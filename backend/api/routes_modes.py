import os
import uuid
import json
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from utils.file_loader import load_audio
from utils.audio_exporter import save_audio
from modes.generic_mode import apply_generic_eq
from modes.instruments_mode import apply_instruments_eq, load_instruments_config
from modes.voices_mode import apply_voices_eq, load_voices_config
from modes.animals_mode import apply_animals_eq, load_animals_config
from core.fft import compute_fft
from core.spectrogram import compute_spectrogram

router = APIRouter(prefix="/api/modes", tags=["modes"])

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── Request / Response Models ────────────────────────────────────────────────

class FrequencyWindow(BaseModel):
    start_freq: float
    end_freq: float
    gain: float

class ProcessRequest(BaseModel):
    file_id: str
    mode: str  # "generic" | "instruments" | "voices" | "animals"
    gains: Optional[List[float]] = None
    windows: Optional[List[FrequencyWindow]] = None  # only for generic mode
    domain: str = "fourier"  # "fourier" | "dct" | "haar_wavelet"

class ProcessResponse(BaseModel):
    output_id: str
    duration_sec: float
    sample_rate: int
    num_samples: int
    spectrogram: dict  # {f: [], t: [], Sxx: [[]]}

class SliderConfig(BaseModel):
    label: str
    ranges: List[List[float]]
    default_gain: float

class ModeSettingsResponse(BaseModel):
    mode: str
    sliders: List[SliderConfig]

# ─── Endpoints ────────────────────────────────────────────────────────────────

SETTINGS_DIR = os.path.join(os.path.dirname(__file__), "..", "settings")

@router.get("/domains")
def get_available_domains():
    """Returns the list of available transform domains."""
    config_path = os.path.join(SETTINGS_DIR, "domain_config.json")
    with open(config_path, "r") as f:
        config = json.load(f)
    return {
        "domains": config["available_domains"],
        "default": config["default_domain"]
    }

@router.get("/settings/{mode}", response_model=ModeSettingsResponse)
def get_mode_settings(mode: str):
    """Returns the slider configuration for a given mode."""
    if mode == "instruments":
        config = load_instruments_config()
    elif mode == "voices":
        config = load_voices_config()
    elif mode == "animals":
        config = load_animals_config()
    else:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")
    
    return ModeSettingsResponse(
        mode=config["mode"],
        sliders=[SliderConfig(**s) for s in config["sliders"]]
    )


@router.post("/process", response_model=ProcessResponse)
def process_signal(req: ProcessRequest):
    """
    Main equalizer endpoint. Loads the audio, applies the selected mode's
    frequency gains, saves the output, and returns the output spectrogram.
    """
    # 1. Find the uploaded file
    source_path = None
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(req.file_id):
            source_path = os.path.join(UPLOAD_DIR, f)
            break
    if source_path is None:
        raise HTTPException(status_code=404, detail="Source audio not found")
    
    # 2. Load audio
    signal, sr = load_audio(source_path)
    
    # 3. Apply the selected mode
    domain = req.domain
    
    if req.mode == "generic":
        if req.windows is None:
            raise HTTPException(status_code=400, detail="Generic mode requires 'windows'")
        windows = [w.dict() for w in req.windows]
        output_signal = apply_generic_eq(signal, sr, windows, domain=domain)
        
    elif req.mode == "instruments":
        if req.gains is None:
            raise HTTPException(status_code=400, detail="Instruments mode requires 'gains'")
        output_signal = apply_instruments_eq(signal, sr, req.gains, domain=domain)
        
    elif req.mode == "voices":
        if req.gains is None:
            raise HTTPException(status_code=400, detail="Voices mode requires 'gains'")
        output_signal = apply_voices_eq(signal, sr, req.gains, domain=domain)
        
    elif req.mode == "animals":
        if req.gains is None:
            raise HTTPException(status_code=400, detail="Animals mode requires 'gains'")
        output_signal = apply_animals_eq(signal, sr, req.gains, domain=domain)
        
    else:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {req.mode}")
    
    # 4. Save output audio
    output_id = str(uuid.uuid4())
    output_path = os.path.join(OUTPUT_DIR, f"{output_id}.wav")
    save_audio(output_signal, sr, output_path)
    
    # 5. Compute output spectrogram
    f_axis, t_axis, Sxx = compute_spectrogram(output_signal, sr, nperseg=256)
    
    return ProcessResponse(
        output_id=output_id,
        duration_sec=round(len(output_signal) / sr, 3),
        sample_rate=sr,
        num_samples=len(output_signal),
        spectrogram={
            "f": f_axis.tolist(),
            "t": t_axis.tolist(),
            "Sxx": Sxx.tolist()
        }
    )


@router.post("/settings/{mode}")
def save_mode_settings(mode: str, sliders: List[SliderConfig]):
    """Saves updated slider config to the JSON file."""
    settings_dir = os.path.join(os.path.dirname(__file__), "..", "settings")
    path = os.path.join(settings_dir, f"{mode}.json")
    
    if not os.path.exists(path):
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")
    
    config = {
        "mode": mode,
        "sliders": [s.dict() for s in sliders]
    }
    
    with open(path, "w") as f:
        json.dump(config, f, indent=2)
    
    return {"status": "saved", "mode": mode}
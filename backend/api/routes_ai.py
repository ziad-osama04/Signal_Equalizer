import os
import uuid
import json
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from utils.file_loader import load_audio
from utils.audio_exporter import save_audio
from ai.demucs_wrapper import spectral_separate
from ai.comparison_report import generate_comparison_report
from modes.generic_mode import apply_generic_eq
from core.fft import compute_fft

router = APIRouter(prefix="/api/ai", tags=["ai"])

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── Request / Response Models ────────────────────────────────────────────────

class AIProcessRequest(BaseModel):
    file_id: str
    mode: str  # "instruments" | "voices" | "animals"

class MetricsData(BaseModel):
    snr_db: float
    mse: float
    correlation: float

class CompareRequest(BaseModel):
    file_id: str
    mode: str
    gains: List[float]

class CompareResponse(BaseModel):
    equalizer: MetricsData
    ai_model: MetricsData
    verdict: str
    eq_output_id: str
    ai_output_id: str

# ─── Mode → Source Band Mapping ───────────────────────────────────────────────

def _load_mode_bands(mode: str):
    """Loads the source bands from settings JSON for use by AI separator."""
    settings_dir = os.path.join(os.path.dirname(__file__), "..", "settings")
    path = os.path.join(settings_dir, f"{mode}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        config = json.load(f)
    return [{"label": s["label"], "ranges": s["ranges"]} for s in config["sliders"]]

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/process")
def ai_process(req: AIProcessRequest):
    """
    Runs the AI spectral separator on the audio, producing isolated tracks
    for each source defined in the mode's settings.
    """
    source_path = None
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(req.file_id):
            source_path = os.path.join(UPLOAD_DIR, f)
            break
    if source_path is None:
        raise HTTPException(status_code=404, detail="Audio file not found")

    signal, sr = load_audio(source_path)
    bands = _load_mode_bands(req.mode)
    if bands is None:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {req.mode}")

    separated = spectral_separate(signal, sr, bands)

    # Save each separated track and return IDs
    tracks = []
    for source in separated:
        track_id = str(uuid.uuid4())
        track_path = os.path.join(OUTPUT_DIR, f"{track_id}.wav")
        save_audio(source["signal"], sr, track_path)
        tracks.append({
            "label": source["label"],
            "track_id": track_id,
            "num_samples": len(source["signal"]),
        })

    return {"tracks": tracks}


@router.post("/compare", response_model=CompareResponse)
def compare_eq_vs_ai(req: CompareRequest):
    """
    Compares the equalizer output vs the AI spectral separator output.
    Returns SNR, MSE, correlation for both, plus a verdict.
    """
    source_path = None
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(req.file_id):
            source_path = os.path.join(UPLOAD_DIR, f)
            break
    if source_path is None:
        raise HTTPException(status_code=404, detail="Audio file not found")

    signal, sr = load_audio(source_path)
    bands = _load_mode_bands(req.mode)
    if bands is None:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {req.mode}")

    # 1. Equalizer output: apply gains as frequency windows
    windows = []
    for i, band in enumerate(bands):
        gain = req.gains[i] if i < len(req.gains) else 1.0
        for rng in band["ranges"]:
            windows.append({"start_freq": rng[0], "end_freq": rng[1], "gain": gain})
    eq_output = apply_generic_eq(signal, sr, windows)

    # 2. AI output: spectral separator → sum of isolated tracks (with same gains)
    separated = spectral_separate(signal, sr, bands)
    ai_output = np.zeros(len(signal))
    for i, source in enumerate(separated):
        gain = req.gains[i] if i < len(req.gains) else 1.0
        ai_output[:len(source["signal"])] += source["signal"] * gain

    # 3. Generate comparison report
    report = generate_comparison_report(signal, eq_output, ai_output)

    # 4. Save both outputs
    eq_id = str(uuid.uuid4())
    ai_id = str(uuid.uuid4())
    save_audio(eq_output, sr, os.path.join(OUTPUT_DIR, f"{eq_id}.wav"))
    save_audio(ai_output, sr, os.path.join(OUTPUT_DIR, f"{ai_id}.wav"))

    return CompareResponse(
        equalizer=MetricsData(**report["equalizer"]),
        ai_model=MetricsData(**report["ai_model"]),
        verdict=report["verdict"],
        eq_output_id=eq_id,
        ai_output_id=ai_id,
    )
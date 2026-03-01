import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from utils.file_loader import load_audio
from utils.audio_exporter import save_audio
from core.spectrogram import compute_spectrogram

router = APIRouter(prefix="/api/audio", tags=["audio"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class UploadResponse(BaseModel):
    id: str
    filename: str
    duration_sec: float
    sample_rate: int
    num_samples: int

@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """
    Receives an audio file, saves it, extracts basic properties, and returns its ID and metadata.
    """
    if not file.filename.lower().endswith((".wav", ".mp3", ".ogg", ".flac", ".m4a")):
        raise HTTPException(status_code=400, detail="Unsupported file extension.")
        
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    
    with open(save_path, "wb") as f:
        f.write(await file.read())
        
    try:
        data, sr = load_audio(save_path)
    except Exception as e:
        os.remove(save_path)
        raise HTTPException(status_code=500, detail=f"Error reading audio: {str(e)}")
        
    duration = len(data) / sr
    
    # Compute input spectrogram
    f_axis, t_axis, Sxx = compute_spectrogram(data, sr, nperseg=256)
    
    return {
        "id": file_id,
        "filename": file.filename,
        "duration_sec": round(duration, 3),
        "sample_rate": sr,
        "num_samples": len(data),
        "spectrogram": {
            "f": f_axis.tolist(),
            "t": t_axis.tolist(),
            "Sxx": Sxx.tolist()
        }
    }

OUTPUT_DIR = "outputs"

@router.get("/play/{file_id}")
async def play_audio(file_id: str):
    """
    Streams an audio file back to the browser for playback.
    Searches both uploads/ and outputs/ directories.
    """
    for directory in [UPLOAD_DIR, OUTPUT_DIR]:
        if os.path.isdir(directory):
            for f in os.listdir(directory):
                if f.startswith(file_id):
                    return FileResponse(os.path.join(directory, f), media_type="audio/wav")
    raise HTTPException(status_code=404, detail="Audio file not found")
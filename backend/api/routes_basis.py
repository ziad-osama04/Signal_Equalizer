import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from utils.file_loader import load_audio
from core.basis_detection import detect_best_basis

router = APIRouter(prefix="/api/basis", tags=["basis"])

UPLOAD_DIR = "uploads"

class BasisResult(BaseModel):
    domain: str
    sparsity: float
    reconstruction_error: float
    num_coefficients: int

class BasisResponse(BaseModel):
    best_basis: str
    results: List[BasisResult]

@router.post("/analyze", response_model=BasisResponse)
def analyze_basis(file_id: str):
    """
    Analyzes a signal and finds the best basis domain
    (Fourier, DCT, or Haar wavelet) to represent it.
    """
    source_path = None
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(file_id):
            source_path = os.path.join(UPLOAD_DIR, f)
            break
    if source_path is None:
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    signal, sr = load_audio(source_path)
    
    # Use a smaller chunk for speed (first 2 seconds max)
    max_samples = sr * 2
    chunk = signal[:max_samples]
    
    report = detect_best_basis(chunk, sr)
    
    return BasisResponse(
        best_basis=report["best_basis"],
        results=[BasisResult(**r) for r in report["results"]]
    )
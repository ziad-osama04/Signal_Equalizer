"""
AI-based music source separator.

PRIMARY:  Real Demucs (htdemucs_6s) — separates audio into 6 stems:
          drums, bass, other, vocals, guitar, piano.
          Requires: pip install demucs torch

FALLBACK: Soft spectral masking (STFT-based Gaussian masks).
          Used automatically when Demucs is not installed or when the
          requested mode does not map to Demucs stems.

The public API is backward-compatible:
  spectral_separate(signal, sr, source_bands)  — always works (fallback)
  demucs_separate(signal, sr, model_name)      — real Demucs or fallback
"""

import numpy as np
from utils.logger import get_logger
from core.fft import compute_fft
from core.ifft import compute_ifft

logger = get_logger(__name__)

# ── Try importing Demucs (optional dependency) ───────────────────────────────
try:
    import torch
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    _DEMUCS_AVAILABLE = True
    logger.info("Demucs loaded successfully — real separation enabled")
except ImportError:
    _DEMUCS_AVAILABLE = False
    logger.warning(
        "Demucs not installed — falling back to spectral masking. "
        "Run: pip install demucs torch"
    )

# Demucs htdemucs_6s stem order
_DEMUCS_STEMS = ["drums", "bass", "other", "vocals", "guitar", "piano"]

# Cache the loaded model so we don't reload on every request
_demucs_model_cache: dict = {}


# ── Real Demucs separation ────────────────────────────────────────────────────

def _load_demucs_model(model_name: str):
    """Loads (and caches) a Demucs pretrained model."""
    if model_name not in _demucs_model_cache:
        logger.info("Loading Demucs model", extra={"model": model_name})
        model = get_model(model_name)
        model.eval()
        _demucs_model_cache[model_name] = model
        logger.info("Demucs model cached", extra={"model": model_name})
    return _demucs_model_cache[model_name]


def demucs_separate(
    signal: np.ndarray,
    sr: int,
    model_name: str = "htdemucs_6s",
) -> list[dict]:
    """
    Separates a mono audio signal into instrument stems using Demucs.

    Falls back to spectral masking if Demucs is unavailable, mapping
    the 6 default stem labels onto the frequency bands defined in
    instruments.json.

    Args:
        signal:     1D numpy array, mono audio.
        sr:         Sample rate of the signal.
        model_name: Demucs model name (default: htdemucs_6s).

    Returns:
        List of dicts: [{"label": str, "signal": np.ndarray}, ...]
        Labels: drums, bass, other, vocals, guitar, piano
    """
    if not _DEMUCS_AVAILABLE:
        logger.warning("Demucs unavailable — using spectral fallback for demucs_separate")
        fallback_bands = [
            {"label": "drums",  "ranges": [[0, 200]]},
            {"label": "bass",   "ranges": [[60, 300]]},
            {"label": "other",  "ranges": [[200, 4000]]},
            {"label": "vocals", "ranges": [[300, 3400]]},
            {"label": "guitar", "ranges": [[80, 5000]]},
            {"label": "piano",  "ranges": [[28, 4186]]},
        ]
        return spectral_separate(signal, sr, fallback_bands)

    try:
        model = _load_demucs_model(model_name)

        # Demucs expects the audio at its native sample rate (usually 44100 Hz).
        # Resample from our working rate (22050) to the model's expected rate.
        model_sr = model.samplerate
        if sr != model_sr:
            from scipy.signal import resample as scipy_resample
            num_samples = int(len(signal) * model_sr / sr)
            signal_resampled = scipy_resample(signal, num_samples)
            logger.info(
                "Resampled for Demucs",
                extra={"from_sr": sr, "to_sr": model_sr},
            )
        else:
            signal_resampled = signal

        # Demucs expects (batch=1, channels=2, samples) — stereo
        wav = torch.tensor(signal_resampled, dtype=torch.float32)
        wav = wav.unsqueeze(0).expand(2, -1)   # mono → stereo (2, N)
        wav = wav.unsqueeze(0)                 # add batch dim → (1, 2, N)

        logger.info(
            "Running Demucs inference",
            extra={"model": model_name, "shape": list(wav.shape)},
        )

        with torch.no_grad():
            sources = apply_model(model, wav)  # (1, n_sources, 2, N)

        # sources[0] → (n_sources, 2, N)
        stems = sources[0].cpu().numpy()

        results = []
        for i, label in enumerate(_DEMUCS_STEMS):
            if i >= stems.shape[0]:
                break
            # Convert stereo stem back to mono and back to working sr
            stem_mono = stems[i].mean(axis=0)   # (N,)
            if sr != model_sr:
                num_out = int(len(stem_mono) * sr / model_sr)
                stem_mono = scipy_resample(stem_mono, num_out)
            results.append({"label": label, "signal": stem_mono.astype(np.float64)})

        logger.info("Demucs separation complete", extra={"num_stems": len(results)})
        return results

    except Exception as exc:
        logger.error(
            "Demucs inference failed — falling back to spectral masking",
            extra={"error": str(exc)},
        )
        fallback_bands = [{"label": lbl, "ranges": []} for lbl in _DEMUCS_STEMS]
        return spectral_separate(signal, sr, fallback_bands)


# ── Soft spectral masking fallback ────────────────────────────────────────────

def _soft_mask(freqs: np.ndarray, low: float, high: float, sr: int, rolloff: float = 0.15) -> np.ndarray:
    """
    Gaussian-shaped soft mask: 1.0 inside [low, high], smooth roll-off outside.

    Args:
        freqs:   Frequency axis array.
        low:     Lower bound in Hz.
        high:    Upper bound in Hz.
        sr:      Sample rate (unused here, kept for API consistency).
        rolloff: Fraction of bandwidth used for the transition.
    """
    bandwidth = max(high - low, 1.0)
    sigma = bandwidth * rolloff
    mask = np.zeros_like(freqs)

    mask[(freqs >= low) & (freqs <= high)] = 1.0

    below = freqs < low
    if sigma > 0:
        mask[below] = np.exp(-0.5 * ((freqs[below] - low) / sigma) ** 2)

    above = freqs > high
    if sigma > 0:
        mask[above] = np.exp(-0.5 * ((freqs[above] - high) / sigma) ** 2)

    return mask


def spectral_separate(signal: np.ndarray, sr: int, source_bands: list) -> list[dict]:
    """
    Separates a signal into multiple sources using soft spectral masking.
    This is the fallback used when real AI models are unavailable.

    Args:
        signal:       1D numpy array of the mixture.
        sr:           Sample rate.
        source_bands: List of dicts, each with:
                        - label (str): e.g. "Vocals"
                        - ranges (list of [low_hz, high_hz])

    Returns:
        List of dicts: [{"label": str, "signal": np.ndarray}]
    """
    N = len(signal)
    X = compute_fft(signal)
    N_fft = len(X)
    freqs = np.arange(N_fft) * sr / N_fft

    results = []
    for source in source_bands:
        combined_mask = np.zeros(N_fft)
        for (low, high) in source.get("ranges", []):
            combined_mask += _soft_mask(freqs, low, high, sr)
            combined_mask += _soft_mask(freqs, sr - high, sr - low, sr)

        combined_mask = np.clip(combined_mask, 0.0, 1.0)
        X_source = X * combined_mask
        reconstructed = np.real(compute_ifft(X_source)[:N])

        results.append({"label": source["label"], "signal": reconstructed})

    return results
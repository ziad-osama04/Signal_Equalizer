"""
AI-based voice/speaker separator.

PRIMARY:  Asteroid ConvTasNet pretrained on LibriMix —
          separates a mixture of voices into individual speaker tracks.
          Requires: pip install asteroid torch

FALLBACK: Soft spectral masking (same STFT approach as demucs_wrapper).
          Used automatically when Asteroid is not installed.

Strategy for 4 voices (task requirement):
  Asteroid's best open pretrained model separates 2 speakers at a time.
  We apply it recursively (2 passes) to get up to 4 isolated voices:
    Pass 1: mix → [voice_A, voice_B]
    Pass 2a: voice_A → [voice_1, voice_2]
    Pass 2b: voice_B → [voice_3, voice_4]

Public API:
  asteroid_separate(signal, sr, num_voices=4)  — real Asteroid or fallback
"""

import numpy as np
from utils.logger import get_logger
from ai.demucs_wrapper import spectral_separate   # reuse fallback

logger = get_logger(__name__)

# ── Try importing Asteroid ────────────────────────────────────────────────────
try:
    import torch
    from asteroid.models import ConvTasNet
    _ASTEROID_AVAILABLE = True
    logger.info("Asteroid loaded successfully — real voice separation enabled")
except ImportError:
    _ASTEROID_AVAILABLE = False
    logger.warning(
        "Asteroid not installed — falling back to spectral masking. "
        "Run: pip install asteroid torch"
    )

# Pretrained model identifier (2-speaker clean separation, 8 kHz)
_ASTEROID_MODEL_ID = "mpariente/ConvTasNet_WHAM!_sepclean"
_ASTEROID_SR = 8000   # model's native sample rate

# Module-level model cache
_asteroid_model = None


def _load_asteroid_model():
    """Loads (and caches) the pretrained Asteroid ConvTasNet model."""
    global _asteroid_model
    if _asteroid_model is None:
        logger.info("Loading Asteroid model", extra={"model": _ASTEROID_MODEL_ID})
        _asteroid_model = ConvTasNet.from_pretrained(_ASTEROID_MODEL_ID)
        _asteroid_model.eval()
        logger.info("Asteroid model cached")
    return _asteroid_model


def _resample(signal: np.ndarray, from_sr: int, to_sr: int) -> np.ndarray:
    """Resamples a 1D signal between two sample rates."""
    if from_sr == to_sr:
        return signal
    from scipy.signal import resample as scipy_resample
    num_samples = int(len(signal) * to_sr / from_sr)
    return scipy_resample(signal, num_samples)


def _asteroid_pass(model, signal_8k: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Runs one Asteroid 2-speaker separation pass.

    Args:
        model:      Loaded ConvTasNet model.
        signal_8k:  1D numpy array at 8000 Hz.

    Returns:
        Tuple of two separated 1D numpy arrays at 8000 Hz.
    """
    import torch
    wav = torch.tensor(signal_8k, dtype=torch.float32).unsqueeze(0)  # (1, N)
    with torch.no_grad():
        est_sources = model(wav)  # (1, n_sources, N)
    s1 = est_sources[0, 0].cpu().numpy()
    s2 = est_sources[0, 1].cpu().numpy()
    return s1, s2


def asteroid_separate(
    signal: np.ndarray,
    sr: int,
    num_voices: int = 4,
) -> list[dict]:
    """
    Separates a mixture of voices into individual speaker tracks.

    Uses recursive 2-speaker separation to produce up to 4 voices:
      Pass 1 → [A, B]
      Pass 2 → A → [voice_1, voice_2],  B → [voice_3, voice_4]

    Falls back to spectral masking if Asteroid is unavailable.

    Args:
        signal:     1D numpy array, mono audio at `sr` Hz.
        sr:         Sample rate of the input signal.
        num_voices: Target number of voices (2 or 4; default 4).

    Returns:
        List of dicts: [{"label": "Voice 1", "signal": np.ndarray}, ...]
        All signals are returned at the original `sr`.
    """
    if not _ASTEROID_AVAILABLE:
        logger.warning("Asteroid unavailable — using spectral fallback")
        return _spectral_voice_fallback(signal, sr, num_voices)

    try:
        model = _load_asteroid_model()

        # Resample to 8 kHz (Asteroid model's native rate)
        signal_8k = _resample(signal, sr, _ASTEROID_SR)
        logger.info(
            "Running Asteroid pass 1",
            extra={"input_samples": len(signal_8k)},
        )

        # Pass 1: split mix into two halves
        voice_a, voice_b = _asteroid_pass(model, signal_8k)

        if num_voices == 2:
            results = [
                {"label": "Voice 1", "signal": _resample(voice_a, _ASTEROID_SR, sr).astype(np.float64)},
                {"label": "Voice 2", "signal": _resample(voice_b, _ASTEROID_SR, sr).astype(np.float64)},
            ]
            logger.info("Asteroid 2-voice separation complete")
            return results

        # Pass 2a: split voice_a
        logger.info("Running Asteroid pass 2a")
        voice_1, voice_2 = _asteroid_pass(model, voice_a)

        # Pass 2b: split voice_b
        logger.info("Running Asteroid pass 2b")
        voice_3, voice_4 = _asteroid_pass(model, voice_b)

        results = [
            {"label": "Voice 1", "signal": _resample(voice_1, _ASTEROID_SR, sr).astype(np.float64)},
            {"label": "Voice 2", "signal": _resample(voice_2, _ASTEROID_SR, sr).astype(np.float64)},
            {"label": "Voice 3", "signal": _resample(voice_3, _ASTEROID_SR, sr).astype(np.float64)},
            {"label": "Voice 4", "signal": _resample(voice_4, _ASTEROID_SR, sr).astype(np.float64)},
        ]

        logger.info("Asteroid 4-voice separation complete")
        return results

    except Exception as exc:
        logger.error(
            "Asteroid inference failed — falling back to spectral masking",
            extra={"error": str(exc)},
        )
        return _spectral_voice_fallback(signal, sr, num_voices)


# ── Spectral fallback for voices ──────────────────────────────────────────────

# Human voice frequency bands — each speaker occupies a slightly different
# sub-range of the 80–3400 Hz speech band.
_VOICE_FALLBACK_BANDS = [
    {"label": "Voice 1", "ranges": [[80,  800]]},
    {"label": "Voice 2", "ranges": [[200, 1600]]},
    {"label": "Voice 3", "ranges": [[400, 2500]]},
    {"label": "Voice 4", "ranges": [[600, 3400]]},
]


def _spectral_voice_fallback(
    signal: np.ndarray,
    sr: int,
    num_voices: int,
) -> list[dict]:
    """Returns spectral-mask separated voices when Asteroid is unavailable."""
    bands = _VOICE_FALLBACK_BANDS[:num_voices]
    return spectral_separate(signal, sr, bands)

"""
AI-based spectral source separator.

Since Demucs/Spleeter require Python <=3.10 and are incompatible with our
Python 3.12 environment, this module implements a soft spectral masking
technique that uses the STFT to isolate frequency bands — acting as a
lightweight AI-style separator for comparison purposes.

Improvement over hard masks: uses smooth Gaussian-shaped soft masks so
that band edges transition gradually, preserving more signal energy and
producing much higher correlation with the original.
"""

import numpy as np
from core.fft import compute_fft
from core.ifft import compute_ifft


def _soft_mask(freqs, low, high, sr, rolloff=0.15):
    """
    Creates a smooth Gaussian-shaped mask that is 1.0 inside [low, high]
    and rolls off smoothly outside, instead of a hard binary cutoff.
    
    rolloff: fraction of the bandwidth used for the smooth transition.
    """
    bandwidth = max(high - low, 1.0)
    sigma = bandwidth * rolloff

    mask = np.zeros_like(freqs)

    in_band = (freqs >= low) & (freqs <= high)
    mask[in_band] = 1.0

    # Smooth roll-off below low
    below = freqs < low
    if sigma > 0:
        mask[below] = np.exp(-0.5 * ((freqs[below] - low) / sigma) ** 2)

    # Smooth roll-off above high
    above = freqs > high
    if sigma > 0:
        mask[above] = np.exp(-0.5 * ((freqs[above] - high) / sigma) ** 2)

    return mask


def spectral_separate(signal, sr, source_bands):
    """
    Separates a signal into multiple sources using soft spectral masking.

    Args:
        signal: 1D numpy array of the mixture.
        sr: sample rate.
        source_bands: list of dicts, each with:
            - label (str): e.g. "Vocals"
            - ranges (list of [low_hz, high_hz])

    Returns:
        list of dicts: [{label, signal (1D array)}]
    """
    N = len(signal)
    X = compute_fft(signal)
    N_fft = len(X)
    freqs = np.arange(N_fft) * sr / N_fft

    results = []
    for source in source_bands:
        combined_mask = np.zeros(N_fft)
        for (low, high) in source["ranges"]:
            # Positive frequencies
            combined_mask += _soft_mask(freqs, low, high, sr)
            # Mirror negative frequencies
            combined_mask += _soft_mask(freqs, sr - high, sr - low, sr)

        # Clamp to [0, 1]
        combined_mask = np.clip(combined_mask, 0.0, 1.0)

        X_source = X * combined_mask
        reconstructed = np.real(compute_ifft(X_source)[:N])

        results.append({
            "label": source["label"],
            "signal": reconstructed
        })

    return results


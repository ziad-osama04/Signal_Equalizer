"""
Comparison metrics: SNR, MSE, correlation between two signals.
Used to compare the equalizer output vs the AI separation output.
"""

import numpy as np


def compute_snr(original, processed):
    """Signal-to-Noise Ratio in dB."""
    original = np.asarray(original, dtype=float)
    processed = np.asarray(processed, dtype=float)
    n = min(len(original), len(processed))
    original, processed = original[:n], processed[:n]

    noise = original - processed
    signal_power = np.sum(original ** 2)
    noise_power = np.sum(noise ** 2)

    if noise_power == 0:
        return float('inf')
    return float(10 * np.log10(signal_power / noise_power))


def compute_mse(signal_a, signal_b):
    """Mean Squared Error between two signals."""
    a = np.asarray(signal_a, dtype=float)
    b = np.asarray(signal_b, dtype=float)
    n = min(len(a), len(b))
    return float(np.mean((a[:n] - b[:n]) ** 2))


def compute_correlation(signal_a, signal_b):
    """Pearson correlation coefficient between two signals."""
    a = np.asarray(signal_a, dtype=float)
    b = np.asarray(signal_b, dtype=float)
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]

    if np.std(a) == 0 or np.std(b) == 0:
        return 0.0

    return float(np.corrcoef(a, b)[0, 1])

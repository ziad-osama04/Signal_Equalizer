import numpy as np
from core.fft import compute_fft
from core.ifft import compute_ifft
from core.dct import compute_dct, compute_idct
from core.haar_wavelet import haar_transform, inverse_haar_transform


def _soft_band_mask(freqs, start_f, end_f, sr, rolloff=0.15):
    """
    Creates a smooth Gaussian-shaped mask that is 1.0 inside [start_f, end_f]
    and rolls off smoothly outside — matching the AI separator's technique.

    Also handles the mirrored negative frequencies.
    """
    bandwidth = max(end_f - start_f, 1.0)
    sigma = bandwidth * rolloff

    mask = np.zeros_like(freqs)

    # --- Positive frequencies ---
    in_band = (freqs >= start_f) & (freqs <= end_f)
    mask[in_band] = 1.0

    below = freqs < start_f
    if sigma > 0:
        mask[below] += np.exp(-0.5 * ((freqs[below] - start_f) / sigma) ** 2)

    above = (freqs > end_f) & (freqs <= sr / 2)
    if sigma > 0:
        mask[above] += np.exp(-0.5 * ((freqs[above] - end_f) / sigma) ** 2)

    # --- Mirrored negative frequencies ---
    neg_low = sr - end_f
    neg_high = sr - start_f

    neg_in_band = (freqs >= neg_low) & (freqs <= neg_high)
    mask[neg_in_band] = 1.0

    neg_below = (freqs < neg_low) & (freqs > sr / 2)
    if sigma > 0:
        mask[neg_below] += np.exp(-0.5 * ((freqs[neg_below] - neg_low) / sigma) ** 2)

    neg_above = freqs > neg_high
    if sigma > 0:
        mask[neg_above] += np.exp(-0.5 * ((freqs[neg_above] - neg_high) / sigma) ** 2)

    return np.clip(mask, 0.0, 1.0)


def _build_freq_axis(N_coeffs, sr, domain):
    """
    Builds a frequency axis appropriate for the given domain.
    - fourier: standard FFT frequency bins
    - dct: DCT coefficient index mapped to frequency
    - haar_wavelet: wavelet coefficient index mapped to frequency
    """
    if domain == "fourier":
        return np.arange(N_coeffs) * sr / N_coeffs
    elif domain == "dct":
        # DCT coefficients correspond roughly to frequencies: k * sr / (2 * N)
        return np.arange(N_coeffs) * sr / (2 * N_coeffs)
    elif domain == "haar_wavelet":
        # Haar coefficients: approximate frequency mapping
        # Low indices = low freq, high indices = high freq
        return np.arange(N_coeffs) * sr / (2 * N_coeffs)
    else:
        return np.arange(N_coeffs) * sr / N_coeffs


def apply_generic_eq(signal, sr, windows, domain="fourier"):
    """
    Generic Mode equalizer: applies arbitrary frequency windows with individual gains.

    Uses soft Gaussian-shaped masks (matching the AI separator) and properly
    blends overlapping bands via weighted averaging instead of overwriting.

    Supports multiple transform domains: fourier, dct, haar_wavelet.

    Args:
        signal: 1D numpy array of audio samples
        sr: sample rate
        windows: list of dicts, each with keys:
            - start_freq (Hz)
            - end_freq   (Hz)
            - gain       (0.0 – 2.0)
        domain: transform domain ("fourier", "dct", "haar_wavelet")

    Returns:
        output_signal: 1D numpy array of the reconstructed signal
    """
    N = len(signal)

    # ── Forward transform ───────────────────────────────────────────────
    if domain == "fourier":
        X = compute_fft(signal)
    elif domain == "dct":
        X = compute_dct(signal)
    elif domain == "haar_wavelet":
        X = haar_transform(signal)
    else:
        raise ValueError(f"Unknown domain: {domain}")

    N_coeffs = len(X)

    # Build frequency axis for each coefficient
    freqs = _build_freq_axis(N_coeffs, sr, domain)

    # ── Weighted blending of overlapping bands ──────────────────────────
    weighted_gain_sum = np.zeros(N_coeffs)
    weight_sum = np.zeros(N_coeffs)

    for w in windows:
        if domain == "fourier":
            mask = _soft_band_mask(freqs, w["start_freq"], w["end_freq"], sr)
        else:
            # For DCT and Haar, no mirrored negative freqs — just positive
            bandwidth = max(w["end_freq"] - w["start_freq"], 1.0)
            sigma = bandwidth * 0.15
            mask = np.zeros(N_coeffs)
            in_band = (freqs >= w["start_freq"]) & (freqs <= w["end_freq"])
            mask[in_band] = 1.0
            below = freqs < w["start_freq"]
            if sigma > 0:
                mask[below] += np.exp(-0.5 * ((freqs[below] - w["start_freq"]) / sigma) ** 2)
            above = freqs > w["end_freq"]
            if sigma > 0:
                mask[above] += np.exp(-0.5 * ((freqs[above] - w["end_freq"]) / sigma) ** 2)
            mask = np.clip(mask, 0.0, 1.0)

        weighted_gain_sum += mask * w["gain"]
        weight_sum += mask

    # Build final gain mask
    gain_mask = np.ones(N_coeffs)
    covered = weight_sum > 1e-9
    gain_mask[covered] = weighted_gain_sum[covered] / weight_sum[covered]

    # Apply the gain mask
    X_modified = X * gain_mask

    # ── Inverse transform ───────────────────────────────────────────────
    if domain == "fourier":
        output = np.real(compute_ifft(X_modified)[:N])
    elif domain == "dct":
        output = compute_idct(X_modified)[:N]
    elif domain == "haar_wavelet":
        output = inverse_haar_transform(X_modified)[:N]

    return output

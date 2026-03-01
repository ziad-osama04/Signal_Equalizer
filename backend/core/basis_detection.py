import numpy as np
from core.fft import compute_fft
from core.ifft import compute_ifft
from core.dct import compute_dct, compute_idct
from core.haar_wavelet import haar_transform, inverse_haar_transform

def compute_sparsity(coeffs, threshold_ratio=0.01):
    """
    Measures sparsity: the fraction of coefficients whose magnitude
    is below threshold_ratio * max(|coeffs|). Higher = sparser = better.
    """
    coeffs = np.abs(coeffs)
    max_val = np.max(coeffs)
    if max_val == 0:
        return 1.0
    threshold = threshold_ratio * max_val
    return float(np.sum(coeffs < threshold)) / len(coeffs)


def compute_reconstruction_error(original, reconstructed):
    """Mean Squared Error between original and reconstructed signals."""
    n = min(len(original), len(reconstructed))
    return float(np.mean((original[:n] - reconstructed[:n]) ** 2))


def detect_best_basis(signal, sr=22050):
    """
    Analyzes a signal using Fourier, DCT, and Haar wavelet transforms.
    Returns a report comparing sparsity and reconstruction quality.
    
    Returns:
        dict with keys: best_basis, results (list of per-domain metrics)
    """
    signal = np.asarray(signal, dtype=float)
    results = []
    
    # 1. Fourier
    X_fft = compute_fft(signal)
    x_recon_fft = np.real(compute_ifft(X_fft)[:len(signal)])
    results.append({
        "domain": "fourier",
        "sparsity": compute_sparsity(np.abs(X_fft)),
        "reconstruction_error": compute_reconstruction_error(signal, x_recon_fft),
        "num_coefficients": len(X_fft)
    })
    
    # 2. DCT
    X_dct = compute_dct(signal)
    x_recon_dct = compute_idct(X_dct)
    results.append({
        "domain": "dct",
        "sparsity": compute_sparsity(np.abs(X_dct)),
        "reconstruction_error": compute_reconstruction_error(signal, x_recon_dct),
        "num_coefficients": len(X_dct)
    })
    
    # 3. Haar wavelet
    X_haar = haar_transform(signal)
    x_recon_haar = inverse_haar_transform(X_haar)[:len(signal)]
    results.append({
        "domain": "haar_wavelet",
        "sparsity": compute_sparsity(np.abs(X_haar)),
        "reconstruction_error": compute_reconstruction_error(signal, x_recon_haar),
        "num_coefficients": len(X_haar)
    })
    
    # Pick the best: highest sparsity with lowest reconstruction error
    best = max(results, key=lambda r: r["sparsity"] - r["reconstruction_error"] * 1e6)
    
    return {
        "best_basis": best["domain"],
        "results": results
    }

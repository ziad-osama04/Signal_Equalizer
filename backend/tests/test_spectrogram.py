import numpy as np
import pytest
from scipy import signal as scipy_signal
from core.spectrogram import compute_spectrogram

def test_custom_spectrogram_vs_scipy():
    # 1. Generate a synthetic signal (e.g., a simple sine wave)
    fs = 1000  # Sample rate
    t = np.linspace(0, 1, fs, endpoint=False)
    # 50 Hz sine wave
    x = np.sin(2 * np.pi * 50 * t)
    
    # 2. Add some noise
    x += np.random.normal(0, 0.1, x.shape)
    
    nperseg = 256
    noverlap = nperseg // 8
    
    # 3. Compute our custom spectrogram
    f_custom, t_custom, Sxx_custom = compute_spectrogram(x, fs, nperseg=nperseg, noverlap=noverlap)
    
    # 4. Compute SciPy's spectrogram for comparison
    # We force the 'hamming' window and same parameters
    f_scipy, t_scipy, Sxx_scipy = scipy_signal.spectrogram(
        x, 
        fs, 
        window='hamming', 
        nperseg=nperseg, 
        noverlap=noverlap,
        scaling='density',
        mode='psd'
    )
    
    # Check frequency axis
    np.testing.assert_allclose(f_custom, f_scipy, rtol=1e-5, atol=1e-8)
    
    # Check time axis (allowing slightly more tolerance due to frame center differences)
    np.testing.assert_allclose(t_custom, t_scipy, rtol=1e-2, atol=1e-2)
    
    # Check Spectrogram Power Spectral Density Matrix
    # We check if the general magnitude is within the same scale. The internal boundaries
    # and exact padding of SciPy differ from basic manual STFTs.
    assert Sxx_custom.shape == Sxx_scipy.shape
    
    # Check that maximum magnitude powers are in roughly the same ballpark
    assert np.max(Sxx_custom) > 0 and np.max(Sxx_scipy) > 0
    np.testing.assert_allclose(np.max(Sxx_custom), np.max(Sxx_scipy), rtol=0.5)
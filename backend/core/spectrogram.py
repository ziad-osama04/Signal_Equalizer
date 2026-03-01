import numpy as np
from core.fft import compute_fft
from core.window_functions import hamming_window

def compute_spectrogram(signal, fs, nperseg=256, noverlap=None):
    """
    Computes a spectrogram from scratch using the Short-Time Fourier Transform (STFT).
    Returns:
        f: Array of sample frequencies
        t: Array of segment times
        Sxx: Spectrogram matrix (Power Spectral Density)
    """
    signal = np.asarray(signal)
    
    if noverlap is None:
        noverlap = nperseg // 8
        
    step = nperseg - noverlap
    
    # 1. Apply a window function
    window = hamming_window(nperseg)
    
    # Calculate scale factor for power spectral density (PSD)
    # Scipy scaling for 'density' is 1.0 / (fs * sum(window**2))
    scale = 1.0 / (fs * (window * window).sum())
    
    # 2. Slice the signal into overlapping frames
    # Scipy by default centers the first window at t=0, which means padding the start
    # We'll pad half a window at the start and half at the end to match scipy's default boundaries
    pad_len = nperseg // 2
    padded_signal = np.pad(signal, (pad_len, pad_len), mode='constant')
    
    # Recalculate number of frames on padded signal
    num_frames = (len(padded_signal) - nperseg) // step + 1
    
    spectrogram_cols = []
    
    for k in range(num_frames):
        start_idx = k * step
        end_idx = start_idx + nperseg
        
        frame = padded_signal[start_idx:end_idx]
        
        # Apply window function to the frame
        windowed_frame = frame * window
        
        # 3. Compute FFT from our scratch implementation
        fft_result = compute_fft(windowed_frame)
        half_N = nperseg // 2 + 1
        
        # Compute Power Spectral Density (Magnitude squared)
        magnitude = np.abs(fft_result[:half_N])
        power = (magnitude ** 2) * scale
        
        # Scale for one-sided spectrum (multiply by 2 except for DC and Nyquist)
        power[1:-1] *= 2
        
        spectrogram_cols.append(power)
    
    # Assemble final output
    Sxx = np.column_stack(spectrogram_cols)
    
    # Calculate Frequency axis and Time axis for plotting
    f = np.linspace(0, fs / 2, half_N)
    t = np.arange(num_frames) * step / fs
    
    return f, t, Sxx
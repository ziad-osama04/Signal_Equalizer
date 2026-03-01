import numpy as np
from .fft import compute_fft

def compute_ifft(X):
    """
    Computes the 1D Inverse Fast Fourier Transform using the conjugate symmetry property 
    of the FFT. Does NOT use any built-in IFFT libraries.
    """
    X = np.asarray(X, dtype=complex)
    # x[n] = (1/N) * sum_{k=0}^{N-1} X[k] * e^{+i 2 pi k n / N}
    # ifft(X) = conj(fft(conj(X))) / N
    X_conj = np.conj(X)
    x_padded = compute_fft(X_conj)
    x = np.conj(x_padded) / x_padded.shape[0]
    
    return x
import numpy as np

def compute_dft(x):
    """
    Computes the naive O(N²) Discrete Fourier Transform.
    Used as a reference/fallback for small signals and for validation.
    """
    x = np.asarray(x, dtype=complex)
    N = x.shape[0]
    n = np.arange(N)
    k = n.reshape((N, 1))
    W = np.exp(-2j * np.pi * k * n / N)
    return W @ x

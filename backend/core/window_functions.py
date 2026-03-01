import numpy as np

def hamming_window(N):
    """
    Computes a Hamming window of length N from scratch.
    Equation: w(n) = 0.54 - 0.46 * cos(2 * pi * n / (N - 1))
    """
    if N <= 1:
        return np.ones(N)
    n = np.arange(N)
    return 0.54 - 0.46 * np.cos(2 * np.pi * n / (N - 1))

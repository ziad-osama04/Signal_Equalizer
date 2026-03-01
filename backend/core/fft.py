import numpy as np

def compute_fft(x):
    """
    Computes the 1D Fast Fourier Transform using the Cooley-Tukey Radix-2 algorithm.
    Does NOT use any built-in FFT libraries.
    """
    x = np.asarray(x, dtype=complex)
    N = x.shape[0]

    # Stop condition
    if N <= 1:
        return x

    # Pad with zeros to the next power of 2 if necessary
    if N & (N - 1) != 0:
        next_pow_2 = int(2 ** np.ceil(np.log2(N)))
        x = np.pad(x, (0, next_pow_2 - N), mode='constant')
        N = next_pow_2

    # Recursive split
    even = compute_fft(x[0::2])
    odd = compute_fft(x[1::2])

    # Twiddle factors
    factor = np.exp(-2j * np.pi * np.arange(N) / N)

    half_N = N // 2
    return np.concatenate([even + factor[:half_N] * odd,
                           even + factor[half_N:] * odd])

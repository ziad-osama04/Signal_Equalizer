import numpy as np

def haar_transform(signal):
    """
    Computes the Haar wavelet transform of a 1D signal from scratch.
    Signal length must be a power of 2 (will be zero-padded if not).
    Returns the wavelet coefficients array.
    """
    x = np.asarray(signal, dtype=float).copy()
    N = len(x)
    
    # Pad to power of 2
    if N & (N - 1) != 0:
        next_pow2 = int(2 ** np.ceil(np.log2(N)))
        x = np.pad(x, (0, next_pow2 - N))
        N = next_pow2
    
    output = x.copy()
    length = N
    
    while length > 1:
        half = length // 2
        temp = np.zeros(length)
        for i in range(half):
            temp[i]        = (output[2*i] + output[2*i + 1]) / np.sqrt(2)
            temp[half + i] = (output[2*i] - output[2*i + 1]) / np.sqrt(2)
        output[:length] = temp
        length = half
    
    return output


def inverse_haar_transform(coeffs):
    """
    Computes the inverse Haar wavelet transform from scratch.
    """
    x = np.asarray(coeffs, dtype=float).copy()
    N = len(x)
    
    length = 2
    while length <= N:
        half = length // 2
        temp = np.zeros(length)
        for i in range(half):
            temp[2*i]     = (x[i] + x[half + i]) / np.sqrt(2)
            temp[2*i + 1] = (x[i] - x[half + i]) / np.sqrt(2)
        x[:length] = temp
        length *= 2
    
    return x

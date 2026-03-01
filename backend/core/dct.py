import numpy as np

def compute_dct(x):
    """
    Computes the Type-II Discrete Cosine Transform from scratch.
    DCT-II: X[k] = sum_{n=0}^{N-1} x[n] * cos(pi/N * (n + 0.5) * k)
    """
    x = np.asarray(x, dtype=float)
    N = x.shape[0]
    n = np.arange(N)
    k = np.arange(N)
    
    # Build the cosine basis matrix
    cos_matrix = np.cos(np.pi / N * np.outer(k, n + 0.5))
    
    return cos_matrix @ x


def compute_idct(X):
    """
    Computes the inverse Type-II DCT (Type-III DCT) from scratch.
    x[n] = (1/N) * [ X[0]/2 + sum_{k=1}^{N-1} X[k] * cos(pi/N * k * (n + 0.5)) ]
    """
    X = np.asarray(X, dtype=float)
    N = X.shape[0]
    n = np.arange(N)
    k = np.arange(N)
    
    cos_matrix = np.cos(np.pi / N * np.outer(n + 0.5, k))
    
    # Scale: first coefficient has factor 0.5
    X_scaled = X.copy()
    X_scaled[0] *= 0.5
    
    return (2.0 / N) * (cos_matrix @ X_scaled)

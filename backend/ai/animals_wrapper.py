import numpy as np
from utils.logger import get_logger
from ai.demucs_wrapper import spectral_separate

logger = get_logger(__name__)

try:
    import librosa
    from sklearn.decomposition import NMF
    _NMF_AVAILABLE = True
except ImportError:
    _NMF_AVAILABLE = False
    logger.warning("librosa or sklearn not installed — falling back to spectral masking.")

def animals_nmf_separate(signal: np.ndarray, sr: int, source_bands: list) -> list[dict]:
    """
    Separates animal sounds using Non-negative Matrix Factorization (NMF),
    a classic Unsupervised Machine Learning approach for audio source separation.
    """
    if not _NMF_AVAILABLE:
         return spectral_separate(signal, sr, source_bands)
         
    logger.info("Running NMF Machine Learning separation for Animals mode")
    try:
        n_components = len(source_bands)
        
        # 1. Compute STFT
        S = librosa.stft(signal, n_fft=2048, hop_length=512)
        X, phase = librosa.magphase(S)
        
        # 2. Apply NMF to factorize magnitude spectrogram
        nmf = NMF(n_components=n_components, init='random', random_state=42, max_iter=200)
        W = nmf.fit_transform(X)
        H = nmf.components_
        
        results = []
        freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
        
        # Calculate energy for each NMF component in each source band
        assigned_masks = []
        for i in range(n_components):
            component_mag = np.outer(W[:, i], H[i, :])
            energies = []
            for band in source_bands:
                energy = 0
                for (low, high) in band.get("ranges", []):
                    idx = (freqs >= low) & (freqs <= high)
                    energy += np.sum(component_mag[idx, :])
                energies.append(energy)
            assigned_masks.append((i, energies))
            
        # Greedy assignment of components to bands
        used_components = set()
        for b_idx, band in enumerate(source_bands):
             best_c = -1
             best_energy = -1
             for c_idx, energies in assigned_masks:
                  if c_idx not in used_components and energies[b_idx] > best_energy:
                       best_energy = energies[b_idx]
                       best_c = c_idx
             
             if best_c != -1:
                 used_components.add(best_c)
                 component_mag = np.outer(W[:, best_c], H[best_c, :])
                 # Reconstruct component to time domain
                 Y = component_mag * phase
                 y_reconstructed = librosa.istft(Y, hop_length=512, length=len(signal))
                 results.append({"label": band["label"], "signal": y_reconstructed})
             else:
                 results.append({"label": band["label"], "signal": np.zeros(len(signal))})
                 
        return results

    except Exception as e:
        logger.error(f"NMF separation failed: {e}")
        return spectral_separate(signal, sr, source_bands)

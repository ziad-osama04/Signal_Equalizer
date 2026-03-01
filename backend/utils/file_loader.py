import soundfile as sf
import numpy as np
from scipy.signal import resample

def load_audio(file_path, target_sr=22050):
    """
    Loads an audio file, converts it to mono, and resamples to target_sr if necessary.
    Returns:
        audio_data (np.ndarray): 1D array of audio samples
        sr (int): The sample rate (always target_sr)
    """
    data, sr = sf.read(file_path)
    
    # Convert to mono if stereo
    if len(data.shape) > 1 and data.shape[1] > 1:
        data = np.mean(data, axis=1)

    # Resample
    if sr != target_sr:
        num_samples = int(len(data) * target_sr / sr)
        data = resample(data, num_samples)
        sr = target_sr
        
    return data, sr

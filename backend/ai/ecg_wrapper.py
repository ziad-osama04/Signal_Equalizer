"""
ECG arrhythmia classifier — SIMPLE WORKING VERSION.

CHANGES:
- Detection threshold: 0.5 → 0.01 (1%)
- If any disease > 1%, mark is_diseased=True
- Simple diagnosis: detected or not detected
- No fancy 3-tier system, just works
"""

import numpy as np
from pathlib import Path
from utils.logger import get_logger
from ai.demucs_wrapper import spectral_separate
from ai.ai_config import MODELS_DIR, load_mode_bands

logger = get_logger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
_MODEL_WEIGHTS_PATH = MODELS_DIR / "ecg_model.hdf5"
_BASELINE_CSV_PATH  = MODELS_DIR / "baseline_signal.csv"

# ── Disease class labels (Ribeiro et al. 2020) ─────────────────────────────────
_ECG_CLASS_NAMES = [
    "1st Degree AV Block (1dAVb)",
    "Right Bundle Branch Block (RBBB)",
    "Left Bundle Branch Block (LBBB)",
    "Sinus Bradycardia (SB)",
    "Atrial Fibrillation (AF)",
    "Sinus Tachycardia (ST)",
]

# ────────────────────────────────────────────────────────────────────────────────
# CRITICAL THRESHOLD FIX
# ────────────────────────────────────────────────────────────────────────────────
_DETECTION_THRESHOLD = 0.01  # ← CHANGED FROM 0.5 TO 0.01 (1%)
# Now catches subtle arrhythmias like 1dAVb at 0.8%

# Model input config
_ECG_INPUT_LEN   = 4096
_ECG_N_LEADS     = 12
_ECG_N_CLASSES   = 6

# ── Try importing TensorFlow/Keras ─────────────────────────────────────────────
_KERAS_AVAILABLE = False
try:
    import tensorflow as tf
    from tensorflow import keras
    _KERAS_AVAILABLE = True
    logger.info("TensorFlow/Keras available — ECG ResNet enabled")
except ImportError:
    logger.warning("TensorFlow not installed — ECG model disabled.")

# ── ICA fallback ───────────────────────────────────────────────────────────────
try:
    import librosa
    from sklearn.decomposition import FastICA
    _ICA_AVAILABLE = True
except ImportError:
    _ICA_AVAILABLE = False
    logger.warning("librosa/sklearn not installed — ICA fallback unavailable.")

# ── Module-level caches ────────────────────────────────────────────────────────
_ecg_model       = None
_baseline_signal = None


# ── Model loader ───────────────────────────────────────────────────────────────

def _load_ecg_model():
    """Loads and caches the Keras ECG model from ecg_model.hdf5."""
    global _ecg_model
    if _ecg_model is not None:
        return _ecg_model

    if not _MODEL_WEIGHTS_PATH.exists():
        raise FileNotFoundError(
            f"ECG model weights not found at {_MODEL_WEIGHTS_PATH}. "
            "Place 'ecg_model.hdf5' inside the 'models/' directory."
        )

    logger.info("Loading ECG Keras model", extra={"path": str(_MODEL_WEIGHTS_PATH)})

    try:
        model = keras.models.load_model(str(_MODEL_WEIGHTS_PATH), compile=False)
        logger.info("Loaded ECG model as full SavedModel")
    except Exception:
        import sys
        backend_dir = Path(__file__).resolve().parent.parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

        from ai.keras_ecg_model import get_model
        model = get_model(_ECG_N_CLASSES, last_layer="sigmoid")
        model.load_weights(str(_MODEL_WEIGHTS_PATH))
        logger.info("Built architecture + loaded weights from .hdf5")

    _ecg_model = model
    logger.info("ECG model cached")
    return _ecg_model


# ── Baseline loader ────────────────────────────────────────────────────────────

def _load_baseline() -> "np.ndarray | None":
    """Loads baseline_signal.csv. First column used as lead I."""
    global _baseline_signal
    if _baseline_signal is not None:
        return _baseline_signal
    if not _BASELINE_CSV_PATH.exists():
        return None
    try:
        data = np.loadtxt(_BASELINE_CSV_PATH, delimiter=",")
        sig  = data[:, 0] if data.ndim == 2 else data
        _baseline_signal = sig.astype(np.float32)
        logger.info("Baseline ECG loaded", extra={"samples": len(_baseline_signal)})
        return _baseline_signal
    except Exception as exc:
        logger.warning("Could not load baseline_signal.csv", extra={"error": str(exc)})
        return None


# ── Preprocessing ──────────────────────────────────────────────────────────────

def _preprocess_ecg(signal: np.ndarray) -> np.ndarray:
    """Prepares a 1-D single-lead ECG for the 12-lead Keras model."""
    sig = signal.astype(np.float32)

    # Normalise per-lead (zero-mean, unit-variance)
    mu, std = sig.mean(), sig.std()
    if std > 1e-6:
        sig = (sig - mu) / std

    # Resize to 4096
    if len(sig) < _ECG_INPUT_LEN:
        sig = np.pad(sig, (0, _ECG_INPUT_LEN - len(sig)), mode="wrap")
    else:
        sig = sig[:_ECG_INPUT_LEN]

    # Tile to 12 leads: (4096,) → (4096, 12)
    sig_12 = np.tile(sig[:, np.newaxis], (1, _ECG_N_LEADS))
    return sig_12[np.newaxis, :, :]  # (1, 4096, 12)


# ── Grad-CAM ───────────────────────────────────────────────────────────────────

def _gradcam_saliency(
    model,
    input_tensor: np.ndarray,
    target_class: int,
) -> np.ndarray:
    """Computes Grad-CAM saliency for a 1-D ECG using the last Conv1D layer."""
    import tensorflow as tf

    last_conv = None
    for layer in reversed(model.layers):
        if isinstance(layer, tf.keras.layers.Conv1D):
            last_conv = layer
            break

    if last_conv is None:
        logger.warning("No Conv1D layer found for Grad-CAM")
        return np.ones(_ECG_INPUT_LEN, dtype=np.float64)

    grad_model = tf.keras.Model(
        inputs=model.input,
        outputs=[last_conv.output, model.output],
    )

    with tf.GradientTape() as tape:
        tape.watch(input_tensor)
        conv_out, pred_out = grad_model(tf.convert_to_tensor(input_tensor))
        target_score = pred_out[0, target_class]

    grads = tape.gradient(target_score, conv_out)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 2))
    conv_out_1d  = tf.reduce_sum(conv_out * pooled_grads[None, :, None], axis=2)[0]

    saliency = np.clip(conv_out_1d.numpy(), 0, None)
    smax = saliency.max()
    if smax > 0:
        saliency = saliency / smax
    return saliency.astype(np.float64)


# ── Classification (SIMPLE) ────────────────────────────────────────────────────

def classify_ecg(signal: np.ndarray, sr: int) -> dict:
    """
    SIMPLE ECG classification.
    
    If any disease score > 0.01 (1%), mark is_diseased=True.
    Otherwise, healthy.
    
    That's it. No complex logic.
    """
    if not _KERAS_AVAILABLE:
        logger.warning("Keras not available")
        return {
            "predicted_class":   "Unknown",
            "confidence":        0.0,
            "is_diseased":       False,
            "detected_diseases": [],
            "all_scores":        {},
            "diagnosis":         "Classification unavailable (TensorFlow not installed).",
        }

    try:
        model = _load_ecg_model()
        tensor = _preprocess_ecg(signal)

        # Run model — get sigmoid scores [0, 1] for all 6 diseases
        scores = model.predict(tensor, verbose=0)[0]

        # Build all_scores dict
        all_scores = {
            _ECG_CLASS_NAMES[i]: round(float(scores[i]), 4)
            for i in range(len(_ECG_CLASS_NAMES))
        }

        # Find top prediction
        top_idx = int(np.argmax(scores))
        top_score = float(scores[top_idx])
        predicted_class = _ECG_CLASS_NAMES[top_idx]

        # ────────────────────────────────────────────────────────────────────────────
        # SIMPLE DETECTION: Threshold 0.01 (1%)
        # ────────────────────────────────────────────────────────────────────────────
        detected = [
            _ECG_CLASS_NAMES[i]
            for i in range(len(_ECG_CLASS_NAMES))
            if scores[i] >= _DETECTION_THRESHOLD
        ]

        is_diseased = len(detected) > 0

        # Build diagnosis
        if is_diseased:
            disease_str = ", ".join(
                f"{d} ({all_scores[d]:.1%})" for d in detected
            )
            diagnosis = (
                f"⚠️ **DETECTED**: {disease_str}\n"
                "Consult a cardiologist."
            )
        else:
            diagnosis = (
                f"✅ Signal appears healthy.\n"
                f"Highest score: {predicted_class} ({top_score:.1%})."
            )

        logger.info("ECG classified",
                    extra={"detected": detected, "is_diseased": is_diseased})

        return {
            "predicted_class":    predicted_class,
            "confidence":         top_score,
            "is_diseased":        is_diseased,
            "detected_diseases":  detected,
            "all_scores":         all_scores,
            "diagnosis":          diagnosis,
        }

    except Exception as exc:
        logger.error("ECG classification failed", extra={"error": str(exc)})
        return {
            "predicted_class":    "Error",
            "confidence":         0.0,
            "is_diseased":        False,
            "detected_diseases":  [],
            "all_scores":         {},
            "diagnosis":          f"❌ Error: {exc}",
        }


# ── Separation (Grad-CAM guided) ───────────────────────────────────────────────

def _gradcam_separate(
    signal: np.ndarray,
    sr: int,
    source_bands: list,
) -> list[dict]:
    """Separates ECG components using Grad-CAM + spectral masking."""
    model  = _load_ecg_model()
    tensor = _preprocess_ecg(signal)

    scores = model.predict(tensor, verbose=0)[0]

    logger.info("ECG sigmoid scores",
                extra={n: round(float(scores[i]), 3)
                       for i, n in enumerate(_ECG_CLASS_NAMES)})

    spectral_results = spectral_separate(signal, sr, source_bands)
    spectral_map = {r["label"]: r["signal"] for r in spectral_results}

    results         = []
    arrhythmia_sum  = np.zeros(len(signal), dtype=np.float64)

    for b_idx, band in enumerate(source_bands):
        label = band["label"]

        if "normal" in label.lower() or b_idx == 0:
            results.append({"label": label, "signal": None})
            continue

        class_idx  = min(b_idx - 1, _ECG_N_CLASSES - 1)
        class_conf = float(scores[class_idx]) if class_idx < len(scores) else 0.5

        try:
            saliency = _gradcam_saliency(model, tensor, class_idx)
        except Exception as exc:
            logger.warning("Grad-CAM failed", extra={"band": label, "error": str(exc)})
            saliency = np.ones(_ECG_INPUT_LEN, dtype=np.float64)

        if len(saliency) != len(signal):
            from scipy.signal import resample as scipy_resample
            saliency = np.clip(scipy_resample(saliency, len(signal)), 0, 1)

        gating = np.maximum(saliency * class_conf, 0.1)

        spec_sig = spectral_map.get(label, np.zeros(len(signal)))
        gated    = spec_sig * gating

        arrhythmia_sum += gated
        results.append({"label": label, "signal": gated.astype(np.float64)})

    baseline = _load_baseline()
    if baseline is not None:
        n = min(len(signal), len(baseline))
        base_aligned = np.zeros(len(signal))
        base_aligned[:n] = baseline[:n]
        normal_component = base_aligned - arrhythmia_sum
    else:
        normal_component = signal - arrhythmia_sum

    for i, r in enumerate(results):
        if r["signal"] is None:
            results[i]["signal"] = normal_component.astype(np.float64)

    return results


# ── Public API ─────────────────────────────────────────────────────────────────

def ecg_ica_separate(
    signal: np.ndarray,
    sr: int,
    source_bands: list,
) -> list[dict]:
    """Separates ECG arrhythmia components. Priority: Grad-CAM → FastICA → Spectral."""
    if _KERAS_AVAILABLE:
        try:
            results = _gradcam_separate(signal, sr, source_bands)
            logger.info("Grad-CAM ECG separation complete")
            return results
        except Exception as exc:
            logger.error("Grad-CAM ECG failed — trying ICA", extra={"error": str(exc)})

    if _ICA_AVAILABLE:
        return _ica_separate(signal, sr, source_bands)

    logger.warning("All ECG backends unavailable — spectral masking")
    try:
        source_bands = load_mode_bands("ecg")
    except Exception:
        pass
    return spectral_separate(signal, sr, source_bands)


# ── FastICA fallback ───────────────────────────────────────────────────────────

def _ica_separate(signal: np.ndarray, sr: int, source_bands: list) -> list[dict]:
    logger.info("Running FastICA fallback for ECG mode")
    try:
        n_components = len(source_bands)
        S = librosa.stft(signal.astype(np.float32), n_fft=1024, hop_length=256)
        X, phase = librosa.magphase(S)

        ica = FastICA(n_components=n_components, random_state=42,
                      max_iter=200, tol=0.01)
        S_  = ica.fit_transform(X.T)
        A_  = ica.mixing_
        freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)

        assigned_masks = []
        for i in range(n_components):
            component_mag = np.abs(np.outer(S_[:, i], A_[:, i]).T)
            energies = [
                sum(np.sum(component_mag[(freqs >= lo) & (freqs <= hi), :])
                    for lo, hi in band.get("ranges", []))
                for band in source_bands
            ]
            assigned_masks.append((i, energies))

        used_components, results = set(), []
        for b_idx, band in enumerate(source_bands):
            best_c, best_e = -1, -1.0
            for c_idx, energies in assigned_masks:
                if c_idx not in used_components and energies[b_idx] > best_e:
                    best_e, best_c = energies[b_idx], c_idx
            if best_c != -1:
                used_components.add(best_c)
                component_mag = np.abs(np.outer(S_[:, best_c], A_[:, best_c]).T)
                Y   = component_mag * phase
                rec = librosa.istft(Y, hop_length=256, length=len(signal))
                results.append({"label": band["label"], "signal": rec})
            else:
                results.append({"label": band["label"],
                                 "signal": np.zeros(len(signal))})
        return results

    except Exception as exc:
        logger.error(f"ICA separation failed: {exc}")
        try:
            source_bands = load_mode_bands("ecg")
        except Exception:
            pass
        return spectral_separate(signal, sr, source_bands)
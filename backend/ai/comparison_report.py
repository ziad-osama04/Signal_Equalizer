"""
Generates a comparison report between the equalizer output and the AI separator output.
"""

from ai.metrics import compute_snr, compute_mse, compute_correlation


def generate_comparison_report(original, eq_output, ai_output):
    """
    Compares equalizer and AI outputs against the original signal.

    Returns:
        dict with equalizer_metrics, ai_metrics, and verdict
    """
    eq_metrics = {
        "snr_db": round(compute_snr(original, eq_output), 2),
        "mse": round(compute_mse(original, eq_output), 6),
        "correlation": round(compute_correlation(original, eq_output), 4),
    }

    ai_metrics = {
        "snr_db": round(compute_snr(original, ai_output), 2),
        "mse": round(compute_mse(original, ai_output), 6),
        "correlation": round(compute_correlation(original, ai_output), 4),
    }

    # Higher SNR and correlation = better, lower MSE = better
    eq_score = eq_metrics["snr_db"] + eq_metrics["correlation"] * 10 - eq_metrics["mse"] * 1e4
    ai_score = ai_metrics["snr_db"] + ai_metrics["correlation"] * 10 - ai_metrics["mse"] * 1e4

    if eq_score > ai_score:
        verdict = "Equalizer performs better"
    elif ai_score > eq_score:
        verdict = "AI model performs better"
    else:
        verdict = "Both perform equally"

    return {
        "equalizer": eq_metrics,
        "ai_model": ai_metrics,
        "verdict": verdict,
    }

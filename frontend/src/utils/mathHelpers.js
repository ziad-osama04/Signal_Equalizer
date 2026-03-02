/**
 * mathHelpers.js — dB conversion, interpolation, and clamping utilities.
 */

/** Linear amplitude (0‑2) → dB.  0‑amplitude maps to −∞, clamped to −60 dB. */
export function linearToDb(val) {
    if (val <= 0) return -60;
    return 20 * Math.log10(val);
}

/** dB → linear amplitude. */
export function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

/** Clamp a value between min and max. */
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/** Linear interpolation between a and b by factor t ∈ [0,1]. */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/** Inverse lerp — returns t such that lerp(a, b, t) === val. */
export function inverseLerp(a, b, val) {
    if (b === a) return 0;
    return (val - a) / (b - a);
}

/** Round to n decimal places. */
export function roundTo(val, n = 2) {
    const f = Math.pow(10, n);
    return Math.round(val * f) / f;
}

/**
 * audiogramScale.js — Frequency ↔ pixel mapping for linear and audiogram (log) scales.
 *
 * Audiogram scale: Logarithmic frequency axis commonly used in hearing-aid applications.
 * Standard audiometric frequencies: 125, 250, 500, 1000, 2000, 4000, 8000 Hz.
 */

const MIN_FREQ = 20;
const MAX_FREQ = 20000;

// Standard audiometric test frequencies for axis labels
export const AUDIOGRAM_FREQUENCIES = [125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/**
 * Convert a frequency (Hz) to an x-pixel position using logarithmic (audiogram) scale.
 * @param {number} freq  — frequency in Hz
 * @param {number} width — total pixel width of the axis
 * @param {number} minF  — minimum frequency (default 20)
 * @param {number} maxF  — maximum frequency (default 20000)
 * @returns {number} x position in pixels
 */
export function freqToX(freq, width, minF = MIN_FREQ, maxF = MAX_FREQ) {
    if (freq <= 0) return 0;
    const logMin = Math.log10(minF);
    const logMax = Math.log10(maxF);
    const logF = Math.log10(Math.max(freq, minF));
    return ((logF - logMin) / (logMax - logMin)) * width;
}

/**
 * Convert an x-pixel position back to a frequency using logarithmic scale.
 * @param {number} x     — pixel position
 * @param {number} width — total pixel width
 * @param {number} minF  — minimum frequency
 * @param {number} maxF  — maximum frequency
 * @returns {number} frequency in Hz
 */
export function xToFreq(x, width, minF = MIN_FREQ, maxF = MAX_FREQ) {
    const logMin = Math.log10(minF);
    const logMax = Math.log10(maxF);
    const logF = logMin + (x / width) * (logMax - logMin);
    return Math.pow(10, logF);
}

/**
 * Convert frequency to x-pixel using linear scale.
 */
export function freqToXLinear(freq, width, minF = MIN_FREQ, maxF = MAX_FREQ) {
    return ((freq - minF) / (maxF - minF)) * width;
}

/**
 * Convert x-pixel to frequency using linear scale.
 */
export function xToFreqLinear(x, width, minF = MIN_FREQ, maxF = MAX_FREQ) {
    return minF + (x / width) * (maxF - minF);
}

/**
 * Format a frequency as a human-readable label.
 * @param {number} hz — frequency in Hz
 * @returns {string} e.g. "1 kHz", "250 Hz"
 */
export function formatFreq(hz) {
    if (hz >= 1000) {
        const k = hz / 1000;
        return k % 1 === 0 ? `${k} kHz` : `${k.toFixed(1)} kHz`;
    }
    return `${Math.round(hz)} Hz`;
}

/**
 * Generate tick positions for the audiogram scale.
 * Returns an array of { freq, x, label } objects.
 */
export function getAudiogramTicks(width, minF = MIN_FREQ, maxF = MAX_FREQ) {
    return AUDIOGRAM_FREQUENCIES
        .filter(f => f >= minF && f <= maxF)
        .map(f => ({
            freq: f,
            x: freqToX(f, width, minF, maxF),
            label: formatFreq(f),
        }));
}

/**
 * Generate tick positions for a linear frequency scale.
 */
export function getLinearTicks(width, minF = MIN_FREQ, maxF = MAX_FREQ, count = 10) {
    const ticks = [];
    const step = (maxF - minF) / count;
    for (let i = 0; i <= count; i++) {
        const f = minF + step * i;
        ticks.push({
            freq: f,
            x: freqToXLinear(f, width, minF, maxF),
            label: formatFreq(f),
        });
    }
    return ticks;
}

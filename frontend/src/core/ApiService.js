import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
});

// ─── Audio ───────────────────────────────────────────────────────────────────

export async function uploadAudio(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/audio/upload', form);
    return res.data; // { id, filename, duration_sec, sample_rate, num_samples }
}

export function getPlayUrl(fileId) {
    return `/api/audio/play/${fileId}`;
}

export async function getSpectrum(fileId, domain = 'fourier') {
    const res = await api.get(`/audio/spectrum/${fileId}?domain=${domain}`);
    return res.data; // { freqs: [], magnitudes: [], domain, sr }
}

// ─── Modes ───────────────────────────────────────────────────────────────────

export async function getModeSettings(mode) {
    const res = await api.get(`/modes/settings/${mode}`);
    return res.data; // { mode, sliders: [{label, ranges, default_gain}] }
}

export async function processSignal({ file_id, mode, gains, windows, domain }) {
    const res = await api.post('/modes/process', { file_id, mode, gains, windows, domain });
    return res.data; // { output_id, duration_sec, sample_rate, num_samples, spectrogram }
}

export async function saveModeSettings(mode, sliders) {
    const res = await api.post(`/modes/settings/${mode}`, sliders);
    return res.data;
}

// ─── Basis ───────────────────────────────────────────────────────────────────

export async function analyzeBasis(fileId) {
    const res = await api.post(`/basis/analyze?file_id=${fileId}`);
    return res.data; // { best_basis, results }
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export async function aiProcess({ file_id, mode }) {
    const res = await api.post('/ai/process', { file_id, mode });
    return res.data; // { tracks: [{label, track_id, num_samples}] }
}

export async function compareEqVsAI({ file_id, mode, gains, domain, windows }) {
    const res = await api.post('/ai/compare', { file_id, mode, gains, domain, windows });
    return res.data; // { equalizer, ai_model, verdict, eq_output_id, ai_output_id }
}

export default api;

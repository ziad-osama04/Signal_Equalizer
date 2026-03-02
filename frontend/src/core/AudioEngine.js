/**
 * AudioEngine.js — Web Audio API wrapper for decoded audio playback.
 *
 * Features:
 *   • load(url)          — fetch & decode audio buffer
 *   • play() / pause() / stop()
 *   • setSpeed(s)        — playback rate
 *   • getFrequencyData() — Uint8Array from AnalyserNode for SpectrumViewer
 *   • getCurrentTime()
 */

export default class AudioEngine {
    constructor() {
        this._ctx = null;
        this._buffer = null;
        this._source = null;
        this._analyser = null;
        this._gainNode = null;

        this._playing = false;
        this._startedAt = 0;   // ctx-time when playback started
        this._pausedAt = 0;    // seconds into the buffer when paused
        this._speed = 1;
    }

    /** Ensure AudioContext exists (call after user gesture). */
    _ensureCtx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._analyser = this._ctx.createAnalyser();
            this._analyser.fftSize = 2048;
            this._analyser.smoothingTimeConstant = 0.8;
            this._gainNode = this._ctx.createGain();
            this._gainNode.connect(this._analyser);
            this._analyser.connect(this._ctx.destination);
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
    }

    /** Load audio from a URL and decode it. */
    async load(url) {
        this._ensureCtx();
        this.stop();
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        this._buffer = await this._ctx.decodeAudioData(arrayBuf);
        this._pausedAt = 0;
        return this._buffer.duration;
    }

    get duration() {
        return this._buffer ? this._buffer.duration : 0;
    }

    get isPlaying() {
        return this._playing;
    }

    play() {
        if (!this._buffer || this._playing) return;
        this._ensureCtx();

        this._source = this._ctx.createBufferSource();
        this._source.buffer = this._buffer;
        this._source.playbackRate.value = this._speed;
        this._source.connect(this._gainNode);

        this._source.onended = () => {
            if (this._playing) {
                this._playing = false;
                this._pausedAt = 0;
            }
        };

        this._source.start(0, this._pausedAt);
        this._startedAt = this._ctx.currentTime - this._pausedAt / this._speed;
        this._playing = true;
    }

    pause() {
        if (!this._playing) return;
        this._pausedAt = this.getCurrentTime();
        this._source?.stop();
        this._source?.disconnect();
        this._source = null;
        this._playing = false;
    }

    stop() {
        if (this._source) {
            try { this._source.stop(); } catch (_) { /* already stopped */ }
            this._source.disconnect();
            this._source = null;
        }
        this._playing = false;
        this._pausedAt = 0;
        this._startedAt = 0;
    }

    seek(t) {
        const wasPlaying = this._playing;
        if (wasPlaying) this.pause();
        this._pausedAt = Math.max(0, Math.min(t, this.duration));
        if (wasPlaying) this.play();
    }

    setSpeed(s) {
        this._speed = s;
        if (this._source) {
            this._source.playbackRate.value = s;
        }
    }

    /** Get the current playback time in seconds. */
    getCurrentTime() {
        if (!this._playing || !this._ctx) return this._pausedAt;
        return (this._ctx.currentTime - this._startedAt) * this._speed;
    }

    /** Get frequency magnitude data for visualisation (SpectrumViewer). */
    getFrequencyData() {
        if (!this._analyser) return null;
        const data = new Uint8Array(this._analyser.frequencyBinCount);
        this._analyser.getByteFrequencyData(data);
        return data;
    }

    /** Get time-domain waveform data. */
    getTimeDomainData() {
        if (!this._analyser) return null;
        const data = new Uint8Array(this._analyser.frequencyBinCount);
        this._analyser.getByteTimeDomainData(data);
        return data;
    }

    get sampleRate() {
        return this._ctx ? this._ctx.sampleRate : 44100;
    }

    destroy() {
        this.stop();
        if (this._ctx) {
            this._ctx.close();
            this._ctx = null;
        }
    }
}

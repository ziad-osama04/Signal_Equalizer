/**
 * TimeController.js — Pure-JS class managing a requestAnimationFrame loop.
 * Drives playback time and feeds callbacks every frame.
 */

export default class TimeController {
    constructor() {
        this._playing = false;
        this._speed = 1;
        this._currentTime = 0;
        this._duration = 0;
        this._rafId = null;
        this._lastTs = null;
        this._listeners = new Set();
    }

    /** Register a tick callback: fn(currentTime, duration). */
    onTick(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    setDuration(d) { this._duration = d; }
    setSpeed(s) { this._speed = s; }

    get currentTime() { return this._currentTime; }
    get isPlaying() { return this._playing; }

    play() {
        if (this._playing) return;
        this._playing = true;
        this._lastTs = performance.now();
        this._loop();
    }

    pause() {
        this._playing = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    stop() {
        this.pause();
        this._currentTime = 0;
        this._notify();
    }

    seek(t) {
        this._currentTime = Math.max(0, Math.min(t, this._duration));
        this._notify();
    }

    _loop() {
        if (!this._playing) return;
        this._rafId = requestAnimationFrame((ts) => {
            const dt = (ts - this._lastTs) / 1000;
            this._lastTs = ts;
            this._currentTime += dt * this._speed;
            if (this._currentTime >= this._duration) {
                this._currentTime = this._duration;
                this._playing = false;
                this._notify();
                return;
            }
            this._notify();
            this._loop();
        });
    }

    _notify() {
        for (const fn of this._listeners) {
            fn(this._currentTime, this._duration);
        }
    }

    destroy() {
        this.pause();
        this._listeners.clear();
    }
}

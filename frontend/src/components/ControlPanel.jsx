import { useState, useRef, useEffect, useCallback } from 'react';
import { useSync } from '../core/SyncContext';
import AudioEngine from '../core/AudioEngine';

/**
 * ControlPanel — Full audio playback controls:
 *   Play / Pause / Stop / Speed / Zoom reset
 *   Wired to AudioEngine (Web Audio API) and SyncContext for linked playback.
 *
 * Props:
 *   audioUrl      — URL of the audio file to play
 *   audioEngine   — shared AudioEngine instance (from parent)
 *   onEngineReady — callback(engine) when engine is loaded
 */
export default function ControlPanel({ audioUrl, audioEngine, onEngineReady }) {
    const {
        currentTime, setCurrentTime,
        isPlaying, setIsPlaying,
        speed, setSpeed,
        resetView,
    } = useSync();

    const rafRef = useRef(null);

    // Load audio into engine when URL changes
    useEffect(() => {
        if (!audioEngine || !audioUrl) return;
        audioEngine.load(audioUrl).then(() => {
            if (onEngineReady) onEngineReady(audioEngine);
        }).catch(err => console.error('AudioEngine load error:', err));

        return () => {
            audioEngine.stop();
            setIsPlaying(false);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [audioUrl, audioEngine]);

    // Animation loop to sync playhead
    const startTimeSync = useCallback(() => {
        const tick = () => {
            if (!audioEngine?.isPlaying) {
                setIsPlaying(false);
                return;
            }
            setCurrentTime(audioEngine.getCurrentTime());
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    }, [audioEngine]);

    const play = () => {
        if (!audioEngine || !audioUrl) return;
        audioEngine.setSpeed(speed);
        audioEngine.play();
        setIsPlaying(true);
        startTimeSync();
    };

    const pause = () => {
        if (!audioEngine) return;
        audioEngine.pause();
        setIsPlaying(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setCurrentTime(audioEngine.getCurrentTime());
    };

    const stop = () => {
        if (!audioEngine) return;
        audioEngine.stop();
        setIsPlaying(false);
        setCurrentTime(0);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    const changeSpeed = (s) => {
        setSpeed(s);
        if (audioEngine) audioEngine.setSpeed(s);
    };

    const handleReset = () => {
        stop();
        resetView();
    };

    const speedOptions = [
        [0.5, 1],
        [1.5, 2],
    ];

    return (
        <div className="flex items-center gap-3 bg-gray-800/60 backdrop-blur rounded-xl px-4 py-2 border border-gray-700 flex-wrap">
            <button
                onClick={stop}
                disabled={!audioUrl}
                className="px-3 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-40 rounded-lg text-xs font-bold transition"
            >
                ⏹ Stop
            </button>
            {isPlaying
                ? <button onClick={pause} className="px-3 py-1.5 bg-yellow-600/80 hover:bg-yellow-500 rounded-lg text-xs font-bold transition">⏸ Pause</button>
                : <button onClick={play} disabled={!audioUrl} className="px-3 py-1.5 bg-green-600/80 hover:bg-green-500 disabled:opacity-40 rounded-lg text-xs font-bold transition">▶ Play</button>
            }

            <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-gray-400">Speed:</span>
                <div className="grid grid-cols-2 grid-rows-2 gap-1">
                    {speedOptions.flat().map((s) => (
                        <button
                            key={s}
                            onClick={() => changeSpeed(s)}
                            className={`px-2 py-1 rounded text-xs font-mono transition ${speed === s ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                            style={{ minWidth: '34px' }}
                        >
                            {s}x
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={handleReset}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-bold transition ml-auto"
            >
                🔄 Reset
            </button>

            {/* Time display */}
            <span className="text-xs text-gray-400 font-mono tabular-nums ml-2">
                {currentTime.toFixed(1)}s
            </span>
        </div>
    );
}

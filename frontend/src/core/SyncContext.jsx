import { createContext, useContext, useState, useCallback, useRef } from 'react';

const SyncContext = createContext(null);

/**
 * SyncProvider — shared playback-time cursor so CineViewer,
 * Spectrogram, and SpectrumViewer all track the same position.
 *
 * Also provides linked zoom/pan state so input & output viewers stay synchronised.
 */
export function SyncProvider({ children }) {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);

    // Linked zoom / pan — expressed as visible time-window
    const [viewStart, setViewStart] = useState(0);      // seconds
    const [viewEnd, setViewEnd] = useState(null);        // null = full duration

    // Ref for animation-frame consumers
    const animFrameRef = useRef(null);

    const seekTo = useCallback((t) => {
        setCurrentTime(Math.max(0, Math.min(t, duration)));
    }, [duration]);

    const resetView = useCallback(() => {
        setViewStart(0);
        setViewEnd(null);
    }, []);

    return (
        <SyncContext.Provider value={{
            currentTime, setCurrentTime,
            duration, setDuration,
            isPlaying, setIsPlaying,
            speed, setSpeed,
            viewStart, setViewStart,
            viewEnd, setViewEnd,
            seekTo,
            resetView,
            animFrameRef,
        }}>
            {children}
        </SyncContext.Provider>
    );
}

export function useSync() {
    const ctx = useContext(SyncContext);
    if (!ctx) throw new Error('useSync must be used within SyncProvider');
    return ctx;
}

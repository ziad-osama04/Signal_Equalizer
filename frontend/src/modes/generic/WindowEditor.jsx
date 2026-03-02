import { useState, useRef, useCallback } from 'react';
import { freqToX, xToFreq, formatFreq, getAudiogramTicks } from '../../utils/audiogramScale';
import { clamp } from '../../utils/mathHelpers';

/**
 * WindowEditor — Interactive SVG-based frequency band visualizer.
 *
 * Users can:
 *   • See each band as a coloured rectangle on a log frequency axis
 *   • Drag left/right edges to change start_freq / end_freq
 *   • See the gain value overlaid on each band
 *   • Add new subdivisions one-by-one
 *   • Remove individual bands
 *
 * Props:
 *   bands       — array of { start_freq, end_freq, gain }
 *   onBandsChange(newBands) — called when bands are edited
 *   scaleType   — 'audiogram' | 'linear'
 */
const COLORS = [
    '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
    '#ec4899', '#3b82f6', '#f97316', '#14b8a6', '#a855f7',
];

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const SVG_HEIGHT = 140;
const AXIS_HEIGHT = 24;
const BAR_TOP = 8;
const BAR_BOTTOM = SVG_HEIGHT - AXIS_HEIGHT - 8;
const BAR_HEIGHT = BAR_BOTTOM - BAR_TOP;

export default function WindowEditor({ bands, onBandsChange, scaleType = 'audiogram' }) {
    const svgRef = useRef(null);
    const [dragState, setDragState] = useState(null); // { bandIdx, edge: 'left'|'right', startX }

    const toX = useCallback((freq, w) => {
        return freqToX(freq, w, MIN_FREQ, MAX_FREQ);
    }, []);

    const toFreq = useCallback((x, w) => {
        return xToFreq(x, w, MIN_FREQ, MAX_FREQ);
    }, []);

    const getSvgWidth = () => {
        if (!svgRef.current) return 600;
        return svgRef.current.getBoundingClientRect().width;
    };

    const handleMouseDown = (e, bandIdx, edge) => {
        e.preventDefault();
        e.stopPropagation();
        const svg = svgRef.current;
        const rect = svg.getBoundingClientRect();
        setDragState({ bandIdx, edge, offsetX: rect.left });

        const handleMouseMove = (ev) => {
            const w = getSvgWidth();
            const x = ev.clientX - rect.left;
            const freq = clamp(toFreq(x, w), MIN_FREQ, MAX_FREQ);
            const newBands = [...bands];
            const band = { ...newBands[bandIdx] };

            if (edge === 'left') {
                band.start_freq = Math.min(freq, band.end_freq - 1);
            } else {
                band.end_freq = Math.max(freq, band.start_freq + 1);
            }
            newBands[bandIdx] = band;
            onBandsChange(newBands);
        };

        const handleMouseUp = () => {
            setDragState(null);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const addBand = () => {
        // Find a gap or add at the end
        const lastEnd = bands.length > 0 ? bands[bands.length - 1].end_freq : MIN_FREQ;
        const newStart = Math.min(lastEnd, MAX_FREQ - 100);
        const newEnd = Math.min(newStart + 1000, MAX_FREQ);
        onBandsChange([...bands, { start_freq: newStart, end_freq: newEnd, gain: 1.0 }]);
    };

    const removeBand = (idx) => {
        const newBands = bands.filter((_, i) => i !== idx);
        onBandsChange(newBands);
    };

    const w = getSvgWidth();
    const ticks = getAudiogramTicks(w, MIN_FREQ, MAX_FREQ);

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                    Frequency Bands
                </span>
                <button
                    onClick={addBand}
                    className="px-2 py-1 text-xs font-bold bg-cyan-700 hover:bg-cyan-600 rounded-md transition"
                >
                    + Add Band
                </button>
            </div>

            <svg
                ref={svgRef}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/80"
                height={SVG_HEIGHT}
                style={{ cursor: dragState ? 'ew-resize' : 'default' }}
            >
                {/* Grid lines */}
                {ticks.map((tick, i) => (
                    <g key={i}>
                        <line
                            x1={tick.x} y1={BAR_TOP}
                            x2={tick.x} y2={BAR_BOTTOM}
                            stroke="rgba(100,116,139,0.15)"
                            strokeWidth="1"
                        />
                        <text
                            x={tick.x} y={SVG_HEIGHT - 4}
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="9"
                            fontFamily="monospace"
                        >
                            {tick.label}
                        </text>
                    </g>
                ))}

                {/* Band rectangles */}
                {bands.map((band, i) => {
                    const x1 = toX(band.start_freq, w);
                    const x2 = toX(band.end_freq, w);
                    const bw = Math.max(x2 - x1, 2);
                    const color = COLORS[i % COLORS.length];
                    const opacity = 0.3 + (band.gain / 2) * 0.5;

                    return (
                        <g key={i}>
                            {/* Band fill */}
                            <rect
                                x={x1} y={BAR_TOP}
                                width={bw} height={BAR_HEIGHT}
                                fill={color}
                                opacity={opacity}
                                rx="3"
                            />
                            {/* Band border */}
                            <rect
                                x={x1} y={BAR_TOP}
                                width={bw} height={BAR_HEIGHT}
                                fill="none"
                                stroke={color}
                                strokeWidth="1.5"
                                rx="3"
                            />

                            {/* Left drag handle */}
                            <rect
                                x={x1 - 3} y={BAR_TOP}
                                width={6} height={BAR_HEIGHT}
                                fill="transparent"
                                style={{ cursor: 'ew-resize' }}
                                onMouseDown={(e) => handleMouseDown(e, i, 'left')}
                            />
                            {/* Right drag handle */}
                            <rect
                                x={x2 - 3} y={BAR_TOP}
                                width={6} height={BAR_HEIGHT}
                                fill="transparent"
                                style={{ cursor: 'ew-resize' }}
                                onMouseDown={(e) => handleMouseDown(e, i, 'right')}
                            />

                            {/* Gain label */}
                            {bw > 30 && (
                                <text
                                    x={x1 + bw / 2}
                                    y={BAR_TOP + BAR_HEIGHT / 2 - 6}
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="10"
                                    fontWeight="bold"
                                >
                                    {band.gain.toFixed(2)}×
                                </text>
                            )}
                            {/* Frequency range label */}
                            {bw > 50 && (
                                <text
                                    x={x1 + bw / 2}
                                    y={BAR_TOP + BAR_HEIGHT / 2 + 8}
                                    textAnchor="middle"
                                    fill="rgba(255,255,255,0.6)"
                                    fontSize="8"
                                    fontFamily="monospace"
                                >
                                    {formatFreq(band.start_freq)}–{formatFreq(band.end_freq)}
                                </text>
                            )}

                            {/* Remove button */}
                            <g
                                onClick={() => removeBand(i)}
                                style={{ cursor: 'pointer' }}
                            >
                                <circle cx={x1 + bw / 2} cy={BAR_TOP - 1} r="6" fill="#374151" stroke={color} strokeWidth="1" />
                                <text x={x1 + bw / 2} y={BAR_TOP + 2.5} textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="bold">×</text>
                            </g>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

import { useState } from 'react';
import { useSignal } from '../core/SignalContext';
import { compareEqVsAI, getPlayUrl } from '../core/ApiService';

export default function AIComparison() {
    const { inputFile, mode, gains } = useSignal();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);

    const runComparison = async () => {
        if (!inputFile) return;
        setLoading(true);
        try {
            const result = await compareEqVsAI({
                file_id: inputFile.id,
                mode,
                gains,
            });
            setReport(result);
        } catch (err) {
            console.error('AI comparison error:', err);
        }
        setLoading(false);
    };

    return (
        <div className="bg-gray-900/60 backdrop-blur rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
                    🤖 AI vs Equalizer Comparison
                </h3>
                <button
                    onClick={runComparison}
                    disabled={!inputFile || loading}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-xs font-bold transition"
                >
                    {loading ? '⏳ Analyzing...' : '⚡ Compare'}
                </button>
            </div>

            {report && (
                <div className="space-y-3">
                    {/* Metrics Table */}
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-gray-700">
                                <th className="text-left py-1 text-gray-500">Metric</th>
                                <th className="text-center py-1 text-cyan-400">🎛️ Equalizer</th>
                                <th className="text-center py-1 text-purple-400">🤖 AI Model</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-gray-800">
                                <td className="py-1.5 text-gray-400">SNR (dB)</td>
                                <td className="text-center font-mono text-cyan-300">{report.equalizer.snr_db}</td>
                                <td className="text-center font-mono text-purple-300">{report.ai_model.snr_db}</td>
                            </tr>
                            <tr className="border-b border-gray-800">
                                <td className="py-1.5 text-gray-400">MSE</td>
                                <td className="text-center font-mono text-cyan-300">{report.equalizer.mse}</td>
                                <td className="text-center font-mono text-purple-300">{report.ai_model.mse}</td>
                            </tr>
                            <tr>
                                <td className="py-1.5 text-gray-400">Correlation</td>
                                <td className="text-center font-mono text-cyan-300">{report.equalizer.correlation}</td>
                                <td className="text-center font-mono text-purple-300">{report.ai_model.correlation}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Verdict */}
                    <div className={`text-center py-2 rounded-lg text-sm font-bold ${report.verdict.includes('Equalizer')
                            ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-800'
                            : report.verdict.includes('AI')
                                ? 'bg-purple-900/40 text-purple-300 border border-purple-800'
                                : 'bg-gray-800 text-gray-300 border border-gray-700'
                        }`}>
                        🏆 {report.verdict}
                    </div>

                    {/* Playback Buttons */}
                    <div className="flex gap-2">
                        <a
                            href={getPlayUrl(report.eq_output_id)}
                            target="_blank"
                            className="flex-1 text-center px-3 py-1.5 bg-cyan-800/40 hover:bg-cyan-700/40 rounded-lg text-xs text-cyan-300 transition border border-cyan-800"
                        >
                            ▶ Play Equalizer Output
                        </a>
                        <a
                            href={getPlayUrl(report.ai_output_id)}
                            target="_blank"
                            className="flex-1 text-center px-3 py-1.5 bg-purple-800/40 hover:bg-purple-700/40 rounded-lg text-xs text-purple-300 transition border border-purple-800"
                        >
                            ▶ Play AI Output
                        </a>
                    </div>
                </div>
            )}

            {!report && !loading && (
                <p className="text-xs text-gray-500 text-center">
                    Upload a signal and adjust sliders, then click Compare to see how the equalizer stacks up against the AI model.
                </p>
            )}
        </div>
    );
}

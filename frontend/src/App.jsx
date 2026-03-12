import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalProvider, useSignal } from './core/SignalContext';
import { SyncProvider, useSync } from './core/SyncContext';
import AudioEngine from './core/AudioEngine';
import { uploadAudio, processSignal, getPlayUrl } from './core/ApiService';
import ModeSelector from './components/ModeSelector';
import SliderControl from './components/SliderControl';
import ControlPanel from './components/ControlPanel';
import CineViewer from './components/CineViewer';
import Spectrogram from './components/Spectrogram';
import SpectrumViewer from './components/SpectrumViewer';
import FFTViewer from './components/FFTViewer';
import AIComparison from './components/AIComparison';
import GenericMode from './modes/generic/GenericMode';
import DualDomainPanel from './components/DualDomainPanel';

function Equalizer() {
  const {
    inputFile, setInputFile,
    outputFile, setOutputFile,
    mode,
    gains, setGains,
    windows, setWindows,
    spectrogram, setSpectrogram,
    inputSpectrogram, setInputSpectrogram,
    freqScale, setFreqScale,
    waveletOutputFile,
    waveletSpectrogram,
  } = useSignal();

  const { isPlaying } = useSync();

  const [showSpectrograms, setShowSpectrograms] = useState(true);
  const [loading, setLoading] = useState(false);

  const isGeneric = mode === 'generic';

  // Shared AudioEngine instances
  const inputEngineRef = useRef(null);
  const outputEngineRef = useRef(null);

  // Create engines once
  useEffect(() => {
    inputEngineRef.current = new AudioEngine();
    outputEngineRef.current = new AudioEngine();
    return () => {
      inputEngineRef.current?.destroy();
      outputEngineRef.current?.destroy();
    };
  }, []);

  // Handle file upload
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const meta = await uploadAudio(file);
      setInputFile(meta);
      setOutputFile(null);
      setSpectrogram(null);
      if (meta.spectrogram) {
        setInputSpectrogram(meta.spectrogram);
      }
    } catch (err) {
      console.error('Upload error:', err);
    }
    setLoading(false);
  };

  // --- Generic Mode: frequency-only processing ---
  const handleGenericProcess = useCallback(async () => {
    if (!inputFile || !isGeneric) return;
    setLoading(true);
    try {
      const result = await processSignal({
        file_id: inputFile.id,
        mode: 'generic',
        gains,
        domain: 'fourier', // Generic mode always uses Fourier
        windows,
      });
      setOutputFile(result);
      setSpectrogram(result.spectrogram);
    } catch (err) {
      console.error('Generic process error:', err);
    }
    setLoading(false);
  }, [inputFile, isGeneric, gains, windows]);

  // Auto-apply for generic mode only (custom modes handled by DualDomainPanel)
  useEffect(() => {
    if (!inputFile || !isGeneric) return;
    const timer = setTimeout(handleGenericProcess, 400);
    return () => clearTimeout(timer);
  }, [handleGenericProcess]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            🎵 Signal Equalizer
          </h1>
          <ModeSelector />

          {/* Frequency scale toggle */}
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-gray-500">Scale:</span>
            <button
              onClick={() => setFreqScale(freqScale === 'linear' ? 'audiogram' : 'linear')}
              className={`px-2 py-1 rounded text-xs font-semibold transition ${freqScale === 'audiogram'
                ? 'bg-purple-600/40 text-purple-300 border border-purple-500'
                : 'bg-gray-700 text-gray-400 border border-gray-600'
                }`}
            >
              {freqScale === 'audiogram' ? '📊 Audiogram' : '📏 Linear'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSpectrograms}
              onChange={(e) => setShowSpectrograms(e.target.checked)}
              className="accent-cyan-500"
            />
            <span className="text-xs text-gray-400">Spectrograms</span>
          </label>

          <label className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-semibold cursor-pointer transition">
            📂 Upload Audio
            <input type="file" accept=".wav,.mp3,.ogg,.flac" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main
        className="flex-1 flex gap-4 p-4 main-content"
        style={{ minHeight: 0, height: '0px', flexGrow: 1, overflow: 'hidden' }}
      >
        {/* Left: Input Signal */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
          <span className="text-sm font-semibold text-gray-300 mb-1 pl-1">Input Signal</span>
          <div className="flex flex-col gap-3 h-full overflow-hidden">
            <CineViewer label="Waveform" audioUrl={inputFile ? getPlayUrl(inputFile.id) : null} />
            {showSpectrograms && (
              <div
                style={{ flex: 1, maxHeight: '280px', minHeight: 0, overflow: 'auto' }}
                className="rounded-md overflow-hidden bg-gray-900 border border-gray-800"
              >
                <Spectrogram label="Input Spectrogram" data={inputSpectrogram} />
              </div>
            )}
            <FFTViewer label="Input" fileId={inputFile?.id} forceDomain="fourier" />
            <SpectrumViewer audioEngine={inputEngineRef.current} isPlaying={isPlaying} />
          </div>
        </div>

        {/* Center: Equalizer Panel */}
        <div className="flex flex-col items-center gap-3 bg-gray-900/50 backdrop-blur rounded-xl p-4 border border-gray-800 w-[440px] h-full overflow-y-auto">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Equalizer</h2>

          {/* --- Generic Mode: frequency-only sliders --- */}
          {isGeneric && <GenericMode />}

          {/* --- Custom Modes: dual freq + wavelet domain panels --- */}
          {!isGeneric && <DualDomainPanel />}

          <div className="mt-auto w-full">
            <footer className="flex justify-center w-full px-0 py-2 border-t border-gray-800 bg-transparent">
              <ControlPanel
                audioUrl={outputFile ? getPlayUrl(outputFile.output_id) : (inputFile ? getPlayUrl(inputFile.id) : null)}
                audioEngine={outputFile ? outputEngineRef.current : inputEngineRef.current}
              />
            </footer>
          </div>
        </div>

        {/* Right: Output Signal */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
          <span className="text-sm font-semibold text-gray-300 mb-1 pl-1">Output Signal</span>
          <div className="flex flex-col gap-3 h-full overflow-hidden">
            <CineViewer label="Waveform" audioUrl={outputFile ? getPlayUrl(outputFile.output_id) : null} />
            {showSpectrograms && (
              <div
                style={{ flex: 1, maxHeight: '280px', minHeight: 0, overflow: 'auto' }}
                className="rounded-md overflow-hidden bg-gray-900 border border-gray-800"
              >
                <Spectrogram label="Output Spectrogram" data={spectrogram} />
              </div>
            )}
            <FFTViewer label="Output" fileId={outputFile?.output_id} forceDomain="fourier" />
            <SpectrumViewer audioEngine={outputEngineRef.current} isPlaying={isPlaying} />
          </div>
        </div>
      </main>

      {/* ─── AI Comparison Footer ─── */}
      <footer className="w-full px-0 py-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur flex-shrink-0 z-10">
        <div className="container mx-auto px-4">
          <AIComparison />
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <SignalProvider>
      <SyncProvider>
        <Equalizer />
      </SyncProvider>
    </SignalProvider>
  );
}

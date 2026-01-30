import React, { useState, useEffect } from 'react';
import {
  Square,
  AlertCircle,
  ShieldCheck,
  Zap,
  ChevronRight,
  Volume2,
} from 'lucide-react';

const API_ENDPOINT = '/api/gemini';

const App = () => {
  const [input, setInput] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sector, setSector] = useState('Health');
  const [foresight, setForesight] = useState('');
  const [foresightLoading, setForesightLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Playfair+Display:ital@0;1&display=swap';
    document.head.appendChild(link);
  }, []);

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchWithRetry = async (payload, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          // Handle rate limiting specifically
          if (res.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment.');
          }
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        return data;
      } catch (err) {
        if (i === retries - 1) throw err;
        // Don't retry on rate limits
        if (err.message.includes('Rate limit')) throw err;
        await new Promise((r) => setTimeout(r, 2 ** i * 500));
      }
    }
  };

  const analyzeSignal = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setAnalysis('');

    const systemPrompt = `You are a specialist in Translational Governance.
Your role is to translate complex technical signals into safe, actionable oversight for institutional leaders.
Format your response with these exact headers:
1. THE BENCH (Environmental Reality)
2. THE BEDSIDE (Institutional Intervention)
3. THE COMMUNITY (Accountability Loop)
Use senior, conservative, board-ready language. Focus on "human adaptive capacity" and "oversight bandwidth."`;

    try {
      const data = await fetchWithRetry({
        contents: [
          {
            parts: [
              {
                text: `Translate this operational signal for institutional leadership: ${input}`,
              },
            ],
          },
        ],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      });
      setAnalysis(
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
          'No synthesis available.'
      );
    } catch (err) {
      setError(err.message || 'A connection error occurred during the translational process.');
    } finally {
      setLoading(false);
    }
  };

  const generateForesight = async () => {
    setForesightLoading(true);
    setError('');

    const systemPrompt = `You are a senior board advisor. Generate 3 critical governance questions for a leader in the ${sector} sector who is overseeing AI at scale.
Focus on 'Institutional Foresight' and 'Risk Visibility'. Use high-altitude, professional tone.`;

    try {
      const data = await fetchWithRetry({
        contents: [{ parts: [{ text: 'Generate 3 foresight questions.' }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      });
      setForesight(
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
          'No foresight generated.'
      );
    } catch (err) {
      setError(err.message || 'Failed to generate foresight questions.');
    } finally {
      setForesightLoading(false);
    }
  };

  const playAudioBriefing = async () => {
    if (!analysis) return;
    setIsPlaying(true);
    setError('');

    try {
      const data = await fetchWithRetry({
        contents: [
          {
            parts: [
              {
                text: `Say in a calm, authoritative professional voice: ${analysis}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const base64Audio =
        data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error('Audio data missing');

      const bytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + bytes.length, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, 24000, true); // Sample rate
      view.setUint32(28, 48000, true); // Byte rate
      view.setUint16(32, 2, true); // Block align
      view.setUint16(34, 16, true); // Bits per sample
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, bytes.length, true);

      const blob = new Blob([wavHeader, bytes], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setError('Audio playback failed.');
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.play();
    } catch (err) {
      setError(err.message || 'Audio briefing unavailable.');
      setIsPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 py-16 px-6 flex flex-col items-center text-stone-900 font-sans">
      <main className="max-w-3xl w-full bg-white shadow-xl p-10 md:p-16 border border-stone-200 rounded-sm overflow-hidden">
        <header className="mb-12 border-b pb-8">
          <p className="uppercase tracking-[0.25em] text-[10px] font-bold text-stone-500">
            Sage Sanctuary Wellness
          </p>
          <h1 className="mt-4 text-xl md:text-2xl tracking-[0.2em] uppercase font-light text-stone-800">
            Nadjean Sagesse, MS, DrPH (c)
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mt-2 font-medium">
            Translational AI Governance · Institutional Capacity
          </p>
        </header>

        <section className="mb-12">
          <h2
            className="text-4xl md:text-5xl font-serif leading-tight text-stone-900"
            style={{ fontFamily: '"Playfair Display", serif' }}
          >
            Translational Governance
          </h2>
          <p
            className="italic font-serif text-2xl md:text-3xl mt-4 text-stone-600"
            style={{ fontFamily: '"Playfair Display", serif' }}
          >
            Making AI Systems Safe for Institutional Touch
          </p>
          <div className="h-1 w-20 bg-stone-900 mt-8"></div>
        </section>

        <section className="mb-14 border border-stone-900 bg-stone-50 p-8 rounded-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="uppercase tracking-widest text-[11px] font-bold text-stone-900 flex items-center gap-2">
              <Zap size={14} className="text-amber-600" /> Translational Signal
              Analysis
            </h3>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full p-5 border border-stone-300 bg-white text-lg leading-relaxed focus:ring-1 focus:ring-stone-900 outline-none transition-all placeholder:text-stone-300 font-serif shadow-inner"
            style={{ fontFamily: '"Playfair Display", serif' }}
            rows="4"
            placeholder="Describe a technical or operational signal (e.g. decision fatigue, bypassed review steps, AI-generated outputs entering production unchecked)..."
          ></textarea>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={analyzeSignal}
              disabled={loading || !input.trim()}
              className="px-8 py-3 bg-stone-900 text-white uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-stone-800 disabled:bg-stone-200 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {loading ? 'Synthesizing...' : 'Run Translation'}
            </button>

            {analysis && (
              <button
                onClick={playAudioBriefing}
                disabled={isPlaying}
                className="px-6 py-3 border border-stone-900 text-stone-900 uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-stone-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <Square size={14} fill="currentColor" />
                ) : (
                  <Volume2 size={16} />
                )}
                Audio Briefing
              </button>
            )}
          </div>

          {analysis && (
            <div className="mt-8 bg-white border border-stone-200 p-8 shadow-sm">
              <p className="uppercase tracking-[0.25em] text-[9px] font-bold text-stone-400 mb-6 border-b border-stone-100 pb-2">
                Advisory Readout (Translation)
              </p>
              <div
                className="text-stone-800 text-lg md:text-xl leading-relaxed italic font-serif whitespace-pre-wrap"
                style={{ fontFamily: '"Playfair Display", serif' }}
              >
                {analysis}
              </div>
            </div>
          )}
        </section>

        <section className="mb-14 p-8 border border-stone-200 border-dashed bg-white">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck size={18} className="text-stone-400" />
            <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-stone-500">
              Governance Foresight Generator
            </h3>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="flex-1 p-3 border border-stone-300 rounded-sm text-xs font-bold uppercase bg-stone-50 outline-none focus:ring-1 focus:ring-stone-900 cursor-pointer"
            >
              <option value="Health">Healthcare Systems</option>
              <option value="Education">Education Systems</option>
              <option value="Federal">Federal / Public Service</option>
            </select>
            <button
              onClick={generateForesight}
              disabled={foresightLoading}
              className="px-6 py-3 border border-stone-900 text-stone-900 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-stone-900 hover:text-white transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {foresightLoading ? 'Generating...' : 'Generate Foresight'}
            </button>
          </div>

          {foresight && (
            <div
              className="p-6 bg-stone-50 border border-stone-100 text-lg font-serif italic leading-relaxed text-stone-700 whitespace-pre-wrap"
              style={{ fontFamily: '"Playfair Display", serif' }}
            >
              {foresight}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-14 border-t pt-10">
          <div>
            <p className="uppercase text-[11px] tracking-[0.25em] text-stone-400 font-bold mb-3">
              Bench
            </p>
            <p className="text-xs leading-relaxed text-stone-500">
              Operational reality at the technical point of AI deployment and
              workforce interaction.
            </p>
          </div>
          <div>
            <p className="uppercase text-[11px] tracking-[0.25em] font-bold text-stone-900 mb-3 underline underline-offset-4">
              Bedside
            </p>
            <p className="text-xs leading-relaxed text-stone-900 font-medium">
              Translating raw signals into governance foresight and senior
              leadership decision support.
            </p>
          </div>
          <div>
            <p className="uppercase text-[11px] tracking-[0.25em] text-stone-400 font-bold mb-3">
              Community
            </p>
            <p className="text-xs leading-relaxed text-stone-500">
              Systemic accountability, long-term equity, and maintaining
              enduring institutional trust.
            </p>
          </div>
        </section>

        <footer className="border-t pt-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
          <div>
            <p className="font-bold text-sm uppercase tracking-widest text-stone-800">
              Nadjean Sagesse
            </p>
            <p className="text-xs text-stone-500 font-medium mt-1">
              nadjean@sagesanctuarywellness.com
            </p>
          </div>

          <a
            href="https://calendar.app.google/Pi5zL7bpu3akWY5o9"
            target="_blank"
            rel="noopener noreferrer"
            className="group px-10 py-4 bg-stone-900 text-white uppercase tracking-[0.3em] text-[10px] font-bold hover:bg-stone-800 transition-all flex items-center gap-3 shadow-lg"
          >
            Book Advisory Call
            <ChevronRight
              size={14}
              className="group-hover:translate-x-1 transition-transform"
            />
          </a>
        </footer>

        <div className="mt-20 text-center border-t border-stone-50 pt-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-stone-300 font-medium">
            © 2026 Sage Sanctuary Wellness · Confidential Institutional Advisory
          </p>
        </div>

        {error && (
          <div className="fixed bottom-6 right-6 bg-stone-900 text-white p-5 rounded-sm shadow-2xl flex items-center gap-4 text-xs border border-stone-700 animate-pulse">
            <AlertCircle size={18} className="text-amber-500" />
            <div className="space-y-1">
              <p className="font-bold uppercase tracking-widest">
                Connectivity Signal
              </p>
              <p className="text-stone-400">{error}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

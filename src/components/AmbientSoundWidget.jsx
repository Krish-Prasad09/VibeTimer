import React, { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'flocus-ambient-config';

const SOUNDS = [
  { id: 'rain',      emoji: '🌧️', name: 'Rain' },
  { id: 'cafe',      emoji: '☕',  name: 'Café' },
  { id: 'fireplace', emoji: '🔥', name: 'Fireplace' },
  { id: 'birds',     emoji: '🐦', name: 'Birds' },
  { id: 'ocean',     emoji: '🌊', name: 'Ocean Waves' },
  { id: 'wind',      emoji: '💨', name: 'Wind' },
];

/* ── Shared AudioContext (survives unmount) ─────────────────────── */
let sharedAudioCtx = null;

function getAudioContext() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/* ── Sound generator factories ──────────────────────────────────── */

function createRain(ctx) {
  // White noise → bandpass filter (center 2000Hz, Q 0.5)
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 2000;
  bandpass.Q.value = 0.5;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(bandpass).connect(gain).connect(ctx.destination);
  source.start();

  return { gain, stop: () => source.stop() };
}

function createCafe(ctx) {
  // Brown noise via integration of white noise + subtle random modulation
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5; // boost amplitude
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Subtle amplitude modulation for chatter-like feel
  const modGain = ctx.createGain();
  modGain.gain.value = 1;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.15;
  lfo.connect(lfoGain).connect(modGain.gain);
  lfo.start();

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(modGain).connect(gain).connect(ctx.destination);
  source.start();

  return { gain, stop: () => { source.stop(); lfo.stop(); } };
}

function createFireplace(ctx) {
  // Crackle: scheduled bursts of filtered noise
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);

  let stopped = false;

  function scheduleCrackle() {
    if (stopped) return;

    const duration = 0.01 + Math.random() * 0.04;
    const bufLen = Math.ceil(duration * ctx.sampleRate);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800 + Math.random() * 2000;

    const env = ctx.createGain();
    const now = ctx.currentTime;
    env.gain.setValueAtTime(0.6 + Math.random() * 0.4, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(hp).connect(env).connect(gain);
    src.start(now);
    src.stop(now + duration);

    const next = 20 + Math.random() * 80; // ms
    setTimeout(scheduleCrackle, next);
  }

  scheduleCrackle();

  return { gain, stop: () => { stopped = true; } };
}

function createBirds(ctx) {
  // Multiple chirps with random frequency & timing
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);

  let stopped = false;

  function scheduleChirp() {
    if (stopped) return;

    const freq = 2000 + Math.random() * 3000;
    const duration = 0.05 + Math.random() * 0.1;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * (0.7 + Math.random() * 0.6), now + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.3 + Math.random() * 0.2, now + duration * 0.1);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(env).connect(gain);
    osc.start(now);
    osc.stop(now + duration);

    // Random chirp patterns – sometimes a quick sequence, sometimes a pause
    const burstChance = Math.random();
    let next;
    if (burstChance < 0.3) {
      next = 80 + Math.random() * 150; // rapid successive chirps
    } else {
      next = 400 + Math.random() * 2000; // longer pause
    }
    setTimeout(scheduleChirp, next);
  }

  // Start 2-3 "birds"
  const birdCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < birdCount; i++) {
    setTimeout(scheduleChirp, Math.random() * 1000);
  }

  return { gain, stop: () => { stopped = true; } };
}

function createOcean(ctx) {
  // Pink noise with slow LFO gain modulation (0.1 Hz)
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Pink noise via Voss-McCartney (simplified)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Slow LFO on gain for wave-like volume swell
  const modGain = ctx.createGain();
  modGain.gain.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.1;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.4;
  lfo.connect(lfoGain).connect(modGain.gain);
  lfo.start();

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(modGain).connect(gain).connect(ctx.destination);
  source.start();

  return { gain, stop: () => { source.stop(); lfo.stop(); } };
}

function createWind(ctx) {
  // White noise → bandpass with sweeping LFO on filter frequency
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 800;
  bandpass.Q.value = 0.8;

  // LFO sweeps the bandpass center frequency
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 600;
  lfo.connect(lfoGain).connect(bandpass.frequency);
  lfo.start();

  const gain = ctx.createGain();
  gain.gain.value = 0;

  source.connect(bandpass).connect(gain).connect(ctx.destination);
  source.start();

  return { gain, stop: () => { source.stop(); lfo.stop(); } };
}

const GENERATORS = {
  rain: createRain,
  cafe: createCafe,
  fireplace: createFireplace,
  birds: createBirds,
  ocean: createOcean,
  wind: createWind,
};

/* ── Component ──────────────────────────────────────────────────── */

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function AmbientSoundWidget({ isOpen, onClose }) {
  // config shape: { [soundId]: { active: boolean, volume: number 0-1 } }
  const [config, setConfig] = useState(() => {
    const saved = loadConfig() || {};
    const initial = {};
    SOUNDS.forEach(s => {
      initial[s.id] = saved[s.id] || { active: false, volume: 0.5 };
    });
    return initial;
  });

  const nodesRef = useRef({});

  /* ── Resume AudioContext on first global interaction ─── */
  useEffect(() => {
    const resumeAudio = () => {
      if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume();
      }
    };
    window.addEventListener('click', resumeAudio, { once: true });
    window.addEventListener('keydown', resumeAudio, { once: true });
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, []);

  /* ── Persist config ───────────────────────────────────────────── */
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  /* ── Start / stop individual sounds ───────────────────────────── */
  const startSound = useCallback((id) => {
    if (nodesRef.current[id]) return; // already running
    const ctx = getAudioContext();
    const generator = GENERATORS[id];
    if (!generator) return;
    const node = generator(ctx);
    node.gain.gain.setValueAtTime(config[id]?.volume ?? 0.5, ctx.currentTime);
    nodesRef.current[id] = node;
  }, [config]);

  const stopSound = useCallback((id) => {
    const node = nodesRef.current[id];
    if (!node) return;
    try { node.stop(); } catch { /* ignore */ }
    delete nodesRef.current[id];
  }, []);

  /* ── Sync active sounds with config (also handles re-mount) ─── */
  useEffect(() => {
    SOUNDS.forEach(s => {
      if (config[s.id]?.active) {
        startSound(s.id);
      } else {
        stopSound(s.id);
      }
    });
  }, [config, startSound, stopSound]);

  /* ── Cleanup on unmount: stop all, but keep AudioContext ─────── */
  useEffect(() => {
    return () => {
      Object.keys(nodesRef.current).forEach(id => {
        try { nodesRef.current[id].stop(); } catch { /* ignore */ }
      });
      nodesRef.current = {};
    };
  }, []);

  /* ── Toggle handler ─ */
  const handleToggle = useCallback((id) => {
    getAudioContext(); // ensures context is created/resumed
    setConfig(prev => ({
      ...prev,
      [id]: { ...prev[id], active: !prev[id].active }
    }));
  }, []);

  /* ── Volume handler ───────────────────────────────────────────── */
  const handleVolume = useCallback((id, value) => {
    const vol = parseFloat(value);
    setConfig(prev => ({ ...prev, [id]: { ...prev[id], volume: vol } }));

    // Update live gain node immediately for responsiveness
    const node = nodesRef.current[id];
    if (node) {
      const ctx = getAudioContext();
      node.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
    }
  }, []);

  /* ── Render ───────────────────────────────────────────────────── */
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-20 left-0 w-80 glass-panel rounded-2xl p-4 shadow-2xl animate-fade-in border border-white/20 z-50 flex flex-col mb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-h2 text-lg text-primary">Ambient Sounds</h3>
        <button onClick={onClose} className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Sound rows */}
      <div className="flex flex-col gap-3">
        {SOUNDS.map(sound => {
          const { active, volume } = config[sound.id];
          return (
            <div key={sound.id} className="flex items-center gap-3">
              {/* Emoji */}
              <span className="text-xl w-7 text-center select-none">{sound.emoji}</span>

              {/* Name */}
              <span className={`text-sm w-20 truncate ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
                {sound.name}
              </span>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(sound.id)}
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                  active
                    ? 'text-primary bg-white/10 hover:bg-white/20'
                    : 'text-on-surface-variant bg-black/30 hover:bg-white/10'
                }`}
                aria-label={`Toggle ${sound.name}`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {active ? 'volume_up' : 'volume_off'}
                </span>
              </button>

              {/* Volume slider */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => handleVolume(sound.id, e.target.value)}
                disabled={!active}
                className="ambient-slider flex-grow h-1 appearance-none rounded-full cursor-pointer disabled:opacity-30 disabled:cursor-default"
                aria-label={`${sound.name} volume`}
              />
            </div>
          );
        })}
      </div>

      {/* Inline slider styles */}
      <style>{`
        .ambient-slider {
          background: rgba(255, 255, 255, 0.1);
          outline: none;
        }
        .ambient-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #FFEE00;
          border: 2px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          box-shadow: 0 0 6px rgba(255, 238, 0, 0.4);
          transition: box-shadow 0.2s;
        }
        .ambient-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 12px rgba(255, 238, 0, 0.6);
        }
        .ambient-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #FFEE00;
          border: 2px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          box-shadow: 0 0 6px rgba(255, 238, 0, 0.4);
        }
        .ambient-slider::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.1);
        }
        .ambient-slider::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.1);
        }
        .ambient-slider:disabled::-webkit-slider-thumb {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          cursor: default;
        }
        .ambient-slider:disabled::-moz-range-thumb {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          cursor: default;
        }
      `}</style>
    </div>
  );
}

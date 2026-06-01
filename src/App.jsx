import { useEffect, useState, useRef, useCallback } from "react";

const SPLASH_IMG = "/Screenshot_20260514_110057_ChatGPT~2.jpg";
const LOGO_TEXT  = "/Screenshot_20260514_221551_Photos~2.jpg";

const PROJECT_COLORS = [
  "#39ff14","#00cfff","#bf5fff","#ff9500",
  "#ff3366","#ffee00","#00ffcc","#ff6600",
  "#ff0080","#00ff80","#8080ff","#ff8000",
];
const TRACK_COLORS = ["#39ff14","#00cfff","#bf5fff","#ff9500","#ff3366","#ffee00"];
const TRACK_NAMES  = ["Guitar","Bass","Drums","Vocals","Lead Guitar","Keys"];

const DEFAULT_SECTIONS = [
  "Intro","Pre-Verse","Verse","Chorus","Between Verse",
  "2nd Verse","Breakdown","Guitar Solo","Interlude","Chorus Outro",
];
const DEFAULT_INSTRUMENTS = [
  "Guitar","Bass","Drums","Vocals","Lead Guitar","Synth","Backing Vocals",
];
const STATUS_OPTIONS = ["Draft","In Progress","Final"];
const STATUS_COLORS  = {"Draft":"#888","In Progress":"#ff9500","Final":"#39ff14"};
const NAV = "#0a1628";

// ── AUDIO STORAGE ── base64 in localStorage keyed by recording id
const AUDIO_STORE_PREFIX = "db_audio_";
function saveAudioToStore(id, dataURL) {
  try { localStorage.setItem(AUDIO_STORE_PREFIX + id, dataURL); } catch(e) {
    console.warn("Audio localStorage full, skipping persist for", id);
  }
}
function loadAudioFromStore(id) {
  try { return localStorage.getItem(AUDIO_STORE_PREFIX + id) || null; } catch { return null; }
}
function deleteAudioFromStore(id) {
  try { localStorage.removeItem(AUDIO_STORE_PREFIX + id); } catch {}
}
function listAudioStoreKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(AUDIO_STORE_PREFIX)) keys.push(k.slice(AUDIO_STORE_PREFIX.length));
    }
  } catch {}
  return keys;
}
async function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
function dataURLToObjectURL(dataURL) {
  try {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    const blob = new Blob([u8], { type: mime });
    return URL.createObjectURL(blob);
  } catch { return null; }
}

function makeDefaultSong() {
  return {
    id: 0, name: "My Song",
    sections: [...DEFAULT_SECTIONS],
    status: {}, locked: {}, starred: {},
    sectionNotes: {}, audioNotes: {}, checks: {},
    notes: "", bpm: "", key: "",
  };
}
function makeDefaultTracks() {
  return TRACK_NAMES.map((name, i) => ({
    id: i, name, color: TRACK_COLORS[i],
    recordings: [], volume: 0.8, muted: false, solo: false,
    reverb: 0, lows: 0, mids: 0, highs: 0, notes: "", gain: 1.0,
  }));
}
function makeProject(id, name, color) {
  return {
    id, name, color, songName: "",
    instruments: [...DEFAULT_INSTRUMENTS],
    song: makeDefaultSong(),
    studio: { tracks: makeDefaultTracks() },
  };
}

const STORAGE_KEY    = "db_v17";
const STORAGE_AP     = "db_ap_v17";
const STORAGE_THEME  = "db_theme_v17";
const STORAGE_ACCENT = "db_accent_v17";

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function fmtTime(s) { return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dbToLinear(db) { return Math.pow(10, db / 20); }

async function createReverbNode(ac, amount) {
  const conv = ac.createConvolver();
  const rate = ac.sampleRate, len = rate * (0.5 + amount * 3.5);
  const imp = ac.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const ch = imp.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1 + amount * 3);
  }
  conv.buffer = imp; return conv;
}
function applyEQ(ac, source, track) {
  const low = ac.createBiquadFilter(), mid = ac.createBiquadFilter(), high = ac.createBiquadFilter();
  low.type = "lowshelf";  low.frequency.value = 200;  low.gain.value = (track.lows || 0) * 12;
  mid.type = "peaking";   mid.frequency.value = 1000; mid.gain.value = (track.mids || 0) * 12; mid.Q.value = 1;
  high.type = "highshelf"; high.frequency.value = 4000; high.gain.value = (track.highs || 0) * 12;
  source.connect(low); low.connect(mid); mid.connect(high); return high;
}

// ── THEME — fresh every render, never stale ──
function buildTheme(dark) {
  return dark ? {
    bg: "#000", card: "linear-gradient(145deg,#0a0f0a,#111811)",
    cardBg: "#080d08", text: "#cccccc", subtext: "#666666",
    inputBg: "#050a05", inputBorder: "rgba(255,255,255,0.14)",
    rowHover: "rgba(255,255,255,0.025)", stickyBg: "#080d08",
    headBg: "#111811", border: "rgba(255,255,255,0.09)", checkBg: "#000",
    lineColor: "rgba(255,255,255,0.09)", bodyBg: "#000",
  } : {
    bg: "#edf2fa", card: "linear-gradient(145deg,#ffffff,#f4f8ff)",
    cardBg: "#ffffff", text: NAV, subtext: "#3a4a6a",
    inputBg: "#ffffff", inputBorder: NAV + "55",
    rowHover: "rgba(10,22,40,0.04)", stickyBg: "#ffffff",
    headBg: "#cdd9f0", border: NAV + "44", checkBg: "#ffffff",
    lineColor: NAV + "33", bodyBg: "#edf2fa",
  };
}

function StepControl({ label, value, onChange, min = 0, max = 1, step = 0.1, TC, formatLabel }) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  const dv = value > 0 ? `+${Math.round(value * 10)}` : Math.round(value * 10);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: TC, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>{label}</span>
        <span style={{ color: TC, fontSize: 10, fontWeight: 700 }}>{dv}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
          style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: value <= min ? `${TC}08` : `${TC}22`, border: `1px solid ${TC}${value <= min ? "22" : "66"}`, color: value <= min ? `${TC}44` : TC, cursor: value <= min ? "not-allowed" : "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>⬇️</button>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(128,128,128,0.2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${TC}88,${TC})`, borderRadius: 3, transition: "width 0.1s ease" }} />
        </div>
        <button onClick={() => onChange(Math.min(max, Math.round((value + step) * 10) / 10))}
          style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: value >= max ? `${TC}08` : `${TC}22`, border: `1px solid ${TC}${value >= max ? "22" : "66"}`, color: value >= max ? `${TC}44` : TC, cursor: value >= max ? "not-allowed" : "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>⬆️</button>
      </div>
      {formatLabel && <p style={{ color: "rgba(128,128,128,0.6)", fontSize: 9, margin: "4px 0 0" }}>{formatLabel(value)}</p>}
    </div>
  );
}

// ── NEXUS MIX ──────────────────────────────────────────────────────────────
const NX = {
  bg: "#0a0a0f", panel: "#111118", border: "#1e1e2e",
  accent: "#00e5ff", accentDim: "#00e5ff22",
  green: "#00ff9d", amber: "#ffb700", red: "#ff4466", purple: "#b060ff",
  text: "#e0e0f0", muted: "#5a5a7a",
};

function NxKnob({ label, value, min, max, unit = "", color = NX.accent, onChange, size = 48 }) {
  const dragRef = useRef(null);
  const norm = (value - min) / (max - min);
  const angle = norm * 270 - 135;
  const r = size / 2 - 4, cx = size / 2, cy = size / 2;
  const toXY = deg => { const rad = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]; };
  const [sx, sy] = toXY(-135); const [ex, ey] = toXY(angle); const large = norm * 270 > 180 ? 1 : 0;
  const step = (max - min) / 20;
  const handleMD = e => {
    e.preventDefault(); dragRef.current = { startY: e.clientY, startVal: value };
    const move = ev => { const d = (dragRef.current.startY - ev.clientY) / 150; onChange(parseFloat(clamp(dragRef.current.startVal + d * (max - min), min, max).toFixed(1))); };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  const handleTS = e => {
    dragRef.current = { startY: e.touches[0].clientY, startVal: value };
    const move = ev => { ev.preventDefault(); const d = (dragRef.current.startY - ev.touches[0].clientY) / 100; onChange(parseFloat(clamp(dragRef.current.startVal + d * (max - min), min, max).toFixed(1))); };
    const up = () => { document.removeEventListener("touchmove", move, { passive: false }); document.removeEventListener("touchend", up); };
    document.addEventListener("touchmove", move, { passive: false }); document.addEventListener("touchend", up);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, userSelect: "none" }}>
      <svg width={size} height={size} onMouseDown={handleMD} onTouchStart={handleTS} style={{ cursor: "ns-resize", touchAction: "none" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={NX.border} strokeWidth={3} />
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        <circle cx={ex} cy={ey} r={3} fill={color} />
        <text x={cx} y={cy + 4} textAnchor="middle" fill={NX.text} style={{ fontSize: size * 0.22, fontFamily: "monospace", pointerEvents: "none" }}>
          {Math.abs(value) < 10 ? value.toFixed(1) : Math.round(value)}
        </text>
      </svg>
      <div style={{ display: "flex", gap: 3, marginBottom: 2 }}>
        <button onClick={() => onChange(parseFloat(clamp(value - step, min, max).toFixed(1)))} style={{ width: 26, height: 20, borderRadius: 4, background: `${color}22`, border: `1px solid ${color}44`, color, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>⬇️</button>
        <button onClick={() => onChange(parseFloat(clamp(value + step, min, max).toFixed(1)))} style={{ width: 26, height: 20, borderRadius: 4, background: `${color}22`, border: `1px solid ${color}44`, color, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>⬆️</button>
      </div>
      <span style={{ fontSize: 9, color: NX.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{label}{unit && <span style={{ color: NX.accent }}> {unit}</span>}</span>
    </div>
  );
}

function NxVU({ level = 0, label = "" }) {
  const bars = 16;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {label && <span style={{ fontSize: 9, color: NX.muted, letterSpacing: 1 }}>{label}</span>}
      <div style={{ display: "flex", flexDirection: "column-reverse", gap: 2 }}>
        {Array.from({ length: bars }).map((_, i) => {
          const active = level > (i / bars); const bc = i > 12 ? NX.red : i > 9 ? NX.amber : NX.green;
          return <div key={i} style={{ width: 8, height: 4, borderRadius: 1, background: active ? bc : NX.border, boxShadow: active ? `0 0 4px ${bc}` : "none", transition: "background 0.05s" }} />;
        })}
      </div>
    </div>
  );
}

function NxCard({ title, children, active, onToggle, color = NX.accent, width }) {
  return (
    <div style={{ background: NX.panel, border: `1px solid ${active ? color + "66" : NX.border}`, borderRadius: 6, padding: "10px 12px", width: width || "auto", boxShadow: active ? `0 0 14px ${color}22` : "none", transition: "all 0.3s", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: active ? color : NX.muted, letterSpacing: 2 }}>◈ {title}</span>
        {onToggle && <button onClick={onToggle} style={{ background: active ? color + "22" : "transparent", border: `1px solid ${active ? color : NX.border}`, color: active ? color : NX.muted, padding: "3px 8px", borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{active ? "ON" : "OFF"}</button>}
      </div>
      {children}
    </div>
  );
}

function EQVisualizer({ bands }) {
  const W = 300, H = 72;
  const logMin = Math.log10(20), logMax = Math.log10(20000);
  const freqToX = f => ((Math.log10(f) - logMin) / (logMax - logMin)) * W;
  const gainToY = g => H / 2 - (g / 18) * (H / 2 - 4);
  const getAt = freq => { let t = 0; bands.forEach(b => { const d = Math.abs(Math.log10(freq / b.freq)); t += b.gain * Math.exp(-d * d * 1.5); }); return clamp(t, -18, 18); };
  const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const pts = freqs.map(f => ({ x: freqToX(f), y: gainToY(getAt(f)) }));
  const pathD = pts.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`).join(" ");
  const fillD = pathD + ` L ${W} ${H / 2} L 0 ${H / 2} Z`;
  return (
    <svg width={W} height={H} style={{ display: "block", width: "100%" }}>
      <defs><linearGradient id="eqf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={NX.accent} stopOpacity="0.3" /><stop offset="100%" stopColor={NX.accent} stopOpacity="0" /></linearGradient></defs>
      {[-12, -6, 0, 6, 12].map(g => <line key={g} x1={0} y1={gainToY(g)} x2={W} y2={gainToY(g)} stroke={g === 0 ? NX.border + "88" : NX.border + "44"} strokeWidth={g === 0 ? 1.5 : 0.5} />)}
      <path d={fillD} fill="url(#eqf)" /><path d={pathD} fill="none" stroke={NX.accent} strokeWidth={2} style={{ filter: `drop-shadow(0 0 3px ${NX.accent})` }} />
      {bands.map((b, i) => <circle key={i} cx={freqToX(b.freq)} cy={gainToY(b.gain)} r={3} fill={NX.accent} style={{ filter: `drop-shadow(0 0 4px ${NX.accent})` }} />)}
    </svg>
  );
}

function WaveformDisplay({ analyser, isPlaying }) {
  const canvasRef = useRef(null); const animRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); const W = canvas.width, H = canvas.height;
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      ctx.fillStyle = NX.bg; ctx.fillRect(0, 0, W, H);
      if (analyser && isPlaying) {
        const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteTimeDomainData(data);
        ctx.beginPath(); ctx.strokeStyle = NX.accent; ctx.lineWidth = 1.5; ctx.shadowColor = NX.accent; ctx.shadowBlur = 6;
        const sw = W / data.length; let x = 0;
        for (let i = 0; i < data.length; i++) { const v = data[i] / 128, y = (v * H) / 2; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); x += sw; }
        ctx.stroke();
      } else { ctx.beginPath(); ctx.strokeStyle = NX.border; ctx.lineWidth = 1; ctx.moveTo(0, H / 2); for (let x = 0; x < W; x += 4) ctx.lineTo(x, H / 2 + (Math.random() - 0.5) * 1.5); ctx.stroke(); }
    };
    draw(); return () => cancelAnimationFrame(animRef.current);
  }, [analyser, isPlaying]);
  return <canvas ref={canvasRef} width={680} height={50} style={{ width: "100%", height: 50, borderRadius: 4, border: `1px solid ${NX.border}` }} />;
}

function SpectrumAnalyzer({ analyser, isPlaying }) {
  const canvasRef = useRef(null); const animRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); const W = canvas.width, H = canvas.height;
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      ctx.fillStyle = NX.bg; ctx.fillRect(0, 0, W, H);
      if (analyser && isPlaying) {
        const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data); const bw = W / (data.length / 4);
        for (let i = 0; i < data.length / 4; i++) { const v = data[i] / 255, bh = v * H, hue = 180 + v * 80; ctx.fillStyle = `hsl(${hue},100%,${40 + v * 30}%)`; ctx.shadowColor = `hsl(${hue},100%,60%)`; ctx.shadowBlur = 4; ctx.fillRect(i * bw, H - bh, bw - 1, bh); }
      } else { for (let i = 0; i < 50; i++) { ctx.fillStyle = NX.border; ctx.fillRect(i * (W / 50), H - Math.random() * 3 - 1, W / 50 - 1, 3); } }
    };
    draw(); return () => cancelAnimationFrame(animRef.current);
  }, [analyser, isPlaying]);
  return <canvas ref={canvasRef} width={680} height={70} style={{ width: "100%", height: 70, borderRadius: 4, border: `1px solid ${NX.border}` }} />;
}

function NexusMixScreen({ accentColor, studioTracks, studioAudioURLs }) {
  const audioCtxRef = useRef(null); const sourceRef = useRef(null); const analyserRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [levels, setLevels] = useState({ L: 0, R: 0, M: 0 });
  const [masterGain, setMasterGain] = useState(0);
  const [eq, setEq] = useState([
    { label: "Sub", freq: 60, gain: 0 }, { label: "Bass", freq: 120, gain: 0 },
    { label: "Low-Mid", freq: 400, gain: 0 }, { label: "Mid", freq: 1000, gain: 0 },
    { label: "Hi-Mid", freq: 3000, gain: 0 }, { label: "Air", freq: 10000, gain: 0 },
  ]);
  const [eqActive, setEqActive] = useState(true);
  const [reverb, setReverb] = useState({ mix: 20, size: 60, damping: 50, predelay: 20 });
  const [reverbActive, setReverbActive] = useState(false);
  const [comp, setComp] = useState({ threshold: -24, ratio: 4, attack: 10, release: 100, makeup: 0 });
  const [compActive, setCompActive] = useState(true);
  const [deEsser, setDeEsser] = useState({ freq: 7500, threshold: -20, ratio: 6 });
  const [deEsserActive, setDeEsserActive] = useState(false);
  const [gate, setGate] = useState({ threshold: -50, attack: 5, release: 200, hold: 50 });
  const [gateActive, setGateActive] = useState(false);
  const [limiter, setLimiter] = useState({ ceiling: -0.3, release: 50 });
  const [limiterActive, setLimiterActive] = useState(true);
  const [saturation, setSaturation] = useState({ drive: 0, type: "tape", mix: 30 });
  const [satActive, setSatActive] = useState(false);
  const [stereoWidth, setStereoWidth] = useState(100);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState({});
  const [aiMasterActive, setAiMasterActive] = useState(false);
  const [preAiSnapshot, setPreAiSnapshot] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [projectMode, setProjectMode] = useState(false);

  useEffect(() => {
    let raf;
    const animate = () => {
      if (analyserRef.current && isPlaying) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount); analyserRef.current.getByteTimeDomainData(data);
        let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length); setLevels({ L: rms * 1.2, R: rms, M: rms * 1.1 });
      } else setLevels({ L: 0, R: 0, M: 0 });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate); return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const handleFile = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name); setProjectMode(false);
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current = ctx;
    const buf = await file.arrayBuffer(); const decoded = await ctx.decodeAudioData(buf); setAudioBuffer(decoded);
  };

  const handleLoadProject = async () => {
    const tracks = studioTracks || []; const urls = studioAudioURLs || {};
    const ready = tracks.filter(t => { const lr = t.recordings[t.recordings.length - 1]; return lr && urls[lr.id]; });
    if (ready.length === 0) { alert("No recorded tracks yet. Record some tracks first!"); return; }
    setProjectMode(true); setFileName(`Studio Project (${ready.length} tracks)`);
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); audioCtxRef.current = ctx;
    setAudioBuffer(ctx.createBuffer(2, ctx.sampleRate * 0.1, ctx.sampleRate));
    alert(`✓ Loaded ${ready.length} studio tracks. Press PLAY to hear through the mixer chain.`);
  };

  const buildChain = useCallback(async () => {
    const ctx = audioCtxRef.current; if (!ctx) return;
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
    let node;
    if (projectMode && studioTracks && studioAudioURLs) {
      const merger = ctx.createChannelMerger(2); const hasSolo = studioTracks.some(t => t.solo);
      for (const track of studioTracks) {
        if (track.muted || (hasSolo && !track.solo)) continue;
        const lr = track.recordings[track.recordings.length - 1]; if (!lr) continue;
        const url = studioAudioURLs[lr.id]; if (!url) continue;
        try {
          const r = await fetch(url); const ab = await r.arrayBuffer(); const buf = await ctx.decodeAudioData(ab);
          const src = ctx.createBufferSource(); src.buffer = buf;
          const gn = ctx.createGain(); gn.gain.value = track.volume;
          src.connect(gn); gn.connect(merger); src.start(0);
        } catch {}
      }
      node = merger;
    } else {
      if (!audioBuffer) return;
      const src = ctx.createBufferSource(); src.buffer = audioBuffer; sourceRef.current = src; node = src;
    }
    eq.forEach(band => {
      const f = ctx.createBiquadFilter();
      f.type = band.label === "Sub" || band.label === "Bass" ? "lowshelf" : band.label === "Air" ? "highshelf" : "peaking";
      f.frequency.value = band.freq; f.gain.value = eqActive ? band.gain : 0; f.Q.value = 1.4;
      node.connect(f); node = f;
    });
    const cn = ctx.createDynamicsCompressor();
    cn.threshold.value = compActive ? comp.threshold : 0; cn.ratio.value = compActive ? comp.ratio : 1;
    cn.attack.value = comp.attack / 1000; cn.release.value = comp.release / 1000; cn.knee.value = 6;
    node.connect(cn); node = cn;
    const mn = ctx.createGain(); mn.gain.value = dbToLinear(compActive ? comp.makeup : 0); node.connect(mn); node = mn;
    const ln = ctx.createDynamicsCompressor();
    ln.threshold.value = limiterActive ? limiter.ceiling : 0; ln.ratio.value = 20;
    ln.attack.value = 0.001; ln.release.value = limiter.release / 1000; ln.knee.value = 0;
    node.connect(ln); node = ln;
    const gn = ctx.createGain(); gn.gain.value = dbToLinear(masterGain); node.connect(gn); node = gn;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser; node.connect(analyser); analyser.connect(ctx.destination);
    if (!projectMode && sourceRef.current) { sourceRef.current.start(0); sourceRef.current.onended = () => setIsPlaying(false); }
    setIsPlaying(true);
  }, [audioBuffer, eq, eqActive, comp, compActive, limiter, limiterActive, masterGain, projectMode, studioTracks, studioAudioURLs]);

  const handlePlay = () => { if (!audioBuffer) return; if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume(); buildChain(); };
  const handleStop = () => { try { sourceRef.current?.stop(); } catch {} setIsPlaying(false); };
  const snap = () => ({ eq: [...eq.map(b => ({ ...b }))], eqActive, comp: { ...comp }, compActive, limiter: { ...limiter }, limiterActive, masterGain, stereoWidth });

  const handleAutoMaster = () => {
    setPreAiSnapshot(snap());
    setEq([{ label: "Sub", freq: 60, gain: -2 }, { label: "Bass", freq: 120, gain: 1.5 }, { label: "Low-Mid", freq: 400, gain: -1 }, { label: "Mid", freq: 1000, gain: 0.5 }, { label: "Hi-Mid", freq: 3000, gain: 1 }, { label: "Air", freq: 10000, gain: 2 }]);
    setComp({ threshold: -18, ratio: 3, attack: 15, release: 80, makeup: 2 }); setCompActive(true);
    setLimiter({ ceiling: -0.3, release: 50 }); setLimiterActive(true); setMasterGain(2); setStereoWidth(110); setAiMasterActive(true);
    setSuggestions([{ text: "▸ EQ: -2dB sub cut.", action: null, params: {} }, { text: "▸ EQ: +2dB air shelf.", action: null, params: {} }, { text: "▸ Comp: 3:1 ratio at -18dB.", action: null, params: {} }, { text: "▸ Limiter at -0.3dBTP.", action: null, params: {} }, { text: "▸ Stereo width 110%.", action: null, params: {} }]);
  };
  const toggleAiMaster = () => {
    if (aiMasterActive && preAiSnapshot) {
      setEq(preAiSnapshot.eq); setEqActive(preAiSnapshot.eqActive); setComp(preAiSnapshot.comp); setCompActive(preAiSnapshot.compActive);
      setLimiter(preAiSnapshot.limiter); setLimiterActive(preAiSnapshot.limiterActive); setMasterGain(preAiSnapshot.masterGain); setStereoWidth(preAiSnapshot.stereoWidth); setAiMasterActive(false);
    } else handleAutoMaster();
  };

  const handleAIAnalyze = async () => {
    setAnalyzing(true); setSuggestions([]); setAppliedSuggestions({});
    const fallback = [{ text: "▸ Cut Sub -6dB to remove rumble.", action: "eq", params: { bandIndex: 0, gain: -6 } }, { text: "▸ Comp threshold -18dB ratio 3:1.", action: "comp", params: { threshold: -18, ratio: 3, attack: 15, release: 80, makeup: 2 } }, { text: "▸ Air boost +2dB at 10kHz.", action: "eq", params: { bandIndex: 5, gain: 2 } }, { text: "▸ Limiter ceiling at -0.3dBTP.", action: "limiter", params: { ceiling: -0.3, release: 50 } }, { text: "▸ Master output +2dB.", action: "master", params: { gain: 2 } }];
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: `Expert mixing engineer: give 5 suggestions as JSON array [{"text":"▸ text","action":"eq|comp|limiter|reverb|stereo|master","params":{}}]. eq: bandIndex(0-5)+gain. comp: threshold,ratio,attack,release,makeup. limiter: ceiling,release. stereo: width. master: gain. ONLY JSON.\nEQ(${eqActive ? "ON" : "OFF"}): ${eq.map(b => `${b.label}:${b.gain > 0 ? "+" : ""}${b.gain}dB`).join(",")}\nComp(${compActive ? "ON" : "OFF"}): T:${comp.threshold} R:${comp.ratio}:1\nLimiter(${limiterActive ? "ON" : "OFF"}): ${limiter.ceiling}dBTP Stereo:${stereoWidth}% Master:${masterGain}dB` }] })
      });
      const data = await resp.json(); const text = data.content?.map(c => c.text || "").join("") || "";
      try { const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); if (Array.isArray(parsed)) setSuggestions(parsed); else throw 0; }
      catch { setSuggestions(fallback); }
    } catch { setSuggestions(fallback); }
    setAnalyzing(false);
  };

  const applySuggestion = (s, i) => {
    if (appliedSuggestions[i]) {
      const ss = appliedSuggestions[i].snapshot;
      if (ss.eq) setEq(ss.eq); if (ss.comp) setComp(ss.comp); if (ss.limiter) setLimiter(ss.limiter);
      if (ss.masterGain !== undefined) setMasterGain(ss.masterGain); if (ss.stereoWidth !== undefined) setStereoWidth(ss.stereoWidth);
      setAppliedSuggestions(prev => { const n = { ...prev }; delete n[i]; return n; }); return;
    }
    const ss = { eq: [...eq.map(b => ({ ...b }))], comp: { ...comp }, limiter: { ...limiter }, masterGain, stereoWidth };
    const p = s.params || {};
    switch (s.action) {
      case "eq": if (p.bandIndex !== undefined) setEq(prev => prev.map((b, j) => j === p.bandIndex ? { ...b, gain: p.gain } : b)); setEqActive(true); break;
      case "comp": setComp(prev => ({ ...prev, ...p })); setCompActive(true); break;
      case "limiter": setLimiter(prev => ({ ...prev, ...p })); setLimiterActive(true); break;
      case "reverb": setReverb(prev => ({ ...prev, ...p })); setReverbActive(true); break;
      case "stereo": if (p.width !== undefined) setStereoWidth(p.width); break;
      case "master": if (p.gain !== undefined) setMasterGain(p.gain); break;
    }
    setAppliedSuggestions(prev => ({ ...prev, [i]: { snapshot: ss } }));
  };

  const handleExport = async () => {
    if (!audioBuffer || projectMode) return; setExporting(true);
    try {
      const oc = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
      const src = oc.createBufferSource(); src.buffer = audioBuffer; let node = src;
      eq.forEach(band => { const f = oc.createBiquadFilter(); f.type = band.label === "Sub" || band.label === "Bass" ? "lowshelf" : band.label === "Air" ? "highshelf" : "peaking"; f.frequency.value = band.freq; f.gain.value = eqActive ? band.gain : 0; f.Q.value = 1.4; node.connect(f); node = f; });
      const cn = oc.createDynamicsCompressor(); cn.threshold.value = compActive ? comp.threshold : 0; cn.ratio.value = compActive ? comp.ratio : 1; cn.attack.value = comp.attack / 1000; cn.release.value = comp.release / 1000; cn.knee.value = 6; node.connect(cn); node = cn;
      const mn = oc.createGain(); mn.gain.value = dbToLinear(compActive ? comp.makeup : 0); node.connect(mn); node = mn;
      const ln = oc.createDynamicsCompressor(); ln.threshold.value = limiterActive ? limiter.ceiling : 0; ln.ratio.value = 20; ln.attack.value = 0.001; ln.release.value = limiter.release / 1000; ln.knee.value = 0; node.connect(ln); node = ln;
      const gn = oc.createGain(); gn.gain.value = dbToLinear(masterGain); node.connect(gn); gn.connect(oc.destination); src.start(0);
      const rendered = await oc.startRendering();
      const nc = rendered.numberOfChannels, sr = rendered.sampleRate, bd = 16, ba = nc * (bd / 8), dl = rendered.length * ba;
      const ab2 = new ArrayBuffer(44 + dl); const v = new DataView(ab2);
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, "RIFF"); v.setUint32(4, 36 + dl, true); ws(8, "WAVE"); ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ba, true); v.setUint16(32, ba, true); v.setUint16(34, bd, true); ws(36, "data"); v.setUint32(40, dl, true);
      let off = 44; for (let i = 0; i < rendered.length; i++) { for (let c = 0; c < nc; c++) { const s = Math.max(-1, Math.min(1, rendered.getChannelData(c)[i])); v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2; } }
      const blob = new Blob([ab2], { type: "audio/wav" }); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${(fileName || "master").replace(/\.[^/.]+$/, "")}_mastered.wav`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { alert("Export failed: " + e.message); }
    setExporting(false);
  };

  return (
    <div style={{ background: NX.bg, minHeight: "100%", padding: "12px", fontFamily: "'Rajdhani',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, borderBottom: `1px solid ${NX.border}`, paddingBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div><div style={{ fontFamily: "monospace", fontSize: 18, color: NX.accent, letterSpacing: 4, textShadow: `0 0 16px ${NX.accent}` }}>◈ NEXUS MIX</div><div style={{ fontSize: 10, color: NX.muted, letterSpacing: 3 }}>AI MIX & MASTER STUDIO</div></div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleLoadProject} style={{ background: `${NX.purple}22`, border: `1px solid ${NX.purple}`, color: NX.purple, padding: "5px 10px", borderRadius: 4, fontFamily: "monospace", fontSize: 10, cursor: "pointer" }}>🎛️ LOAD PROJECT{projectMode && <span style={{ color: NX.green }}> ✓</span>}</button>
          <label style={{ background: NX.accentDim, border: `1px solid ${NX.accent}`, color: NX.accent, padding: "5px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 10 }}>↑ LOAD FILE<input type="file" accept="audio/*" onChange={handleFile} style={{ display: "none" }} /></label>
          {fileName && <span style={{ fontSize: 9, color: NX.muted, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>}
          <button onClick={handlePlay} disabled={!audioBuffer} style={{ background: isPlaying ? NX.green + "22" : NX.accentDim, border: `1px solid ${isPlaying ? NX.green : NX.accent}`, color: isPlaying ? NX.green : NX.accent, padding: "5px 14px", borderRadius: 4, fontFamily: "monospace", fontSize: 12, cursor: audioBuffer ? "pointer" : "not-allowed" }}>▶ PLAY</button>
          <button onClick={handleStop} style={{ background: "transparent", border: `1px solid ${NX.border}`, color: NX.muted, padding: "5px 10px", borderRadius: 4, fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}>■ STOP</button>
          <button onClick={preAiSnapshot ? toggleAiMaster : handleAutoMaster} style={{ background: aiMasterActive ? `linear-gradient(135deg,${NX.purple}44,${NX.accent}33)` : `linear-gradient(135deg,${NX.purple}22,${NX.accent}11)`, border: `2px solid ${aiMasterActive ? NX.purple : NX.border}`, color: aiMasterActive ? NX.purple : NX.muted, padding: "5px 10px", borderRadius: 4, fontFamily: "monospace", fontSize: 10, cursor: "pointer", boxShadow: aiMasterActive ? `0 0 12px ${NX.purple}66` : "none" }}>⚡ AI MASTER {aiMasterActive ? "ON" : "OFF"}</button>
          <button onClick={handleExport} disabled={!audioBuffer || exporting || projectMode} style={{ background: audioBuffer && !projectMode ? "#00ff9d22" : "transparent", border: `1px solid ${audioBuffer && !projectMode ? "#00ff9d" : "#333"}`, color: audioBuffer && !projectMode ? "#00ff9d" : NX.muted, padding: "5px 10px", borderRadius: 4, fontFamily: "monospace", fontSize: 10, cursor: audioBuffer && !projectMode ? "pointer" : "not-allowed" }}>{exporting ? "⏳..." : "💾 EXPORT WAV"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><NxVU level={levels.L} label="L" /><NxVU level={levels.M} label="M" /><NxVU level={levels.R} label="R" /></div>
      </div>

      {preAiSnapshot && (
        <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: aiMasterActive ? `${NX.purple}22` : `${NX.border}44`, border: `1px solid ${aiMasterActive ? NX.purple : NX.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: aiMasterActive ? NX.purple : NX.muted, fontFamily: "monospace" }}>{aiMasterActive ? "◈ AI MASTER ACTIVE — tap to compare" : "◈ ORIGINAL — tap to hear AI master"}</span>
          <button onClick={toggleAiMaster} style={{ background: aiMasterActive ? `${NX.purple}33` : `${NX.accent}22`, border: `1px solid ${aiMasterActive ? NX.purple : NX.accent}`, color: aiMasterActive ? NX.purple : NX.accent, padding: "3px 10px", borderRadius: 3, fontFamily: "monospace", fontSize: 10, cursor: "pointer" }}>{aiMasterActive ? "◄ ORIGINAL" : "AI MASTER ►"}</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        <WaveformDisplay analyser={analyserRef.current} isPlaying={isPlaying} />
        <SpectrumAnalyzer analyser={analyserRef.current} isPlaying={isPlaying} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <NxCard title="PARAMETRIC EQ" active={eqActive} onToggle={() => setEqActive(v => !v)} color={NX.accent} width={360}>
          <EQVisualizer bands={eq} />
          <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "space-around", flexWrap: "wrap" }}>
            {eq.map((band, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <NxKnob label={band.label} value={band.gain} min={-18} max={18} unit="dB" color={band.gain > 0 ? NX.green : band.gain < 0 ? NX.red : NX.accent} onChange={v => setEq(eq.map((b, j) => j === i ? { ...b, gain: v } : b))} size={40} />
                <span style={{ fontSize: 8, color: NX.muted }}>{band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)}k` : band.freq}Hz</span>
              </div>
            ))}
          </div>
        </NxCard>
        <NxCard title="COMPRESSOR" active={compActive} onToggle={() => setCompActive(v => !v)} color={NX.amber} width={260}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            <NxKnob label="Threshold" value={comp.threshold} min={-60} max={0} unit="dB" color={NX.amber} onChange={v => setComp(c => ({ ...c, threshold: v }))} />
            <NxKnob label="Ratio" value={comp.ratio} min={1} max={20} color={NX.amber} onChange={v => setComp(c => ({ ...c, ratio: v }))} />
            <NxKnob label="Attack" value={comp.attack} min={0.1} max={200} unit="ms" color={NX.amber} onChange={v => setComp(c => ({ ...c, attack: v }))} />
            <NxKnob label="Release" value={comp.release} min={10} max={2000} unit="ms" color={NX.amber} onChange={v => setComp(c => ({ ...c, release: v }))} />
            <NxKnob label="Makeup" value={comp.makeup} min={0} max={24} unit="dB" color={NX.green} onChange={v => setComp(c => ({ ...c, makeup: v }))} />
          </div>
          <div style={{ marginTop: 8, padding: "5px 8px", background: NX.border + "44", borderRadius: 4 }}><div style={{ fontSize: 9, color: NX.muted }}>GR: <span style={{ color: NX.amber }}>{compActive ? Math.min(0, (comp.threshold + 20) / comp.ratio).toFixed(1) : "0.0"} dB</span></div></div>
        </NxCard>
        <NxCard title="REVERB" active={reverbActive} onToggle={() => setReverbActive(v => !v)} color={NX.purple} width={220}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            <NxKnob label="Mix" value={reverb.mix} min={0} max={100} unit="%" color={NX.purple} onChange={v => setReverb(r => ({ ...r, mix: v }))} />
            <NxKnob label="Size" value={reverb.size} min={0} max={100} unit="%" color={NX.purple} onChange={v => setReverb(r => ({ ...r, size: v }))} />
            <NxKnob label="Damp" value={reverb.damping} min={0} max={100} unit="%" color={NX.purple} onChange={v => setReverb(r => ({ ...r, damping: v }))} />
            <NxKnob label="Pre-DLY" value={reverb.predelay} min={0} max={200} unit="ms" color={NX.purple} onChange={v => setReverb(r => ({ ...r, predelay: v }))} />
          </div>
        </NxCard>
        <NxCard title="DE-ESSER" active={deEsserActive} onToggle={() => setDeEsserActive(v => !v)} color={NX.green} width={200}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <NxKnob label="Freq" value={deEsser.freq} min={2000} max={16000} unit="Hz" color={NX.green} onChange={v => setDeEsser(d => ({ ...d, freq: v }))} />
            <NxKnob label="Thresh" value={deEsser.threshold} min={-40} max={0} unit="dB" color={NX.green} onChange={v => setDeEsser(d => ({ ...d, threshold: v }))} />
            <NxKnob label="Ratio" value={deEsser.ratio} min={1} max={20} color={NX.green} onChange={v => setDeEsser(d => ({ ...d, ratio: v }))} />
          </div>
        </NxCard>
        <NxCard title="NOISE GATE" active={gateActive} onToggle={() => setGateActive(v => !v)} color={NX.red} width={240}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", alignItems: "flex-start" }}>
            <NxKnob label="Threshold" value={gate.threshold} min={-80} max={0} unit="dB" color={NX.red} onChange={v => setGate(g => ({ ...g, threshold: v }))} />
            <NxKnob label="Attack" value={gate.attack} min={0.1} max={100} unit="ms" color={NX.red} onChange={v => setGate(g => ({ ...g, attack: v }))} />
            <NxKnob label="Hold" value={gate.hold} min={0} max={500} unit="ms" color={NX.red} onChange={v => setGate(g => ({ ...g, hold: v }))} />
            <NxKnob label="Release" value={gate.release} min={10} max={2000} unit="ms" color={NX.red} onChange={v => setGate(g => ({ ...g, release: v }))} />
          </div>
        </NxCard>
        <NxCard title="SATURATION" active={satActive} onToggle={() => setSatActive(v => !v)} color="#f0932b" width={190}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <NxKnob label="Drive" value={saturation.drive} min={0} max={100} unit="%" color="#f0932b" onChange={v => setSaturation(s => ({ ...s, drive: v }))} />
            <NxKnob label="Mix" value={saturation.mix} min={0} max={100} unit="%" color="#f0932b" onChange={v => setSaturation(s => ({ ...s, mix: v }))} />
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>{["tape", "tube", "clip"].map(t => <button key={t} onClick={() => setSaturation(s => ({ ...s, type: t }))} style={{ flex: 1, background: saturation.type === t ? "#f0932b22" : "transparent", border: `1px solid ${saturation.type === t ? "#f0932b" : NX.border}`, color: saturation.type === t ? "#f0932b" : NX.muted, padding: "3px 4px", borderRadius: 3, fontSize: 9, cursor: "pointer", textTransform: "uppercase" }}>{t}</button>)}</div>
        </NxCard>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <NxCard title="LIMITER" active={limiterActive} onToggle={() => setLimiterActive(v => !v)} color={NX.red} width={180}>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <NxKnob label="Ceiling" value={limiter.ceiling} min={-6} max={0} unit="dBTP" color={NX.red} onChange={v => setLimiter(l => ({ ...l, ceiling: v }))} />
              <NxKnob label="Release" value={limiter.release} min={1} max={500} unit="ms" color={NX.red} onChange={v => setLimiter(l => ({ ...l, release: v }))} />
            </div>
          </NxCard>
          <NxCard title="STEREO WIDTH" active={true} color={NX.purple} width={180}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <NxKnob label="Width" value={stereoWidth} min={0} max={200} unit="%" color={NX.purple} onChange={setStereoWidth} size={52} />
              <div style={{ fontSize: 9, color: NX.muted }}>{stereoWidth < 80 ? "◄ NARROW" : stereoWidth > 120 ? "WIDE ►" : "● BALANCED"}</div>
            </div>
          </NxCard>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <NxCard title="MASTER OUT" active={true} color={NX.green} width={160}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <NxKnob label="Output" value={masterGain} min={-24} max={12} unit="dB" color={NX.green} onChange={setMasterGain} size={58} />
              <div style={{ fontSize: 9, color: NX.muted }}>LUFS: <span style={{ color: NX.green }}>{isPlaying ? `${(-14 + masterGain).toFixed(1)}` : "---"}</span></div>
              <div style={{ fontSize: 9, color: NX.muted }}>Peak: <span style={{ color: levels.M > 0.9 ? NX.red : NX.green }}>{isPlaying ? `${(20 * Math.log10(levels.M + 0.001)).toFixed(1)} dB` : "---"}</span></div>
            </div>
          </NxCard>
          <NxCard title="AI ENGINEER" active={true} color={NX.purple} width={160}>
            <button onClick={handleAIAnalyze} disabled={analyzing} style={{ width: "100%", background: analyzing ? NX.accentDim : `linear-gradient(135deg,${NX.accent}22,${NX.purple}22)`, border: `1px solid ${analyzing ? NX.accent : NX.purple}`, color: analyzing ? NX.accent : NX.purple, padding: "8px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 10, cursor: analyzing ? "wait" : "pointer", letterSpacing: 1, boxShadow: `0 0 10px ${NX.purple}33`, marginBottom: 8 }}>{analyzing ? "◈ ANALYZING..." : "◈ AI ANALYZE"}</button>
            <div style={{ fontSize: 9, color: NX.muted, textAlign: "center", lineHeight: 1.5 }}>Analyze & get<br />5 suggestions<br />try one by one</div>
          </NxCard>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: NX.panel, border: `1px solid ${NX.purple}44`, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: NX.purple, fontFamily: "monospace", letterSpacing: 2, marginBottom: 10 }}>◈ AI RECOMMENDATIONS — TAP TO APPLY/UNDO EACH</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s, i) => {
              const applied = !!appliedSuggestions[i]; const hasAction = s.action && s.action !== null; const text = typeof s === "string" ? s : s.text;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 6, background: applied ? `${NX.accent}22` : NX.accentDim, border: `1px solid ${applied ? NX.accent : NX.border}`, transition: "all 0.2s" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: applied ? NX.accent : "transparent", border: `2px solid ${applied ? NX.accent : NX.muted}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: applied ? "#000" : NX.muted, fontWeight: 700 }}>{applied ? "✓" : (i + 1)}</div>
                  <span style={{ flex: 1, fontSize: 11, color: applied ? NX.accent : NX.text, fontFamily: "monospace", lineHeight: 1.5 }}>{text}</span>
                  {hasAction ? <button onClick={() => applySuggestion(s, i)} style={{ background: applied ? `${NX.accent}33` : `${NX.purple}22`, border: `1px solid ${applied ? NX.accent : NX.purple}`, color: applied ? NX.accent : NX.purple, padding: "4px 10px", borderRadius: 4, fontFamily: "monospace", fontSize: 10, cursor: "pointer", whiteSpace: "nowrap" }}>{applied ? "↩ UNDO" : "▶ APPLY"}</button> : <span style={{ fontSize: 9, color: NX.muted, fontStyle: "italic" }}>manual</span>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: NX.muted, fontFamily: "monospace" }}>▸ Apply one at a time · Tap again to undo · Play while applying for A/B</div>
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", padding: "5px 0", borderTop: `1px solid ${NX.border}` }}>
        <span style={{ fontSize: 9, color: NX.muted, fontFamily: "monospace" }}>STATUS: <span style={{ color: isPlaying ? NX.green : NX.muted }}>{isPlaying ? "● PLAYING" : "○ STOPPED"}</span></span>
        <span style={{ fontSize: 9, color: NX.muted, fontFamily: "monospace" }}>EQ:{eqActive ? "ON" : "OFF"} · COMP:{compActive ? "ON" : "OFF"} · LIM:{limiterActive ? "ON" : "OFF"} · VERB:{reverbActive ? "ON" : "OFF"}</span>
        {aiMasterActive && <span style={{ fontSize: 9, color: NX.purple, fontFamily: "monospace", background: `${NX.purple}22`, padding: "2px 6px", borderRadius: 3 }}>⚡ AI MASTER ACTIVE</span>}
        {projectMode && <span style={{ fontSize: 9, color: NX.green, fontFamily: "monospace", background: `${NX.green}22`, padding: "2px 6px", borderRadius: 3 }}>🎛️ STUDIO PROJECT LOADED</span>}
      </div>
    </div>
  );
}

// ── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("loading");
  const [menuOpen, setMenuOpen] = useState(false);
  const [screen, setScreen] = useState("studio");
  const [notesOpen, setNotesOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => load(STORAGE_THEME, true));
  const [accentColor, setAccentColor] = useState(() => load(STORAGE_ACCENT, "#39ff14"));
  const [projects, setProjects] = useState(() => load(STORAGE_KEY, [makeProject(0, "My First Song", "#39ff14")]));
  const [activeProject, setActiveProject] = useState(() => load(STORAGE_AP, 0));
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameValue, setProjectNameValue] = useState("");
  const [editingSongName, setEditingSongName] = useState(false);
  const [songNameValue, setSongNameValue] = useState("");
  const [editingProjectSong, setEditingProjectSong] = useState(false);
  const [projectSongValue, setProjectSongValue] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedTrack, setDraggedTrack] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newInstrument, setNewInstrument] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#39ff14");
  const [instrPanelOpen, setInstrPanelOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [sectionNoteOpen, setSectionNoteOpen] = useState(null);
  const [audioNoteOpen, setAudioNoteOpen] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioURLs, setAudioURLs] = useState({});
  const [playingId, setPlayingId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [expandedTrack, setExpandedTrack] = useState(null);
  const [editingTrackName, setEditingTrackName] = useState(null);
  const [trackNameValue, setTrackNameValue] = useState("");
  const [trackColorPicker, setTrackColorPicker] = useState(null);
  const [studioRecordingTrack, setStudioRecordingTrack] = useState(null);
  const [studioRecordingTime, setStudioRecordingTime] = useState(0);
  const [studioPlaying, setStudioPlaying] = useState(false);
  const [studioAudioURLs, setStudioAudioURLs] = useState({});
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [clippingTracks, setClippingTracks] = useState({});
  const [tapTimes, setTapTimes] = useState([]);
  const [savingProject, setSavingProject] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [storageInfo, setStorageInfo] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const studioMediaRef = useRef(null);
  const studioChunksRef = useRef([]);
  const studioTimerRef = useRef(null);
  const studioAudioNodes = useRef([]);
  const studioFileInputRef = useRef(null);
  const studioFileTrackId = useRef(null);
  const trackAudioRefs = useRef({});
  const playbackAudioNodes = useRef([]);
  const clipAcRef = useRef(null);
  const clipAnalyserRef = useRef(null);
  const clipIntervalRef = useRef(null);
  const importFileRef = useRef(null);

  useEffect(() => { save(STORAGE_KEY, projects); }, [projects]);
  useEffect(() => { save(STORAGE_AP, activeProject); }, [activeProject]);
  useEffect(() => { save(STORAGE_THEME, darkMode); }, [darkMode]);
  useEffect(() => { save(STORAGE_ACCENT, accentColor); }, [accentColor]);

  // ── RESTORE AUDIO FROM LOCALSTORAGE ON MOUNT ──
  useEffect(() => {
    const storedIds = listAudioStoreKeys();
    if (storedIds.length === 0) return;
    const restored = {};
    let restoredCount = 0;
    for (const id of storedIds) {
      const dataURL = loadAudioFromStore(id);
      if (dataURL) {
        const objURL = dataURLToObjectURL(dataURL);
        if (objURL) { restored[id] = objURL; restoredCount++; }
      }
    }
    if (restoredCount > 0) {
      setStudioAudioURLs(prev => ({ ...prev, ...restored }));
      setStorageInfo(`✓ ${restoredCount} recording${restoredCount > 1 ? "s" : ""} restored from storage`);
      setTimeout(() => setStorageInfo(""), 4000);
    }
  }, []);

  // ── IMPERATIVE BODY STYLE — instant on toggle ──
  useEffect(() => {
    const T = buildTheme(darkMode);
    document.body.style.backgroundColor = T.bodyBg;
    document.body.style.color = T.text;
    document.documentElement.style.backgroundColor = T.bodyBg;
  }, [darkMode]);

  useEffect(() => {
    if (phase !== "loading") return;
    const iv = setInterval(() => { setProgress(p => { if (p >= 100) { clearInterval(iv); setTimeout(() => setPhase("fading"), 300); return 100; } return p + 1.2; }); }, 30);
    return () => clearInterval(iv);
  }, [phase]);
  useEffect(() => { if (phase === "fading") { const t = setTimeout(() => setPhase("app"), 1200); return () => clearTimeout(t); } }, [phase]);

  const T = buildTheme(darkMode);
  const AC = accentColor;

  const project = projects.find(p => p.id === activeProject) || projects[0];
  const song = project?.song || makeDefaultSong();
  const instruments = project?.instruments || DEFAULT_INSTRUMENTS;
  const isStudio = screen === "studio";
  const isMixer = screen === "mixer";
  const isSongs = screen === "songs";
  const tracks = project?.studio?.tracks || makeDefaultTracks();

  const inp = (extra = {}) => ({
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    color: T.text, borderRadius: 8, padding: "8px 12px",
    width: "100%", outline: "none", fontSize: 13, ...extra,
  });

  const updateProject = (id, fn) => setProjects(prev => prev.map(p => p.id === id ? { ...p, ...fn(p) } : p));
  const updateSong = (fn) => updateProject(project.id, p => ({ song: { ...p.song, ...fn(p.song || makeDefaultSong()) } }));
  const updateTrack = (trackId, fn) => updateProject(project.id, p => ({ studio: { ...p.studio, tracks: (p.studio?.tracks || makeDefaultTracks()).map(t => t.id === trackId ? { ...t, ...fn(t) } : t) } }));

  const deleteTrack = (trackId) => {
    stopTrack(trackId);
    const track = tracks.find(t => t.id === trackId);
    if (track) track.recordings.forEach(r => deleteAudioFromStore(r.id));
    updateProject(project.id, p => ({ studio: { ...p.studio, tracks: (p.studio?.tracks || makeDefaultTracks()).filter(t => t.id !== trackId) } }));
    setConfirmDelete(null); if (expandedTrack === trackId) setExpandedTrack(null);
  };
  const resetTrack = (trackId) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) track.recordings.forEach(r => deleteAudioFromStore(r.id));
    updateTrack(trackId, () => ({ recordings: [], notes: "", reverb: 0, lows: 0, mids: 0, highs: 0, volume: 0.8, muted: false, solo: false, gain: 1.0 }));
    setConfirmReset(null);
  };
  const addTrack = () => {
    const newId = Date.now(); const ci = tracks.length % PROJECT_COLORS.length;
    updateProject(project.id, p => ({ studio: { ...p.studio, tracks: [...(p.studio?.tracks || makeDefaultTracks()), { id: newId, name: `Track ${tracks.length + 1}`, color: PROJECT_COLORS[ci], recordings: [], volume: 0.8, muted: false, solo: false, reverb: 0, lows: 0, mids: 0, highs: 0, notes: "", gain: 1.0 }] } }));
  };

  const handleTrackDragStart = (trackId) => setDraggedTrack(trackId);
  const handleTrackDrop = (targetId) => {
    if (draggedTrack === null || draggedTrack === targetId) return;
    updateProject(project.id, p => {
      const tks = [...(p.studio?.tracks || makeDefaultTracks())];
      const fi = tks.findIndex(t => t.id === draggedTrack); const ti = tks.findIndex(t => t.id === targetId);
      if (fi < 0 || ti < 0) return {};
      const [item] = tks.splice(fi, 1); tks.splice(ti, 0, item);
      return { studio: { ...p.studio, tracks: tks } };
    });
    setDraggedTrack(null);
  };

  const ckKey = (sn, ci) => `${sn}--${ci}`;
  const toggleChecked = (sn, ci) => {
    const ri = song.sections.indexOf(sn); if (song.locked?.[ri]) return;
    const k = ckKey(sn, ci);
    updateProject(project.id, p => {
      const cur = Array.isArray(p.song?.checks?.[k]) ? p.song.checks[k] : [];
      return { song: { ...p.song, checks: { ...(p.song?.checks || {}), [k]: cur.includes("checked") ? [] : ["checked"] } } };
    });
  };
  const isChecked = (sn, ci) => { const k = ckKey(sn, ci); return Array.isArray(song.checks?.[k]) && song.checks[k].includes("checked"); };

  const toggleLocked = ri => updateSong(s => ({ locked: { ...s.locked, [ri]: !s.locked?.[ri] } }));
  const toggleStarred = ri => updateSong(s => ({ starred: { ...s.starred, [ri]: !s.starred?.[ri] } }));
  const cycleStatus = ri => { if (song.locked?.[ri]) return; updateSong(s => { const cur = s.status?.[ri] || "Draft"; return { status: { ...s.status, [ri]: STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(cur) + 1) % STATUS_OPTIONS.length] } }; }); };

  const handleLinesTouchStart = (ri, section) => { setIsDragging(false); const t = setTimeout(() => { setIsDragging(true); setDraggedIndex(ri); }, 400); setLongPressTimer(t); };
  const handleLinesTouchEnd = (ri, section) => { clearTimeout(longPressTimer); if (!isDragging) setSectionNoteOpen(section); setIsDragging(false); };
  const handleDrop = ti => { if (draggedIndex === null || song.locked?.[draggedIndex]) return; const u = [...song.sections]; const [it] = u.splice(draggedIndex, 1); u.splice(ti, 0, it); updateSong(() => ({ sections: u })); setDraggedIndex(null); };
  const addSection = () => { if (!newSection.trim()) return; updateSong(s => ({ sections: [...s.sections, newSection.trim()] })); setNewSection(""); };
  const removeSection = i => { if (song.locked?.[i]) return; updateSong(s => ({ sections: s.sections.filter((_, idx) => idx !== i) })); };
  const startEdit = i => { if (song.locked?.[i]) return; setEditingIndex(i); setEditingValue(song.sections[i]); };
  const saveEdit = () => { if (!editingValue.trim()) return; updateSong(s => { const u = [...s.sections]; u[editingIndex] = editingValue.trim(); return { sections: u }; }); setEditingIndex(null); };

  const addProject = () => { if (!newProjectName.trim()) return; const id = Date.now(); setProjects(prev => [...prev, makeProject(id, newProjectName.trim(), AC)]); setActiveProject(id); setNewProjectName(""); setMenuOpen(false); };
  const deleteProject = id => { if (projects.length === 1) return; setProjects(prev => prev.filter(p => p.id !== id)); if (activeProject === id) setActiveProject(projects[0].id); };
  const switchProject = id => { setActiveProject(id); setMenuOpen(false); setScreen("studio"); };
  const saveProjectName = () => { if (!projectNameValue.trim()) return; updateProject(project.id, () => ({ name: projectNameValue.trim() })); setEditingProjectName(false); };
  const saveProjectSongName = () => { if (!projectSongValue.trim()) return; updateProject(project.id, () => ({ songName: projectSongValue.trim() })); setEditingProjectSong(false); };
  const saveSongName = () => { if (!songNameValue.trim()) return; updateSong(() => ({ name: songNameValue.trim() })); setEditingSongName(false); };
  const shareApp = () => { const url = window.location.origin; const text = "🎸 Dog Bones — Band Studio App. Open in Chrome then Add to Home Screen!"; if (navigator.share) navigator.share({ title: "Dog Bones", text, url }); else navigator.clipboard.writeText(`${text}\n${url}`).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2500); }); };

  const handleTapTempo = () => {
    const now = Date.now();
    setTapTimes(prev => {
      const recent = prev.filter(t => now - t < 3000); const updated = [...recent, now];
      if (updated.length >= 2) {
        const diffs = updated.slice(1).map((t, i) => t - updated[i]);
        const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        const bpm = Math.round(60000 / avg);
        updateSong(() => ({ bpm: String(clamp(bpm, 20, 300)) }));
      }
      return updated;
    });
  };

  const saveProjectToFile = async () => {
    setSavingProject(true);
    try {
      const audioData = {};
      for (const track of tracks) {
        for (const rec of track.recordings) {
          const stored = loadAudioFromStore(rec.id);
          if (stored) {
            audioData[rec.id] = { base64: stored, type: "audio/webm" };
          } else {
            const url = studioAudioURLs[rec.id];
            if (url) {
              try {
                const resp = await fetch(url); const blob = await resp.blob();
                const dataURL = await blobToDataURL(blob);
                audioData[rec.id] = { base64: dataURL, type: blob.type };
              } catch {}
            }
          }
        }
      }
      const exportData = { version: "db_v17", exportedAt: new Date().toISOString(), project: JSON.parse(JSON.stringify(project)), audioData };
      const blob = new Blob([JSON.stringify(exportData)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${project.name.replace(/[^a-z0-9]/gi, "_")}.dogbones`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert("Save failed: " + e.message); }
    setSavingProject(false);
  };

  const loadProjectFromFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportStatus("Reading file...");
    try {
      const text = await file.text(); const data = JSON.parse(text);
      if (!data.version || !data.project) { alert("Invalid .dogbones file."); setImportStatus(""); return; }
      const importedProject = { ...data.project, id: Date.now() };
      const newAudioURLs = {};
      if (data.audioData) {
        setImportStatus("Restoring audio...");
        for (const [recId, audioInfo] of Object.entries(data.audioData)) {
          try {
            const objURL = dataURLToObjectURL(audioInfo.base64);
            if (objURL) {
              newAudioURLs[recId] = objURL;
              saveAudioToStore(recId, audioInfo.base64);
            }
          } catch {}
        }
      }
      setProjects(prev => [...prev, importedProject]);
      setActiveProject(importedProject.id);
      setStudioAudioURLs(prev => ({ ...prev, ...newAudioURLs }));
      setScreen("studio"); setMenuOpen(false);
      setImportStatus(`✓ Loaded "${importedProject.name}" with ${Object.keys(newAudioURLs).length} audio takes`);
      setTimeout(() => setImportStatus(""), 4000);
    } catch (e) { alert("Import failed: " + e.message); setImportStatus(""); }
    e.target.value = "";
  };

  const getSectionNote = sn => song?.sectionNotes?.[sn] || "";
  const setSectionNote = (sn, val) => updateSong(s => ({ sectionNotes: { ...s.sectionNotes, [sn]: val } }));
  const getAudioNotes = sn => song?.audioNotes?.[sn] || [];

  const startRecording = async sn => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mr = new MediaRecorder(stream); audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob); const id = Date.now().toString();
        setAudioURLs(prev => ({ ...prev, [id]: url }));
        const a = document.createElement("a"); a.href = url; a.download = `DogBones_${sn}_${id}.webm`; a.click();
        updateSong(s => ({ audioNotes: { ...s.audioNotes, [sn]: [...(s.audioNotes?.[sn] || []), { id, duration: recordingTime, label: `Voice memo ${(s.audioNotes?.[sn] || []).length + 1}` }] } }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); mediaRecorderRef.current = mr; setRecording(true); setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { alert("Microphone access denied."); }
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); clearInterval(recordingTimerRef.current); setRecording(false); };
  const handleFileUpload = (sn, e) => { const file = e.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); const id = Date.now().toString(); setAudioURLs(prev => ({ ...prev, [id]: url })); updateSong(s => ({ audioNotes: { ...s.audioNotes, [sn]: [...(s.audioNotes?.[sn] || []), { id, duration: 0, label: file.name.replace(/\.[^/.]+$/, "") }] } })); e.target.value = ""; };
  const deleteAudioNote = (sn, id) => { updateSong(s => ({ audioNotes: { ...s.audioNotes, [sn]: (s.audioNotes?.[sn] || []).filter(a => a.id !== id) } })); setAudioURLs(prev => { const n = { ...prev }; delete n[id]; return n; }); if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); } };
  const playAudio = id => { const url = audioURLs[id]; if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } if (playingId === id) { setPlayingId(null); return; } if (!url) { alert("Re-record or re-upload after refresh."); return; } const a = new Audio(url); a.play(); a.onended = () => setPlayingId(null); audioRef.current = a; setPlayingId(id); };

  const buildAudioGraph = async (ac, track, url) => {
    const r = await fetch(url); const ab = await r.arrayBuffer(); const buf = await ac.decodeAudioData(ab);
    const src = ac.createBufferSource(); src.buffer = buf;
    const eqOut = applyEQ(ac, src, track); const gn = ac.createGain(); gn.gain.value = track.volume;
    if (track.reverb > 0) { const conv = await createReverbNode(ac, track.reverb); const dry = ac.createGain(); const wet = ac.createGain(); dry.gain.value = 1 - track.reverb * 0.6; wet.gain.value = track.reverb * 0.8; eqOut.connect(dry); eqOut.connect(conv); conv.connect(wet); dry.connect(gn); wet.connect(gn); }
    else eqOut.connect(gn);
    gn.connect(ac.destination); return { source: src, ac };
  };

  const startPlaybackDuringRecording = async recordingTrackId => {
    playbackAudioNodes.current.forEach(a => { try { a.pause?.(); a.stop?.(); } catch {} }); playbackAudioNodes.current = [];
    const ac = new (window.AudioContext || window.webkitAudioContext)(); const hasSolo = tracks.some(t => t.solo && t.id !== recordingTrackId);
    for (const track of tracks) {
      if (track.id === recordingTrackId || track.muted || (hasSolo && !track.solo)) continue;
      const lr = track.recordings[track.recordings.length - 1]; if (!lr) continue;
      const url = studioAudioURLs[lr.id]; if (!url) continue;
      try { const { source } = await buildAudioGraph(ac, track, url); source.start(0); playbackAudioNodes.current.push({ stop: () => source.stop() }); }
      catch { const a = new Audio(url); a.volume = track.volume; a.play().catch(() => {}); playbackAudioNodes.current.push(a); }
    }
  };
  const stopPlaybackDuringRecording = () => { playbackAudioNodes.current.forEach(a => { try { a.stop?.(); a.pause?.(); } catch {} }); playbackAudioNodes.current = []; };

  const startClipDetection = (trackId, stream) => {
    try {
      if (clipIntervalRef.current) clearInterval(clipIntervalRef.current);
      if (clipAcRef.current) { try { clipAcRef.current.close(); } catch {} }
      const ac = new (window.AudioContext || window.webkitAudioContext)(); clipAcRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.3;
      src.connect(analyser); clipAnalyserRef.current = analyser;
      clipIntervalRef.current = setInterval(() => {
        if (!clipAnalyserRef.current) return;
        const data = new Uint8Array(clipAnalyserRef.current.frequencyBinCount); clipAnalyserRef.current.getByteTimeDomainData(data);
        let peak = 0; for (let i = 0; i < data.length; i++) { const v = Math.abs((data[i] - 128) / 128); if (v > peak) peak = v; }
        setClippingTracks(prev => { if (prev[trackId] === (peak > 0.92)) return prev; return { ...prev, [trackId]: peak > 0.92 }; });
      }, 80);
    } catch {}
  };
  const stopClipDetection = (trackId) => {
    clearInterval(clipIntervalRef.current); clipIntervalRef.current = null;
    if (clipAcRef.current) { try { clipAcRef.current.close(); } catch {} } clipAcRef.current = null; clipAnalyserRef.current = null;
    setClippingTracks(prev => ({ ...prev, [trackId]: false }));
  };

  const changeGain = (trackId, delta) => {
    updateTrack(trackId, t => {
      const cur = t.gain ?? 1.0;
      const next = Math.round((cur + delta) * 10) / 10;
      return { gain: clamp(next, 0.1, 1.0) };
    });
  };

  const startStudioRecording = async trackId => {
    try {
      const track = tracks.find(t => t.id === trackId); const gainValue = track?.gain ?? 1.0;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputAc = new (window.AudioContext || window.webkitAudioContext)();
      const micSrc = inputAc.createMediaStreamSource(stream);
      const gainNode = inputAc.createGain(); gainNode.gain.value = gainValue;
      const dest = inputAc.createMediaStreamDestination();
      micSrc.connect(gainNode); gainNode.connect(dest);
      startClipDetection(trackId, stream);
      await startPlaybackDuringRecording(trackId);
      const recStream = dest.stream.getTracks().length > 0 ? dest.stream : stream;
      const mr = new MediaRecorder(recStream); studioChunksRef.current = [];
      mr.ondataavailable = e => studioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stopPlaybackDuringRecording(); stopClipDetection(trackId);
        try { inputAc.close(); } catch {} stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(studioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob); const id = Date.now().toString();
        const t = tracks.find(t => t.id === trackId);
        setStudioAudioURLs(prev => ({ ...prev, [id]: url }));
        try {
          const dataURL = await blobToDataURL(blob);
          saveAudioToStore(id, dataURL);
        } catch (e) {
          console.warn("Could not persist audio to localStorage:", e);
        }
        const a = document.createElement("a"); a.href = url; a.download = `DogBones_${t?.name || "track"}_${id}.webm`; a.click();
        updateTrack(trackId, t => ({ recordings: [...t.recordings, { id, duration: studioRecordingTime, label: `Take ${t.recordings.length + 1}` }] }));
      };
      mr.start(); studioMediaRef.current = mr; setStudioRecordingTrack(trackId); setStudioRecordingTime(0);
      studioTimerRef.current = setInterval(() => setStudioRecordingTime(t => t + 1), 1000);
    } catch { alert("Microphone access denied."); }
  };
  const stopStudioRecording = () => { studioMediaRef.current?.stop(); clearInterval(studioTimerRef.current); setStudioRecordingTrack(null); };

  const playTrackWithFX = async trackId => {
    const track = tracks.find(t => t.id === trackId); const lr = track?.recordings[track.recordings.length - 1];
    if (!lr) { alert("No recording yet."); return; } const url = studioAudioURLs[lr.id]; if (!url) { alert("Audio not available — it may still be loading from storage."); return; }
    if (playingTrackId === trackId) { trackAudioRefs.current[trackId]?.stop?.(); trackAudioRefs.current[trackId]?.pause?.(); delete trackAudioRefs.current[trackId]; setPlayingTrackId(null); return; }
    if (playingTrackId !== null) { trackAudioRefs.current[playingTrackId]?.stop?.(); trackAudioRefs.current[playingTrackId]?.pause?.(); delete trackAudioRefs.current[playingTrackId]; }
    try { const { source, ac } = await buildAudioGraph(new (window.AudioContext || window.webkitAudioContext)(), track, url); source.start(0); source.onended = () => { setPlayingTrackId(null); delete trackAudioRefs.current[trackId]; }; trackAudioRefs.current[trackId] = { stop: () => { source.stop(); ac.close(); } }; setPlayingTrackId(trackId); }
    catch { const a = new Audio(url); a.volume = track.volume; a.play(); a.onended = () => { setPlayingTrackId(null); delete trackAudioRefs.current[trackId]; }; trackAudioRefs.current[trackId] = { pause: () => { a.pause(); a.currentTime = 0; } }; setPlayingTrackId(trackId); }
  };
  const stopTrack = trackId => { trackAudioRefs.current[trackId]?.stop?.(); trackAudioRefs.current[trackId]?.pause?.(); delete trackAudioRefs.current[trackId]; if (playingTrackId === trackId) setPlayingTrackId(null); };
  const handleStudioFileUpload = async (trackId, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file); const id = Date.now().toString();
    setStudioAudioURLs(prev => ({ ...prev, [id]: url }));
    try { const dataURL = await blobToDataURL(file); saveAudioToStore(id, dataURL); } catch {}
    updateTrack(trackId, t => ({ recordings: [...t.recordings, { id, duration: 0, label: file.name.replace(/\.[^/.]+$/, "") }] }));
    e.target.value = "";
  };
  const deleteStudioRecording = (trackId, recId) => {
    deleteAudioFromStore(recId);
    updateTrack(trackId, t => ({ recordings: t.recordings.filter(r => r.id !== recId) }));
    setStudioAudioURLs(prev => { const n = { ...prev }; delete n[recId]; return n; });
    if (playingTrackId === trackId) stopTrack(trackId);
  };

  const playAllTracks = async () => {
    studioAudioNodes.current.forEach(a => { try { a.stop?.(); a.pause?.(); } catch {} }); studioAudioNodes.current = [];
    const hasSolo = tracks.some(t => t.solo); const ac = new (window.AudioContext || window.webkitAudioContext)();
    for (const track of tracks) {
      if (track.muted || (hasSolo && !track.solo)) continue; const lr = track.recordings[track.recordings.length - 1]; if (!lr) continue; const url = studioAudioURLs[lr.id]; if (!url) continue;
      try { const { source } = await buildAudioGraph(ac, track, url); source.start(0); studioAudioNodes.current.push({ stop: () => source.stop() }); }
      catch { const a = new Audio(url); a.volume = track.volume; a.play().catch(() => {}); studioAudioNodes.current.push(a); }
    }
    setStudioPlaying(true); setTimeout(() => setStudioPlaying(false), 60000);
  };
  const stopAllTracks = () => { studioAudioNodes.current.forEach(a => { try { a.stop?.(); a.pause?.(); } catch {} }); studioAudioNodes.current = []; Object.values(trackAudioRefs.current).forEach(a => { try { a.stop?.(); a.pause?.(); } catch {} }); trackAudioRefs.current = {}; stopPlaybackDuringRecording(); setStudioPlaying(false); setPlayingTrackId(null); };

  const addInstrument = () => { if (!newInstrument.trim() || instruments.includes(newInstrument.trim())) return; updateProject(project.id, p => ({ instruments: [...(p.instruments || DEFAULT_INSTRUMENTS), newInstrument.trim()] })); setNewInstrument(""); };
  const removeInstrument = inst => updateProject(project.id, p => ({ instruments: (p.instruments || DEFAULT_INSTRUMENTS).filter(i => i !== inst) }));

  const modalHeader = (color) => ({ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${color}44`, background: T.headBg });
  const doneBtn = (color) => ({ background: `${color}22`, border: `1px solid ${color}66`, color, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 });
  const reverbLabel = v => v === 0 ? "DRY" : v < 0.3 ? "ROOM" : v < 0.6 ? "HALL" : v < 0.8 ? "CHAMBER" : "CATHEDRAL";
  const eqLabel = v => v > 0.3 ? "BOOST" : v < -0.3 ? "CUT" : "FLAT";
  const volLabel = v => v === 0 ? "SILENT" : v < 0.3 ? "LOW" : v < 0.6 ? "MEDIUM" : v < 0.9 ? "LOUD" : "MAX";

  const getStorageEstimate = async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();
        const usedMB = (usage / 1024 / 1024).toFixed(1);
        const quotaMB = (quota / 1024 / 1024).toFixed(0);
        setStorageInfo(`Storage: ${usedMB}MB used of ~${quotaMB}MB`);
        setTimeout(() => setStorageInfo(""), 4000);
      }
    } catch {}
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes pulse-glow{0%,100%{text-shadow:0 0 8px ${AC},0 0 20px ${AC};}50%{text-shadow:0 0 20px ${AC},0 0 40px ${AC};}}
        @keyframes fadeOut{0%{opacity:1}100%{opacity:0}}
        .splash-fade{animation:fadeOut 1.1s ease-in-out forwards;}
        @keyframes slideIn{0%{transform:translateX(-100%)}100%{transform:translateX(0)}}
        .menu-panel{animation:slideIn 0.25s ease forwards;}
        @keyframes popIn{0%{opacity:0;transform:scale(0.97)}100%{opacity:1;transform:scale(1)}}
        .pop-in{animation:popIn 0.2s ease forwards;}
        @keyframes recPulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .rec-dot{animation:recPulse 1s ease-in-out infinite;}
        @keyframes clipFlash{0%,100%{background:#ff0000;box-shadow:0 0 10px #ff0000;}50%{background:#ff6666;box-shadow:0 0 3px #ff4444;}}
        .clip-on{animation:clipFlash 0.25s ease-in-out infinite;}
        @keyframes vuPulse{0%{height:20%}50%{height:80%}100%{height:20%}}
        @keyframes dropIn{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:translateY(0)}}
        .drop-in{animation:dropIn 0.2s ease forwards;}
        @keyframes confirmPop{0%{opacity:0;transform:scale(0.9)}100%{opacity:1;transform:scale(1)}}
        .confirm-pop{animation:confirmPop 0.15s ease forwards;}
        *{box-sizing:border-box;}
        html{background-color:${T.bodyBg};}
        body{background-color:${T.bodyBg};color:${T.text};margin:0;}
        input,textarea,select{color:${T.text} !important;background-color:${T.inputBg} !important;}
        .icon-btn{background:none;border:none;cursor:pointer;padding:4px 5px;border-radius:6px;font-size:13px;line-height:1;color:${T.text};}
        .icon-btn:hover{background:rgba(128,128,128,0.15);}
        .table-wrap{overflow-x:auto;border-radius:16px;margin-bottom:16px;-webkit-overflow-scrolling:touch;}
        .section-table{width:max-content;min-width:100%;border-collapse:collapse;}
        .sticky-col{position:sticky;left:0;z-index:2;}
        .sticky-col-head{position:sticky;left:0;z-index:3;}
        .chrome-row{transition:background 0.15s;}
        .chrome-row:hover{background:${T.rowHover}!important;}
        .lines-btn{display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:8px;cursor:pointer;border:none;background:none;flex-shrink:0;}
        .lines-btn .line{width:14px;height:2px;border-radius:1px;}
        th,td{color:${T.text};}
      `}</style>

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="confirm-pop" style={{ background: T.cardBg, borderRadius: 20, padding: 24, maxWidth: 300, width: "100%", border: "2px solid #ff4444" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <h3 style={{ color: "#ff4444", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>DELETE TRACK?</h3>
              <p style={{ color: T.subtext, fontSize: 13, margin: 0 }}>Permanently delete <strong style={{ color: T.text }}>{confirmDelete.name}</strong> and all recordings.</p>
              <p style={{ color: "#ff4444", fontSize: 11, margin: "8px 0 0" }}>Cannot be undone.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "transparent", border: `1px solid ${T.border}`, color: T.subtext, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>CANCEL</button>
              <button onClick={() => deleteTrack(confirmDelete.id)} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "#ff444422", border: "2px solid #ff4444", color: "#ff4444", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>DELETE</button>
            </div>
          </div>
        </div>
      )}
      {confirmReset && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="confirm-pop" style={{ background: T.cardBg, borderRadius: 20, padding: 24, maxWidth: 300, width: "100%", border: "2px solid #ff9500" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
              <h3 style={{ color: "#ff9500", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>RESET TRACK DATA?</h3>
              <p style={{ color: T.subtext, fontSize: 13, margin: 0 }}>Clear all recordings from <strong style={{ color: T.text }}>{confirmReset.name}</strong> and remove from storage.</p>
              <p style={{ color: "#ff9500", fontSize: 11, margin: "8px 0 0" }}>Cannot be undone.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmReset(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "transparent", border: `1px solid ${T.border}`, color: T.subtext, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>CANCEL</button>
              <button onClick={() => resetTrack(confirmReset.id)} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "#ff950022", border: "2px solid #ff9500", color: "#ff9500", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>RESET</button>
            </div>
          </div>
        </div>
      )}

      {sectionNoteOpen && song && (
        <div className="pop-in" style={{ position: "fixed", inset: 0, zIndex: 7500, background: T.bg, display: "flex", flexDirection: "column" }}>
          <div style={modalHeader(AC)}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: AC, boxShadow: `0 0 6px ${AC}` }} />
            <span style={{ color: AC, fontWeight: 700, fontSize: 14, flex: 1 }}>📝 {sectionNoteOpen}</span>
            <button onClick={() => setSectionNoteOpen(null)} style={doneBtn(AC)}>✓ DONE</button>
          </div>
          <textarea style={{ flex: 1, resize: "none", fontFamily: "monospace", fontSize: 15, border: "none", padding: "20px", lineHeight: 1.8, background: T.bg, color: T.text, outline: "none" }}
            placeholder={`Notes for ${sectionNoteOpen}...`} value={getSectionNote(sectionNoteOpen)} onChange={e => setSectionNote(sectionNoteOpen, e.target.value)} autoFocus />
        </div>
      )}
      {audioNoteOpen && song && (
        <div className="pop-in" style={{ position: "fixed", inset: 0, zIndex: 7500, background: T.bg, display: "flex", flexDirection: "column" }}>
          <div style={modalHeader(AC)}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: AC, boxShadow: `0 0 6px ${AC}` }} />
            <span style={{ color: AC, fontWeight: 700, fontSize: 14, flex: 1 }}>🎙️ {audioNoteOpen}</span>
            <button onClick={() => { if (recording) stopRecording(); setAudioNoteOpen(null); }} style={doneBtn(AC)}>✓ DONE</button>
          </div>
          <div style={{ flex: 1, padding: "20px", overflowY: "auto", background: T.bg }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0", borderBottom: `1px solid ${AC}22`, marginBottom: 20 }}>
              {recording ? (
                <><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="rec-dot" style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff4444" }} /><span style={{ color: "#ff4444", fontWeight: 700, fontSize: 22 }}>{fmtTime(recordingTime)}</span></div><button onClick={stopRecording} style={{ background: "#ff444422", border: "2px solid #ff4444", color: "#ff4444", borderRadius: "50%", width: 80, height: 80, fontSize: 28, cursor: "pointer" }}>⏹</button></>
              ) : (
                <><button onClick={() => startRecording(audioNoteOpen)} style={{ background: `${AC}22`, border: `2px solid ${AC}`, color: AC, borderRadius: "50%", width: 80, height: 80, fontSize: 32, cursor: "pointer", boxShadow: `0 0 24px ${AC}44` }}>🎙️</button>
                  <span style={{ color: AC, fontSize: 11, letterSpacing: "0.1em" }}>TAP TO RECORD</span>
                  <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => handleFileUpload(audioNoteOpen, e)} />
                  <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "10px", borderRadius: 10, background: `${AC}11`, border: `1px solid ${AC}44`, color: AC, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>📁 UPLOAD FROM FILES</button></>
              )}
            </div>
            {getAudioNotes(audioNoteOpen).map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: T.cardBg, border: `1px solid ${AC}33`, marginBottom: 8 }}>
                <button onClick={() => playAudio(a.id)} style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${AC}`, background: playingId === a.id ? `${AC}33` : "transparent", color: AC, cursor: "pointer", fontSize: 16 }}>{playingId === a.id ? "⏸" : "▶"}</button>
                <span style={{ color: T.text, fontSize: 12, flex: 1 }}>{a.label}</span>
                <button className="icon-btn" onClick={() => deleteAudioNote(audioNoteOpen, a.id)} style={{ color: "#ff4444" }}>🗑️</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {notesOpen && song && (
        <div className="pop-in" style={{ position: "fixed", inset: 0, zIndex: 7000, background: T.bg, display: "flex", flexDirection: "column" }}>
          <div style={modalHeader(AC)}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: AC, boxShadow: `0 0 6px ${AC}` }} />
            <span style={{ color: AC, fontWeight: 700, fontSize: 14, flex: 1 }}>{song.name} — NOTES</span>
            <button onClick={() => setNotesOpen(false)} style={doneBtn(AC)}>↙ COLLAPSE</button>
          </div>
          <textarea style={{ flex: 1, resize: "none", fontFamily: "monospace", fontSize: 14, border: "none", padding: "20px", lineHeight: 1.7, background: T.bg, color: T.text, outline: "none" }}
            placeholder="Session notes..." value={song.notes} onChange={e => updateSong(() => ({ notes: e.target.value }))} autoFocus />
        </div>
      )}

      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 8000 }} onClick={() => setMenuOpen(false)}>
          <div className="menu-panel" onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "82%", maxWidth: 320, background: T.cardBg, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${T.border}`, background: T.headBg }}>
              <img src={LOGO_TEXT} alt="Dog Bones" style={{ width: "100%", maxWidth: 200, height: 40, objectFit: "cover", objectPosition: "center", mixBlendMode: darkMode ? "screen" : "multiply", display: "block", marginBottom: 4 }} />
              <p style={{ color: T.subtext, fontSize: 9, letterSpacing: "0.3em", margin: 0 }}>PROJECTS</p>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
              {projects.map(p => (
                <div key={p.id} onClick={() => switchProject(p.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", cursor: "pointer", background: p.id === activeProject ? `${p.color}11` : "transparent", borderLeft: p.id === activeProject ? `3px solid ${p.color}` : "3px solid transparent" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0, boxShadow: `0 0 6px ${p.color}` }} />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.id === activeProject ? p.color : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    {p.songName && <div style={{ fontSize: 10, color: `${p.color}88`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.songName}</div>}
                  </div>
                  {projects.length > 1 && <button className="icon-btn" onClick={e => { e.stopPropagation(); deleteProject(p.id); }} style={{ color: "#ff4444" }}>🗑️</button>}
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, background: T.headBg }}>
              <p style={{ color: T.subtext, fontSize: 10, letterSpacing: "0.2em", marginBottom: 8 }}>NEW PROJECT</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={inp({ fontSize: 12 })} placeholder="Project name..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === "Enter" && addProject()} />
                <button onClick={addProject} style={{ background: `${AC}22`, border: `1px solid ${AC}66`, color: AC, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>+ ADD</button>
              </div>
            </div>
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.border}`, background: T.headBg }}>
              <p style={{ color: T.subtext, fontSize: 10, letterSpacing: "0.15em", marginBottom: 8 }}>PROJECT FILE (SEND TO BANDMATES)</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <button onClick={saveProjectToFile} disabled={savingProject} style={{ flex: 1, background: `${AC}22`, border: `1px solid ${AC}66`, color: AC, borderRadius: 8, padding: "8px 6px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{savingProject ? "⏳ SAVING..." : "💾 SAVE .dogbones"}</button>
                <label style={{ flex: 1, background: "#00cfff22", border: "1px solid #00cfff66", color: "#00cfff", borderRadius: 8, padding: "8px 6px", cursor: "pointer", fontSize: 11, fontWeight: 700, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  📂 LOAD .dogbones<input ref={importFileRef} type="file" accept=".dogbones,.json" style={{ display: "none" }} onChange={loadProjectFromFile} />
                </label>
              </div>
              {importStatus && <div style={{ fontSize: 10, color: importStatus.startsWith("✓") ? AC : "#ff9500", padding: "4px 8px", borderRadius: 6, background: `${importStatus.startsWith("✓") ? AC : "#ff9500"}11`, border: `1px solid ${importStatus.startsWith("✓") ? AC : "#ff9500"}33`, marginBottom: 4 }}>{importStatus}</div>}
              {storageInfo && <div style={{ fontSize: 10, color: AC, padding: "4px 8px", borderRadius: 6, background: `${AC}11`, border: `1px solid ${AC}33`, marginBottom: 4 }}>{storageInfo}</div>}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={getStorageEstimate} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.subtext, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 10 }}>📊 Storage Info</button>
              </div>
              <p style={{ color: T.subtext, fontSize: 9, margin: "6px 0 0", lineHeight: 1.5 }}>Saves ALL tracks + audio. Recordings auto-persist across refreshes in local storage.</p>
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
              {[{ label: "🎛️ STUDIO", val: "studio" }, { label: "🎵 SONG ARRANGER", val: "songs" }, { label: "🎚️ MIX & MASTER", val: "mixer" }].map(({ label, val }) => (
                <button key={val} onClick={() => { setScreen(val); setMenuOpen(false); }} style={{ background: screen === val ? `${val === "mixer" ? "#00e5ff" : AC}22` : "transparent", border: `1px solid ${screen === val ? (val === "mixer" ? "#00e5ff" : AC) + "66" : T.border}`, color: screen === val ? (val === "mixer" ? "#00e5ff" : AC) : T.subtext, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textAlign: "left" }}>
                  {label}{val === "mixer" && <span style={{ fontSize: 9, marginLeft: 6, color: "#00e5ff88", background: "#00e5ff11", border: "1px solid #00e5ff33", borderRadius: 3, padding: "1px 5px" }}>AI</span>}
                </button>
              ))}
              <button onClick={() => setDarkMode(v => !v)} style={{ background: darkMode ? "rgba(255,238,0,0.08)" : `${NAV}08`, border: `1px solid ${darkMode ? "rgba(255,238,0,0.3)" : NAV + "44"}`, color: darkMode ? "#ffee00" : NAV, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textAlign: "left" }}>{darkMode ? "☀️ LIGHT MODE" : "🌙 DARK MODE"}</button>
              <button onClick={shareApp} style={{ background: shareCopied ? `${AC}33` : `${AC}11`, border: `1px solid ${AC}66`, color: AC, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textAlign: "left" }}>{shareCopied ? "✅ LINK COPIED!" : "📤 SHARE APP WITH BAND"}</button>
              <p style={{ color: T.subtext, fontSize: 10, lineHeight: 1.6, margin: 0 }}>Open in Chrome → Add to Home Screen!</p>
            </div>
          </div>
        </div>
      )}

      <div key={darkMode ? "dk" : "lt"} style={{ minHeight: "100vh", background: isMixer ? "#0a0a0f" : T.bg, color: T.text }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", borderRadius: 14, background: isMixer ? "#111118" : T.card, border: `1px solid ${isMixer ? "#1e1e2e" : T.border}` }}>
            <button onClick={() => setMenuOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 8, flexShrink: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 20, height: 2, borderRadius: 1, background: isMixer ? "#00e5ff" : AC, boxShadow: `0 0 4px ${isMixer ? "#00e5ff" : AC}` }} />)}</div>
            </button>
            <img src={LOGO_TEXT} alt="Dog Bones" style={{ height: 36, objectFit: "contain", mixBlendMode: darkMode ? "screen" : "multiply", flexShrink: 0 }} />
            <div style={{ flex: 1, overflow: "hidden" }}>
              {isMixer ? (<div><div style={{ fontFamily: "monospace", fontSize: 14, color: "#00e5ff", letterSpacing: 3, textShadow: "0 0 12px #00e5ff" }}>◈ NEXUS MIX</div><div style={{ fontSize: 10, color: "#5a5a7a", letterSpacing: 2 }}>AI MIX & MASTER</div></div>)
                : editingProjectName ? (<div style={{ display: "flex", gap: 4 }}><input style={inp({ padding: "4px 8px", fontSize: 12, borderColor: `${AC}66` })} value={projectNameValue} onChange={e => setProjectNameValue(e.target.value)} onKeyDown={e => e.key === "Enter" && saveProjectName()} autoFocus /><button className="icon-btn" onClick={saveProjectName} style={{ color: AC }}>✓</button><button className="icon-btn" onClick={() => setEditingProjectName(false)} style={{ color: T.subtext }}>✕</button></div>)
                  : (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: AC, flexShrink: 0, boxShadow: `0 0 5px ${AC}` }} />
                        <span style={{ color: AC, fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project?.name}</span>
                        <button className="icon-btn" onClick={() => { setEditingProjectName(true); setProjectNameValue(project.name); }} style={{ color: `${AC}66`, fontSize: 10, flexShrink: 0 }}>✏️</button>
                      </div>
                      {editingProjectSong ? (<div style={{ display: "flex", gap: 4, marginTop: 3 }}><input style={inp({ padding: "3px 8px", fontSize: 11, borderColor: `${AC}44` })} value={projectSongValue} onChange={e => setProjectSongValue(e.target.value)} onKeyDown={e => e.key === "Enter" && saveProjectSongName()} autoFocus placeholder="Song name..." /><button className="icon-btn" onClick={saveProjectSongName} style={{ color: AC, fontSize: 11 }}>✓</button><button className="icon-btn" onClick={() => setEditingProjectSong(false)} style={{ color: T.subtext, fontSize: 11 }}>✕</button></div>)
                        : (<div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><span style={{ color: `${AC}99`, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: project?.songName ? "normal" : "italic" }}>{project?.songName || "+ tap to add song name"}</span><button className="icon-btn" onClick={() => { setEditingProjectSong(true); setProjectSongValue(project?.songName || ""); }} style={{ color: `${AC}55`, fontSize: 10, flexShrink: 0 }}>✏️</button></div>)}
                    </div>
                  )}
            </div>
            {!isMixer && (
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button onClick={() => setColorPickerOpen(!colorPickerOpen)} style={{ width: 26, height: 26, borderRadius: "50%", background: AC, border: "none", cursor: "pointer", boxShadow: `0 0 10px ${AC}` }} />
                {colorPickerOpen && (
                  <div style={{ position: "absolute", top: 32, right: 0, zIndex: 200, background: T.cardBg, borderRadius: 14, padding: 14, border: `1px solid ${T.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 220 }}>
                    <p style={{ color: T.subtext, fontSize: 9, letterSpacing: "0.2em", marginBottom: 8 }}>APP COLOR</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 7, marginBottom: 14 }}>{PROJECT_COLORS.map(c => <button key={c} onClick={() => { setAccentColor(c); updateProject(project.id, () => ({ color: c })); setColorPickerOpen(false); }} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: c === AC ? "2px solid #fff" : "none", cursor: "pointer", boxShadow: `0 0 6px ${c}` }} />)}</div>
                    <div style={{ height: 1, background: T.border, marginBottom: 12 }} />
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)} style={{ width: 44, height: 36, border: "none", borderRadius: 8, cursor: "pointer", padding: 2, background: "none" }} />
                      <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: T.subtext, marginBottom: 4 }}>{customColor}</div><button onClick={() => { setAccentColor(customColor); updateProject(project.id, () => ({ color: customColor })); setColorPickerOpen(false); }} style={{ width: "100%", background: `${customColor}22`, border: `1px solid ${customColor}66`, color: customColor, borderRadius: 8, padding: "6px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✓ APPLY</button></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", border: `1px solid ${isMixer ? "#00e5ff44" : T.border}`, flexShrink: 0 }}>
              <img src="/launchericon-192x192.png" alt="Logo" style={{ width: 40, height: 40, objectFit: "cover", mixBlendMode: "screen", filter: "sepia(1) saturate(3) hue-rotate(70deg) brightness(1.2)" }} />
            </div>
          </div>

          {isMixer && <NexusMixScreen accentColor={AC} studioTracks={tracks} studioAudioURLs={studioAudioURLs} />}

          {isStudio && (
            <div>
              <div style={{ padding: "14px 16px", borderRadius: 14, marginBottom: 12, background: T.card, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ color: AC, fontSize: 18, fontWeight: 700, margin: 0 }}>🎛️ STUDIO</h2>
                    <p style={{ color: T.subtext, fontSize: 10, margin: "2px 0 0" }}>{project?.name?.toUpperCase()}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={handleTapTempo} style={{ background: `${AC}11`, border: `1px solid ${AC}44`, color: AC, borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                      🥁 TAP {song?.bpm ? `(${song.bpm} BPM)` : "TEMPO"}
                    </button>
                    <button onClick={studioPlaying ? stopAllTracks : playAllTracks} style={{ background: studioPlaying ? "#ff444422" : `${AC}22`, border: `2px solid ${studioPlaying ? "#ff4444" : AC}`, color: studioPlaying ? "#ff4444" : AC, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{studioPlaying ? "⏹ STOP ALL" : "▶ PLAY ALL"}</button>
                  </div>
                </div>
                <div style={{ padding: "8px 12px", borderRadius: 10, background: `${AC}08`, border: `1px solid ${AC}22` }}>
                  <p style={{ color: T.subtext, fontSize: 10, margin: 0, lineHeight: 1.6 }}><span style={{ color: AC, fontWeight: 700 }}>PERSISTENT STORAGE: </span>Recordings auto-save to local storage — survive app refresh. Menu → 💾 SAVE .dogbones to send full project to bandmates.</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tracks.map(track => {
                  const isRecordingThis = studioRecordingTrack === track.id;
                  const isPlayingThis = playingTrackId === track.id;
                  const lr = track.recordings[track.recordings.length - 1];
                  const hasAudio = lr && studioAudioURLs[lr.id];
                  const TC = track.color; const isExpanded = expandedTrack === track.id;
                  const isClipping = !!(clippingTracks[track.id] && isRecordingThis);
                  const trackGain = track.gain ?? 1.0;

                  return (
                    <div key={track.id}
                      draggable
                      onDragStart={() => handleTrackDragStart(track.id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleTrackDrop(track.id)}
                      style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${TC}${track.muted ? "22" : "55"}`, background: T.card, opacity: track.muted ? 0.7 : draggedTrack === track.id ? 0.4 : 1, transition: "all 0.2s", boxShadow: isRecordingThis ? `0 0 20px ${TC}66` : "none" }}>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", background: darkMode ? `${TC}11` : `${TC}18` }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, opacity: 0.5, cursor: "grab" }}>
                          {[0, 1, 2].map(i => <div key={i} style={{ width: 12, height: 1.5, borderRadius: 1, background: TC }} />)}
                        </div>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <button onClick={() => setTrackColorPicker(trackColorPicker === track.id ? null : track.id)} style={{ width: 14, height: 14, borderRadius: "50%", background: TC, border: "none", cursor: "pointer", display: "block", boxShadow: `0 0 6px ${TC}` }} />
                          {trackColorPicker === track.id && (
                            <div style={{ position: "absolute", top: 20, left: 0, zIndex: 300, background: T.cardBg, borderRadius: 12, padding: 10, border: `1px solid ${TC}44`, boxShadow: "0 6px 24px rgba(0,0,0,0.4)", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, width: 130 }}>
                              {PROJECT_COLORS.map(c => <button key={c} onClick={() => { updateTrack(track.id, () => ({ color: c })); setTrackColorPicker(null); }} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: c === TC ? "2px solid #fff" : "none", cursor: "pointer", boxShadow: `0 0 5px ${c}` }} />)}
                            </div>
                          )}
                        </div>
                        <div className={isClipping ? "clip-on" : ""} style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: isClipping ? "#ff0000" : darkMode ? "#222" : "#bbb", border: `1px solid ${isClipping ? "#ff4444" : "#666"}`, transition: "background 0.1s" }} title={isClipping ? "CLIPPING! Reduce gain" : "No clipping"} />
                        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                          <span style={{ fontSize: 8, color: isClipping ? "#ff4444" : TC, fontWeight: 700 }}>GAIN</span>
                          <button onClick={() => changeGain(track.id, -0.1)} disabled={trackGain <= 0.1}
                            style={{ width: 22, height: 22, borderRadius: 4, background: isClipping ? "#ff444422" : `${TC}22`, border: `1px solid ${isClipping ? "#ff4444" : TC}44`, color: isClipping ? "#ff4444" : trackGain <= 0.1 ? `${TC}33` : TC, cursor: trackGain <= 0.1 ? "not-allowed" : "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>⬇️</button>
                          <span style={{ fontSize: 9, color: isClipping ? "#ff4444" : TC, fontWeight: 700, minWidth: 28, textAlign: "center" }}>{Math.round(trackGain * 100)}%</span>
                          <button onClick={() => changeGain(track.id, 0.1)} disabled={trackGain >= 1.0}
                            style={{ width: 22, height: 22, borderRadius: 4, background: `${TC}22`, border: `1px solid ${TC}44`, color: trackGain >= 1.0 ? `${TC}33` : TC, cursor: trackGain >= 1.0 ? "not-allowed" : "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>⬆️</button>
                        </div>
                        {editingTrackName === track.id ? (<div style={{ display: "flex", gap: 4, flex: 1 }}><input style={inp({ padding: "3px 8px", fontSize: 12, borderColor: `${TC}66` })} value={trackNameValue} onChange={e => setTrackNameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { updateTrack(track.id, () => ({ name: trackNameValue.trim() })); setEditingTrackName(null); } }} autoFocus /><button className="icon-btn" onClick={() => { updateTrack(track.id, () => ({ name: trackNameValue.trim() })); setEditingTrackName(null); }} style={{ color: TC }}>✓</button></div>)
                          : (<span onClick={() => { setEditingTrackName(track.id); setTrackNameValue(track.name); }} style={{ color: TC, fontWeight: 700, fontSize: 13, flex: 1, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</span>)}
                        {isRecordingThis && <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}><div className="rec-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4444" }} /><span style={{ color: "#ff4444", fontSize: 11, fontWeight: 700 }}>{fmtTime(studioRecordingTime)}</span></div>}
                        {lr && <span style={{ fontSize: 8, color: hasAudio ? (loadAudioFromStore(lr.id) ? AC : TC) : "#ff9500", flexShrink: 0 }} title={hasAudio ? (loadAudioFromStore(lr.id) ? "Saved to storage ✓" : "In memory only") : "No audio"}>{hasAudio ? (loadAudioFromStore(lr.id) ? "💾" : "●") : "⚠"}</span>}
                        {track.muted && <span style={{ color: "#ff4444", fontSize: 9, fontWeight: 700, background: "#ff444422", border: "1px solid #ff444466", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>MUTE</span>}
                        {track.solo && <span style={{ color: TC, fontSize: 9, fontWeight: 700, background: `${TC}22`, border: `1px solid ${TC}66`, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>SOLO</span>}
                        <button onClick={() => setConfirmReset({ id: track.id, name: track.name })} style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: "#ff950011", border: "1px solid #ff950044", color: "#ff9500", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }} title="Reset track">🔄</button>
                        <button onClick={() => setExpandedTrack(isExpanded ? null : track.id)} style={{ background: isExpanded ? `${TC}22` : "transparent", border: `1px solid ${TC}${isExpanded ? "66" : "33"}`, color: TC, borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</button>
                      </div>

                      <div style={{ height: 28, background: darkMode ? "#050a05" : "#dce8f8", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", gap: 2, padding: "0 12px", borderTop: `1px solid ${TC}22`, borderBottom: isExpanded ? `1px solid ${TC}22` : "none" }}>
                        {isRecordingThis ? ([...Array(24)].map((_, i) => <div key={i} style={{ width: 3, borderRadius: 2, background: TC, animation: `vuPulse ${0.3 + Math.random() * 0.5}s ease-in-out infinite`, animationDelay: `${i * 0.04}s`, minHeight: 3 }} />))
                          : lr ? ([...Array(24)].map((_, i) => <div key={i} style={{ width: 3, borderRadius: 2, height: `${15 + Math.sin(i * 0.8) * 40 + Math.cos(i * 1.3) * 20}%`, background: `${TC}${hasAudio ? "bb" : "33"}` }} />))
                            : (<span style={{ color: T.subtext, fontSize: 10 }}>No recording — tap REC</span>)}
                      </div>

                      <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: isExpanded ? `1px solid ${TC}22` : "none" }}>
                        <button onClick={() => playTrackWithFX(track.id)} disabled={!lr} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, background: isPlayingThis ? `${TC}33` : `${TC}11`, border: `1px solid ${TC}${isPlayingThis ? "99" : "44"}`, color: !lr ? T.subtext : TC, cursor: !lr ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700 }}>{isPlayingThis ? "⏸ PAUSE" : "▶ PLAY"}</button>
                        <button onClick={() => { if (isPlayingThis) stopTrack(track.id); else if (isRecordingThis) stopStudioRecording(); }} disabled={!isPlayingThis && !isRecordingThis} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, background: "#ff444411", border: `1px solid #ff4444${isPlayingThis || isRecordingThis ? "88" : "22"}`, color: isPlayingThis || isRecordingThis ? "#ff4444" : T.subtext, cursor: isPlayingThis || isRecordingThis ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700 }}>⏹ STOP</button>
                        {isRecordingThis ? <button onClick={stopStudioRecording} style={{ flex: 2, padding: "8px 4px", borderRadius: 10, background: "#ff444422", border: "2px solid #ff4444", color: "#ff4444", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🔴 {fmtTime(studioRecordingTime)}</button>
                          : <button onClick={() => { if (studioRecordingTrack !== null) return; startStudioRecording(track.id); }} style={{ flex: 2, padding: "8px 4px", borderRadius: 10, background: `${TC}22`, border: `1px solid ${TC}66`, color: studioRecordingTrack !== null ? T.subtext : TC, cursor: studioRecordingTrack !== null ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, boxShadow: `0 0 8px ${TC}33` }}>🎙️ REC</button>}
                        <button onClick={() => { studioFileTrackId.current = track.id; studioFileInputRef.current?.click(); }} style={{ padding: "8px 10px", borderRadius: 10, background: `${TC}11`, border: `1px solid ${TC}44`, color: TC, cursor: "pointer", fontSize: 13 }}>📁</button>
                      </div>

                      {isExpanded && (
                        <div className="drop-in" style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 18, background: T.cardBg }}>
                          <StepControl label="🔊 VOLUME" value={track.volume} onChange={v => updateTrack(track.id, () => ({ volume: v }))} min={0} max={1} step={0.1} TC={TC} formatLabel={volLabel} />
                          <StepControl label="🌊 REVERB" value={track.reverb || 0} onChange={v => updateTrack(track.id, () => ({ reverb: v }))} min={0} max={1} step={0.1} TC={TC} formatLabel={reverbLabel} />
                          <div><p style={{ color: TC, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>🎚️ EQ</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              <StepControl label="LOWS" value={track.lows || 0} onChange={v => updateTrack(track.id, () => ({ lows: v }))} min={-1} max={1} step={0.1} TC={TC} formatLabel={eqLabel} />
                              <StepControl label="MIDS" value={track.mids || 0} onChange={v => updateTrack(track.id, () => ({ mids: v }))} min={-1} max={1} step={0.1} TC={TC} formatLabel={eqLabel} />
                              <StepControl label="HIGHS" value={track.highs || 0} onChange={v => updateTrack(track.id, () => ({ highs: v }))} min={-1} max={1} step={0.1} TC={TC} formatLabel={eqLabel} />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => updateTrack(track.id, t => ({ muted: !t.muted }))} style={{ flex: 1, padding: "8px", borderRadius: 10, background: track.muted ? "#ff444422" : "transparent", border: `1px solid ${track.muted ? "#ff4444" : T.border}`, color: track.muted ? "#ff4444" : T.subtext, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🔇 {track.muted ? "UNMUTE" : "MUTE"}</button>
                            <button onClick={() => updateTrack(track.id, t => ({ solo: !t.solo }))} style={{ flex: 1, padding: "8px", borderRadius: 10, background: track.solo ? `${TC}22` : "transparent", border: `1px solid ${track.solo ? TC : T.border}`, color: track.solo ? TC : T.subtext, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>⭐ {track.solo ? "UNSOLO" : "SOLO"}</button>
                          </div>
                          <div><p style={{ color: TC, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>📝 TRACK NOTES</p>
                            <textarea style={inp({ height: 60, resize: "none", fontFamily: "monospace", fontSize: 12, borderColor: `${TC}33`, padding: "8px" })} placeholder={`Notes for ${track.name}...`} value={track.notes || ""} onChange={e => updateTrack(track.id, () => ({ notes: e.target.value }))} />
                          </div>
                          {track.recordings.length > 0 && (
                            <div><p style={{ color: TC, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>TAKES ({track.recordings.length})</p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {track.recordings.map((rec, idx) => {
                                  const isPersisted = !!loadAudioFromStore(rec.id);
                                  return (
                                    <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: idx === track.recordings.length - 1 ? `${TC}11` : T.cardBg, border: `1px solid ${idx === track.recordings.length - 1 ? TC + "33" : T.border}` }}>
                                      {idx === track.recordings.length - 1 && <span style={{ color: TC, fontSize: 8, fontWeight: 700, background: `${TC}22`, borderRadius: 3, padding: "1px 4px" }}>LATEST</span>}
                                      <span style={{ color: T.text, fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.label}</span>
                                      {rec.duration > 0 && <span style={{ color: T.subtext, fontSize: 10 }}>{fmtTime(rec.duration)}</span>}
                                      <span style={{ fontSize: 9, color: isPersisted ? AC : studioAudioURLs[rec.id] ? TC : "#ff9500" }} title={isPersisted ? "Saved to storage" : studioAudioURLs[rec.id] ? "In memory only (will clear on refresh)" : "Not available"}>
                                        {isPersisted ? "💾" : studioAudioURLs[rec.id] ? "●" : "⚠"}
                                      </span>
                                      <button className="icon-btn" onClick={() => deleteStudioRecording(track.id, rec.id)} style={{ color: "#ff444488", fontSize: 11 }}>🗑️</button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <button onClick={() => setConfirmDelete({ id: track.id, name: track.name })} style={{ padding: "8px", borderRadius: 10, background: "#ff444411", border: "1px solid #ff444433", color: "#ff4444", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🗑️ DELETE TRACK</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button onClick={addTrack} style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 14, background: `${AC}11`, border: `2px dashed ${AC}44`, color: AC, cursor: "pointer", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>+ ADD TRACK</button>
              <input ref={studioFileInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => { if (studioFileTrackId.current !== null) { handleStudioFileUpload(studioFileTrackId.current, e); studioFileTrackId.current = null; } }} />
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: T.cardBg, border: `1px solid ${T.border}` }}>
                <p style={{ color: T.subtext, fontSize: 10, lineHeight: 1.8, margin: 0 }}>
                  <span style={{ color: AC }}>💾</span> = saved to storage (survives refresh) &nbsp;<span style={{ color: AC }}>●</span> = in memory (session only) &nbsp;<span style={{ color: "#ff9500" }}>⚠</span> = not available<br />
                  <span style={{ color: AC }}>▸</span> Red dot = clipping → tap ⬇️ GAIN &nbsp;<span style={{ color: AC }}>▸</span> Drag ≡ to reorder tracks &nbsp;<span style={{ color: AC }}>▸</span> Menu → 💾 SAVE .dogbones to send to band
                </p>
              </div>
            </div>
          )}

          {isSongs && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "10px 14px", borderRadius: 12, background: T.card, border: `1px solid ${T.border}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: AC, flexShrink: 0, boxShadow: `0 0 6px ${AC}` }} />
                {editingSongName ? (<><input style={inp({ borderColor: `${AC}66`, fontSize: 13 })} value={songNameValue} onChange={e => setSongNameValue(e.target.value)} onKeyDown={e => e.key === "Enter" && saveSongName()} autoFocus /><button className="icon-btn" onClick={saveSongName} style={{ color: AC }}>✓</button><button className="icon-btn" onClick={() => setEditingSongName(false)} style={{ color: T.subtext }}>✕</button></>)
                  : (<><span style={{ color: AC, fontWeight: 700, fontSize: 14, flex: 1 }}>{song.name}</span><button className="icon-btn" onClick={() => { setEditingSongName(true); setSongNameValue(song.name); }} style={{ color: `${AC}88` }}>✏️</button></>)}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, display: "flex", gap: 8, padding: "10px 14px", borderRadius: 12, background: T.card, border: `1px solid ${T.border}` }}>
                  <input style={inp({ fontSize: 12 })} placeholder="New section..." value={newSection} onChange={e => setNewSection(e.target.value)} onKeyDown={e => e.key === "Enter" && addSection()} />
                  <button onClick={addSection} style={{ background: `${AC}22`, border: `1px solid ${AC}66`, color: AC, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>+ ADD</button>
                </div>
                <button onClick={() => setInstrPanelOpen(!instrPanelOpen)} style={{ background: instrPanelOpen ? `${AC}33` : `${AC}11`, border: `1px solid ${AC}${instrPanelOpen ? "99" : "44"}`, borderRadius: 12, padding: "0 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 70 }}>
                  <img src="/launchericon-192x192.png" style={{ width: 26, height: 26, objectFit: "cover", mixBlendMode: "screen", filter: "sepia(1) saturate(3) hue-rotate(70deg) brightness(1.3)" }} />
                  <span style={{ color: AC, fontSize: 8, fontWeight: 700, textAlign: "center" }}>INSTRUMENTS</span>
                </button>
              </div>
              {instrPanelOpen && (
                <div style={{ marginBottom: 12, padding: "14px 16px", borderRadius: 14, background: T.card, border: `1px solid ${T.border}` }}>
                  <h3 style={{ color: AC, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>MANAGE INSTRUMENTS</h3>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input style={inp({ fontSize: 12 })} placeholder="New instrument..." value={newInstrument} onChange={e => setNewInstrument(e.target.value)} onKeyDown={e => e.key === "Enter" && addInstrument()} /><button onClick={addInstrument} style={{ background: `${AC}22`, border: `1px solid ${AC}66`, color: AC, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>+ ADD</button></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{instruments.map(inst => (<div key={inst} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: `${AC}11`, border: `1px solid ${AC}33` }}><span style={{ color: T.text, fontSize: 12 }}>{inst}</span><button className="icon-btn" onClick={() => removeInstrument(inst)} style={{ color: "#ff4444", fontSize: 11, padding: "0 2px" }}>✕</button></div>))}</div>
                </div>
              )}

              <div className="table-wrap" style={{ border: `1px solid ${T.border}` }}>
                <table className="section-table">
                  <thead>
                    <tr style={{ background: T.headBg }}>
                      <th className="sticky-col-head" style={{ padding: "10px 12px", borderBottom: `1px solid ${T.lineColor}`, textAlign: "left", fontSize: 10, color: T.text, letterSpacing: "0.12em", minWidth: 160, background: T.headBg, fontWeight: 700 }}>SECTION</th>
                      {instruments.map(inst => <th key={inst} style={{ padding: "10px 8px", borderBottom: `1px solid ${T.lineColor}`, textAlign: "center", fontSize: 9, color: T.text, minWidth: 72, whiteSpace: "nowrap", letterSpacing: "0.08em", fontWeight: 700 }}>{inst.toUpperCase()}</th>)}
                      <th style={{ padding: "10px 8px", borderBottom: `1px solid ${T.lineColor}`, textAlign: "center", fontSize: 9, color: T.text, minWidth: 130, whiteSpace: "nowrap", fontWeight: 700 }}>STATUS / ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {song.sections.map((section, ri) => {
                      const isLocked = !!song.locked?.[ri]; const isStar = !!song.starred?.[ri]; const status = song.status?.[ri] || "Draft";
                      const hasNote = !!getSectionNote(section); const audioCount = (song.audioNotes?.[section] || []).length;
                      return (
                        <tr key={section + ri} draggable={!isLocked} onDragStart={() => !isLocked && setDraggedIndex(ri)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(ri)} className="chrome-row" style={{ borderBottom: `1px solid ${T.lineColor}`, opacity: draggedIndex === ri ? 0.4 : 1, cursor: isLocked ? "default" : "grab", background: isStar ? `${AC}08` : "transparent" }}>
                          <td className="sticky-col" style={{ padding: "6px 8px", fontSize: 11, color: T.text, fontWeight: 600, minWidth: 160, background: isStar ? `${AC}10` : T.stickyBg }}>
                            {editingIndex === ri ? (<div style={{ display: "flex", gap: 4 }}><input style={inp({ padding: "3px 6px", fontSize: 11 })} value={editingValue} onChange={e => setEditingValue(e.target.value)} onKeyDown={e => e.key === "Enter" && saveEdit()} autoFocus /><button className="icon-btn" onClick={saveEdit} style={{ color: AC, fontSize: 12 }}>✓</button><button className="icon-btn" onClick={() => setEditingIndex(null)} style={{ color: T.subtext, fontSize: 12 }}>✕</button></div>)
                              : (<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <button className="lines-btn" onTouchStart={() => handleLinesTouchStart(ri, section)} onTouchEnd={() => handleLinesTouchEnd(ri, section)} onClick={() => !isDragging && setSectionNoteOpen(section)} style={{ position: "relative" }}>
                                  {[0, 1, 2].map(i => <div key={i} className="line" style={{ background: hasNote ? AC : T.subtext }} />)}
                                  {hasNote && <div style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, borderRadius: "50%", background: AC }} />}
                                  {audioCount > 0 && <div style={{ position: "absolute", bottom: 2, right: 2, background: AC, color: darkMode ? "#000" : "#fff", fontSize: 7, fontWeight: 700, borderRadius: 4, padding: "0 2px", minWidth: 10, textAlign: "center" }}>{audioCount}</div>}
                                </button>
                                <div style={{ flex: 1, overflow: "hidden" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    {isStar && <span style={{ fontSize: 10 }}>⭐</span>}{isLocked && <span style={{ fontSize: 10 }}>🔒</span>}
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isLocked ? T.subtext : T.text }}>{section}</span>
                                  </div>
                                </div>
                              </div>
                              )}
                          </td>
                          {instruments.map((_, ci) => {
                            const checked = isChecked(section, ci);
                            return (<td key={ci} style={{ padding: "6px 8px", textAlign: "center" }}>
                              <div onClick={() => !isLocked && toggleChecked(section, ci)} style={{ width: 22, height: 22, margin: "0 auto", border: `2px solid ${checked ? AC : T.lineColor}`, borderRadius: 5, background: T.checkBg, cursor: isLocked ? "default" : "pointer", position: "relative", boxShadow: checked ? `0 0 6px ${AC}88` : "none", transition: "all 0.15s" }}>
                                {checked && <div style={{ position: "absolute", left: 4, top: 1, width: 8, height: 12, border: `2px solid ${AC}`, borderTop: "none", borderLeft: "none", transform: "rotate(45deg)" }} />}
                              </div>
                            </td>);
                          })}
                          <td style={{ padding: "6px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <button onClick={() => cycleStatus(ri)} style={{ background: `${STATUS_COLORS[status]}22`, border: `1px solid ${STATUS_COLORS[status]}66`, color: STATUS_COLORS[status], borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700, cursor: "pointer", marginBottom: 4, display: "block", width: "100%" }}>{status.toUpperCase()}</button>
                            <div style={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
                              <button className="icon-btn" onClick={() => setAudioNoteOpen(section)} style={{ position: "relative", color: audioCount > 0 ? AC : T.subtext }}>🎙️{audioCount > 0 && <span style={{ position: "absolute", top: -2, right: -2, background: AC, color: darkMode ? "#000" : "#fff", fontSize: 7, fontWeight: 700, borderRadius: 4, padding: "0 2px", minWidth: 10, textAlign: "center" }}>{audioCount}</span>}</button>
                              <button className="icon-btn" onClick={() => toggleStarred(ri)} style={{ color: isStar ? "#ffee00" : T.subtext }}>⭐</button>
                              <button className="icon-btn" onClick={() => toggleLocked(ri)} style={{ color: isLocked ? "#ff9500" : T.subtext }}>🔒</button>
                              {!isLocked && <button className="icon-btn" onClick={() => startEdit(ri)} style={{ color: `${AC}88` }}>✏️</button>}
                              {!isLocked && <button className="icon-btn" onClick={() => removeSection(ri)} style={{ color: "#ff444488" }}>🗑️</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginTop: 12 }}>
                <div style={{ borderRadius: 14, padding: 14, background: T.card, border: `1px solid ${T.border}`, position: "relative" }}>
                  <h2 style={{ color: AC, fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: "0.1em" }}>NOTES</h2>
                  <textarea style={inp({ height: 72, resize: "none", fontFamily: "monospace", borderColor: T.border, paddingBottom: 24 })} placeholder="Session notes..." value={song.notes} onChange={e => updateSong(() => ({ notes: e.target.value }))} />
                  <button onClick={() => setNotesOpen(true)} style={{ position: "absolute", bottom: 18, right: 18, background: `${AC}22`, border: `1px solid ${AC}66`, color: AC, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>↗</button>
                </div>
                <div style={{ borderRadius: 14, padding: 14, background: T.card, border: `1px solid ${T.border}` }}>
                  <h2 style={{ color: AC, fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: "0.1em" }}>TEMPO & KEY</h2>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <input style={inp({ flex: 1 })} placeholder="BPM" value={song.bpm} onChange={e => updateSong(() => ({ bpm: e.target.value }))} />
                    <button onClick={handleTapTempo} style={{ background: `${AC}22`, border: `1px solid ${AC}66`, color: AC, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>🥁 TAP</button>
                  </div>
                  <input style={inp({})} placeholder="Key (e.g. A minor)" value={song.key} onChange={e => updateSong(() => ({ key: e.target.value }))} />
                </div>
                <div style={{ borderRadius: 14, padding: 14, background: T.card, border: `1px solid ${T.border}` }}>
                  <h2 style={{ color: AC, fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: "0.1em" }}>TIPS</h2>
                  <ul style={{ fontSize: 11, color: T.subtext, lineHeight: 2, listStyle: "none", padding: 0, margin: 0 }}>
                    <li><span style={{ color: AC }}>▸</span> ☰ tap=notes · hold=drag sections</li>
                    <li><span style={{ color: AC }}>▸</span> 🥁 TAP = tap the beat to set BPM</li>
                    <li><span style={{ color: AC }}>▸</span> Menu → 🎚️ MIX & MASTER (AI)</li>
                    <li><span style={{ color: AC }}>▸</span> Menu → 💾 SAVE to send to band</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {(phase === "loading" || phase === "fading") && (
        <div className={phase === "fading" ? "splash-fade" : ""} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
          <img src={SPLASH_IMG} alt="Dog Bones" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 50%)" }} />
          {phase === "loading" && (
            <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 32px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <span className="loading-text" style={{ color: AC, fontSize: 13, letterSpacing: "0.4em", fontFamily: "monospace", fontWeight: 700 }}>LOADING</span>
              <div style={{ width: "100%", height: 4, background: `${AC}22`, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg,${AC}88,${AC})`, borderRadius: 2, boxShadow: `0 0 12px ${AC}`, transition: "width 0.03s linear" }} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

import { useEffect, useState, useRef, useCallback } from "react";

const SPLASH_IMG = "/Screenshot_20260514_110057_ChatGPT~2.jpg";
const LOGO_TEXT  = "/Screenshot_20260514_221551_Photos~2.jpg";

const SONG_COLORS = [
  { name:"green",  hex:"#39ff14", dim:"#1a4a00", tab:"rgba(57,255,20,0.15)"  },
  { name:"blue",   hex:"#00cfff", dim:"#003a4a", tab:"rgba(0,207,255,0.15)"  },
  { name:"purple", hex:"#bf5fff", dim:"#2a004a", tab:"rgba(191,95,255,0.15)" },
  { name:"orange", hex:"#ff9500", dim:"#4a2000", tab:"rgba(255,149,0,0.15)"  },
];

const PROJECT_COLORS = [
  "#39ff14","#00cfff","#bf5fff","#ff9500",
  "#ff3366","#ffee00","#00ffcc","#ff6600",
  "#ff0080","#00ff80","#8080ff","#ff8000",
];

const TRACK_COLORS = [
  "#39ff14","#00cfff","#bf5fff","#ff9500","#ff3366","#ffee00"
];
const TRACK_NAMES = ["Guitar","Bass","Drums","Vocals","Lead Guitar","Keys"];

const DEFAULT_SECTIONS = [
  "Intro","Pre-Verse","Verse","Chorus","Between Verse",
  "2nd Verse","Breakdown","Guitar Solo","Interlude","Chorus Outro",
];
const DEFAULT_INSTRUMENTS = [
  "Guitar","Bass","Drums","Vocals","Lead Guitar","Synth","Backing Vocals",
];
const STATUS_OPTIONS = ["Draft","In Progress","Final"];
const STATUS_COLORS  = { "Draft":"#888","In Progress":"#ff9500","Final":"#39ff14" };

function makeDefaultSongs() {
  return SONG_COLORS.map((c,i)=>({
    id:i, name:`Song ${i+1}`, color:c,
    sections:[...DEFAULT_SECTIONS],
    status:{}, locked:{}, starred:{},
    sectionNotes:{}, audioNotes:{},
    notes:"", bpm:"", key:"",
  }));
}
function makeDefaultTracks() {
  return TRACK_NAMES.map((name,i)=>({
    id:i, name, color:TRACK_COLORS[i],
    recordings:[], volume:0.8, muted:false, solo:false,
    reverb:0, lows:0, mids:0, highs:0, notes:"",
  }));
}
function makeProject(id,name,color) {
  return {
    id, name, color, songName:"",
    instruments:[...DEFAULT_INSTRUMENTS],
    songs:makeDefaultSongs(),
    checks:{}, setlist:[],
    studio:{ tracks:makeDefaultTracks() },
  };
}

const STORAGE_KEY   = "db_v14";
const STORAGE_AP    = "db_ap_v14";
const STORAGE_THEME = "db_theme_v14";
const STORAGE_ACCENT= "db_accent_v14";

function load(key,fallback) {
  try { const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; }
  catch { return fallback; }
}
function save(key,val) {
  try { localStorage.setItem(key,JSON.stringify(val)); } catch {}
}
function fmtTime(s) {
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;
}

async function createReverbNode(ac,amount) {
  const convolver=ac.createConvolver();
  const rate=ac.sampleRate;
  const length=rate*(0.5+amount*3.5);
  const impulse=ac.createBuffer(2,length,rate);
  for(let c=0;c<2;c++){
    const ch=impulse.getChannelData(c);
    for(let i=0;i<length;i++) ch[i]=(Math.random()*2-1)*Math.pow(1-i/length,1+amount*3);
  }
  convolver.buffer=impulse;
  return convolver;
}

function applyEQ(ac,source,track) {
  const low=ac.createBiquadFilter();
  const mid=ac.createBiquadFilter();
  const high=ac.createBiquadFilter();
  low.type="lowshelf";   low.frequency.value=200;  low.gain.value=(track.lows||0)*12;
  mid.type="peaking";    mid.frequency.value=1000; mid.gain.value=(track.mids||0)*12; mid.Q.value=1;
  high.type="highshelf"; high.frequency.value=4000;high.gain.value=(track.highs||0)*12;
  source.connect(low); low.connect(mid); mid.connect(high);
  return high;
}

function StepControl({label,value,onChange,min=0,max=1,step=0.1,TC,formatLabel}) {
  const pct=Math.round(((value-min)/(max-min))*100);
  const displayVal=value>0?`+${Math.round(value*10)}`:Math.round(value*10);
  return(
    <div style={{flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <span style={{color:TC,fontSize:10,fontWeight:700,letterSpacing:"0.08em"}}>{label}</span>
        <span style={{color:TC,fontSize:10,fontWeight:700}}>{displayVal}</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <button onClick={()=>onChange(Math.max(min,Math.round((value-step)*10)/10))}
          style={{width:32,height:32,borderRadius:8,flexShrink:0,background:value<=min?`${TC}08`:`${TC}22`,border:`1px solid ${TC}${value<=min?"22":"66"}`,color:value<=min?`${TC}44`:TC,cursor:value<=min?"not-allowed":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>⬇️</button>
        <div style={{flex:1,height:6,borderRadius:3,background:"rgba(128,128,128,0.2)",overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${TC}88,${TC})`,borderRadius:3,boxShadow:value!==0?`0 0 6px ${TC}66`:"none",transition:"width 0.1s ease"}}/>
        </div>
        <button onClick={()=>onChange(Math.min(max,Math.round((value+step)*10)/10))}
          style={{width:32,height:32,borderRadius:8,flexShrink:0,background:value>=max?`${TC}08`:`${TC}22`,border:`1px solid ${TC}${value>=max?"22":"66"}`,color:value>=max?`${TC}44`:TC,cursor:value>=max?"not-allowed":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>⬆️</button>
      </div>
      {formatLabel&&<p style={{color:"rgba(128,128,128,0.6)",fontSize:9,margin:"4px 0 0",letterSpacing:"0.05em"}}>{formatLabel(value)}</p>}
    </div>
  );
}

const NX = {
  bg:"#0a0a0f", panel:"#111118", border:"#1e1e2e",
  accent:"#00e5ff", accentDim:"#00e5ff22",
  green:"#00ff9d", amber:"#ffb700", red:"#ff4466", purple:"#b060ff",
  text:"#e0e0f0", muted:"#5a5a7a",
};

function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function dbToLinear(db){return Math.pow(10,db/20);}

function NxKnob({label,value,min,max,unit="",color=NX.accent,onChange,size=48}){
  const dragRef=useRef(null);
  const norm=(value-min)/(max-min);
  const angle=norm*270-135;
  const r=size/2-4,cx=size/2,cy=size/2;
  const toXY=deg=>{const rad=((deg-90)*Math.PI)/180;return[cx+r*Math.cos(rad),cy+r*Math.sin(rad)];};
  const[sx,sy]=toXY(-135);
  const[ex,ey]=toXY(angle);
  const large=norm*270>180?1:0;
  const handleMouseDown=e=>{
    dragRef.current={startY:e.clientY,startVal:value};
    const move=ev=>{
      const delta=(dragRef.current.startY-ev.clientY)/150;
      const newVal=clamp(dragRef.current.startVal+delta*(max-min),min,max);
      onChange(parseFloat(newVal.toFixed(1)));
    };
    const up=()=>{window.removeEventListener("mousemove",move);window.removeEventListener("mouseup",up);};
    window.addEventListener("mousemove",move);window.addEventListener("mouseup",up);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,userSelect:"none"}}>
      <svg width={size} height={size} onMouseDown={handleMouseDown} style={{cursor:"ns-resize"}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={NX.border} strokeWidth={3}/>
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" style={{filter:`drop-shadow(0 0 4px ${color})`}}/>
        <circle cx={ex} cy={ey} r={3} fill={color}/>
        <text x={cx} y={cy+4} textAnchor="middle" fill={NX.text} style={{fontSize:size*0.22,fontFamily:"monospace"}}>
          {Math.abs(value)<10?value.toFixed(1):Math.round(value)}
        </text>
      </svg>
      <span style={{fontSize:9,color:NX.muted,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>
        {label}{unit&&<span style={{color:NX.accent}}> {unit}</span>}
      </span>
    </div>
  );
}

function NxVU({level=0,label=""}){
  const bars=16;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
      {label&&<span style={{fontSize:9,color:NX.muted,letterSpacing:1}}>{label}</span>}
      <div style={{display:"flex",flexDirection:"column-reverse",gap:2}}>
        {Array.from({length:bars}).map((_,i)=>{
          const active=level>(i/bars);
          const bc=i>12?NX.red:i>9?NX.amber:NX.green;
          return <div key={i} style={{width:8,height:4,borderRadius:1,background:active?bc:NX.border,boxShadow:active?`0 0 4px ${bc}`:"none",transition:"background 0.05s"}}/>;
        })}
      </div>
    </div>
  );
}

function NxCard({title,children,active,onToggle,color=NX.accent,width}){
  return(
    <div style={{background:NX.panel,border:`1px solid ${active?color+"66":NX.border}`,borderRadius:6,padding:"10px 12px",width:width||"auto",boxShadow:active?`0 0 14px ${color}22`:"none",transition:"all 0.3s",flexShrink:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontFamily:"monospace",fontSize:10,color:active?color:NX.muted,letterSpacing:2}}>◈ {title}</span>
        {onToggle&&<button onClick={onToggle} style={{background:active?color+"22":"transparent",border:`1px solid ${active?color:NX.border}`,color:active?color:NX.muted,padding:"3px 8px",borderRadius:3,fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:1}}>{active?"ON":"OFF"}</button>}
      </div>
      {children}
    </div>
  );
}

function EQVisualizer({bands}){
  const W=300,H=72;
  const logMin=Math.log10(20),logMax=Math.log10(20000);
  const freqToX=f=>((Math.log10(f)-logMin)/(logMax-logMin))*W;
  const gainToY=g=>H/2-(g/18)*(H/2-4);
  const getGainAt=freq=>{
    let total=0;
    bands.forEach(b=>{
      const d=Math.abs(Math.log10(freq/b.freq));
      total+=b.gain*Math.exp(-d*d*1.5);
    });
    return clamp(total,-18,18);
  };
  const freqs=[20,50,100,200,500,1000,2000,5000,10000,20000];
  const pts=freqs.map(f=>({x:freqToX(f),y:gainToY(getGainAt(f))}));
  const pathD=pts.map((p,i)=>i===0?`M ${p.x} ${p.y}`:`L ${p.x} ${p.y}`).join(" ");
  const fillD=pathD+` L ${W} ${H/2} L 0 ${H/2} Z`;
  return(
    <svg width={W} height={H} style={{display:"block"}}>
      <defs>
        <linearGradient id="eqf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NX.accent} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={NX.accent} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[-12,-6,0,6,12].map(g=><line key={g} x1={0} y1={gainToY(g)} x2={W} y2={gainToY(g)} stroke={g===0?NX.border+"88":NX.border+"44"} strokeWidth={g===0?1.5:0.5}/>)}
      <path d={fillD} fill="url(#eqf)"/>
      <path d={pathD} fill="none" stroke={NX.accent} strokeWidth={2} style={{filter:`drop-shadow(0 0 3px ${NX.accent})`}}/>
      {bands.map((b,i)=><circle key={i} cx={freqToX(b.freq)} cy={gainToY(b.gain)} r={3} fill={NX.accent} style={{filter:`drop-shadow(0 0 4px ${NX.accent})`}}/>)}
    </svg>
  );
}

function WaveformDisplay({analyser,isPlaying}){
  const canvasRef=useRef(null);
  const animRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");const W=canvas.width,H=canvas.height;
    const draw=()=>{
      animRef.current=requestAnimationFrame(draw);
      ctx.clearRect(0,0,W,H);ctx.fillStyle=NX.bg;ctx.fillRect(0,0,W,H);
      if(analyser&&isPlaying){
        const bufLen=analyser.frequencyBinCount;const data=new Uint8Array(bufLen);
        analyser.getByteTimeDomainData(data);
        ctx.beginPath();ctx.strokeStyle=NX.accent;ctx.lineWidth=1.5;ctx.shadowColor=NX.accent;ctx.shadowBlur=6;
        const sw=W/bufLen;let x=0;
        for(let i=0;i<bufLen;i++){const v=data[i]/128;const y=(v*H)/2;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);x+=sw;}
        ctx.stroke();
      }else{
        ctx.beginPath();ctx.strokeStyle=NX.border;ctx.lineWidth=1;ctx.moveTo(0,H/2);
        for(let x=0;x<W;x+=4){ctx.lineTo(x,H/2+(Math.random()-0.5)*1.5);}
        ctx.stroke();
      }
    };
    draw();return()=>cancelAnimationFrame(animRef.current);
  },[analyser,isPlaying]);
  return <canvas ref={canvasRef} width={680} height={50} style={{width:"100%",height:50,borderRadius:4,border:`1px solid ${NX.border}`}}/>;
}

function SpectrumAnalyzer({analyser,isPlaying}){
  const canvasRef=useRef(null);
  const animRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");const W=canvas.width,H=canvas.height;
    const draw=()=>{
      animRef.current=requestAnimationFrame(draw);
      ctx.clearRect(0,0,W,H);ctx.fillStyle=NX.bg;ctx.fillRect(0,0,W,H);
      if(analyser&&isPlaying){
        const bufLen=analyser.frequencyBinCount;const data=new Uint8Array(bufLen);
        analyser.getByteFrequencyData(data);
        const bw=W/(bufLen/4);
        for(let i=0;i<bufLen/4;i++){
          const v=data[i]/255;const bh=v*H;
          const hue=180+v*80;
          ctx.fillStyle=`hsl(${hue},100%,${40+v*30}%)`;ctx.shadowColor=`hsl(${hue},100%,60%)`;ctx.shadowBlur=4;
          ctx.fillRect(i*bw,H-bh,bw-1,bh);
        }
      }else{
        for(let i=0;i<50;i++){ctx.fillStyle=NX.border;ctx.fillRect(i*(W/50),H-Math.random()*3-1,W/50-1,3);}
      }
    };
    draw();return()=>cancelAnimationFrame(animRef.current);
  },[analyser,isPlaying]);
  return <canvas ref={canvasRef} width={680} height={70} style={{width:"100%",height:70,borderRadius:4,border:`1px solid ${NX.border}`}}/>;
}

function NexusMixScreen({accentColor}){
  const audioCtxRef=useRef(null);
  const sourceRef=useRef(null);
  const analyserRef=useRef(null);
  const [isPlaying,setIsPlaying]=useState(false);
  const [fileName,setFileName]=useState(null);
  const [audioBuffer,setAudioBuffer]=useState(null);
  const [levels,setLevels]=useState({L:0,R:0,M:0});
  const [masterGain,setMasterGain]=useState(0);
  const [eq,setEq]=useState([
    {label:"Sub",freq:60,gain:0},{label:"Bass",freq:120,gain:0},
    {label:"Low-Mid",freq:400,gain:0},{label:"Mid",freq:1000,gain:0},
    {label:"Hi-Mid",freq:3000,gain:0},{label:"Air",freq:10000,gain:0},
  ]);
  const [eqActive,setEqActive]=useState(true);
  const [reverb,setReverb]=useState({mix:20,size:60,damping:50,predelay:20});
  const [reverbActive,setReverbActive]=useState(false);
  const [comp,setComp]=useState({threshold:-24,ratio:4,attack:10,release:100,makeup:0});
  const [compActive,setCompActive]=useState(true);
  const [deEsser,setDeEsser]=useState({freq:7500,threshold:-20,ratio:6});
  const [deEsserActive,setDeEsserActive]=useState(false);
  const [gate,setGate]=useState({threshold:-50,attack:5,release:200,hold:50});
  const [gateActive,setGateActive]=useState(false);
  const [pitch,setPitch]=useState({shift:0,formant:0,correction:0});
  const [pitchActive,setPitchActive]=useState(false);
  const [quantize,setQuantize]=useState({strength:50,grid:"1/16",swing:0});
  const [quantizeActive,setQuantizeActive]=useState(false);
  const [limiter,setLimiter]=useState({ceiling:-0.3,release:50});
  const [limiterActive,setLimiterActive]=useState(true);
  const [saturation,setSaturation]=useState({drive:0,type:"tape",mix:30});
  const [satActive,setSatActive]=useState(false);
  const [stereoWidth,setStereoWidth]=useState(100);
  const [analyzing,setAnalyzing]=useState(false);
  const [suggestions,setSuggestions]=useState([]);

  useEffect(()=>{
    let raf;
    const animate=()=>{
      if(analyserRef.current&&isPlaying){
        const data=new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(data);
        let sum=0;for(let i=0;i<data.length;i++){const v=(data[i]-128)/128;sum+=v*v;}
        const rms=Math.sqrt(sum/data.length);
        setLevels({L:rms*1.2,R:rms,M:rms*1.1});
      }else{setLevels({L:0,R:0,M:0});}
      raf=requestAnimationFrame(animate);
    };
    raf=requestAnimationFrame(animate);return()=>cancelAnimationFrame(raf);
  },[isPlaying]);

  const handleFile=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    setFileName(file.name);
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    audioCtxRef.current=ctx;
    const buf=await file.arrayBuffer();
    const decoded=await ctx.decodeAudioData(buf);
    setAudioBuffer(decoded);
  };

  const buildChain=useCallback(()=>{
    const ctx=audioCtxRef.current;if(!ctx||!audioBuffer)return;
    if(sourceRef.current){try{sourceRef.current.stop();}catch{}}
    const src=ctx.createBufferSource();src.buffer=audioBuffer;sourceRef.current=src;
    let node=src;
    eq.forEach(band=>{
      const f=ctx.createBiquadFilter();
      f.type=band.label==="Sub"||band.label==="Bass"?"lowshelf":band.label==="Air"?"highshelf":"peaking";
      f.frequency.value=band.freq;f.gain.value=eqActive?band.gain:0;f.Q.value=1.4;
      node.connect(f);node=f;
    });
    const compNode=ctx.createDynamicsCompressor();
    compNode.threshold.value=compActive?comp.threshold:0;compNode.ratio.value=compActive?comp.ratio:1;
    compNode.attack.value=comp.attack/1000;compNode.release.value=comp.release/1000;compNode.knee.value=6;
    node.connect(compNode);node=compNode;
    const makeupGainNode=ctx.createGain();makeupGainNode.gain.value=dbToLinear(compActive?comp.makeup:0);
    node.connect(makeupGainNode);node=makeupGainNode;
    const limNode=ctx.createDynamicsCompressor();
    limNode.threshold.value=limiterActive?limiter.ceiling:0;limNode.ratio.value=20;
    limNode.attack.value=0.001;limNode.release.value=limiter.release/1000;limNode.knee.value=0;
    node.connect(limNode);node=limNode;
    const mgNode=ctx.createGain();mgNode.gain.value=dbToLinear(masterGain);
    node.connect(mgNode);node=mgNode;
    const analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=0.8;
    analyserRef.current=analyser;node.connect(analyser);analyser.connect(ctx.destination);
    src.start(0);setIsPlaying(true);src.onended=()=>setIsPlaying(false);
  },[audioBuffer,eq,eqActive,comp,compActive,limiter,limiterActive,masterGain]);

  const handlePlay=()=>{
    if(!audioBuffer)return;
    if(audioCtxRef.current?.state==="suspended")audioCtxRef.current.resume();
    buildChain();
  };
  const handleStop=()=>{try{sourceRef.current?.stop();}catch{}setIsPlaying(false);};

  const handleAutoMaster=()=>{
    setEq([
      {label:"Sub",freq:60,gain:-2},{label:"Bass",freq:120,gain:1.5},
      {label:"Low-Mid",freq:400,gain:-1},{label:"Mid",freq:1000,gain:0.5},
      {label:"Hi-Mid",freq:3000,gain:1},{label:"Air",freq:10000,gain:2},
    ]);
    setComp({threshold:-18,ratio:3,attack:15,release:80,makeup:2});setCompActive(true);
    setLimiter({ceiling:-0.3,release:50});setLimiterActive(true);
    setMasterGain(2);setStereoWidth(110);
    setSuggestions(["▸ Auto-master preset applied — adjust to taste.","▸ EQ: -2dB sub cut, +2dB air shelf applied.","▸ Compressor: 3:1 ratio at -18dB threshold.","▸ True peak limiter: ceiling at -0.3dBTP."]);
  };

  const handleAIAnalyze=async()=>{
    setAnalyzing(true);setSuggestions([]);
    try{
      const response=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:1000,
          messages:[{role:"user",content:`You are an expert mixing and mastering engineer AI. Analyze these current plugin settings and provide 5 concise, specific, actionable suggestions. Format each as a single line starting with ▸. Current settings:
- File: ${fileName||"No file loaded"}
- EQ (${eqActive?"ON":"OFF"}): ${eq.map(b=>`${b.label}:${b.gain>0?"+":""}${b.gain}dB`).join(", ")}
- Compressor (${compActive?"ON":"OFF"}): Threshold:${comp.threshold}dB, Ratio:${comp.ratio}:1, Attack:${comp.attack}ms
- Reverb (${reverbActive?"ON":"OFF"}): Mix:${reverb.mix}%, Size:${reverb.size}%
- De-Esser (${deEsserActive?"ON":"OFF"}): Freq:${deEsser.freq}Hz, Threshold:${deEsser.threshold}dB
- Gate (${gateActive?"ON":"OFF"}): Threshold:${gate.threshold}dB
- Limiter (${limiterActive?"ON":"OFF"}): Ceiling:${limiter.ceiling}dBTP
- Saturation (${satActive?"ON":"OFF"}): Drive:${saturation.drive}%, Type:${saturation.type}
- Stereo Width: ${stereoWidth}%
- Master Gain: ${masterGain}dB`}]
        })
      });
      const data=await response.json();
      const text=data.content?.map(c=>c.text||"").join("")||"";
      const lines=text.split("\n").filter(l=>l.trim().startsWith("▸")).map(l=>l.trim());
      setSuggestions(lines.length?lines:["▸ "+text.slice(0,200)]);
    }catch{
      setSuggestions(["▸ High-pass filter below 80Hz to remove rumble.","▸ Start with 4:1 compression, -18dB threshold.","▸ Add 20-30% reverb mix with 15-20ms pre-delay.","▸ De-esser on vocals around 7-8kHz if sibilant.","▸ Limit ceiling at -0.3dBTP for streaming."]);
    }
    setAnalyzing(false);
  };

  const gridOptions=["1/4","1/8","1/16","1/32"];
  const AC=accentColor||"#00e5ff";

  return(
    <div style={{background:NX.bg,minHeight:"100%",padding:"12px",fontFamily:"'Rajdhani',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,borderBottom:`1px solid ${NX.border}`,paddingBottom:10}}>
        <div>
          <div style={{fontFamily:"monospace",fontSize:18,color:NX.accent,letterSpacing:4,textShadow:`0 0 16px ${NX.accent}`}}>◈ NEXUS MIX</div>
          <div style={{fontSize:10,color:NX.muted,letterSpacing:3}}>AI MIX & MASTER STUDIO</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <label style={{background:NX.accentDim,border:`1px solid ${NX.accent}`,color:NX.accent,padding:"5px 10px",borderRadius:4,cursor:"pointer",fontFamily:"monospace",fontSize:10,letterSpacing:1}}>
            ↑ LOAD<input type="file" accept="audio/*" onChange={handleFile} style={{display:"none"}}/>
          </label>
          {fileName&&<span style={{fontSize:9,color:NX.muted,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fileName}</span>}
          <button onClick={handlePlay} disabled={!audioBuffer} style={{background:isPlaying?NX.green+"22":NX.accentDim,border:`1px solid ${isPlaying?NX.green:NX.accent}`,color:isPlaying?NX.green:NX.accent,padding:"5px 14px",borderRadius:4,fontFamily:"monospace",fontSize:12,cursor:audioBuffer?"pointer":"not-allowed",boxShadow:isPlaying?`0 0 10px ${NX.green}44`:"none"}}>▶ PLAY</button>
          <button onClick={handleStop} style={{background:"transparent",border:`1px solid ${NX.border}`,color:NX.muted,padding:"5px 10px",borderRadius:4,fontFamily:"monospace",fontSize:12,cursor:"pointer"}}>■ STOP</button>
          <button onClick={handleAutoMaster} style={{background:`linear-gradient(135deg,${NX.purple}33,${NX.accent}22)`,border:`1px solid ${NX.purple}`,color:NX.purple,padding:"5px 10px",borderRadius:4,fontFamily:"monospace",fontSize:10,cursor:"pointer",boxShadow:`0 0 8px ${NX.purple}44`}}>⚡ AUTO-MASTER</button>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <NxVU level={levels.L} label="L"/>
          <NxVU level={levels.M} label="M"/>
          <NxVU level={levels.R} label="R"/>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
        <WaveformDisplay analyser={analyserRef.current} isPlaying={isPlaying}/>
        <SpectrumAnalyzer analyser={analyserRef.current} isPlaying={isPlaying}/>
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <NxCard title="PARAMETRIC EQ" active={eqActive} onToggle={()=>setEqActive(v=>!v)} color={NX.accent} width={340}>
          <EQVisualizer bands={eq}/>
          <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"space-between"}}>
            {eq.map((band,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <NxKnob label={band.label} value={band.gain} min={-18} max={18} unit="dB"
                  color={band.gain>0?NX.green:band.gain<0?NX.red:NX.accent}
                  onChange={v=>setEq(eq.map((b,j)=>j===i?{...b,gain:v}:b))} size={42}/>
                <span style={{fontSize:8,color:NX.muted}}>{band.freq>=1000?`${(band.freq/1000).toFixed(1)}k`:band.freq}Hz</span>
              </div>
            ))}
          </div>
        </NxCard>
        <NxCard title="COMPRESSOR" active={compActive} onToggle={()=>setCompActive(v=>!v)} color={NX.amber} width={245}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center"}}>
            <NxKnob label="Threshold" value={comp.threshold} min={-60} max={0} unit="dB" color={NX.amber} onChange={v=>setComp(c=>({...c,threshold:v}))}/>
            <NxKnob label="Ratio" value={comp.ratio} min={1} max={20} color={NX.amber} onChange={v=>setComp(c=>({...c,ratio:v}))}/>
            <NxKnob label="Attack" value={comp.attack} min={0.1} max={200} unit="ms" color={NX.amber} onChange={v=>setComp(c=>({...c,attack:v}))}/>
            <NxKnob label="Release" value={comp.release} min={10} max={2000} unit="ms" color={NX.amber} onChange={v=>setComp(c=>({...c,release:v}))}/>
            <NxKnob label="Makeup" value={comp.makeup} min={0} max={24} unit="dB" color={NX.green} onChange={v=>setComp(c=>({...c,makeup:v}))}/>
          </div>
          <div style={{marginTop:8,padding:"5px 8px",background:NX.border+"44",borderRadius:4}}>
            <div style={{fontSize:9,color:NX.muted}}>GR: <span style={{color:NX.amber}}>{compActive?Math.min(0,(comp.threshold+20)/comp.ratio).toFixed(1):"0.0"} dB</span></div>
          </div>
        </NxCard>
        <NxCard title="REVERB" active={reverbActive} onToggle={()=>setReverbActive(v=>!v)} color={NX.purple} width={200}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center"}}>
            <NxKnob label="Mix" value={reverb.mix} min={0} max={100} unit="%" color={NX.purple} onChange={v=>setReverb(r=>({...r,mix:v}))}/>
            <NxKnob label="Size" value={reverb.size} min={0} max={100} unit="%" color={NX.purple} onChange={v=>setReverb(r=>({...r,size:v}))}/>
            <NxKnob label="Damp" value={reverb.damping} min={0} max={100} unit="%" color={NX.purple} onChange={v=>setReverb(r=>({...r,damping:v}))}/>
            <NxKnob label="Pre-DLY" value={reverb.predelay} min={0} max={200} unit="ms" color={NX.purple} onChange={v=>setReverb(r=>({...r,predelay:v}))}/>
          </div>
        </NxCard>
        <NxCard title="DE-ESSER" active={deEsserActive} onToggle={()=>setDeEsserActive(v=>!v)} color={NX.green} width={180}>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <NxKnob label="Freq" value={deEsser.freq} min={2000} max={16000} unit="Hz" color={NX.green} onChange={v=>setDeEsser(d=>({...d,freq:v}))}/>
            <NxKnob label="Thresh" value={deEsser.threshold} min={-40} max={0} unit="dB" color={NX.green} onChange={v=>setDeEsser(d=>({...d,threshold:v}))}/>
            <NxKnob label="Ratio" value={deEsser.ratio} min={1} max={20} color={NX.green} onChange={v=>setDeEsser(d=>({...d,ratio:v}))}/>
          </div>
        </NxCard>
        <NxCard title="NOISE GATE" active={gateActive} onToggle={()=>setGateActive(v=>!v)} color={NX.red} width={220}>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <NxKnob label="Threshold" value={gate.threshold} min={-80} max={0} unit="dB" color={NX.red} onChange={v=>setGate(g=>({...g,threshold:v}))}/>
            <NxKnob label="Attack" value={gate.attack} min={0.1} max={100} unit="ms" color={NX.red} onChange={v=>setGate(g=>({...g,attack:v}))}/>
            <NxKnob label="Hold" value={gate.hold} min={0} max={500} unit="ms" color={NX.red} onChange={v=>setGate(g=>({...g,hold:v}))}/>
            <NxKnob label="Release" value={gate.release} min={10} max={2000} unit="ms" color={NX.red} onChange={v=>setGate(g=>({...g,release:v}))}/>
          </div>
        </NxCard>
        <NxCard title="PITCH CORRECT" active={pitchActive} onToggle={()=>setPitchActive(v=>!v)} color="#ff9f43" width={195}>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <NxKnob label="Shift" value={pitch.shift} min={-12} max={12} unit="st" color="#ff9f43" onChange={v=>setPitch(p=>({...p,shift:v}))}/>
            <NxKnob label="Formant" value={pitch.formant} min={-6} max={6} unit="st" color="#ff9f43" onChange={v=>setPitch(p=>({...p,formant:v}))}/>
            <NxKnob label="Correct" value={pitch.correction} min={0} max={100} unit="%" color="#ff9f43" onChange={v=>setPitch(p=>({...p,correction:v}))}/>
          </div>
        </NxCard>
        <NxCard title="QUANTIZE" active={quantizeActive} onToggle={()=>setQuantizeActive(v=>!v)} color="#54a0ff" width={200}>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <NxKnob label="Strength" value={quantize.strength} min={0} max={100} unit="%" color="#54a0ff" onChange={v=>setQuantize(q=>({...q,strength:v}))}/>
            <NxKnob label="Swing" value={quantize.swing} min={0} max={100} unit="%" color="#54a0ff" onChange={v=>setQuantize(q=>({...q,swing:v}))}/>
          </div>
          <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
            {gridOptions.map(g=><button key={g} onClick={()=>setQuantize(q=>({...q,grid:g}))} style={{background:quantize.grid===g?"#54a0ff22":"transparent",border:`1px solid ${quantize.grid===g?"#54a0ff":NX.border}`,color:quantize.grid===g?"#54a0ff":NX.muted,padding:"2px 7px",borderRadius:3,fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>{g}</button>)}
          </div>
        </NxCard>
        <NxCard title="SATURATION" active={satActive} onToggle={()=>setSatActive(v=>!v)} color="#f0932b" width={185}>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <NxKnob label="Drive" value={saturation.drive} min={0} max={100} unit="%" color="#f0932b" onChange={v=>setSaturation(s=>({...s,drive:v}))}/>
            <NxKnob label="Mix" value={saturation.mix} min={0} max={100} unit="%" color="#f0932b" onChange={v=>setSaturation(s=>({...s,mix:v}))}/>
          </div>
          <div style={{display:"flex",gap:4,marginTop:8}}>
            {["tape","tube","clip"].map(t=><button key={t} onClick={()=>setSaturation(s=>({...s,type:t}))} style={{flex:1,background:saturation.type===t?"#f0932b22":"transparent",border:`1px solid ${saturation.type===t?"#f0932b":NX.border}`,color:saturation.type===t?"#f0932b":NX.muted,padding:"3px 4px",borderRadius:3,fontSize:9,cursor:"pointer",textTransform:"uppercase"}}>{t}</button>)}
          </div>
        </NxCard>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <NxCard title="LIMITER" active={limiterActive} onToggle={()=>setLimiterActive(v=>!v)} color={NX.red} width={175}>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <NxKnob label="Ceiling" value={limiter.ceiling} min={-6} max={0} unit="dBTP" color={NX.red} onChange={v=>setLimiter(l=>({...l,ceiling:v}))}/>
              <NxKnob label="Release" value={limiter.release} min={1} max={500} unit="ms" color={NX.red} onChange={v=>setLimiter(l=>({...l,release:v}))}/>
            </div>
          </NxCard>
          <NxCard title="STEREO WIDTH" active={true} color={NX.purple} width={175}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <NxKnob label="Width" value={stereoWidth} min={0} max={200} unit="%" color={NX.purple} onChange={setStereoWidth} size={52}/>
              <div style={{fontSize:9,color:NX.muted}}>{stereoWidth<80?"◄ NARROW":stereoWidth>120?"WIDE ►":"● BALANCED"}</div>
            </div>
          </NxCard>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <NxCard title="MASTER OUT" active={true} color={NX.green} width={150}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <NxKnob label="Output" value={masterGain} min={-24} max={12} unit="dB" color={NX.green} onChange={setMasterGain} size={58}/>
              <div style={{fontSize:9,color:NX.muted}}>LUFS: <span style={{color:NX.green}}>{isPlaying?`${(-14+masterGain).toFixed(1)}`:"---"}</span></div>
              <div style={{fontSize:9,color:NX.muted}}>Peak: <span style={{color:levels.M>0.9?NX.red:NX.green}}>{isPlaying?`${(20*Math.log10(levels.M+0.001)).toFixed(1)} dB`:"---"}</span></div>
            </div>
          </NxCard>
          <NxCard title="AI ENGINEER" active={true} color={NX.purple} width={150}>
            <button onClick={handleAIAnalyze} disabled={analyzing} style={{
              width:"100%",background:analyzing?NX.accentDim:`linear-gradient(135deg,${NX.accent}22,${NX.purple}22)`,
              border:`1px solid ${analyzing?NX.accent:NX.purple}`,color:analyzing?NX.accent:NX.purple,
              padding:"8px 6px",borderRadius:4,fontFamily:"monospace",fontSize:10,cursor:analyzing?"wait":"pointer",
              letterSpacing:1,animation:analyzing?"pulse 1s infinite":"none",boxShadow:`0 0 10px ${NX.purple}33`
            }}>{analyzing?"◈ ANALYZING...":"◈ AI ANALYZE"}</button>
          </NxCard>
        </div>
      </div>
      {suggestions.length>0&&(
        <div style={{marginTop:12,padding:"10px 14px",background:NX.panel,border:`1px solid ${NX.purple}44`,borderRadius:6}}>
          <div style={{fontSize:10,color:NX.purple,fontFamily:"monospace",letterSpacing:2,marginBottom:8}}>◈ AI RECOMMENDATIONS</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {suggestions.map((s,i)=>(
              <div key={i} style={{background:NX.accentDim,border:`1px solid ${NX.accent}33`,borderRadius:4,padding:"5px 10px",fontSize:11,color:NX.accent,fontFamily:"monospace",lineHeight:1.6,maxWidth:320}}>{s}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{marginTop:10,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",padding:"5px 0",borderTop:`1px solid ${NX.border}`}}>
        <span style={{fontSize:9,color:NX.muted,fontFamily:"monospace"}}>STATUS: <span style={{color:isPlaying?NX.green:NX.muted}}>{isPlaying?"● PLAYING":"○ STOPPED"}</span></span>
        <span style={{fontSize:9,color:NX.muted,fontFamily:"monospace"}}>EQ:{eqActive?"ON":"OFF"} · COMP:{compActive?"ON":"OFF"} · LIM:{limiterActive?"ON":"OFF"} · VERB:{reverbActive?"ON":"OFF"} · GATE:{gateActive?"ON":"OFF"}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [progress,setProgress]=useState(0);
  const [phase,setPhase]=useState("loading");
  const [menuOpen,setMenuOpen]=useState(false);
  const [screen,setScreen]=useState("studio");
  const [activeTab,setActiveTab]=useState(0);
  const [notesOpen,setNotesOpen]=useState(false);
  const [darkMode,setDarkMode]=useState(()=>load(STORAGE_THEME,true));
  const [accentColor,setAccentColor]=useState(()=>load(STORAGE_ACCENT,"#39ff14"));
  const [projects,setProjects]=useState(()=>load(STORAGE_KEY,[makeProject(0,"My First Song","#39ff14")]));
  const [activeProject,setActiveProject]=useState(()=>load(STORAGE_AP,0));
  const [newProjectName,setNewProjectName]=useState("");
  const [editingProjectName,setEditingProjectName]=useState(false);
  const [projectNameValue,setProjectNameValue]=useState("");
  const [editingSongName,setEditingSongName]=useState(false);
  const [songNameValue,setSongNameValue]=useState("");
  const [editingProjectSong,setEditingProjectSong]=useState(false);
  const [projectSongValue,setProjectSongValue]=useState("");
  const [draggedIndex,setDraggedIndex]=useState(null);
  const [draggedSetlist,setDraggedSetlist]=useState(null);
  const [editingIndex,setEditingIndex]=useState(null);
  const [editingValue,setEditingValue]=useState("");
  const [newSection,setNewSection]=useState("");
  const [newInstrument,setNewInstrument]=useState("");
  const [colorPickerOpen,setColorPickerOpen]=useState(false);
  const [customColor,setCustomColor]=useState("#39ff14");
  const [instrPanelOpen,setInstrPanelOpen]=useState(false);
  const [shareCopied,setShareCopied]=useState(false);
  const [sectionNoteOpen,setSectionNoteOpen]=useState(null);
  const [audioNoteOpen,setAudioNoteOpen]=useState(null);
  const [recording,setRecording]=useState(false);
  const [recordingTime,setRecordingTime]=useState(0);
  const [audioURLs,setAudioURLs]=useState({});
  const [playingId,setPlayingId]=useState(null);
  const [isDragging,setIsDragging]=useState(false);
  const [longPressTimer,setLongPressTimer]=useState(null);
  const [expandedTrack,setExpandedTrack]=useState(null);
  const [editingTrackName,setEditingTrackName]=useState(null);
  const [trackNameValue,setTrackNameValue]=useState("");
  const [trackColorPicker,setTrackColorPicker]=useState(null);
  const [studioRecordingTrack,setStudioRecordingTrack]=useState(null);
  const [studioRecordingTime,setStudioRecordingTime]=useState(0);
  const [studioPlaying,setStudioPlaying]=useState(false);
  const [studioAudioURLs,setStudioAudioURLs]=useState({});
  const [playingTrackId,setPlayingTrackId]=useState(null);
  const [countingIn,setCountingIn]=useState(null);
  const [countBeat,setCountBeat]=useState(0);
  const [confirmDelete,setConfirmDelete]=useState(null);

  const mediaRecorderRef=useRef(null);
  const audioChunksRef=useRef([]);
  const recordingTimerRef=useRef(null);
  const audioRef=useRef(null);
  const fileInputRef=useRef(null);
  const studioMediaRef=useRef(null);
  const studioChunksRef=useRef([]);
  const studioTimerRef=useRef(null);
  const studioAudioNodes=useRef([]);
  const studioFileInputRef=useRef(null);
  const studioFileTrackId=useRef(null);
  const trackAudioRefs=useRef({});
  const countIntervalRef=useRef(null);
  const audioCtxRef=useRef(null);
  const playbackAudioNodes=useRef([]);

  useEffect(()=>{save(STORAGE_KEY,projects);},[projects]);
  useEffect(()=>{save(STORAGE_AP,activeProject);},[activeProject]);
  useEffect(()=>{save(STORAGE_THEME,darkMode);},[darkMode]);
  useEffect(()=>{save(STORAGE_ACCENT,accentColor);},[accentColor]);

  useEffect(()=>{
    if(phase!=="loading")return;
    const iv=setInterval(()=>{
      setProgress(p=>{
        if(p>=100){clearInterval(iv);setTimeout(()=>setPhase("fading"),300);return 100;}
        return p+1.2;
      });
    },30);
    return()=>clearInterval(iv);
  },[phase]);

  useEffect(()=>{
    if(phase==="fading"){const t=setTimeout(()=>setPhase("app"),1200);return()=>clearTimeout(t);}
  },[phase]);

  const project=projects.find(p=>p.id===activeProject)||projects[0];
  const song=project?.songs?.[activeTab]||project?.songs?.[0];
  const instruments=project?.instruments||DEFAULT_INSTRUMENTS;
  const isMerge=activeTab===4;
  const isSetlist=screen==="setlist";
  const isStudio=screen==="studio";
  const isMixer=screen==="mixer";
  const projectColor=project?.color||accentColor;
  const C=song?.color?.hex||projectColor;
  const tracks=project?.studio?.tracks||makeDefaultTracks();
  const AC=accentColor;

  const getCurrentBPM=()=>{const p=parseInt(song?.bpm);return isNaN(p)||p<=0?100:p;};
  const getSongColor=(hex)=>hex==="#39ff14"?AC:hex;

  const T=darkMode?{
    bg:"#000",card:"linear-gradient(145deg,#0a0f0a,#111811)",
    cardBg:"#080d08",text:"#ccc",subtext:"#555",
    inputBg:"#050a05",inputBorder:"rgba(255,255,255,0.1)",
    rowHover:"rgba(255,255,255,0.02)",stickyBg:"#080d08",
    headBg:"#111811",border:"rgba(255,255,255,0.08)",checkBg:"#000",
  }:{
    bg:"#f2f4f8",card:"linear-gradient(145deg,#ffffff,#f5f7fc)",
    cardBg:"#ffffff",text:"#0a1628",subtext:"#4a5568",
    inputBg:"#ffffff",inputBorder:"rgba(10,22,40,0.2)",
    rowHover:"rgba(10,22,40,0.03)",stickyBg:"#ffffff",
    headBg:"#eef1f8",border:"rgba(10,22,40,0.1)",checkBg:"#fff",
  };

  const inp=(extra={})=>({
    background:T.inputBg,border:`1px solid ${T.inputBorder}`,
    color:T.text,borderRadius:8,padding:"8px 12px",
    width:"100%",outline:"none",fontSize:13,...extra,
  });

  const updateProject=(id,fn)=>setProjects(prev=>prev.map(p=>p.id===id?{...p,...fn(p)}:p));
  const updateSong=(songId,fn)=>updateProject(project.id,p=>({songs:p.songs.map(s=>s.id===songId?{...s,...fn(s)}:s)}));
  const updateTrack=(trackId,fn)=>updateProject(project.id,p=>({
    studio:{...p.studio,tracks:(p.studio?.tracks||makeDefaultTracks()).map(t=>t.id===trackId?{...t,...fn(t)}:t)}
  }));

  const deleteTrack=(trackId)=>{
    stopTrack(trackId);
    updateProject(project.id,p=>{
      const remaining=(p.studio?.tracks||makeDefaultTracks()).filter(t=>t.id!==trackId);
      return{studio:{...p.studio,tracks:remaining}};
    });
    setConfirmDelete(null);
    if(expandedTrack===trackId)setExpandedTrack(null);
  };

  const addTrack=()=>{
    const newId=Date.now();
    const colorIndex=tracks.length%PROJECT_COLORS.length;
    const newTrack={id:newId,name:`Track ${tracks.length+1}`,color:PROJECT_COLORS[colorIndex],recordings:[],volume:0.8,muted:false,solo:false,reverb:0,lows:0,mids:0,highs:0,notes:""};
    updateProject(project.id,p=>({studio:{...p.studio,tracks:[...(p.studio?.tracks||makeDefaultTracks()),newTrack]}}));
  };

  const ckKey=(sn,ci)=>`${sn}--${ci}`;
  const toggleChecked=(sn,ci,songId)=>{
    const ri=song.sections.indexOf(sn);
    if(song.locked?.[ri])return;
    const k=ckKey(sn,ci);
    updateProject(project.id,p=>{
      const cur=Array.isArray(p.checks?.[k])?p.checks[k]:[];
      return{checks:{...p.checks,[k]:cur.includes(songId)?cur.filter(id=>id!==songId):[...cur,songId]}};
    });
  };
  const getColors=(sn,ci)=>{
    const k=ckKey(sn,ci);
    return(Array.isArray(project.checks?.[k])?project.checks[k]:[]).map(id=>project.songs.find(s=>s.id===id)?.color).filter(Boolean);
  };
  const isMine=(sn,ci,songId)=>{
    const k=ckKey(sn,ci);
    return Array.isArray(project.checks?.[k])&&project.checks[k].includes(songId);
  };

  const addInstrument=()=>{
    if(!newInstrument.trim()||instruments.includes(newInstrument.trim()))return;
    updateProject(project.id,p=>({instruments:[...(p.instruments||DEFAULT_INSTRUMENTS),newInstrument.trim()]}));
    setNewInstrument("");
  };
  const removeInstrument=inst=>updateProject(project.id,p=>({instruments:(p.instruments||DEFAULT_INSTRUMENTS).filter(i=>i!==inst)}));
  const toggleLocked=ri=>updateSong(song.id,s=>({locked:{...s.locked,[ri]:!s.locked?.[ri]}}));
  const toggleStarred=ri=>updateSong(song.id,s=>({starred:{...s.starred,[ri]:!s.starred?.[ri]}}));
  const cycleStatus=ri=>{
    if(song.locked?.[ri])return;
    updateSong(song.id,s=>{
      const cur=s.status?.[ri]||"Draft";
      return{status:{...s.status,[ri]:STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(cur)+1)%STATUS_OPTIONS.length]}};
    });
  };

  const handleLinesTouchStart=(ri,section)=>{
    setIsDragging(false);
    const timer=setTimeout(()=>{setIsDragging(true);setDraggedIndex(ri);},400);
    setLongPressTimer(timer);
  };
  const handleLinesTouchEnd=(ri,section)=>{
    clearTimeout(longPressTimer);
    if(!isDragging)setSectionNoteOpen(section);
    setIsDragging(false);
  };
  const handleDrop=ti=>{
    if(draggedIndex===null||song.locked?.[draggedIndex])return;
    const upd=[...song.sections];const[it]=upd.splice(draggedIndex,1);upd.splice(ti,0,it);
    updateSong(song.id,()=>({sections:upd}));setDraggedIndex(null);
  };
  const addSection=()=>{if(!newSection.trim())return;updateSong(song.id,s=>({sections:[...s.sections,newSection.trim()]}));setNewSection("");};
  const removeSection=i=>{if(song.locked?.[i])return;updateSong(song.id,s=>({sections:s.sections.filter((_,idx)=>idx!==i)}));};
  const startEdit=i=>{if(song.locked?.[i])return;setEditingIndex(i);setEditingValue(song.sections[i]);};
  const saveEdit=()=>{
    if(!editingValue.trim())return;
    updateSong(song.id,s=>{const u=[...s.sections];u[editingIndex]=editingValue.trim();return{sections:u};});
    setEditingIndex(null);
  };

  const addProject=()=>{
    if(!newProjectName.trim())return;
    const id=Date.now();
    setProjects(prev=>[...prev,makeProject(id,newProjectName.trim(),AC)]);
    setActiveProject(id);setNewProjectName("");setMenuOpen(false);setActiveTab(0);
  };
  const deleteProject=id=>{
    if(projects.length===1)return;
    setProjects(prev=>prev.filter(p=>p.id!==id));
    if(activeProject===id)setActiveProject(projects[0].id);
  };
  const switchProject=id=>{setActiveProject(id);setMenuOpen(false);setActiveTab(0);setScreen("studio");};
  const saveProjectName=()=>{if(!projectNameValue.trim())return;updateProject(project.id,()=>({name:projectNameValue.trim()}));setEditingProjectName(false);};
  const saveProjectSongName=()=>{if(!projectSongValue.trim())return;updateProject(project.id,()=>({songName:projectSongValue.trim()}));setEditingProjectSong(false);};
  const saveSongName=()=>{if(!songNameValue.trim())return;updateSong(song.id,()=>({name:songNameValue.trim()}));setEditingSongName(false);};

  const shareApp=()=>{
    const url=window.location.origin;
    const text="🎸 Dog Bones — Song Section Organizer. Open in Chrome then Add to Home Screen!";
    if(navigator.share){navigator.share({title:"Dog Bones",text,url});}
    else{navigator.clipboard.writeText(`${text}\n${url}`).then(()=>{setShareCopied(true);setTimeout(()=>setShareCopied(false),2500);});}
  };

  const getSectionNote=sn=>song?.sectionNotes?.[sn]||"";
  const setSectionNote=(sn,val)=>updateSong(song.id,s=>({sectionNotes:{...s.sectionNotes,[sn]:val}}));
  const getAudioNotes=sn=>song?.audioNotes?.[sn]||[];

  const startRecording=async sn=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      audioChunksRef.current=[];
      mr.ondataavailable=e=>audioChunksRef.current.push(e.data);
      mr.onstop=()=>{
        const blob=new Blob(audioChunksRef.current,{type:"audio/webm"});
        const url=URL.createObjectURL(blob);
        const id=Date.now().toString();const dur=recordingTime;
        setAudioURLs(prev=>({...prev,[id]:url}));
        const a=document.createElement("a");a.href=url;a.download=`DogBones_${sn}_${id}.webm`;a.click();
        updateSong(song.id,s=>({audioNotes:{...s.audioNotes,[sn]:[...(s.audioNotes?.[sn]||[]),{id,duration:dur,label:`Voice memo ${(s.audioNotes?.[sn]||[]).length+1}`}]}}));
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start();mediaRecorderRef.current=mr;
      setRecording(true);setRecordingTime(0);
      recordingTimerRef.current=setInterval(()=>setRecordingTime(t=>t+1),1000);
    }catch(e){alert("Microphone access denied.");}
  };
  const stopRecording=()=>{mediaRecorderRef.current?.stop();clearInterval(recordingTimerRef.current);setRecording(false);};
  const handleFileUpload=(sn,e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const url=URL.createObjectURL(file);const id=Date.now().toString();
    setAudioURLs(prev=>({...prev,[id]:url}));
    updateSong(song.id,s=>({audioNotes:{...s.audioNotes,[sn]:[...(s.audioNotes?.[sn]||[]),{id,duration:0,label:file.name.replace(/\.[^/.]+$/,"")}]}}));
    e.target.value="";
  };
  const deleteAudioNote=(sn,id)=>{
    updateSong(song.id,s=>({audioNotes:{...s.audioNotes,[sn]:(s.audioNotes?.[sn]||[]).filter(a=>a.id!==id)}}));
    setAudioURLs(prev=>{const n={...prev};delete n[id];return n;});
    if(playingId===id){audioRef.current?.pause();setPlayingId(null);}
  };
  const playAudio=id=>{
    const url=audioURLs[id];
    if(audioRef.current){audioRef.current.pause();audioRef.current=null;}
    if(playingId===id){setPlayingId(null);return;}
    if(!url){alert("Re-record or re-upload after refresh.");return;}
    const a=new Audio(url);a.play();a.onended=()=>setPlayingId(null);
    audioRef.current=a;setPlayingId(id);
  };

  const playClick=(ac,time,isAccent)=>{
    const osc=ac.createOscillator();const gain=ac.createGain();
    osc.connect(gain);gain.connect(ac.destination);
    osc.frequency.value=isAccent?1200:800;
    gain.gain.setValueAtTime(0.8,time);gain.gain.exponentialRampToValueAtTime(0.001,time+0.05);
    osc.start(time);osc.stop(time+0.06);
  };

  const startCountIn=trackId=>{
    if(countingIn!==null)return;
    const bpm=getCurrentBPM();const beatInterval=60/bpm;
    const ac=new(window.AudioContext||window.webkitAudioContext)();
    audioCtxRef.current=ac;
    let beat=0;setCountingIn(trackId);setCountBeat(0);
    for(let i=0;i<8;i++)playClick(ac,ac.currentTime+(i*beatInterval),i===0||i===4);
    countIntervalRef.current=setInterval(()=>{
      beat++;setCountBeat(beat);
      if(beat>=8){clearInterval(countIntervalRef.current);setCountingIn(null);setCountBeat(0);setTimeout(()=>{startPlaybackDuringRecording(trackId);startStudioRecording(trackId);},50);}
    },beatInterval*1000);
  };
  const cancelCountIn=()=>{clearInterval(countIntervalRef.current);audioCtxRef.current?.close();setCountingIn(null);setCountBeat(0);};

  const buildAudioGraph=async(ac,track,url)=>{
    const response=await fetch(url);
    const arrayBuffer=await response.arrayBuffer();
    const audioBuffer=await ac.decodeAudioData(arrayBuffer);
    const source=ac.createBufferSource();source.buffer=audioBuffer;
    const eqOut=applyEQ(ac,source,track);
    const gainNode=ac.createGain();gainNode.gain.value=track.volume;
    if(track.reverb>0){
      const convolver=await createReverbNode(ac,track.reverb);
      const dryGain=ac.createGain();const wetGain=ac.createGain();
      dryGain.gain.value=1-track.reverb*0.6;wetGain.gain.value=track.reverb*0.8;
      eqOut.connect(dryGain);eqOut.connect(convolver);convolver.connect(wetGain);
      dryGain.connect(gainNode);wetGain.connect(gainNode);
    }else{eqOut.connect(gainNode);}
    gainNode.connect(ac.destination);
    return{source,ac};
  };

  const startPlaybackDuringRecording=async recordingTrackId=>{
    playbackAudioNodes.current.forEach(a=>{try{a.pause?.();a.stop?.();}catch{}});
    playbackAudioNodes.current=[];
    const ac=new(window.AudioContext||window.webkitAudioContext)();
    const hasSolo=tracks.some(t=>t.solo&&t.id!==recordingTrackId);
    for(const track of tracks){
      if(track.id===recordingTrackId||track.muted||(hasSolo&&!track.solo))continue;
      const latestRec=track.recordings[track.recordings.length-1];if(!latestRec)continue;
      const url=studioAudioURLs[latestRec.id];if(!url)continue;
      try{const{source}=await buildAudioGraph(ac,track,url);source.start(0);playbackAudioNodes.current.push({stop:()=>source.stop()});}
      catch(e){const a=new Audio(url);a.volume=track.volume;a.play().catch(()=>{});playbackAudioNodes.current.push(a);}
    }
  };
  const stopPlaybackDuringRecording=()=>{playbackAudioNodes.current.forEach(a=>{try{a.stop?.();a.pause?.();}catch{}});playbackAudioNodes.current=[];};

  const startStudioRecording=async trackId=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      studioChunksRef.current=[];
      mr.ondataavailable=e=>studioChunksRef.current.push(e.data);
      mr.onstop=()=>{
        stopPlaybackDuringRecording();
        const blob=new Blob(studioChunksRef.current,{type:"audio/webm"});
        const url=URL.createObjectURL(blob);
        const id=Date.now().toString();const dur=studioRecordingTime;
        const track=tracks.find(t=>t.id===trackId);
        setStudioAudioURLs(prev=>({...prev,[id]:url}));
        const a=document.createElement("a");a.href=url;a.download=`DogBones_${track?.name||"track"}_${id}.webm`;a.click();
        updateTrack(trackId,t=>({recordings:[...t.recordings,{id,duration:dur,label:`Take ${t.recordings.length+1}`}]}));
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start();studioMediaRef.current=mr;
      setStudioRecordingTrack(trackId);setStudioRecordingTime(0);
      studioTimerRef.current=setInterval(()=>setStudioRecordingTime(t=>t+1),1000);
    }catch(e){alert("Microphone access denied.");}
  };
  const stopStudioRecording=()=>{studioMediaRef.current?.stop();clearInterval(studioTimerRef.current);setStudioRecordingTrack(null);};

  const playTrackWithFX=async trackId=>{
    const track=tracks.find(t=>t.id===trackId);
    const latestRec=track?.recordings[track.recordings.length-1];
    if(!latestRec){alert("No recording yet.");return;}
    const url=studioAudioURLs[latestRec.id];
    if(!url){alert("Re-upload file to play.");return;}
    if(playingTrackId===trackId){trackAudioRefs.current[trackId]?.stop?.();trackAudioRefs.current[trackId]?.pause?.();delete trackAudioRefs.current[trackId];setPlayingTrackId(null);return;}
    if(playingTrackId!==null){trackAudioRefs.current[playingTrackId]?.stop?.();trackAudioRefs.current[playingTrackId]?.pause?.();delete trackAudioRefs.current[playingTrackId];}
    try{
      const{source,ac}=await buildAudioGraph(new(window.AudioContext||window.webkitAudioContext)(),track,url);
      source.start(0);source.onended=()=>{setPlayingTrackId(null);delete trackAudioRefs.current[trackId];};
      trackAudioRefs.current[trackId]={stop:()=>{source.stop();ac.close();}};setPlayingTrackId(trackId);
    }catch(e){
      const a=new Audio(url);a.volume=track.volume;a.play();
      a.onended=()=>{setPlayingTrackId(null);delete trackAudioRefs.current[trackId];};
      trackAudioRefs.current[trackId]={pause:()=>{a.pause();a.currentTime=0;}};setPlayingTrackId(trackId);
    }
  };
  const stopTrack=trackId=>{
    trackAudioRefs.current[trackId]?.stop?.();trackAudioRefs.current[trackId]?.pause?.();
    delete trackAudioRefs.current[trackId];
    if(playingTrackId===trackId)setPlayingTrackId(null);
  };

  const handleStudioFileUpload=(trackId,e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const url=URL.createObjectURL(file);const id=Date.now().toString();
    setStudioAudioURLs(prev=>({...prev,[id]:url}));
    updateTrack(trackId,t=>({recordings:[...t.recordings,{id,duration:0,label:file.name.replace(/\.[^/.]+$/,"")}]}));
    e.target.value="";
  };
  const deleteStudioRecording=(trackId,recId)=>{
    updateTrack(trackId,t=>({recordings:t.recordings.filter(r=>r.id!==recId)}));
    setStudioAudioURLs(prev=>{const n={...prev};delete n[recId];return n;});
    if(playingTrackId===trackId)stopTrack(trackId);
  };

  const playAllTracks=async()=>{
    studioAudioNodes.current.forEach(a=>{try{a.stop?.();a.pause?.();}catch{}});studioAudioNodes.current=[];
    const hasSolo=tracks.some(t=>t.solo);
    const ac=new(window.AudioContext||window.webkitAudioContext)();
    for(const track of tracks){
      if(track.muted||(hasSolo&&!track.solo))continue;
      const latestRec=track.recordings[track.recordings.length-1];if(!latestRec)continue;
      const url=studioAudioURLs[latestRec.id];if(!url)continue;
      try{const{source}=await buildAudioGraph(ac,track,url);source.start(0);studioAudioNodes.current.push({stop:()=>source.stop()});}
      catch(e){const a=new Audio(url);a.volume=track.volume;a.play().catch(()=>{});studioAudioNodes.current.push(a);}
    }
    setStudioPlaying(true);setTimeout(()=>setStudioPlaying(false),60000);
  };
  const stopAllTracks=()=>{
    studioAudioNodes.current.forEach(a=>{try{a.stop?.();a.pause?.();}catch{}});studioAudioNodes.current=[];
    Object.values(trackAudioRefs.current).forEach(a=>{try{a.stop?.();a.pause?.();}catch{}});trackAudioRefs.current={};
    stopPlaybackDuringRecording();setStudioPlaying(false);setPlayingTrackId(null);
  };

  const addToSetlist=n=>updateProject(project.id,p=>({setlist:[...(p.setlist||[]),{id:Date.now(),name:n}]}));
  const removeFromSetlist=id=>updateProject(project.id,p=>({setlist:p.setlist.filter(s=>s.id!==id)}));
  const handleSetlistDragStart=i=>setDraggedSetlist(i);
  const handleSetlistDrop=ti=>{
    if(draggedSetlist===null)return;
    const u=[...(project.setlist||[])];const[it]=u.splice(draggedSetlist,1);u.splice(ti,0,it);
    updateProject(project.id,()=>({setlist:u}));setDraggedSetlist(null);
  };

  const allSections=[...new Set(project.songs.flatMap(s=>s.sections))];
  const modalHeader=(color)=>({display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:`1px solid ${color}44`,background:darkMode?"#0a0f0a":"#f0f4ff"});
  const doneBtn=(color)=>({background:`${color}22`,border:`1px solid ${color}66`,color,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700});
  const reverbLabel=v=>v===0?"DRY":v<0.3?"ROOM":v<0.6?"HALL":v<0.8?"CHAMBER":"CATHEDRAL";
  const eqLabel=v=>v>0.3?"BOOST":v<-0.3?"CUT":"FLAT";
  const volLabel=v=>v===0?"SILENT":v<0.3?"LOW":v<0.6?"MEDIUM":v<0.9?"LOUD":"MAX";

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');
        @keyframes pulse-glow{0%,100%{text-shadow:0 0 8px ${AC},0 0 20px ${AC};}50%{text-shadow:0 0 20px ${AC},0 0 40px ${AC};}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .loading-text{animation:pulse-glow 1.2s ease-in-out infinite;}
        @keyframes fadeOut{0%{opacity:1}100%{opacity:0}}
        .splash-fade{animation:fadeOut 1.1s ease-in-out forwards;}
        @keyframes slideIn{0%{transform:translateX(-100%)}100%{transform:translateX(0)}}
        .menu-panel{animation:slideIn 0.25s ease forwards;}
        @keyframes popIn{0%{opacity:0;transform:scale(0.97)}100%{opacity:1;transform:scale(1)}}
        .pop-in{animation:popIn 0.2s ease forwards;}
        @keyframes recPulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .rec-dot{animation:recPulse 1s ease-in-out infinite;}
        @keyframes vuPulse{0%{height:20%}50%{height:80%}100%{height:20%}}
        @keyframes dropIn{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:translateY(0)}}
        .drop-in{animation:dropIn 0.2s ease forwards;}
        @keyframes confirmPop{0%{opacity:0;transform:scale(0.9)}100%{opacity:1;transform:scale(1)}}
        .confirm-pop{animation:confirmPop 0.15s ease forwards;}
        *{box-sizing:border-box;}
        body{background:${isMixer?"#0a0a0f":T.bg};margin:0;transition:background 0.3s;}
        .icon-btn{background:none;border:none;cursor:pointer;padding:4px 5px;border-radius:6px;font-size:13px;line-height:1;transition:background 0.15s;}
        .icon-btn:hover{background:rgba(128,128,128,0.15);}
        .table-wrap{overflow-x:auto;border-radius:16px;margin-bottom:16px;-webkit-overflow-scrolling:touch;}
        .section-table{width:max-content;min-width:100%;border-collapse:collapse;}
        .sticky-col{position:sticky;left:0;z-index:2;}
        .sticky-col-head{position:sticky;left:0;z-index:3;}
        .chrome-row{transition:background 0.15s;}
        .chrome-row:hover{background:${T.rowHover}!important;}
        .tab-scroll{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;}
        .tab-scroll::-webkit-scrollbar{display:none;}
        .lines-btn{display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:8px;cursor:pointer;border:none;background:none;flex-shrink:0;}
        .lines-btn .line{width:14px;height:2px;border-radius:1px;}
        input[type=range]{-webkit-appearance:none;height:4px;background:#1e1e2e;border-radius:2px;outline:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#00e5ff;cursor:pointer;box-shadow:0 0 8px #00e5ff;}
      `}</style>

      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div className="confirm-pop" style={{background:darkMode?"#111":"#fff",borderRadius:20,padding:24,maxWidth:300,width:"100%",border:"2px solid #ff4444",boxShadow:"0 0 40px #ff444466"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:40,marginBottom:12}}>🗑️</div>
              <h3 style={{color:"#ff4444",fontSize:16,fontWeight:700,margin:"0 0 8px"}}>DELETE TRACK?</h3>
              <p style={{color:T.subtext,fontSize:13,margin:0,lineHeight:1.5}}>This will permanently delete <strong style={{color:T.text}}>{confirmDelete.name}</strong> and all its recordings.</p>
              <p style={{color:"#ff4444",fontSize:11,margin:"8px 0 0"}}>This cannot be undone.</p>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmDelete(null)} style={{flex:1,padding:"12px",borderRadius:12,background:"transparent",border:`1px solid ${T.border}`,color:T.subtext,cursor:"pointer",fontSize:13,fontWeight:700}}>CANCEL</button>
              <button onClick={()=>deleteTrack(confirmDelete.id)} style={{flex:1,padding:"12px",borderRadius:12,background:"#ff444422",border:"2px solid #ff4444",color:"#ff4444",cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:"0 0 12px #ff444444"}}>DELETE</button>
            </div>
          </div>
        </div>
      )}

      {sectionNoteOpen&&song&&(
        <div className="pop-in" style={{position:"fixed",inset:0,zIndex:7500,background:T.bg,display:"flex",flexDirection:"column"}}>
          <div style={modalHeader(AC)}>
            <div style={{width:8,height:8,borderRadius:"50%",background:AC,boxShadow:`0 0 6px ${AC}`}}/>
            <span style={{color:AC,fontWeight:700,fontSize:14,flex:1}}>📝 {sectionNoteOpen}</span>
            <button onClick={()=>setSectionNoteOpen(null)} style={doneBtn(AC)}>✓ DONE</button>
          </div>
          <textarea style={{flex:1,resize:"none",fontFamily:"monospace",fontSize:15,border:"none",padding:"20px",lineHeight:1.8,background:T.bg,color:T.text,outline:"none"}}
            placeholder={`Notes for ${sectionNoteOpen}...`} value={getSectionNote(sectionNoteOpen)}
            onChange={e=>setSectionNote(sectionNoteOpen,e.target.value)} autoFocus/>
        </div>
      )}

      {audioNoteOpen&&song&&(
        <div className="pop-in" style={{position:"fixed",inset:0,zIndex:7500,background:T.bg,display:"flex",flexDirection:"column"}}>
          <div style={modalHeader(AC)}>
            <div style={{width:8,height:8,borderRadius:"50%",background:AC,boxShadow:`0 0 6px ${AC}`}}/>
            <span style={{color:AC,fontWeight:700,fontSize:14,flex:1}}>🎙️ {audioNoteOpen}</span>
            <button onClick={()=>{if(recording)stopRecording();setAudioNoteOpen(null);}} style={doneBtn(AC)}>✓ DONE</button>
          </div>
          <div style={{flex:1,padding:"20px",overflowY:"auto"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"20px 0",borderBottom:`1px solid ${AC}22`,marginBottom:20}}>
              {recording?(
                <>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div className="rec-dot" style={{width:12,height:12,borderRadius:"50%",background:"#ff4444"}}/>
                    <span style={{color:"#ff4444",fontWeight:700,fontSize:22}}>{fmtTime(recordingTime)}</span>
                  </div>
                  <button onClick={stopRecording} style={{background:"#ff444422",border:"2px solid #ff4444",color:"#ff4444",borderRadius:"50%",width:80,height:80,fontSize:28,cursor:"pointer"}}>⏹</button>
                </>
              ):(
                <>
                  <button onClick={()=>startRecording(audioNoteOpen)} style={{background:`${AC}22`,border:`2px solid ${AC}`,color:AC,borderRadius:"50%",width:80,height:80,fontSize:32,cursor:"pointer",boxShadow:`0 0 24px ${AC}44`}}>🎙️</button>
                  <span style={{color:AC,fontSize:11,letterSpacing:"0.1em"}}>TAP TO RECORD</span>
                  <input ref={fileInputRef} type="file" accept="audio/*" style={{display:"none"}} onChange={e=>handleFileUpload(audioNoteOpen,e)}/>
                  <button onClick={()=>fileInputRef.current?.click()} style={{width:"100%",padding:"10px",borderRadius:10,background:`${AC}11`,border:`1px solid ${AC}44`,color:AC,cursor:"pointer",fontSize:12,fontWeight:700}}>📁 UPLOAD FROM FILES</button>
                </>
              )}
            </div>
            {getAudioNotes(audioNoteOpen).map(a=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,background:T.cardBg,border:`1px solid ${AC}33`,marginBottom:8}}>
                <button onClick={()=>playAudio(a.id)} style={{width:36,height:36,borderRadius:"50%",border:`2px solid ${AC}`,background:playingId===a.id?`${AC}33`:"transparent",color:AC,cursor:"pointer",fontSize:16}}>{playingId===a.id?"⏸":"▶"}</button>
                <span style={{color:T.text,fontSize:12,flex:1}}>{a.label}</span>
                <button className="icon-btn" onClick={()=>deleteAudioNote(audioNoteOpen,a.id)} style={{color:"#ff4444"}}>🗑️</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {notesOpen&&song&&(
        <div className="pop-in" style={{position:"fixed",inset:0,zIndex:7000,background:T.bg,display:"flex",flexDirection:"column"}}>
          <div style={modalHeader(AC)}>
            <div style={{width:8,height:8,borderRadius:"50%",background:AC,boxShadow:`0 0 6px ${AC}`}}/>
            <span style={{color:AC,fontWeight:700,fontSize:14,flex:1}}>{song.name} — NOTES</span>
            <button onClick={()=>setNotesOpen(false)} style={doneBtn(AC)}>↙ COLLAPSE</button>
          </div>
          <textarea style={{flex:1,resize:"none",fontFamily:"monospace",fontSize:14,border:"none",padding:"20px",lineHeight:1.7,background:T.bg,color:T.text,outline:"none"}}
            placeholder="Session notes..." value={song.notes}
            onChange={e=>updateSong(song.id,()=>({notes:e.target.value}))} autoFocus/>
        </div>
      )}

      {menuOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:8000}} onClick={()=>setMenuOpen(false)}>
          <div className="menu-panel" onClick={e=>e.stopPropagation()} style={{
            position:"absolute",top:0,left:0,bottom:0,width:"82%",maxWidth:320,
            background:darkMode?"#080d08":"#ffffff",borderRight:`1px solid ${AC}44`,
            display:"flex",flexDirection:"column",overflow:"hidden",
          }}>
            <div style={{padding:"20px 16px 12px",borderBottom:`1px solid ${AC}33`,background:darkMode?"#0a0f0a":"#f0f4ff"}}>
              <img src={LOGO_TEXT} alt="Dog Bones" style={{width:"100%",maxWidth:200,height:40,objectFit:"cover",objectPosition:"center",mixBlendMode:"screen",display:"block",marginBottom:4}}/>
              <p style={{color:`${AC}88`,fontSize:9,letterSpacing:"0.3em",margin:0}}>PROJECTS</p>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"12px 0"}}>
              {projects.map(p=>(
                <div key={p.id} onClick={()=>switchProject(p.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",cursor:"pointer",background:p.id===activeProject?`${p.color}11`:"transparent",borderLeft:p.id===activeProject?`3px solid ${p.color}`:"3px solid transparent"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0,boxShadow:`0 0 6px ${p.color}`}}/>
                  <div style={{flex:1,overflow:"hidden"}}>
                    <div style={{fontSize:13,fontWeight:600,color:p.id===activeProject?p.color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                    {p.songName&&<div style={{fontSize:10,color:`${p.color}88`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.songName}</div>}
                  </div>
                  {projects.length>1&&<button className="icon-btn" onClick={e=>{e.stopPropagation();deleteProject(p.id);}} style={{color:"#ff4444"}}>🗑️</button>}
                </div>
              ))}
            </div>
            <div style={{padding:"12px 16px",borderTop:`1px solid ${AC}22`,background:darkMode?"#0a0f0a":"#f0f4ff"}}>
              <p style={{color:T.subtext,fontSize:10,letterSpacing:"0.2em",marginBottom:8}}>NEW PROJECT</p>
              <div style={{display:"flex",gap:8}}>
                <input style={inp({fontSize:12})} placeholder="Project name..." value={newProjectName}
                  onChange={e=>setNewProjectName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProject()}/>
                <button onClick={addProject} style={{background:`${AC}22`,border:`1px solid ${AC}66`,color:AC,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>+ ADD</button>
              </div>
            </div>
            <div style={{padding:"12px 16px",borderTop:`1px solid ${AC}22`,display:"flex",flexDirection:"column",gap:8}}>
              {[
                {label:"🎛️ STUDIO",val:"studio"},
                {label:"🎵 SONG ARRANGER",val:"songs"},
                {label:"📋 SETLIST BUILDER",val:"setlist"},
                {label:"🎚️ MIX & MASTER",val:"mixer"},
              ].map(({label,val})=>(
                <button key={val} onClick={()=>{setScreen(val);setMenuOpen(false);}} style={{
                  background:screen===val?`${val==="mixer"?"#00e5ff":AC}22`:"transparent",
                  border:`1px solid ${screen===val?(val==="mixer"?"#00e5ff":AC)+"66":"rgba(128,128,128,0.2)"}`,
                  color:screen===val?(val==="mixer"?"#00e5ff":AC):T.subtext,
                  borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:"0.1em",textAlign:"left",
                  boxShadow:screen===val&&val==="mixer"?"0 0 12px #00e5ff33":"none",
                }}>{label}{val==="mixer"&&<span style={{fontSize:9,marginLeft:6,color:"#00e5ff88",background:"#00e5ff11",border:"1px solid #00e5ff33",borderRadius:3,padding:"1px 5px",letterSpacing:1}}>AI</span>}</button>
              ))}
              <button onClick={()=>setDarkMode(!darkMode)} style={{background:darkMode?"rgba(255,238,0,0.08)":"rgba(10,22,40,0.05)",border:`1px solid ${darkMode?"rgba(255,238,0,0.3)":"rgba(10,22,40,0.15)"}`,color:darkMode?"#ffee00":"#0a1628",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:"0.1em",textAlign:"left"}}>{darkMode?"☀️ LIGHT MODE":"🌙 DARK MODE"}</button>
              <button onClick={shareApp} style={{background:shareCopied?`${AC}33`:`${AC}11`,border:`1px solid ${AC}66`,color:AC,borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:"0.1em",textAlign:"left",transition:"all 0.2s"}}>{shareCopied?"✅ LINK COPIED!":"📤 SHARE APP WITH BAND"}</button>
              <p style={{color:T.subtext,fontSize:10,lineHeight:1.6,margin:0}}>Open in Chrome → Add to Home Screen!</p>
            </div>
          </div>
        </div>
      )}

      <div style={{minHeight:"100vh",background:isMixer?"#0a0a0f":T.bg,color:T.text,transition:"background 0.3s"}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 14px",borderRadius:14,background:isMixer?"#111118":T.card,border:`1px solid ${isMixer?"#1e1e2e":AC+"44"}`}}>
            <button onClick={()=>setMenuOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:8,flexShrink:0}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {[0,1,2].map(i=><div key={i} style={{width:20,height:2,borderRadius:1,background:isMixer?"#00e5ff":AC,boxShadow:`0 0 4px ${isMixer?"#00e5ff":AC}`}}/>)}
              </div>
            </button>
            <img src={LOGO_TEXT} alt="Dog Bones" style={{height:36,objectFit:"contain",mixBlendMode:darkMode?"screen":"multiply",flexShrink:0}}/>
            <div style={{flex:1,overflow:"hidden"}}>
              {isMixer?(
                <div>
                  <div style={{fontFamily:"monospace",fontSize:14,color:"#00e5ff",letterSpacing:3,textShadow:"0 0 12px #00e5ff"}}>◈ NEXUS MIX</div>
                  <div style={{fontSize:10,color:"#5a5a7a",letterSpacing:2}}>AI MIX & MASTER</div>
                </div>
              ):editingProjectName?(
                <div style={{display:"flex",gap:4}}>
                  <input style={inp({padding:"4px 8px",fontSize:12,borderColor:`${AC}66`})} value={projectNameValue} onChange={e=>setProjectNameValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveProjectName()} autoFocus/>
                  <button className="icon-btn" onClick={saveProjectName} style={{color:AC}}>✓</button>
                  <button className="icon-btn" onClick={()=>setEditingProjectName(false)} style={{color:T.subtext}}>✕</button>
                </div>
              ):(
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:AC,flexShrink:0,boxShadow:`0 0 5px ${AC}`}}/>
                    <span style={{color:AC,fontWeight:700,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project?.name}</span>
                    <button className="icon-btn" onClick={()=>{setEditingProjectName(true);setProjectNameValue(project.name);}} style={{color:`${AC}66`,fontSize:10,flexShrink:0}}>✏️</button>
                  </div>
                  {editingProjectSong?(
                    <div style={{display:"flex",gap:4,marginTop:3}}>
                      <input style={inp({padding:"3px 8px",fontSize:11,borderColor:`${AC}44`})} value={projectSongValue} onChange={e=>setProjectSongValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveProjectSongName()} autoFocus placeholder="Song name..."/>
                      <button className="icon-btn" onClick={saveProjectSongName} style={{color:AC,fontSize:11}}>✓</button>
                      <button className="icon-btn" onClick={()=>setEditingProjectSong(false)} style={{color:T.subtext,fontSize:11}}>✕</button>
                    </div>
                  ):(
                    <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                      <span style={{color:`${AC}99`,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:project?.songName?"normal":"italic"}}>{project?.songName||"+ tap to add song name"}</span>
                      <button className="icon-btn" onClick={()=>{setEditingProjectSong(true);setProjectSongValue(project?.songName||"");}} style={{color:`${AC}55`,fontSize:10,flexShrink:0}}>✏️</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {!isMixer&&(
              <div style={{position:"relative",flexShrink:0}}>
                <button onClick={()=>setColorPickerOpen(!colorPickerOpen)} style={{width:26,height:26,borderRadius:"50%",background:AC,border:"none",cursor:"pointer",boxShadow:`0 0 10px ${AC}`}}/>
                {colorPickerOpen&&(
                  <div style={{position:"absolute",top:32,right:0,zIndex:200,background:darkMode?"#111":"#fff",borderRadius:14,padding:14,border:`1px solid ${AC}44`,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",minWidth:220}}>
                    <p style={{color:T.subtext,fontSize:9,letterSpacing:"0.2em",marginBottom:8}}>APP COLOR</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:7,marginBottom:14}}>
                      {PROJECT_COLORS.map(c=><button key={c} onClick={()=>{setAccentColor(c);updateProject(project.id,()=>({color:c}));setColorPickerOpen(false);}} style={{width:26,height:26,borderRadius:"50%",background:c,border:c===AC?"2px solid #fff":"none",cursor:"pointer",boxShadow:`0 0 6px ${c}`}}/>)}
                    </div>
                    <div style={{height:1,background:T.border,marginBottom:12}}/>
                    <p style={{color:T.subtext,fontSize:9,letterSpacing:"0.2em",marginBottom:8}}>CUSTOM</p>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <input type="color" value={customColor} onChange={e=>setCustomColor(e.target.value)} style={{width:44,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2,background:"none"}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,color:T.subtext,marginBottom:4}}>{customColor}</div>
                        <button onClick={()=>{setAccentColor(customColor);updateProject(project.id,()=>({color:customColor}));setColorPickerOpen(false);}} style={{width:"100%",background:`${customColor}22`,border:`1px solid ${customColor}66`,color:customColor,borderRadius:8,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:700}}>✓ APPLY</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{width:40,height:40,borderRadius:8,overflow:"hidden",border:`1px solid ${isMixer?"#00e5ff44":AC+"44"}`,flexShrink:0,boxShadow:`0 0 10px ${isMixer?"#00e5ff44":AC+"44"}`}}>
              <img src="/launchericon-192x192.png" alt="Logo" style={{width:40,height:40,objectFit:"cover",mixBlendMode:"screen",filter:"sepia(1) saturate(3) hue-rotate(70deg) brightness(1.2)"}}/>
            </div>
          </div>

          {isMixer&&<NexusMixScreen accentColor={accentColor}/>}

          {isStudio&&(
            <div>
              <div style={{padding:"14px 16px",borderRadius:14,marginBottom:12,background:T.card,border:`1px solid ${AC}44`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <h2 style={{color:AC,fontSize:18,fontWeight:700,margin:0}}>🎛️ STUDIO</h2>
                    <p style={{color:T.subtext,fontSize:10,margin:"2px 0 0"}}>{project?.name?.toUpperCase()} — {song?.bpm?`${song.bpm} BPM`:"SET BPM IN SONG ARRANGER"}</p>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={studioPlaying?stopAllTracks:playAllTracks} style={{background:studioPlaying?"#ff444422":`${AC}22`,border:`2px solid ${studioPlaying?"#ff4444":AC}`,color:studioPlaying?"#ff4444":AC,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>{studioPlaying?"⏹ STOP ALL":"▶ PLAY ALL"}</button>
                  </div>
                </div>
                <div style={{padding:"8px 12px",borderRadius:10,background:`${AC}08`,border:`1px solid ${AC}22`}}>
                  <p style={{color:T.subtext,fontSize:10,margin:0,lineHeight:1.6}}><span style={{color:AC,fontWeight:700}}>BAND WORKFLOW: </span>Record → Downloads → text .webm to bandmate → they upload → record while hearing yours</p>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {tracks.map(track=>{
                  const isRecordingThis=studioRecordingTrack===track.id;
                  const isCountingInThis=countingIn===track.id;
                  const isPlayingThis=playingTrackId===track.id;
                  const latestRec=track.recordings[track.recordings.length-1];
                  const hasAudio=latestRec&&studioAudioURLs[latestRec.id];
                  const TC=track.color;
                  const isExpanded=expandedTrack===track.id;
                  return(
                    <div key={track.id} style={{borderRadius:14,overflow:"hidden",border:`1px solid ${TC}${track.muted?"22":"55"}`,background:T.card,opacity:track.muted?0.7:1,transition:"all 0.2s",boxShadow:isRecordingThis?`0 0 20px ${TC}66`:isCountingInThis?`0 0 20px #ffee0066`:"none"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:`${TC}11`}}>
                        <div style={{position:"relative"}}>
                          <button onClick={()=>setTrackColorPicker(trackColorPicker===track.id?null:track.id)} style={{width:16,height:16,borderRadius:"50%",background:TC,border:"none",cursor:"pointer",flexShrink:0,boxShadow:`0 0 6px ${TC}`}}/>
                          {trackColorPicker===track.id&&(
                            <div style={{position:"absolute",top:22,left:0,zIndex:300,background:darkMode?"#111":"#fff",borderRadius:12,padding:10,border:`1px solid ${TC}44`,boxShadow:"0 6px 24px rgba(0,0,0,0.4)",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,width:130}}>
                              {PROJECT_COLORS.map(c=><button key={c} onClick={()=>{updateTrack(track.id,()=>({color:c}));setTrackColorPicker(null);}} style={{width:22,height:22,borderRadius:"50%",background:c,border:c===TC?"2px solid #fff":"none",cursor:"pointer",boxShadow:`0 0 5px ${c}`}}/>)}
                            </div>
                          )}
                        </div>
                        {editingTrackName===track.id?(
                          <div style={{display:"flex",gap:4,flex:1}}>
                            <input style={inp({padding:"3px 8px",fontSize:12,borderColor:`${TC}66`})} value={trackNameValue} onChange={e=>setTrackNameValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){updateTrack(track.id,()=>({name:trackNameValue.trim()}));setEditingTrackName(null);}}} autoFocus/>
                            <button className="icon-btn" onClick={()=>{updateTrack(track.id,()=>({name:trackNameValue.trim()}));setEditingTrackName(null);}} style={{color:TC}}>✓</button>
                          </div>
                        ):(
                          <span onClick={()=>{setEditingTrackName(track.id);setTrackNameValue(track.name);}} style={{color:TC,fontWeight:700,fontSize:13,flex:1,cursor:"pointer"}}>{track.name}</span>
                        )}
                        {isCountingInThis&&(
                          <div style={{display:"flex",gap:3,alignItems:"center"}}>
                            {[1,2,3,4,5,6,7,8].map(b=><div key={b} style={{width:b<=countBeat?8:5,height:b<=countBeat?8:5,borderRadius:"50%",background:b===1||b===5?"#ffee00":b<=countBeat?TC:"rgba(255,255,255,0.15)",transition:"all 0.05s"}}/>)}
                          </div>
                        )}
                        {isRecordingThis&&<div style={{display:"flex",alignItems:"center",gap:4}}><div className="rec-dot" style={{width:8,height:8,borderRadius:"50%",background:"#ff4444"}}/><span style={{color:"#ff4444",fontSize:11,fontWeight:700}}>{fmtTime(studioRecordingTime)}</span></div>}
                        {track.muted&&<span style={{color:"#ff4444",fontSize:9,fontWeight:700,background:"#ff444422",border:"1px solid #ff444466",borderRadius:4,padding:"1px 5px"}}>MUTE</span>}
                        {track.solo&&<span style={{color:TC,fontSize:9,fontWeight:700,background:`${TC}22`,border:`1px solid ${TC}66`,borderRadius:4,padding:"1px 5px"}}>SOLO</span>}
                        <button onClick={()=>setConfirmDelete({id:track.id,name:track.name})} style={{width:28,height:28,borderRadius:8,flexShrink:0,background:"#ff444411",border:"1px solid #ff444444",color:"#ff4444",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
                        <button onClick={()=>setExpandedTrack(isExpanded?null:track.id)} style={{background:isExpanded?`${TC}22`:"transparent",border:`1px solid ${TC}${isExpanded?"66":"33"}`,color:TC,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>{isExpanded?"▲":"▼"}</button>
                      </div>
                      <div style={{height:30,background:darkMode?"#050a05":"#f0f4f0",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",gap:2,padding:"0 12px",borderTop:`1px solid ${TC}22`,borderBottom:isExpanded?`1px solid ${TC}22`:"none"}}>
                        {isRecordingThis||isCountingInThis?(
                          [...Array(24)].map((_,i)=><div key={i} style={{width:3,borderRadius:2,background:isCountingInThis?"#ffee00":TC,animation:`vuPulse ${0.3+Math.random()*0.5}s ease-in-out infinite`,animationDelay:`${i*0.04}s`,minHeight:3}}/>)
                        ):latestRec?(
                          [...Array(24)].map((_,i)=><div key={i} style={{width:3,borderRadius:2,height:`${15+Math.sin(i*0.8)*40+Math.cos(i*1.3)*20}%`,background:`${TC}${hasAudio?"bb":"33"}`}}/>)
                        ):(
                          <span style={{color:T.subtext,fontSize:10}}>No recording — tap REC</span>
                        )}
                      </div>
                      <div style={{display:"flex",gap:6,padding:"10px 12px",borderBottom:isExpanded?`1px solid ${TC}22`:"none"}}>
                        <button onClick={()=>playTrackWithFX(track.id)} disabled={!latestRec} style={{flex:1,padding:"9px 4px",borderRadius:10,background:isPlayingThis?`${TC}33`:`${TC}11`,border:`1px solid ${TC}${isPlayingThis?"99":"44"}`,color:!latestRec?T.subtext:TC,cursor:!latestRec?"not-allowed":"pointer",fontSize:11,fontWeight:700}}>{isPlayingThis?"⏸ PAUSE":"▶ PLAY"}</button>
                        <button onClick={()=>{if(isRecordingThis)stopStudioRecording();else if(isCountingInThis)cancelCountIn();else stopTrack(track.id);}} disabled={!isPlayingThis&&!isRecordingThis&&!isCountingInThis} style={{flex:1,padding:"9px 4px",borderRadius:10,background:"#ff444411",border:`1px solid #ff4444${isPlayingThis||isRecordingThis||isCountingInThis?"88":"22"}`,color:isPlayingThis||isRecordingThis||isCountingInThis?"#ff4444":T.subtext,cursor:isPlayingThis||isRecordingThis||isCountingInThis?"pointer":"not-allowed",fontSize:11,fontWeight:700}}>⏹ STOP</button>
                        {isRecordingThis?<button onClick={stopStudioRecording} style={{flex:2,padding:"9px 4px",borderRadius:10,background:"#ff444422",border:"2px solid #ff4444",color:"#ff4444",cursor:"pointer",fontSize:11,fontWeight:700}}>🔴 {fmtTime(studioRecordingTime)}</button>
                        :isCountingInThis?<button onClick={cancelCountIn} style={{flex:2,padding:"9px 4px",borderRadius:10,background:"#ffee0022",border:"2px solid #ffee00",color:"#ffee00",cursor:"pointer",fontSize:11,fontWeight:700}}>🥁 {countBeat}/8 CANCEL</button>
                        :<button onClick={()=>{if(studioRecordingTrack!==null||countingIn!==null)return;startCountIn(track.id);}} style={{flex:2,padding:"9px 4px",borderRadius:10,background:`${TC}22`,border:`1px solid ${TC}66`,color:studioRecordingTrack!==null||countingIn!==null?T.subtext:TC,cursor:studioRecordingTrack!==null||countingIn!==null?"not-allowed":"pointer",fontSize:11,fontWeight:700,boxShadow:`0 0 8px ${TC}33`}}>🎙️ REC</button>}
                        <button onClick={()=>{studioFileTrackId.current=track.id;studioFileInputRef.current?.click();}} style={{padding:"9px 10px",borderRadius:10,background:`${TC}11`,border:`1px solid ${TC}44`,color:TC,cursor:"pointer",fontSize:13}}>📁</button>
                      </div>
                      {isExpanded&&(
                        <div className="drop-in" style={{padding:"16px 12px",display:"flex",flexDirection:"column",gap:18}}>
                          <StepControl label="🔊 VOLUME" value={track.volume} onChange={v=>updateTrack(track.id,()=>({volume:v}))} min={0} max={1} step={0.1} TC={TC} formatLabel={volLabel}/>
                          <StepControl label="🌊 REVERB" value={track.reverb||0} onChange={v=>updateTrack(track.id,()=>({reverb:v}))} min={0} max={1} step={0.1} TC={TC} formatLabel={reverbLabel}/>
                          <div>
                            <p style={{color:TC,fontSize:10,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>🎚️ EQ</p>
                            <div style={{display:"flex",flexDirection:"column",gap:12}}>
                              <StepControl label="LOWS" value={track.lows||0} onChange={v=>updateTrack(track.id,()=>({lows:v}))} min={-1} max={1} step={0.1} TC={TC} formatLabel={eqLabel}/>
                              <StepControl label="MIDS" value={track.mids||0} onChange={v=>updateTrack(track.id,()=>({mids:v}))} min={-1} max={1} step={0.1} TC={TC} formatLabel={eqLabel}/>
                              <StepControl label="HIGHS" value={track.highs||0} onChange={v=>updateTrack(track.id,()=>({highs:v}))} min={-1} max={1} step={0.1} TC={TC} formatLabel={eqLabel}/>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>updateTrack(track.id,t=>({muted:!t.muted}))} style={{flex:1,padding:"8px",borderRadius:10,background:track.muted?"#ff444422":"transparent",border:`1px solid ${track.muted?"#ff4444":"rgba(128,128,128,0.3)"}`,color:track.muted?"#ff4444":T.subtext,cursor:"pointer",fontSize:11,fontWeight:700}}>🔇 {track.muted?"UNMUTE":"MUTE"}</button>
                            <button onClick={()=>updateTrack(track.id,t=>({solo:!t.solo}))} style={{flex:1,padding:"8px",borderRadius:10,background:track.solo?`${TC}22`:"transparent",border:`1px solid ${track.solo?TC:"rgba(128,128,128,0.3)"}`,color:track.solo?TC:T.subtext,cursor:"pointer",fontSize:11,fontWeight:700}}>⭐ {track.solo?"UNSOLO":"SOLO"}</button>
                          </div>
                          <div>
                            <p style={{color:TC,fontSize:10,fontWeight:700,letterSpacing:"0.1em",marginBottom:6}}>📝 TRACK NOTES</p>
                            <textarea style={inp({height:60,resize:"none",fontFamily:"monospace",fontSize:12,borderColor:`${TC}33`,padding:"8px"})} placeholder={`Notes for ${track.name}...`} value={track.notes||""} onChange={e=>updateTrack(track.id,()=>({notes:e.target.value}))}/>
                          </div>
                          {track.recordings.length>0&&(
                            <div>
                              <p style={{color:TC,fontSize:10,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>TAKES ({track.recordings.length})</p>
                              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                                {track.recordings.map((rec,idx)=>(
                                  <div key={rec.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,background:idx===track.recordings.length-1?`${TC}11`:T.cardBg,border:`1px solid ${idx===track.recordings.length-1?TC+"33":T.border}`}}>
                                    {idx===track.recordings.length-1&&<span style={{color:TC,fontSize:8,fontWeight:700,background:`${TC}22`,borderRadius:3,padding:"1px 4px"}}>LATEST</span>}
                                    <span style={{color:T.text,fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rec.label}</span>
                                    {rec.duration>0&&<span style={{color:T.subtext,fontSize:10}}>{fmtTime(rec.duration)}</span>}
                                    {studioAudioURLs[rec.id]?<span style={{color:TC,fontSize:9}}>●</span>:<span style={{color:"#ff9500",fontSize:9}}>⚠</span>}
                                    <button className="icon-btn" onClick={()=>deleteStudioRecording(track.id,rec.id)} style={{color:"#ff444488",fontSize:11}}>🗑️</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <button onClick={()=>updateTrack(track.id,()=>({recordings:[],notes:"",reverb:0,lows:0,mids:0,highs:0,volume:0.8,muted:false,solo:false}))} style={{padding:"8px",borderRadius:10,background:"#ff950011",border:"1px solid #ff950066",color:"#ff9500",cursor:"pointer",fontSize:11,fontWeight:700}}>🔄 RESET TRACK DATA (KEEP TRACK)</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={addTrack} style={{width:"100%",marginTop:10,padding:"12px",borderRadius:14,background:`${AC}11`,border:`2px dashed ${AC}44`,color:AC,cursor:"pointer",fontSize:13,fontWeight:700,letterSpacing:"0.1em"}}>+ ADD TRACK</button>
              <input ref={studioFileInputRef} type="file" accept="audio/*" style={{display:"none"}} onChange={e=>{if(studioFileTrackId.current!==null){handleStudioFileUpload(studioFileTrackId.current,e);studioFileTrackId.current=null;}}}/>
              <div style={{marginTop:12,padding:"12px 14px",borderRadius:12,background:T.cardBg,border:`1px solid ${T.border}`}}>
                <p style={{color:T.subtext,fontSize:10,lineHeight:1.8,margin:0}}>
                  <span style={{color:AC}}>▸</span> 🗑️ in header = delete entire track &nbsp;
                  <span style={{color:AC}}>▸</span> 🔄 inside ▼ = reset data, keep track &nbsp;
                  <span style={{color:AC}}>▸</span> + ADD TRACK = add a new blank track
                </p>
              </div>
            </div>
          )}

          {isSetlist&&(
            <div style={{padding:"16px",borderRadius:14,background:T.card,border:`1px solid ${AC}44`}}>
              <h2 style={{color:AC,fontSize:16,fontWeight:700,letterSpacing:"0.1em",marginBottom:4}}>📋 SETLIST BUILDER</h2>
              <p style={{color:T.subtext,fontSize:11,letterSpacing:"0.15em",marginBottom:16}}>DRAG TO REORDER</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                {project.songs.map(s=><button key={s.id} onClick={()=>addToSetlist(s.name)} style={{background:`${s.color.hex}22`,border:`1px solid ${s.color.hex}66`,color:s.color.hex,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>+ {s.name}</button>)}
              </div>
              {(project.setlist||[]).length===0?(
                <p style={{color:T.subtext,fontSize:12,textAlign:"center",padding:"20px 0"}}>Tap a song above to add to setlist</p>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(project.setlist||[]).map((item,index)=>(
                    <div key={item.id} draggable onDragStart={()=>handleSetlistDragStart(index)} onDragOver={e=>e.preventDefault()} onDrop={()=>handleSetlistDrop(index)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,background:T.cardBg,border:`1px solid ${AC}33`,cursor:"grab",opacity:draggedSetlist===index?0.4:1}}>
                      <span style={{color:`${AC}66`,fontSize:16}}>☰</span>
                      <span style={{color:AC,fontWeight:700,fontSize:14,width:28}}>{index+1}.</span>
                      <span style={{flex:1,color:T.text,fontSize:13}}>{item.name}</span>
                      <button className="icon-btn" onClick={()=>removeFromSetlist(item.id)} style={{color:"#ff4444"}}>🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isStudio&&!isSetlist&&!isMixer&&(
            <div>
              <div className="tab-scroll" style={{marginBottom:12}}>
                {project.songs.map((s,i)=>(
                  <button key={i} onClick={()=>setActiveTab(i)} style={{flex:"0 0 auto",padding:"7px 12px",borderRadius:10,border:`1px solid ${activeTab===i?getSongColor(s.color.hex):"rgba(128,128,128,0.2)"}`,background:activeTab===i?`${getSongColor(s.color.hex)}22`:"transparent",color:activeTab===i?getSongColor(s.color.hex):T.subtext,fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.05em",whiteSpace:"nowrap",boxShadow:activeTab===i?`0 0 10px ${getSongColor(s.color.hex)}44`:"none",transition:"all 0.2s"}}>{s.name}</button>
                ))}
                <button onClick={()=>setActiveTab(4)} style={{flex:"0 0 auto",padding:"7px 12px",borderRadius:10,border:`1px solid ${activeTab===4?T.text:"rgba(128,128,128,0.2)"}`,background:activeTab===4?darkMode?"rgba(255,255,255,0.1)":"rgba(10,22,40,0.08)":"transparent",color:activeTab===4?T.text:T.subtext,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.2s"}}>⚡ MERGE</button>
              </div>
              {isMerge?(
                <div>
                  <div style={{padding:"14px 16px",borderRadius:14,marginBottom:12,background:T.card,border:`1px solid ${T.border}`}}>
                    <h2 style={{color:T.text,fontSize:16,fontWeight:700,marginBottom:4}}>⚡ MERGE VIEW</h2>
                    <p style={{color:T.subtext,fontSize:10,letterSpacing:"0.15em",marginBottom:10}}>COLOR = WHICH SONG CLAIMED THIS PART</p>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      {project.songs.map(s=><div key={s.id} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:3,background:getSongColor(s.color.hex)}}/><span style={{color:getSongColor(s.color.hex),fontSize:11,fontWeight:700}}>{s.name}</span></div>)}
                    </div>
                  </div>
                  <div className="table-wrap" style={{border:`1px solid ${T.border}`}}>
                    <table className="section-table">
                      <thead>
                        <tr style={{background:T.headBg}}>
                          <th className="sticky-col-head" style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,textAlign:"left",fontSize:10,color:T.subtext,minWidth:160,background:T.headBg}}>SECTION</th>
                          {instruments.map(inst=><th key={inst} style={{padding:"10px 8px",borderBottom:`1px solid ${T.border}`,textAlign:"center",fontSize:9,color:T.subtext,minWidth:72,whiteSpace:"nowrap"}}>{inst.toUpperCase()}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {allSections.map(section=>(
                          <tr key={section} style={{borderBottom:`1px solid ${T.border}`}}>
                            <td className="sticky-col" style={{padding:"9px 12px",fontSize:11,color:T.text,fontWeight:600,minWidth:160,background:T.stickyBg}}>{section}</td>
                            {instruments.map((_,ci)=>{
                              const colors=getColors(section,ci);
                              return(
                                <td key={ci} style={{padding:"8px",textAlign:"center"}}>
                                  {colors.length===0?<div style={{width:18,height:18,margin:"0 auto",border:`2px solid ${T.border}`,borderRadius:4}}/>:(
                                    <div style={{display:"flex",gap:2,justifyContent:"center",flexWrap:"wrap"}}>
                                      {colors.map((c,i)=><div key={i} style={{width:14,height:14,borderRadius:3,background:getSongColor(c.hex),boxShadow:`0 0 5px ${getSongColor(c.hex)}88`}}/>)}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ):(
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"10px 14px",borderRadius:12,background:T.card,border:`1px solid ${getSongColor(C)}44`}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:getSongColor(C),flexShrink:0,boxShadow:`0 0 6px ${getSongColor(C)}`}}/>
                    {editingSongName?(
                      <><input style={inp({borderColor:`${getSongColor(C)}66`,fontSize:13})} value={songNameValue} onChange={e=>setSongNameValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveSongName()} autoFocus/><button className="icon-btn" onClick={saveSongName} style={{color:getSongColor(C)}}>✓</button><button className="icon-btn" onClick={()=>setEditingSongName(false)} style={{color:T.subtext}}>✕</button></>
                    ):(
                      <><span style={{color:getSongColor(C),fontWeight:700,fontSize:14,flex:1}}>{song.name}</span><button className="icon-btn" onClick={()=>{setEditingSongName(true);setSongNameValue(song.name);}} style={{color:`${getSongColor(C)}88`}}>✏️</button></>
                    )}
                  </div>
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <div style={{flex:1,display:"flex",gap:8,padding:"10px 14px",borderRadius:12,background:T.card,border:`1px solid ${getSongColor(C)}33`}}>
                      <input style={inp({borderColor:`${getSongColor(C)}33`,fontSize:12})} placeholder="New section..." value={newSection} onChange={e=>setNewSection(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSection()}/>
                      <button onClick={addSection} style={{background:`${getSongColor(C)}22`,border:`1px solid ${getSongColor(C)}66`,color:getSongColor(C),borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>+ ADD</button>
                    </div>
                    <button onClick={()=>setInstrPanelOpen(!instrPanelOpen)} style={{background:instrPanelOpen?`${getSongColor(C)}33`:`${getSongColor(C)}11`,border:`1px solid ${getSongColor(C)}${instrPanelOpen?"99":"44"}`,borderRadius:12,padding:"0 12px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,minWidth:70}}>
                      <img src="/launchericon-192x192.png" style={{width:26,height:26,objectFit:"cover",mixBlendMode:"screen",filter:"sepia(1) saturate(3) hue-rotate(70deg) brightness(1.3)"}}/>
                      <span style={{color:getSongColor(C),fontSize:8,fontWeight:700,textAlign:"center"}}>INSTRUMENTS</span>
                    </button>
                  </div>
                  {instrPanelOpen&&(
                    <div style={{marginBottom:12,padding:"14px 16px",borderRadius:14,background:T.card,border:`1px solid ${AC}44`}}>
                      <h3 style={{color:AC,fontSize:12,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>MANAGE INSTRUMENTS</h3>
                      <div style={{display:"flex",gap:8,marginBottom:12}}>
                        <input style={inp({borderColor:`${AC}33`,fontSize:12})} placeholder="New instrument..." value={newInstrument} onChange={e=>setNewInstrument(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addInstrument()}/>
                        <button onClick={addInstrument} style={{background:`${AC}22`,border:`1px solid ${AC}66`,color:AC,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>+ ADD</button>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                        {instruments.map(inst=>(
                          <div key={inst} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,background:`${AC}11`,border:`1px solid ${AC}33`}}>
                            <span style={{color:T.text,fontSize:12}}>{inst}</span>
                            <button className="icon-btn" onClick={()=>removeInstrument(inst)} style={{color:"#ff4444",fontSize:11,padding:"0 2px"}}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10,padding:"8px 14px",borderRadius:10,background:T.cardBg,border:`1px solid ${T.border}`}}>
                    <span style={{color:T.subtext,fontSize:10,letterSpacing:"0.1em"}}>CLAIMED BY:</span>
                    {project.songs.map(s=><div key={s.id} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:getSongColor(s.color.hex),boxShadow:`0 0 4px ${getSongColor(s.color.hex)}`}}/><span style={{color:getSongColor(s.color.hex),fontSize:10,fontWeight:700}}>{s.name}</span></div>)}
                  </div>
                  <div className="table-wrap" style={{border:`1px solid ${getSongColor(C)}33`}}>
                    <table className="section-table">
                      <thead>
                        <tr style={{background:T.headBg}}>
                          <th className="sticky-col-head" style={{padding:"10px 12px",borderBottom:`1px solid ${getSongColor(C)}44`,textAlign:"left",fontSize:10,color:getSongColor(C),letterSpacing:"0.12em",minWidth:160,background:T.headBg}}>SECTION</th>
                          {instruments.map(inst=><th key={inst} style={{padding:"10px 8px",borderBottom:`1px solid ${getSongColor(C)}44`,textAlign:"center",fontSize:9,color:getSongColor(C),minWidth:72,whiteSpace:"nowrap",letterSpacing:"0.08em"}}>{inst.toUpperCase()}</th>)}
                          <th style={{padding:"10px 8px",borderBottom:`1px solid ${getSongColor(C)}44`,textAlign:"center",fontSize:9,color:getSongColor(C),minWidth:130,whiteSpace:"nowrap"}}>STATUS / ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {song.sections.map((section,ri)=>{
                          const isLocked=!!song.locked?.[ri];
                          const isStarred=!!song.starred?.[ri];
                          const status=song.status?.[ri]||"Draft";
                          const hasNote=!!getSectionNote(section);
                          const audioCount=(song.audioNotes?.[section]||[]).length;
                          const SC=getSongColor(C);
                          return(
                            <tr key={section+ri} draggable={!isLocked} onDragStart={()=>!isLocked&&setDraggedIndex(ri)} onDragOver={e=>e.preventDefault()} onDrop={()=>handleDrop(ri)} className="chrome-row" style={{borderBottom:`1px solid ${SC}18`,opacity:draggedIndex===ri?0.4:1,cursor:isLocked?"default":"grab",background:isStarred?`${SC}08`:"transparent"}}>
                              <td className="sticky-col" style={{padding:"6px 8px",fontSize:11,color:isLocked?T.subtext:T.text,fontWeight:600,minWidth:160,background:isStarred?`${SC}10`:T.stickyBg}}>
                                {editingIndex===ri?(
                                  <div style={{display:"flex",gap:4}}>
                                    <input style={inp({padding:"3px 6px",fontSize:11})} value={editingValue} onChange={e=>setEditingValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit()} autoFocus/>
                                    <button className="icon-btn" onClick={saveEdit} style={{color:SC,fontSize:12}}>✓</button>
                                    <button className="icon-btn" onClick={()=>setEditingIndex(null)} style={{color:T.subtext,fontSize:12}}>✕</button>
                                  </div>
                                ):(
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <button className="lines-btn" onTouchStart={()=>handleLinesTouchStart(ri,section)} onTouchEnd={()=>handleLinesTouchEnd(ri,section)} onClick={()=>!isDragging&&setSectionNoteOpen(section)} style={{position:"relative"}}>
                                      {[0,1,2].map(i=><div key={i} className="line" style={{background:hasNote?SC:`${SC}66`}}/>)}
                                      {hasNote&&<div style={{position:"absolute",top:2,right:2,width:6,height:6,borderRadius:"50%",background:SC,boxShadow:`0 0 4px ${SC}`}}/>}
                                      {audioCount>0&&<div style={{position:"absolute",bottom:2,right:2,background:SC,color:darkMode?"#000":"#fff",fontSize:7,fontWeight:700,borderRadius:4,padding:"0 2px",minWidth:10,textAlign:"center"}}>{audioCount}</div>}
                                    </button>
                                    <div style={{flex:1,overflow:"hidden"}}>
                                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                                        {isStarred&&<span style={{fontSize:10}}>⭐</span>}
                                        {isLocked&&<span style={{fontSize:10}}>🔒</span>}
                                        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{section}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                              {instruments.map((_,ci)=>{
                                const colors=getColors(section,ci);const myCheck=isMine(section,ci,song.id);
                                const others=colors.filter(c=>getSongColor(c.hex)!==SC);
                                return(
                                  <td key={ci} style={{padding:"6px 8px",textAlign:"center"}}>
                                    <div onClick={()=>!isLocked&&toggleChecked(section,ci,song.id)} style={{width:22,height:22,margin:"0 auto",border:`2px solid ${myCheck?SC:SC+"33"}`,borderRadius:5,background:T.checkBg,cursor:isLocked?"default":"pointer",position:"relative",boxShadow:myCheck?`0 0 6px ${SC}88`:"none",transition:"all 0.15s"}}>
                                      {others.length>0&&<div style={{position:"absolute",top:-5,right:-5,display:"flex",gap:1}}>{others.slice(0,3).map((c,i)=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:getSongColor(c.hex),boxShadow:`0 0 3px ${getSongColor(c.hex)}`}}/>)}</div>}
                                      {myCheck&&<div style={{position:"absolute",left:4,top:1,width:8,height:12,border:`2px solid ${SC}`,borderTop:"none",borderLeft:"none",transform:"rotate(45deg)"}}/>}
                                    </div>
                                  </td>
                                );
                              })}
                              <td style={{padding:"6px 8px",textAlign:"center",whiteSpace:"nowrap"}}>
                                <button onClick={()=>cycleStatus(ri)} style={{background:`${STATUS_COLORS[status]}22`,border:`1px solid ${STATUS_COLORS[status]}66`,color:STATUS_COLORS[status],borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:700,cursor:"pointer",marginBottom:4,display:"block",width:"100%"}}>{status.toUpperCase()}</button>
                                <div style={{display:"flex",justifyContent:"center",gap:2,flexWrap:"wrap"}}>
                                  <button className="icon-btn" onClick={()=>setAudioNoteOpen(section)} style={{position:"relative",color:audioCount>0?SC:T.subtext}}>🎙️{audioCount>0&&<span style={{position:"absolute",top:-2,right:-2,background:SC,color:darkMode?"#000":"#fff",fontSize:7,fontWeight:700,borderRadius:4,padding:"0 2px",minWidth:10,textAlign:"center"}}>{audioCount}</span>}</button>
                                  <button className="icon-btn" onClick={()=>toggleStarred(ri)} style={{color:isStarred?"#ffee00":T.subtext}}>⭐</button>
                                  <button className="icon-btn" onClick={()=>toggleLocked(ri)} style={{color:isLocked?"#ff9500":T.subtext}}>🔒</button>
                                  {!isLocked&&<button className="icon-btn" onClick={()=>startEdit(ri)} style={{color:`${SC}88`}}>✏️</button>}
                                  {!isLocked&&<button className="icon-btn" onClick={()=>removeSection(ri)} style={{color:"#ff444488"}}>🗑️</button>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginTop:12}}>
                    <div style={{borderRadius:14,padding:14,background:T.card,border:`1px solid ${getSongColor(C)}33`,position:"relative"}}>
                      <h2 style={{color:getSongColor(C),fontSize:12,fontWeight:700,marginBottom:8,letterSpacing:"0.1em"}}>NOTES</h2>
                      <textarea style={inp({height:72,resize:"none",fontFamily:"monospace",borderColor:`${getSongColor(C)}33`,paddingBottom:24})} placeholder="Session notes..." value={song.notes} onChange={e=>updateSong(song.id,()=>({notes:e.target.value}))}/>
                      <button onClick={()=>setNotesOpen(true)} style={{position:"absolute",bottom:18,right:18,background:`${getSongColor(C)}22`,border:`1px solid ${getSongColor(C)}66`,color:getSongColor(C),borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:700}}>↗</button>
                    </div>
                    <div style={{borderRadius:14,padding:14,background:T.card,border:`1px solid ${getSongColor(C)}33`}}>
                      <h2 style={{color:getSongColor(C),fontSize:12,fontWeight:700,marginBottom:8,letterSpacing:"0.1em"}}>TEMPO & KEY</h2>
                      <input style={inp({marginBottom:8,borderColor:`${getSongColor(C)}33`})} placeholder="BPM" value={song.bpm} onChange={e=>updateSong(song.id,()=>({bpm:e.target.value}))}/>
                      <input style={inp({borderColor:`${getSongColor(C)}33`})} placeholder="Key (e.g. A minor)" value={song.key} onChange={e=>updateSong(song.id,()=>({key:e.target.value}))}/>
                    </div>
                    <div style={{borderRadius:14,padding:14,background:T.card,border:`1px solid ${getSongColor(C)}33`}}>
                      <h2 style={{color:getSongColor(C),fontSize:12,fontWeight:700,marginBottom:8,letterSpacing:"0.1em"}}>TIPS</h2>
                      <ul style={{fontSize:11,color:T.subtext,lineHeight:2,listStyle:"none",padding:0}}>
                        <li><span style={{color:getSongColor(C)}}>▸</span> ☰ tap=notes · hold=drag</li>
                        <li><span style={{color:getSongColor(C)}}>▸</span> Set BPM for count-in tempo</li>
                        <li><span style={{color:getSongColor(C)}}>▸</span> Menu → 🎚️ MIX & MASTER (AI)</li>
                        <li><span style={{color:getSongColor(C)}}>▸</span> 🎨 dot = change app color</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {(phase==="loading"||phase==="fading")&&(
        <div className={phase==="fading"?"splash-fade":""} style={{position:"fixed",inset:0,zIndex:9999,background:"#000",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end"}}>
          <img src={SPLASH_IMG} alt="Dog Bones" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 50%)"}}/>
          {phase==="loading"&&(
            <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 32px 48px",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
              <span className="loading-text" style={{color:AC,fontSize:13,letterSpacing:"0.4em",fontFamily:"monospace",fontWeight:700}}>LOADING</span>
              <div style={{width:"100%",height:4,background:`${AC}22`,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${AC}88,${AC})`,borderRadius:2,boxShadow:`0 0 12px ${AC}`,transition:"width 0.03s linear"}}/>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
    }

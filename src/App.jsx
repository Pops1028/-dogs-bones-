import { useEffect, useState, useRef } from "react";

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
    reverb:0, notes:"",
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

const STORAGE_KEY   = "db_v12";
const STORAGE_AP    = "db_ap_v12";
const STORAGE_THEME = "db_theme_v12";
const STORAGE_ACCENT= "db_accent_v12";

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

// ── REVERB HELPER ──
async function createReverbNode(audioCtx, amount) {
  const convolver = audioCtx.createConvolver();
  const rate = audioCtx.sampleRate;
  const length = rate * (0.5 + amount * 3.5); // 0.5s–4s decay
  const impulse = audioCtx.createBuffer(2, length, rate);
  for (let c=0; c<2; c++) {
    const ch = impulse.getChannelData(c);
    for (let i=0; i<length; i++) {
      ch[i] = (Math.random()*2-1) * Math.pow(1-i/length, 1+amount*3);
    }
  }
  convolver.buffer = impulse;
  return convolver;
}

export default function App() {
  const [progress,           setProgress]           = useState(0);
  const [phase,              setPhase]              = useState("loading");
  const [menuOpen,           setMenuOpen]           = useState(false);
  const [screen,             setScreen]             = useState("songs");
  const [activeTab,          setActiveTab]          = useState(0);
  const [notesOpen,          setNotesOpen]          = useState(false);
  const [darkMode,           setDarkMode]           = useState(()=>load(STORAGE_THEME,true));
  const [accentColor,        setAccentColor]        = useState(()=>load(STORAGE_ACCENT,"#39ff14"));
  const [projects,           setProjects]           = useState(()=>load(STORAGE_KEY,[makeProject(0,"My First Song","#39ff14")]));
  const [activeProject,      setActiveProject]      = useState(()=>load(STORAGE_AP,0));
  const [newProjectName,     setNewProjectName]     = useState("");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameValue,   setProjectNameValue]   = useState("");
  const [editingSongName,    setEditingSongName]    = useState(false);
  const [songNameValue,      setSongNameValue]      = useState("");
  const [editingProjectSong, setEditingProjectSong] = useState(false);
  const [projectSongValue,   setProjectSongValue]   = useState("");
  const [draggedIndex,       setDraggedIndex]       = useState(null);
  const [draggedSetlist,     setDraggedSetlist]     = useState(null);
  const [editingIndex,       setEditingIndex]       = useState(null);
  const [editingValue,       setEditingValue]       = useState("");
  const [newSection,         setNewSection]         = useState("");
  const [newInstrument,      setNewInstrument]      = useState("");
  const [colorPickerOpen,    setColorPickerOpen]    = useState(false);
  const [customColor,        setCustomColor]        = useState("#39ff14");
  const [instrPanelOpen,     setInstrPanelOpen]     = useState(false);
  const [shareCopied,        setShareCopied]        = useState(false);
  const [sectionNoteOpen,    setSectionNoteOpen]    = useState(null);
  const [audioNoteOpen,      setAudioNoteOpen]      = useState(null);
  const [recording,          setRecording]          = useState(false);
  const [recordingTime,      setRecordingTime]      = useState(0);
  const [audioURLs,          setAudioURLs]          = useState({});
  const [playingId,          setPlayingId]          = useState(null);
  const [isDragging,         setIsDragging]         = useState(false);
  const [longPressTimer,     setLongPressTimer]     = useState(null);
  const [expandedTrack,      setExpandedTrack]      = useState(null);
  const [editingTrackName,   setEditingTrackName]   = useState(null);
  const [trackNameValue,     setTrackNameValue]     = useState("");
  const [studioRecordingTrack,setStudioRecordingTrack]=useState(null);
  const [studioRecordingTime, setStudioRecordingTime] =useState(0);
  const [studioPlaying,      setStudioPlaying]      = useState(false);
  const [studioAudioURLs,    setStudioAudioURLs]    = useState({});
  const [playingTrackId,     setPlayingTrackId]     = useState(null);
  const [countingIn,         setCountingIn]         = useState(null);
  const [countBeat,          setCountBeat]          = useState(0);

  const mediaRecorderRef   = useRef(null);
  const audioChunksRef     = useRef([]);
  const recordingTimerRef  = useRef(null);
  const audioRef           = useRef(null);
  const fileInputRef       = useRef(null);
  const studioMediaRef     = useRef(null);
  const studioChunksRef    = useRef([]);
  const studioTimerRef     = useRef(null);
  const studioAudioNodes   = useRef([]);
  const studioFileInputRef = useRef(null);
  const studioFileTrackId  = useRef(null);
  const trackAudioRefs     = useRef({});
  const countIntervalRef   = useRef(null);
  const audioCtxRef        = useRef(null);
  const playbackAudioNodes = useRef([]);

  useEffect(()=>{ save(STORAGE_KEY,   projects);      },[projects]);
  useEffect(()=>{ save(STORAGE_AP,    activeProject); },[activeProject]);
  useEffect(()=>{ save(STORAGE_THEME, darkMode);      },[darkMode]);
  useEffect(()=>{ save(STORAGE_ACCENT,accentColor);   },[accentColor]);

  useEffect(()=>{
    if (phase!=="loading") return;
    const iv=setInterval(()=>{
      setProgress(p=>{
        if (p>=100){ clearInterval(iv); setTimeout(()=>setPhase("fading"),300); return 100; }
        return p+1.2;
      });
    },30);
    return ()=>clearInterval(iv);
  },[phase]);

  useEffect(()=>{
    if (phase==="fading"){ const t=setTimeout(()=>setPhase("app"),1200); return ()=>clearTimeout(t); }
  },[phase]);

  const project      = projects.find(p=>p.id===activeProject)||projects[0];
  const song         = project?.songs?.[activeTab]||project?.songs?.[0];
  const instruments  = project?.instruments||DEFAULT_INSTRUMENTS;
  const isMerge      = activeTab===4;
  const isSetlist    = screen==="setlist";
  const isStudio     = screen==="studio";
  const projectColor = project?.color||accentColor;
  const C            = song?.color?.hex||projectColor;
  const tracks       = project?.studio?.tracks||makeDefaultTracks();
  const AC           = accentColor;

  const getCurrentBPM=()=>{
    const parsed=parseInt(song?.bpm);
    return isNaN(parsed)||parsed<=0?100:parsed;
  };
  const getSongColor=(hex)=>hex==="#39ff14"?AC:hex;

  const T = darkMode ? {
    bg:"#000", card:"linear-gradient(145deg,#0a0f0a,#111811)",
    cardBg:"#080d08", text:"#ccc", subtext:"#555",
    inputBg:"#050a05", inputBorder:"rgba(255,255,255,0.1)",
    rowHover:"rgba(255,255,255,0.02)", stickyBg:"#080d08",
    headBg:"#111811", border:"rgba(255,255,255,0.08)", checkBg:"#000",
  } : {
    bg:"#f2f4f8", card:"linear-gradient(145deg,#ffffff,#f5f7fc)",
    cardBg:"#ffffff", text:"#0a1628", subtext:"#4a5568",
    inputBg:"#ffffff", inputBorder:"rgba(10,22,40,0.2)",
    rowHover:"rgba(10,22,40,0.03)", stickyBg:"#ffffff",
    headBg:"#eef1f8", border:"rgba(10,22,40,0.1)", checkBg:"#fff",
  };

  const inp=(extra={})=>({
    background:T.inputBg, border:`1px solid ${T.inputBorder}`,
    color:T.text, borderRadius:8, padding:"8px 12px",
    width:"100%", outline:"none", fontSize:13, ...extra,
  });

  const updateProject=(id,fn)=>
    setProjects(prev=>prev.map(p=>p.id===id?{...p,...fn(p)}:p));
  const updateSong=(songId,fn)=>
    updateProject(project.id,p=>({songs:p.songs.map(s=>s.id===songId?{...s,...fn(s)}:s)}));
  const updateTrack=(trackId,fn)=>
    updateProject(project.id,p=>({
      studio:{...p.studio,tracks:(p.studio?.tracks||makeDefaultTracks()).map(t=>t.id===trackId?{...t,...fn(t)}:t)}
    }));

  const ckKey=(sn,ci)=>`${sn}--${ci}`;
  const toggleChecked=(sn,ci,songId)=>{
    const ri=song.sections.indexOf(sn);
    if (song.locked?.[ri]) return;
    const k=ckKey(sn,ci);
    updateProject(project.id,p=>{
      const cur=Array.isArray(p.checks?.[k])?p.checks[k]:[];
      return{checks:{...p.checks,[k]:cur.includes(songId)?cur.filter(id=>id!==songId):[...cur,songId]}};
    });
  };
  const getColors=(sn,ci)=>{
    const k=ckKey(sn,ci);
    return (Array.isArray(project.checks?.[k])?project.checks[k]:[])
      .map(id=>project.songs.find(s=>s.id===id)?.color).filter(Boolean);
  };
  const isMine=(sn,ci,songId)=>{
    const k=ckKey(sn,ci);
    return Array.isArray(project.checks?.[k])&&project.checks[k].includes(songId);
  };

  const addInstrument=()=>{
    if (!newInstrument.trim()||instruments.includes(newInstrument.trim())) return;
    updateProject(project.id,p=>({instruments:[...(p.instruments||DEFAULT_INSTRUMENTS),newInstrument.trim()]}));
    setNewInstrument("");
  };
  const removeInstrument=inst=>
    updateProject(project.id,p=>({instruments:(p.instruments||DEFAULT_INSTRUMENTS).filter(i=>i!==inst)}));

  const toggleLocked =ri=>updateSong(song.id,s=>({locked:{...s.locked,[ri]:!s.locked?.[ri]}}));
  const toggleStarred=ri=>updateSong(song.id,s=>({starred:{...s.starred,[ri]:!s.starred?.[ri]}}));
  const cycleStatus  =ri=>{
    if (song.locked?.[ri]) return;
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
    if (!isDragging) setSectionNoteOpen(section);
    setIsDragging(false);
  };
  const handleDrop=ti=>{
    if (draggedIndex===null||song.locked?.[draggedIndex]) return;
    const upd=[...song.sections];const [it]=upd.splice(draggedIndex,1);upd.splice(ti,0,it);
    updateSong(song.id,()=>({sections:upd}));setDraggedIndex(null);
  };
  const addSection=()=>{
    if (!newSection.trim()) return;
    updateSong(song.id,s=>({sections:[...s.sections,newSection.trim()]}));setNewSection("");
  };
  const removeSection=i=>{
    if (song.locked?.[i]) return;
    updateSong(song.id,s=>({sections:s.sections.filter((_,idx)=>idx!==i)}));
  };
  const startEdit=i=>{if(song.locked?.[i])return;setEditingIndex(i);setEditingValue(song.sections[i]);};
  const saveEdit=()=>{
    if (!editingValue.trim()) return;
    updateSong(song.id,s=>{const u=[...s.sections];u[editingIndex]=editingValue.trim();return{sections:u};});
    setEditingIndex(null);
  };

  const addProject=()=>{
    if (!newProjectName.trim()) return;
    const id=Date.now();
    setProjects(prev=>[...prev,makeProject(id,newProjectName.trim(),AC)]);
    setActiveProject(id);setNewProjectName("");setMenuOpen(false);setActiveTab(0);
  };
  const deleteProject=id=>{
    if (projects.length===1) return;
    setProjects(prev=>prev.filter(p=>p.id!==id));
    if (activeProject===id) setActiveProject(projects[0].id);
  };
  const switchProject=id=>{setActiveProject(id);setMenuOpen(false);setActiveTab(0);setScreen("songs");};
  const saveProjectName=()=>{if(!projectNameValue.trim())return;updateProject(project.id,()=>({name:projectNameValue.trim()}));setEditingProjectName(false);};
  const saveProjectSongName=()=>{if(!projectSongValue.trim())return;updateProject(project.id,()=>({songName:projectSongValue.trim()}));setEditingProjectSong(false);};
  const saveSongName=()=>{if(!songNameValue.trim())return;updateSong(song.id,()=>({name:songNameValue.trim()}));setEditingSongName(false);};

  const shareApp=()=>{
    const url=window.location.origin;
    const text="🎸 Dog Bones — Song Section Organizer. Open in Chrome then Add to Home Screen!";
    if (navigator.share){ navigator.share({title:"Dog Bones",text,url}); }
    else { navigator.clipboard.writeText(`${text}\n${url}`).then(()=>{setShareCopied(true);setTimeout(()=>setShareCopied(false),2500);}); }
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
        const id=Date.now().toString();
        const dur=recordingTime;
        setAudioURLs(prev=>({...prev,[id]:url}));
        const a=document.createElement("a");
        a.href=url;a.download=`DogBones_${sn}_${id}.webm`;a.click();
        updateSong(song.id,s=>({audioNotes:{...s.audioNotes,[sn]:[...(s.audioNotes?.[sn]||[]),{id,duration:dur,label:`Voice memo ${(s.audioNotes?.[sn]||[]).length+1}`}]}}));
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start();
      mediaRecorderRef.current=mr;
      setRecording(true);setRecordingTime(0);
      recordingTimerRef.current=setInterval(()=>setRecordingTime(t=>t+1),1000);
    }catch(e){ alert("Microphone access denied."); }
  };
  const stopRecording=()=>{
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setRecording(false);
  };
  const handleFileUpload=(sn,e)=>{
    const file=e.target.files?.[0];
    if (!file) return;
    const url=URL.createObjectURL(file);
    const id=Date.now().toString();
    setAudioURLs(prev=>({...prev,[id]:url}));
    updateSong(song.id,s=>({audioNotes:{...s.audioNotes,[sn]:[...(s.audioNotes?.[sn]||[]),{id,duration:0,label:file.name.replace(/\.[^/.]+$/,"")}]}}));
    e.target.value="";
  };
  const deleteAudioNote=(sn,id)=>{
    updateSong(song.id,s=>({audioNotes:{...s.audioNotes,[sn]:(s.audioNotes?.[sn]||[]).filter(a=>a.id!==id)}}));
    setAudioURLs(prev=>{const n={...prev};delete n[id];return n;});
    if (playingId===id){audioRef.current?.pause();setPlayingId(null);}
  };
  const playAudio=id=>{
    const url=audioURLs[id];
    if (audioRef.current){audioRef.current.pause();audioRef.current=null;}
    if (playingId===id){setPlayingId(null);return;}
    if (!url){alert("Re-record or re-upload after refresh.");return;}
    const a=new Audio(url);
    a.play();a.onended=()=>setPlayingId(null);
    audioRef.current=a;setPlayingId(id);
  };

  // ── COUNT IN ──
  const playClick=(ac,time,isAccent)=>{
    const osc=ac.createOscillator();
    const gain=ac.createGain();
    osc.connect(gain);gain.connect(ac.destination);
    osc.frequency.value=isAccent?1200:800;
    gain.gain.setValueAtTime(0.8,time);
    gain.gain.exponentialRampToValueAtTime(0.001,time+0.05);
    osc.start(time);osc.stop(time+0.06);
  };

  const startCountIn=trackId=>{
    if (countingIn!==null) return;
    const bpm=getCurrentBPM();
    const beatInterval=60/bpm;
    const ac=new (window.AudioContext||window.webkitAudioContext)();
    audioCtxRef.current=ac;
    let beat=0;
    setCountingIn(trackId);setCountBeat(0);
    for(let i=0;i<8;i++) playClick(ac,ac.currentTime+(i*beatInterval),i===0||i===4);
    countIntervalRef.current=setInterval(()=>{
      beat++;
      setCountBeat(beat);
      if (beat>=8){
        clearInterval(countIntervalRef.current);
        setCountingIn(null);setCountBeat(0);
        // Start playback of other tracks + recording simultaneously
        setTimeout(()=>{
          startPlaybackDuringRecording(trackId);
          startStudioRecording(trackId);
        },50);
      }
    },beatInterval*1000);
  };

  const cancelCountIn=()=>{
    clearInterval(countIntervalRef.current);
    audioCtxRef.current?.close();
    setCountingIn(null);setCountBeat(0);
  };

  // ── PLAY OTHER TRACKS DURING RECORDING ──
  const startPlaybackDuringRecording=async(recordingTrackId)=>{
    playbackAudioNodes.current.forEach(a=>{try{a.pause();}catch{}});
    playbackAudioNodes.current=[];

    const ac=new (window.AudioContext||window.webkitAudioContext)();
    const hasSolo=tracks.some(t=>t.solo&&t.id!==recordingTrackId);

    for (const track of tracks) {
      if (track.id===recordingTrackId) continue;
      if (track.muted) continue;
      if (hasSolo&&!track.solo) continue;
      const latestRec=track.recordings[track.recordings.length-1];
      if (!latestRec) continue;
      const url=studioAudioURLs[latestRec.id];
      if (!url) continue;

      try {
        const response=await fetch(url);
        const arrayBuffer=await response.arrayBuffer();
        const audioBuffer=await ac.decodeAudioData(arrayBuffer);

        const source=ac.createBufferSource();
        source.buffer=audioBuffer;

        // Gain node for volume
        const gainNode=ac.createGain();
        gainNode.gain.value=track.volume;

        if (track.reverb>0) {
          const convolver=await createReverbNode(ac,track.reverb);
          const dryGain=ac.createGain();
          const wetGain=ac.createGain();
          dryGain.gain.value=1-track.reverb*0.6;
          wetGain.gain.value=track.reverb*0.8;
          source.connect(dryGain);
          source.connect(convolver);
          convolver.connect(wetGain);
          dryGain.connect(gainNode);
          wetGain.connect(gainNode);
        } else {
          source.connect(gainNode);
        }

        gainNode.connect(ac.destination);
        source.start(0);
        playbackAudioNodes.current.push({pause:()=>source.stop(),currentTime:0});
      } catch(e) {
        // Fall back to HTML Audio if Web Audio fails
        const a=new Audio(url);
        a.volume=track.volume;
        a.play().catch(()=>{});
        playbackAudioNodes.current.push(a);
      }
    }
  };

  const stopPlaybackDuringRecording=()=>{
    playbackAudioNodes.current.forEach(a=>{try{a.pause();if(a.currentTime!==undefined)a.currentTime=0;}catch{}});
    playbackAudioNodes.current=[];
  };

  // ── STUDIO RECORDING ──
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
        const id=Date.now().toString();
        const dur=studioRecordingTime;
        const track=tracks.find(t=>t.id===trackId);
        setStudioAudioURLs(prev=>({...prev,[id]:url}));
        const a=document.createElement("a");
        a.href=url;a.download=`DogBones_${track?.name||"track"}_${id}.webm`;a.click();
        updateTrack(trackId,t=>({recordings:[...t.recordings,{id,duration:dur,label:`Take ${t.recordings.length+1}`}]}));
        stream.getTracks().forEach(t=>t.stop());
      };
      mr.start();
      studioMediaRef.current=mr;
      setStudioRecordingTrack(trackId);setStudioRecordingTime(0);
      studioTimerRef.current=setInterval(()=>setStudioRecordingTime(t=>t+1),1000);
    }catch(e){ alert("Microphone access denied."); }
  };

  const stopStudioRecording=()=>{
    studioMediaRef.current?.stop();
    clearInterval(studioTimerRef.current);
    setStudioRecordingTrack(null);
  };

  // ── PLAY WITH REVERB ──
  const playTrackWithReverb=async(trackId)=>{
    const track=tracks.find(t=>t.id===trackId);
    const latestRec=track?.recordings[track.recordings.length-1];
    if (!latestRec){alert("No recording yet.");return;}
    const url=studioAudioURLs[latestRec.id];
    if (!url){alert("Re-upload file to play.");return;}

    if (playingTrackId===trackId){
      trackAudioRefs.current[trackId]?.stop?.();
      trackAudioRefs.current[trackId]?.pause?.();
      delete trackAudioRefs.current[trackId];
      setPlayingTrackId(null);
      return;
    }

    // Stop others
    if (playingTrackId!==null){
      trackAudioRefs.current[playingTrackId]?.stop?.();
      trackAudioRefs.current[playingTrackId]?.pause?.();
      delete trackAudioRefs.current[playingTrackId];
    }

    if (track.reverb>0) {
      try {
        const ac=new (window.AudioContext||window.webkitAudioContext)();
        const response=await fetch(url);
        const arrayBuffer=await response.arrayBuffer();
        const audioBuffer=await ac.decodeAudioData(arrayBuffer);
        const source=ac.createBufferSource();
        source.buffer=audioBuffer;
        const gainNode=ac.createGain();
        gainNode.gain.value=track.volume;
        const convolver=await createReverbNode(ac,track.reverb);
        const dryGain=ac.createGain();
        const wetGain=ac.createGain();
        dryGain.gain.value=1-track.reverb*0.6;
        wetGain.gain.value=track.reverb*0.8;
        source.connect(dryGain);
        source.connect(convolver);
        convolver.connect(wetGain);
        dryGain.connect(gainNode);
        wetGain.connect(gainNode);
        gainNode.connect(ac.destination);
        source.start(0);
        source.onended=()=>{setPlayingTrackId(null);delete trackAudioRefs.current[trackId];};
        trackAudioRefs.current[trackId]={stop:()=>{source.stop();ac.close();}};
        setPlayingTrackId(trackId);
        return;
      } catch(e) { /* fall through to HTML Audio */ }
    }

    // No reverb — use simple HTML Audio
    const a=new Audio(url);
    a.volume=track.volume;
    a.play();
    a.onended=()=>{setPlayingTrackId(null);delete trackAudioRefs.current[trackId];};
    trackAudioRefs.current[trackId]={pause:()=>{a.pause();a.currentTime=0;}};
    setPlayingTrackId(trackId);
  };

  const stopTrack=trackId=>{
    trackAudioRefs.current[trackId]?.stop?.();
    trackAudioRefs.current[trackId]?.pause?.();
    delete trackAudioRefs.current[trackId];
    if (playingTrackId===trackId) setPlayingTrackId(null);
  };

  const handleStudioFileUpload=(trackId,e)=>{
    const file=e.target.files?.[0];
    if (!file) return;
    const url=URL.createObjectURL(file);
    const id=Date.now().toString();
    setStudioAudioURLs(prev=>({...prev,[id]:url}));
    updateTrack(trackId,t=>({recordings:[...t.recordings,{id,duration:0,label:file.name.replace(/\.[^/.]+$/,"")}]}));
    e.target.value="";
  };

  const deleteStudioRecording=(trackId,recId)=>{
    updateTrack(trackId,t=>({recordings:t.recordings.filter(r=>r.id!==recId)}));
    setStudioAudioURLs(prev=>{const n={...prev};delete n[recId];return n;});
    if (playingTrackId===trackId) stopTrack(trackId);
  };

  const playAllTracks=async()=>{
    studioAudioNodes.current.forEach(a=>{try{a.pause?.();a.stop?.();}catch{}});
    studioAudioNodes.current=[];
    const hasSolo=tracks.some(t=>t.solo);
    const ac=new (window.AudioContext||window.webkitAudioContext)();

    for (const track of tracks) {
      if (track.muted||(hasSolo&&!track.solo)) continue;
      const latestRec=track.recordings[track.recordings.length-1];
      if (!latestRec) continue;
      const url=studioAudioURLs[latestRec.id];
      if (!url) continue;
      try {
        const response=await fetch(url);
        const arrayBuffer=await response.arrayBuffer();
        const audioBuffer=await ac.decodeAudioData(arrayBuffer);
        const source=ac.createBufferSource();
        source.buffer=audioBuffer;
        const gainNode=ac.createGain();
        gainNode.gain.value=track.volume;
        if (track.reverb>0) {
          const convolver=await createReverbNode(ac,track.reverb);
          const dryGain=ac.createGain();
          const wetGain=ac.createGain();
          dryGain.gain.value=1-track.reverb*0.6;
          wetGain.gain.value=track.reverb*0.8;
          source.connect(dryGain);
          source.connect(convolver);
          convolver.connect(wetGain);
          dryGain.connect(gainNode);
          wetGain.connect(gainNode);
        } else {
          source.connect(gainNode);
        }
        gainNode.connect(ac.destination);
        source.start(0);
        studioAudioNodes.current.push({stop:()=>source.stop()});
      } catch(e) {
        const a=new Audio(url);
        a.volume=track.volume;
        a.play().catch(()=>{});
        studioAudioNodes.current.push(a);
      }
    }
    setStudioPlaying(true);
    setTimeout(()=>setStudioPlaying(false),60000);
  };

  const stopAllTracks=()=>{
    studioAudioNodes.current.forEach(a=>{try{a.stop?.();a.pause?.();}catch{}});
    studioAudioNodes.current=[];
    Object.values(trackAudioRefs.current).forEach(a=>{try{a.stop?.();a.pause?.();}catch{}});
    trackAudioRefs.current={};
    stopPlaybackDuringRecording();
    setStudioPlaying(false);
    setPlayingTrackId(null);
  };

  const addToSetlist=n=>updateProject(project.id,p=>({setlist:[...(p.setlist||[]),{id:Date.now(),name:n}]}));
  const removeFromSetlist=id=>updateProject(project.id,p=>({setlist:p.setlist.filter(s=>s.id!==id)}));
  const handleSetlistDragStart=i=>setDraggedSetlist(i);
  const handleSetlistDrop=ti=>{
    if (draggedSetlist===null) return;
    const u=[...(project.setlist||[])];const [it]=u.splice(draggedSetlist,1);u.splice(ti,0,it);
    updateProject(project.id,()=>({setlist:u}));setDraggedSetlist(null);
  };

  const allSections=[...new Set(project.songs.flatMap(s=>s.sections))];

  const modalHeader=(color)=>({
    display:"flex",alignItems:"center",gap:10,padding:"14px 16px",
    borderBottom:`1px solid ${color}44`,
    background:darkMode?"#0a0f0a":"#f0f4ff",
  });
  const doneBtn=(color)=>({
    background:`${color}22`,border:`1px solid ${color}66`,
    color,borderRadius:8,padding:"6px 14px",
    cursor:"pointer",fontSize:12,fontWeight:700,
  });

  // Reverb step
  const changeReverb=(trackId,delta,TC)=>{
    updateTrack(trackId,t=>{
      const newVal=Math.max(0,Math.min(1,Math.round((t.reverb+delta)*10)/10));
      return{reverb:newVal};
    });
  };

  return (
    <>
      <style>{`
        @keyframes pulse-glow{0%,100%{text-shadow:0 0 8px ${AC},0 0 20px ${AC};}50%{text-shadow:0 0 20px ${AC},0 0 40px ${AC};}}
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
        *{box-sizing:border-box;}
        body{background:${T.bg};margin:0;transition:background 0.3s;}
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
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;outline:none;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;cursor:pointer;}
      `}</style>

      {/* SECTION NOTE MODAL */}
      {sectionNoteOpen&&song&&(
        <div className="pop-in" style={{position:"fixed",inset:0,zIndex:7500,background:T.bg,display:"flex",flexDirection:"column"}}>
          <div style={modalHeader(AC)}>
            <div style={{width:8,height:8,borderRadius:"50%",background:AC,boxShadow:`0 0 6px ${AC}`}}/>
            <span style={{color:AC,fontWeight:700,fontSize:14,flex:1}}>📝 {sectionNoteOpen}</span>
            <button onClick={()=>setSectionNoteOpen(null)} style={doneBtn(AC)}>✓ DONE</button>
          </div>
          <textarea style={{flex:1,resize:"none",fontFamily:"monospace",fontSize:15,border:"none",padding:"20px",lineHeight:1.8,background:T.bg,color:T.text,outline:"none"}}
            placeholder={`Notes for ${sectionNoteOpen}...`}
            value={getSectionNote(sectionNoteOpen)}
            onChange={e=>setSectionNote(sectionNoteOpen,e.target.value)} autoFocus/>
        </div>
      )}

      {/* AUDIO NOTE MODAL */}
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
                <button onClick={()=>playAudio(a.id)} style={{width:36,height:36,borderRadius:"50%",border:`2px solid ${AC}`,background:playingId===a.id?`${AC}33`:"transparent",color:AC,cursor:"pointer",fontSize:16}}>
                  {playingId===a.id?"⏸":"▶"}
                </button>
                <span style={{color:T.text,fontSize:12,flex:1}}>{a.label}</span>
                <button className="icon-btn" onClick={()=>deleteAudioNote(audioNoteOpen,a.id)} style={{color:"#ff4444"}}>🗑️</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FULLSCREEN NOTES */}
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

      {/* MENU */}
      {menuOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:8000}} onClick={()=>setMenuOpen(false)}>
          <div className="menu-panel" onClick={e=>e.stopPropagation()} style={{
            position:"absolute",top:0,left:0,bottom:0,width:"82%",maxWidth:320,
            background:darkMode?"#080d08":"#ffffff",
            borderRight:`1px solid ${AC}44`,
            display:"flex",flexDirection:"column",overflow:"hidden",
          }}>
            <div style={{padding:"20px 16px 12px",borderBottom:`1px solid ${AC}33`,background:darkMode?"#0a0f0a":"#f0f4ff"}}>
              <img src={LOGO_TEXT} alt="Dog Bones" style={{width:"100%",maxWidth:200,height:40,objectFit:"cover",objectPosition:"center",mixBlendMode:"screen",display:"block",marginBottom:4}}/>
              <p style={{color:`${AC}88`,fontSize:9,letterSpacing:"0.3em",margin:0}}>PROJECTS</p>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"12px 0"}}>
              {projects.map(p=>(
                <div key={p.id} onClick={()=>switchProject(p.id)} style={{
                  display:"flex",alignItems:"center",gap:8,padding:"12px 16px",cursor:"pointer",
                  background:p.id===activeProject?`${p.color}11`:"transparent",
                  borderLeft:p.id===activeProject?`3px solid ${p.color}`:"3px solid transparent",
                }}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0,boxShadow:`0 0 6px ${p.color}`}}/>
                  <div style={{flex:1,overflow:"hidden"}}>
                    <div style={{fontSize:13,fontWeight:600,color:p.id===activeProject?p.color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                    {p.songName&&<div style={{fontSize:10,color:`${p.color}88`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.songName}</div>}
                  </div>
                  {projects.length>1&&(
                    <button className="icon-btn" onClick={e=>{e.stopPropagation();deleteProject(p.id);}} style={{color:"#ff4444"}}>🗑️</button>
                  )}
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
              {[{label:"🎵 SONG ARRANGER",val:"songs"},{label:"🎛️ STUDIO",val:"studio"},{label:"📋 SETLIST BUILDER",val:"setlist"}].map(({label,val})=>(
                <button key={val} onClick={()=>{setScreen(val);setMenuOpen(false);}} style={{
                  background:screen===val?`${AC}22`:"transparent",
                  border:`1px solid ${screen===val?AC+"66":"rgba(128,128,128,0.2)"}`,
                  color:screen===val?AC:T.subtext,
                  borderRadius:8,padding:"8px 12px",cursor:"pointer",
                  fontSize:12,fontWeight:700,letterSpacing:"0.1em",textAlign:"left",
                }}>{label}</button>
              ))}
              <button onClick={()=>setDarkMode(!darkMode)} style={{
                background:darkMode?"rgba(255,238,0,0.08)":"rgba(10,22,40,0.05)",
                border:`1px solid ${darkMode?"rgba(255,238,0,0.3)":"rgba(10,22,40,0.15)"}`,
                color:darkMode?"#ffee00":"#0a1628",
                borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:"0.1em",textAlign:"left",
              }}>{darkMode?"☀️ LIGHT MODE":"🌙 DARK MODE"}</button>
              <button onClick={shareApp} style={{
                background:shareCopied?`${AC}33`:`${AC}11`,border:`1px solid ${AC}66`,color:AC,
                borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:"0.1em",textAlign:"left",transition:"all 0.2s",
              }}>{shareCopied?"✅ LINK COPIED!":"📤 SHARE APP WITH BAND"}</button>
              <p style={{color:T.subtext,fontSize:10,lineHeight:1.6,margin:0}}>Open in Chrome → Add to Home Screen!</p>
            </div>
          </div>
        </div>
      )}

      {/* APP */}
      <div style={{minHeight:"100vh",background:T.bg,color:T.text,transition:"background 0.3s"}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"12px"}}>

          {/* Top Bar */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 14px",borderRadius:14,background:T.card,border:`1px solid ${AC}44`}}>
            <button onClick={()=>setMenuOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:8,flexShrink:0}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {[0,1,2].map(i=><div key={i} style={{width:20,height:2,borderRadius:1,background:AC,boxShadow:`0 0 4px ${AC}`}}/>)}
              </div>
            </button>
            <img src={LOGO_TEXT} alt="Dog Bones" style={{height:36,objectFit:"contain",mixBlendMode:darkMode?"screen":"multiply",flexShrink:0}}/>
            <div style={{flex:1,overflow:"hidden"}}>
              {editingProjectName?(
                <div style={{display:"flex",gap:4}}>
                  <input style={inp({padding:"4px 8px",fontSize:12,borderColor:`${AC}66`})}
                    value={projectNameValue} onChange={e=>setProjectNameValue(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&saveProjectName()} autoFocus/>
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
                      <input style={inp({padding:"3px 8px",fontSize:11,borderColor:`${AC}44`})}
                        value={projectSongValue} onChange={e=>setProjectSongValue(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&saveProjectSongName()} autoFocus placeholder="Song name..."/>
                      <button className="icon-btn" onClick={saveProjectSongName} style={{color:AC,fontSize:11}}>✓</button>
                      <button className="icon-btn" onClick={()=>setEditingProjectSong(false)} style={{color:T.subtext,fontSize:11}}>✕</button>
                    </div>
                  ):(
                    <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                      <span style={{color:`${AC}99`,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:project?.songName?"normal":"italic"}}>
                        {project?.songName||"+ tap to add song name"}
                      </span>
                      <button className="icon-btn" onClick={()=>{setEditingProjectSong(true);setProjectSongValue(project?.songName||"");}} style={{color:`${AC}55`,fontSize:10,flexShrink:0}}>✏️</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{position:"relative",flexShrink:0}}>
              <button onClick={()=>setColorPickerOpen(!colorPickerOpen)} style={{width:26,height:26,borderRadius:"50%",background:AC,border:"none",cursor:"pointer",boxShadow:`0 0 10px ${AC}`}}/>
              {colorPickerOpen&&(
                <div style={{position:"absolute",top:32,right:0,zIndex:200,background:darkMode?"#111":"#fff",borderRadius:14,padding:14,border:`1px solid ${AC}44`,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",minWidth:220}}>
                  <p style={{color:T.subtext,fontSize:9,letterSpacing:"0.2em",marginBottom:8}}>PRESETS</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:7,marginBottom:14}}>
                    {PROJECT_COLORS.map(c=>(
                      <button key={c} onClick={()=>{setAccentColor(c);updateProject(project.id,()=>({color:c}));setColorPickerOpen(false);}} style={{width:26,height:26,borderRadius:"50%",background:c,border:c===AC?"2px solid #fff":"none",cursor:"pointer",boxShadow:`0 0 6px ${c}`}}/>
                    ))}
                  </div>
                  <div style={{height:1,background:T.border,marginBottom:12}}/>
                  <p style={{color:T.subtext,fontSize:9,letterSpacing:"0.2em",marginBottom:8}}>CUSTOM</p>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input type="color" value={customColor} onChange={e=>setCustomColor(e.target.value)}
                      style={{width:44,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2,background:"none"}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,color:T.subtext,marginBottom:4}}>{customColor}</div>
                      <button onClick={()=>{setAccentColor(customColor);updateProject(project.id,()=>({color:customColor}));setColorPickerOpen(false);}}
                        style={{width:"100%",background:`${customColor}22`,border:`1px solid ${customColor}66`,color:customColor,borderRadius:8,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:700}}>✓ APPLY</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{width:40,height:40,borderRadius:8,overflow:"hidden",border:`1px solid ${AC}44`,flexShrink:0,boxShadow:`0 0 10px ${AC}44`}}>
              <img src="/launchericon-192x192.png" alt="Logo" style={{width:40,height:40,objectFit:"cover",mixBlendMode:"screen",filter:"sepia(1) saturate(3) hue-rotate(70deg) brightness(1.2)"}}/>
            </div>
          </div>

          {/* ── STUDIO ── */}
          {isStudio&&(
            <div>
              {/* Studio Header */}
              <div style={{padding:"14px 16px",borderRadius:14,marginBottom:12,background:T.card,border:`1px solid ${AC}44`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <h2 style={{color:AC,fontSize:18,fontWeight:700,margin:0}}>🎛️ STUDIO</h2>
                    <p style={{color:T.subtext,fontSize:10,margin:"2px 0 0"}}>{project?.name?.toUpperCase()} — {song?.bpm?`${song.bpm} BPM`:"SET BPM IN SONG ARRANGER"}</p>
                  </div>
                  <button onClick={studioPlaying?stopAllTracks:playAllTracks} style={{
                    background:studioPlaying?"#ff444422":`${AC}22`,
                    border:`2px solid ${studioPlaying?"#ff4444":AC}`,
                    color:studioPlaying?"#ff4444":AC,
                    borderRadius:10,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:700,
                  }}>{studioPlaying?"⏹ STOP ALL":"▶ PLAY ALL"}</button>
                </div>

                {/* Share tip */}
                <div style={{padding:"10px 12px",borderRadius:10,background:`${AC}08`,border:`1px solid ${AC}22`}}>
                  <p style={{color:AC,fontSize:10,fontWeight:700,margin:"0 0 4px",letterSpacing:"0.08em"}}>📱 BAND WORKFLOW</p>
                  <p style={{color:T.subtext,fontSize:10,margin:0,lineHeight:1.7}}>
                    Record → auto-saves to Downloads → text .webm file to bandmate → they upload to their track → record their part while hearing yours
                  </p>
                </div>
              </div>

              {/* Tracks */}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {tracks.map(track=>{
                  const isRecordingThis=studioRecordingTrack===track.id;
                  const isCountingInThis=countingIn===track.id;
                  const isPlayingThis=playingTrackId===track.id;
                  const latestRec=track.recordings[track.recordings.length-1];
                  const hasAudio=latestRec&&studioAudioURLs[latestRec.id];
                  const TC=track.color;
                  const isExpanded=expandedTrack===track.id;
                  const reverbPct=Math.round((track.reverb||0)*100);

                  return(
                    <div key={track.id} style={{
                      borderRadius:14,overflow:"hidden",
                      border:`1px solid ${TC}${track.muted?"22":"55"}`,
                      background:T.card,
                      opacity:track.muted?0.7:1,
                      transition:"all 0.2s",
                      boxShadow:isRecordingThis?`0 0 20px ${TC}66`:isCountingInThis?`0 0 20px #ffee0066`:"none",
                    }}>

                      {/* ── TRACK HEADER (always visible) ── */}
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:`${TC}11`}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:TC,flexShrink:0,boxShadow:`0 0 6px ${TC}`}}/>

                        {/* Name */}
                        {editingTrackName===track.id?(
                          <div style={{display:"flex",gap:4,flex:1}}>
                            <input style={inp({padding:"3px 8px",fontSize:12,borderColor:`${TC}66`})}
                              value={trackNameValue} onChange={e=>setTrackNameValue(e.target.value)}
                              onKeyDown={e=>{if(e.key==="Enter"){updateTrack(track.id,()=>({name:trackNameValue.trim()}));setEditingTrackName(null);}}}
                              autoFocus/>
                            <button className="icon-btn" onClick={()=>{updateTrack(track.id,()=>({name:trackNameValue.trim()}));setEditingTrackName(null);}} style={{color:TC}}>✓</button>
                          </div>
                        ):(
                          <span onClick={()=>{setEditingTrackName(track.id);setTrackNameValue(track.name);}}
                            style={{color:TC,fontWeight:700,fontSize:13,flex:1,cursor:"pointer"}}>
                            {track.name}
                          </span>
                        )}

                        {/* Count-in dots */}
                        {isCountingInThis&&(
                          <div style={{display:"flex",gap:3,alignItems:"center"}}>
                            {[1,2,3,4,5,6,7,8].map(b=>(
                              <div key={b} style={{
                                width:b<=countBeat?8:5,height:b<=countBeat?8:5,
                                borderRadius:"50%",
                                background:b===1||b===5?"#ffee00":b<=countBeat?TC:"rgba(255,255,255,0.15)",
                                transition:"all 0.05s",
                              }}/>
                            ))}
                          </div>
                        )}

                        {/* Recording timer */}
                        {isRecordingThis&&(
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            <div className="rec-dot" style={{width:8,height:8,borderRadius:"50%",background:"#ff4444"}}/>
                            <span style={{color:"#ff4444",fontSize:11,fontWeight:700}}>{fmtTime(studioRecordingTime)}</span>
                          </div>
                        )}

                        {/* Status indicators */}
                        {track.muted&&<span style={{color:"#ff4444",fontSize:9,fontWeight:700,background:"#ff444422",border:"1px solid #ff444466",borderRadius:4,padding:"1px 5px"}}>MUTE</span>}
                        {track.solo&&<span style={{color:TC,fontSize:9,fontWeight:700,background:`${TC}22`,border:`1px solid ${TC}66`,borderRadius:4,padding:"1px 5px"}}>SOLO</span>}
                        {reverbPct>0&&<span style={{color:TC,fontSize:9,opacity:0.7}}>RVB {reverbPct}%</span>}

                        {/* Expand/collapse dropdown */}
                        <button onClick={()=>setExpandedTrack(isExpanded?null:track.id)} style={{
                          background:isExpanded?`${TC}22`:"transparent",
                          border:`1px solid ${TC}${isExpanded?"66":"33"}`,
                          color:TC,borderRadius:8,padding:"4px 10px",
                          cursor:"pointer",fontSize:11,fontWeight:700,
                          transition:"all 0.2s",
                        }}>{isExpanded?"▲":"▼"}</button>
                      </div>

                      {/* Waveform bar (always visible) */}
                      <div style={{height:32,background:darkMode?"#050a05":"#f0f4f0",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",gap:2,padding:"0 12px",borderTop:`1px solid ${TC}22`,borderBottom:isExpanded?`1px solid ${TC}22`:"none"}}>
                        {isRecordingThis||isCountingInThis?(
                          [...Array(24)].map((_,i)=>(
                            <div key={i} style={{width:3,borderRadius:2,background:isCountingInThis?"#ffee00":TC,animation:`vuPulse ${0.3+Math.random()*0.5}s ease-in-out infinite`,animationDelay:`${i*0.04}s`,minHeight:3}}/>
                          ))
                        ):latestRec?(
                          [...Array(24)].map((_,i)=>(
                            <div key={i} style={{width:3,borderRadius:2,height:`${15+Math.sin(i*0.8)*40+Math.cos(i*1.3)*20}%`,background:`${TC}${hasAudio?"bb":"33"}`}}/>
                          ))
                        ):(
                          <span style={{color:T.subtext,fontSize:10,letterSpacing:"0.05em"}}>No recording — tap REC to start</span>
                        )}
                      </div>

                      {/* ── MAIN ACTION BUTTONS (always visible) ── */}
                      <div style={{display:"flex",gap:6,padding:"10px 12px",borderBottom:isExpanded?`1px solid ${TC}22`:"none"}}>
                        {/* PLAY */}
                        <button onClick={()=>playTrackWithReverb(track.id)} disabled={!latestRec}
                          style={{flex:1,padding:"9px 4px",borderRadius:10,background:isPlayingThis?`${TC}33`:`${TC}11`,border:`1px solid ${TC}${isPlayingThis?"99":"44"}`,color:!latestRec?T.subtext:TC,cursor:!latestRec?"not-allowed":"pointer",fontSize:11,fontWeight:700,boxShadow:isPlayingThis?`0 0 8px ${TC}44`:"none"}}>
                          {isPlayingThis?"⏸ PAUSE":"▶ PLAY"}
                        </button>

                        {/* STOP */}
                        <button
                          onClick={()=>{if(isRecordingThis)stopStudioRecording();else if(isCountingInThis)cancelCountIn();else stopTrack(track.id);}}
                          disabled={!isPlayingThis&&!isRecordingThis&&!isCountingInThis}
                          style={{flex:1,padding:"9px 4px",borderRadius:10,background:"#ff444411",border:`1px solid #ff4444${isPlayingThis||isRecordingThis||isCountingInThis?"88":"22"}`,color:isPlayingThis||isRecordingThis||isCountingInThis?"#ff4444":T.subtext,cursor:isPlayingThis||isRecordingThis||isCountingInThis?"pointer":"not-allowed",fontSize:11,fontWeight:700}}>
                          ⏹ STOP
                        </button>

                        {/* REC / COUNT IN */}
                        {isRecordingThis?(
                          <button onClick={stopStudioRecording} style={{flex:2,padding:"9px 4px",borderRadius:10,background:"#ff444422",border:"2px solid #ff4444",color:"#ff4444",cursor:"pointer",fontSize:11,fontWeight:700,boxShadow:"0 0 10px #ff444444"}}>
                            🔴 {fmtTime(studioRecordingTime)}
                          </button>
                        ):isCountingInThis?(
                          <button onClick={cancelCountIn} style={{flex:2,padding:"9px 4px",borderRadius:10,background:"#ffee0022",border:"2px solid #ffee00",color:"#ffee00",cursor:"pointer",fontSize:11,fontWeight:700}}>
                            🥁 {countBeat}/8 CANCEL
                          </button>
                        ):(
                          <button onClick={()=>{if(studioRecordingTrack!==null||countingIn!==null)return;startCountIn(track.id);}}
                            style={{flex:2,padding:"9px 4px",borderRadius:10,background:`${TC}22`,border:`1px solid ${TC}66`,color:studioRecordingTrack!==null||countingIn!==null?T.subtext:TC,cursor:studioRecordingTrack!==null||countingIn!==null?"not-allowed":"pointer",fontSize:11,fontWeight:700,boxShadow:`0 0 8px ${TC}33`}}>
                            🎙️ REC
                          </button>
                        )}

                        {/* UPLOAD */}
                        <button onClick={()=>{studioFileTrackId.current=track.id;studioFileInputRef.current?.click();}}
                          style={{padding:"9px 10px",borderRadius:10,background:`${TC}11`,border:`1px solid ${TC}44`,color:TC,cursor:"pointer",fontSize:13}}>📁</button>
                      </div>

                      {/* ── DROPDOWN PANEL ── */}
                      {isExpanded&&(
                        <div className="drop-in" style={{padding:"14px 12px",display:"flex",flexDirection:"column",gap:14}}>

                          {/* Volume */}
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                              <span style={{color:TC,fontSize:10,fontWeight:700,letterSpacing:"0.1em"}}>🔊 VOLUME</span>
                              <span style={{color:TC,fontSize:10,fontWeight:700}}>{Math.round(track.volume*100)}%</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.05"
                              value={track.volume}
                              onChange={e=>updateTrack(track.id,()=>({volume:parseFloat(e.target.value)}))}
                              style={{width:"100%",accentColor:TC,background:`linear-gradient(to right,${TC} ${track.volume*100}%,${T.border} ${track.volume*100}%)`}}/>
                          </div>

                          {/* Reverb */}
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                              <span style={{color:TC,fontSize:10,fontWeight:700,letterSpacing:"0.1em"}}>🌊 REVERB</span>
                              <span style={{color:TC,fontSize:10,fontWeight:700}}>{reverbPct}%</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              {/* DOWN */}
                              <button onClick={()=>changeReverb(track.id,-0.1,TC)} style={{
                                width:38,height:38,borderRadius:10,flexShrink:0,
                                background:track.reverb<=0?`${TC}08`:`${TC}22`,
                                border:`1px solid ${TC}${track.reverb<=0?"22":"66"}`,
                                color:track.reverb<=0?`${TC}44`:TC,
                                cursor:track.reverb<=0?"not-allowed":"pointer",
                                fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",
                                boxShadow:track.reverb>0?`0 0 8px ${TC}33`:"none",
                              }}>⬇️</button>

                              {/* Visual reverb bar */}
                              <div style={{flex:1,height:8,borderRadius:4,background:T.border,overflow:"hidden"}}>
                                <div style={{
                                  height:"100%",width:`${reverbPct}%`,
                                  background:`linear-gradient(90deg,${TC}88,${TC})`,
                                  borderRadius:4,
                                  boxShadow:reverbPct>0?`0 0 8px ${TC}66`:"none",
                                  transition:"width 0.1s ease",
                                }}/>
                              </div>

                              {/* UP */}
                              <button onClick={()=>changeReverb(track.id,0.1,TC)} style={{
                                width:38,height:38,borderRadius:10,flexShrink:0,
                                background:track.reverb>=1?`${TC}08`:`${TC}22`,
                                border:`1px solid ${TC}${track.reverb>=1?"22":"66"}`,
                                color:track.reverb>=1?`${TC}44`:TC,
                                cursor:track.reverb>=1?"not-allowed":"pointer",
                                fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",
                                boxShadow:track.reverb<1?`0 0 8px ${TC}33`:"none",
                              }}>⬆️</button>
                            </div>
                            <p style={{color:T.subtext,fontSize:9,margin:"6px 0 0",letterSpacing:"0.05em"}}>
                              {reverbPct===0?"DRY — no reverb":reverbPct<30?"ROOM — subtle space":reverbPct<60?"HALL — medium reverb":reverbPct<80?"CHAMBER — large space":"CATHEDRAL — maximum reverb"}
                            </p>
                          </div>

                          {/* Mute / Solo */}
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>updateTrack(track.id,t=>({muted:!t.muted}))} style={{
                              flex:1,padding:"8px",borderRadius:10,
                              background:track.muted?"#ff444422":"transparent",
                              border:`1px solid ${track.muted?"#ff4444":"rgba(128,128,128,0.3)"}`,
                              color:track.muted?"#ff4444":T.subtext,
                              cursor:"pointer",fontSize:11,fontWeight:700,
                            }}>🔇 {track.muted?"UNMUTE":"MUTE"}</button>
                            <button onClick={()=>updateTrack(track.id,t=>({solo:!t.solo}))} style={{
                              flex:1,padding:"8px",borderRadius:10,
                              background:track.solo?`${TC}22`:"transparent",
                              border:`1px solid ${track.solo?TC:"rgba(128,128,128,0.3)"}`,
                              color:track.solo?TC:T.subtext,
                              cursor:"pointer",fontSize:11,fontWeight:700,
                            }}>⭐ {track.solo?"UNSOLO":"SOLO"}</button>
                          </div>

                          {/* Track notes */}
                          <div>
                            <p style={{color:TC,fontSize:10,fontWeight:700,letterSpacing:"0.1em",marginBottom:6}}>📝 TRACK NOTES</p>
                            <textarea
                              style={inp({height:60,resize:"none",fontFamily:"monospace",fontSize:12,borderColor:`${TC}33`,padding:"8px"})}
                              placeholder={`Notes for ${track.name}...`}
                              value={track.notes||""}
                              onChange={e=>updateTrack(track.id,()=>({notes:e.target.value}))}
                            />
                          </div>

                          {/* Recordings list */}
                          {track.recordings.length>0&&(
                            <div>
                              <p style={{color:TC,fontSize:10,fontWeight:700,letterSpacing:"0.1em",marginBottom:8}}>TAKES ({track.recordings.length})</p>
                              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                                {track.recordings.map((rec,idx)=>(
                                  <div key={rec.id} style={{
                                    display:"flex",alignItems:"center",gap:8,
                                    padding:"7px 10px",borderRadius:8,
                                    background:idx===track.recordings.length-1?`${TC}11`:T.cardBg,
                                    border:`1px solid ${idx===track.recordings.length-1?TC+"33":T.border}`,
                                  }}>
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

                          {/* Delete track data */}
                          <button onClick={()=>{
                            if(window.confirm(`Clear all recordings from ${track.name}?`)){
                              updateTrack(track.id,()=>({recordings:[],notes:"",reverb:0,volume:0.8,muted:false,solo:false}));
                            }
                          }} style={{
                            padding:"8px",borderRadius:10,
                            background:"#ff444411",border:"1px solid #ff444433",
                            color:"#ff444488",cursor:"pointer",fontSize:11,fontWeight:700,
                          }}>🗑️ CLEAR TRACK</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <input ref={studioFileInputRef} type="file" accept="audio/*" style={{display:"none"}}
                onChange={e=>{
                  if (studioFileTrackId.current!==null){
                    handleStudioFileUpload(studioFileTrackId.current,e);
                    studioFileTrackId.current=null;
                  }
                }}/>

              <div style={{marginTop:12,padding:"12px 14px",borderRadius:12,background:T.cardBg,border:`1px solid ${T.border}`}}>
                <p style={{color:T.subtext,fontSize:10,lineHeight:1.8,margin:0}}>
                  <span style={{color:AC}}>▸</span> Tap track name to rename &nbsp;
                  <span style={{color:AC}}>▸</span> ▼ opens options — volume, reverb, mute, solo, notes<br/>
                  <span style={{color:AC}}>▸</span> 🎙️ REC = 8 count-in then records (other tracks play in your ear)<br/>
                  <span style={{color:AC}}>▸</span> ⬆️⬇️ reverb = more or less room effect
                </p>
              </div>
            </div>
          )}

          {/* ── SETLIST ── */}
          {isSetlist&&(
            <div style={{padding:"16px",borderRadius:14,background:T.card,border:`1px solid ${AC}44`}}>
              <h2 style={{color:AC,fontSize:16,fontWeight:700,letterSpacing:"0.1em",marginBottom:4}}>📋 SETLIST BUILDER</h2>
              <p style={{color:T.subtext,fontSize:11,letterSpacing:"0.15em",marginBottom:16}}>DRAG TO REORDER</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                {project.songs.map(s=>(
                  <button key={s.id} onClick={()=>addToSetlist(s.name)} style={{background:`${s.color.hex}22`,border:`1px solid ${s.color.hex}66`,color:s.color.hex,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>+ {s.name}</button>
                ))}
              </div>
              {(project.setlist||[]).length===0?(
                <p style={{color:T.subtext,fontSize:12,textAlign:"center",padding:"20px 0"}}>Tap a song above to add to setlist</p>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(project.setlist||[]).map((item,index)=>(
                    <div key={item.id} draggable onDragStart={()=>handleSetlistDragStart(index)} onDragOver={e=>e.preventDefault()} onDrop={()=>handleSetlistDrop(index)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:10,background:T.cardBg,border:`1px solid ${AC}33`,cursor:"grab",opacity:draggedSetlist===index?0.4:1}}>
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

          {/* ── SONGS ── */}
          {!isStudio&&!isSetlist&&(
            <div>
              <div className="tab-scroll" style={{marginBottom:12}}>
                {project.songs.map((s,i)=>(
                  <button key={i} onClick={()=>setActiveTab(i)} style={{
                    flex:"0 0 auto",padding:"7px 12px",borderRadius:10,
                    border:`1px solid ${activeTab===i?getSongColor(s.color.hex):"rgba(128,128,128,0.2)"}`,
                    background:activeTab===i?`${getSongColor(s.color.hex)}22`:"transparent",
                    color:activeTab===i?getSongColor(s.color.hex):T.subtext,
                    fontSize:11,fontWeight:700,cursor:"pointer",
                    letterSpacing:"0.05em",whiteSpace:"nowrap",
                    boxShadow:activeTab===i?`0 0 10px ${getSongColor(s.color.hex)}44`:"none",
                    transition:"all 0.2s",
                  }}>{s.name}</button>
                ))}
                <button onClick={()=>setActiveTab(4)} style={{
                  flex:"0 0 auto",padding:"7px 12px",borderRadius:10,
                  border:`1px solid ${activeTab===4?T.text:"rgba(128,128,128,0.2)"}`,
                  background:activeTab===4?darkMode?"rgba(255,255,255,0.1)":"rgba(10,22,40,0.08)":"transparent",
                  color:activeTab===4?T.text:T.subtext,
                  fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.2s",
                }}>⚡ MERGE</button>
              </div>

              {isMerge?(
                <div>
                  <div style={{padding:"14px 16px",borderRadius:14,marginBottom:12,background:T.card,border:`1px solid ${T.border}`}}>
                    <h2 style={{color:T.text,fontSize:16,fontWeight:700,marginBottom:4}}>⚡ MERGE VIEW</h2>
                    <p style={{color:T.subtext,fontSize:10,letterSpacing:"0.15em",marginBottom:10}}>COLOR = WHICH SONG CLAIMED THIS PART</p>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      {project.songs.map(s=>(
                        <div key={s.id} style={{display:"flex",alignItems:"center",gap:5}}>
                          <div style={{width:10,height:10,borderRadius:3,background:getSongColor(s.color.hex)}}/>
                          <span style={{color:getSongColor(s.color.hex),fontSize:11,fontWeight:700}}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="table-wrap" style={{border:`1px solid ${T.border}`}}>
                    <table className="section-table">
                      <thead>
                        <tr style={{background:T.headBg}}>
                          <th className="sticky-col-head" style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,textAlign:"left",fontSize:10,color:T.subtext,minWidth:160,background:T.headBg}}>SECTION</th>
                          {instruments.map(inst=>(
                            <th key={inst} style={{padding:"10px 8px",borderBottom:`1px solid ${T.border}`,textAlign:"center",fontSize:9,color:T.subtext,minWidth:72,whiteSpace:"nowrap"}}>{inst.toUpperCase()}</th>
                          ))}
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
                                  {colors.length===0?(
                                    <div style={{width:18,height:18,margin:"0 auto",border:`2px solid ${T.border}`,borderRadius:4}}/>
                                  ):(
                                    <div style={{display:"flex",gap:2,justifyContent:"center",flexWrap:"wrap"}}>
                                      {colors.map((c,i)=>(
                                        <div key={i} style={{width:14,height:14,borderRadius:3,background:getSongColor(c.hex),boxShadow:`0 0 5px ${getSongColor(c.hex)}88`}}/>
                                      ))}
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
                      <>
                        <input style={inp({borderColor:`${getSongColor(C)}66`,fontSize:13})} value={songNameValue} onChange={e=>setSongNameValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveSongName()} autoFocus/>
                        <button className="icon-btn" onClick={saveSongName} style={{color:getSongColor(C)}}>✓</button>
                        <button className="icon-btn" onClick={()=>setEditingSongName(false)} style={{color:T.subtext}}>✕</button>
                      </>
                    ):(
                      <>
                        <span style={{color:getSongColor(C),fontWeight:700,fontSize:14,flex:1}}>{song.name}</span>
                        <button className="icon-btn" onClick={()=>{setEditingSongName(true);setSongNameValue(song.name);}} style={{color:`${getSongColor(C)}88`}}>✏️</button>
                      </>
                    )}
                  </div>

                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <div style={{flex:1,display:"flex",gap:8,padding:"10px 14px",borderRadius:12,background:T.card,border:`1px solid ${getSongColor(C)}33`}}>
                      <input style={inp({borderColor:`${getSongColor(C)}33`,fontSize:12})} placeholder="New section..." value={newSection}
                        onChange={e=>setNewSection(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSection()}/>
                      <button onClick={addSection} style={{background:`${getSongColor(C)}22`,border:`1px solid ${getSongColor(C)}66`,color:getSongColor(C),borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>+ ADD</button>
                    </div>
                    <button onClick={()=>setInstrPanelOpen(!instrPanelOpen)} style={{
                      background:instrPanelOpen?`${getSongColor(C)}33`:`${getSongColor(C)}11`,
                      border:`1px solid ${getSongColor(C)}${instrPanelOpen?"99":"44"}`,
                      borderRadius:12,padding:"0 12px",cursor:"pointer",
                      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,minWidth:70,
                    }}>
                      <img src="/launchericon-192x192.png" style={{width:26,height:26,objectFit:"cover",mixBlendMode:"screen",filter:"sepia(1) saturate(3) hue-rotate(70deg) brightness(1.3)"}}/>
                      <span style={{color:getSongColor(C),fontSize:8,fontWeight:700,textAlign:"center"}}>INSTRUMENTS</span>
                    </button>
                  </div>

                  {instrPanelOpen&&(
                    <div style={{marginBottom:12,padding:"14px 16px",borderRadius:14,background:T.card,border:`1px solid ${AC}44`}}>
                      <h3 style={{color:AC,fontSize:12,fontWeight:700,letterSpacing:"0.1em",marginBottom:10}}>MANAGE INSTRUMENTS</h3>
                      <div style={{display:"flex",gap:8,marginBottom:12}}>
                        <input style={inp({borderColor:`${AC}33`,fontSize:12})} placeholder="New instrument..." value={newInstrument}
                          onChange={e=>setNewInstrument(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addInstrument()}/>
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
                    {project.songs.map(s=>(
                      <div key={s.id} style={{display:"flex",alignItems:"center",gap:4}}>
                        <div style={{width:10,height:10,borderRadius:2,background:getSongColor(s.color.hex),boxShadow:`0 0 4px ${getSongColor(s.color.hex)}`}}/>
                        <span style={{color:getSongColor(s.color.hex),fontSize:10,fontWeight:700}}>{s.name}</span>
                      </div>
                    ))}
                  </div>

                  <div className="table-wrap" style={{border:`1px solid ${getSongColor(C)}33`}}>
                    <table className="section-table">
                      <thead>
                        <tr style={{background:T.headBg}}>
                          <th className="sticky-col-head" style={{padding:"10px 12px",borderBottom:`1px solid ${getSongColor(C)}44`,textAlign:"left",fontSize:10,color:getSongColor(C),letterSpacing:"0.12em",minWidth:160,background:T.headBg}}>SECTION</th>
                          {instruments.map(inst=>(
                            <th key={inst} style={{padding:"10px 8px",borderBottom:`1px solid ${getSongColor(C)}44`,textAlign:"center",fontSize:9,color:getSongColor(C),minWidth:72,whiteSpace:"nowrap",letterSpacing:"0.08em"}}>{inst.toUpperCase()}</th>
                          ))}
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
                            <tr key={section+ri} draggable={!isLocked}
                              onDragStart={()=>!isLocked&&setDraggedIndex(ri)}
                              onDragOver={e=>e.preventDefault()}
                              onDrop={()=>handleDrop(ri)}
                              className="chrome-row"
                              style={{borderBottom:`1px solid ${SC}18`,opacity:draggedIndex===ri?0.4:1,cursor:isLocked?"default":"grab",background:isStarred?`${SC}08`:"transparent"}}>
                              <td className="sticky-col" style={{padding:"6px 8px",fontSize:11,color:isLocked?T.subtext:T.text,fontWeight:600,minWidth:160,background:isStarred?`${SC}10`:T.stickyBg}}>
                                {editingIndex===ri?(
                                  <div style={{display:"flex",gap:4}}>
                                    <input style={inp({padding:"3px 6px",fontSize:11})} value={editingValue} onChange={e=>setEditingValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit()} autoFocus/>
                                    <button className="icon-btn" onClick={saveEdit} style={{color:SC,fontSize:12}}>✓</button>
                                    <button className="icon-btn" onClick={()=>setEditingIndex(null)} style={{color:T.subtext,fontSize:12}}>✕</button>
                                  </div>
                                ):(
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <button className="lines-btn"
                                      onTouchStart={()=>handleLinesTouchStart(ri,section)}
                                      onTouchEnd={()=>handleLinesTouchEnd(ri,section)}
                                      onClick={()=>!isDragging&&setSectionNoteOpen(section)}
                                      style={{position:"relative"}}>
                                      {[0,1,2].map(i=>(
                                        <div key={i} className="line" style={{background:hasNote?SC:`${SC}66`}}/>
                                      ))}
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
                                const colors=getColors(section,ci);
                                const myCheck=isMine(section,ci,song.id);
                                const others=colors.filter(c=>getSongColor(c.hex)!==SC);
                                return(
                                  <td key={ci} style={{padding:"6px 8px",textAlign:"center"}}>
                                    <div onClick={()=>!isLocked&&toggleChecked(section,ci,song.id)}
                                      style={{width:22,height:22,margin:"0 auto",border:`2px solid ${myCheck?SC:SC+"33"}`,borderRadius:5,background:T.checkBg,cursor:isLocked?"default":"pointer",position:"relative",boxShadow:myCheck?`0 0 6px ${SC}88`:"none",transition:"all 0.15s"}}>
                                      {others.length>0&&(
                                        <div style={{position:"absolute",top:-5,right:-5,display:"flex",gap:1}}>
                                          {others.slice(0,3).map((c,i)=>(
                                            <div key={i} style={{width:6,height:6,borderRadius:"50%",background:getSongColor(c.hex),boxShadow:`0 0 3px ${getSongColor(c.hex)}`}}/>
                                          ))}
                                        </div>
                                      )}
                                      {myCheck&&<div style={{position:"absolute",left:4,top:1,width:8,height:12,border:`2px solid ${SC}`,borderTop:"none",borderLeft:"none",transform:"rotate(45deg)"}}/>}
                                    </div>
                                  </td>
                                );
                              })}
                              <td style={{padding:"6px 8px",textAlign:"center",whiteSpace:"nowrap"}}>
                                <button onClick={()=>cycleStatus(ri)} style={{background:`${STATUS_COLORS[status]}22`,border:`1px solid ${STATUS_COLORS[status]}66`,color:STATUS_COLORS[status],borderRadius:6,padding:"2px 6px",fontSize:9,fontWeight:700,cursor:"pointer",marginBottom:4,display:"block",width:"100%"}}>{status.toUpperCase()}</button>
                                <div style={{display:"flex",justifyContent:"center",gap:2,flexWrap:"wrap"}}>
                                  <button className="icon-btn" onClick={()=>setAudioNoteOpen(section)} style={{position:"relative",color:audioCount>0?SC:T.subtext}}>
                                    🎙️{audioCount>0&&<span style={{position:"absolute",top:-2,right:-2,background:SC,color:darkMode?"#000":"#fff",fontSize:7,fontWeight:700,borderRadius:4,padding:"0 2px",minWidth:10,textAlign:"center"}}>{audioCount}</span>}
                                  </button>
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
                      <textarea style={inp({height:72,resize:"none",fontFamily:"monospace",borderColor:`${getSongColor(C)}33`,paddingBottom:24})}
                        placeholder="Session notes..." value={song.notes}
                        onChange={e=>updateSong(song.id,()=>({notes:e.target.value}))}/>
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
                        <li><span style={{color:getSongColor(C)}}>▸</span> ☰ menu → 🎛️ STUDIO</li>
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

      {/* SPLASH */}
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

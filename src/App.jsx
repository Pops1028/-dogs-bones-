import { useEffect, useState } from "react";

const SPLASH_IMG = "/Screenshot_20260514_110057_ChatGPT~2.jpg";
const LOGO_TEXT = "/Screenshot_20260514_221551_Photos~2.jpg";

const SONG_COLORS = [
  { name: "green",  hex: "#39ff14", dim: "#1a4a00", tab: "rgba(57,255,20,0.15)"  },
  { name: "blue",   hex: "#00cfff", dim: "#003a4a", tab: "rgba(0,207,255,0.15)"  },
  { name: "purple", hex: "#bf5fff", dim: "#2a004a", tab: "rgba(191,95,255,0.15)" },
  { name: "orange", hex: "#ff9500", dim: "#4a2000", tab: "rgba(255,149,0,0.15)"  },
];

const PROJECT_COLORS = [
  "#39ff14","#00cfff","#bf5fff","#ff9500",
  "#ff3366","#ffee00","#00ffcc","#ff6600",
];

const DEFAULT_SECTIONS = [
  "Intro","Pre-Verse","Verse","Chorus","Between Verse",
  "2nd Verse","Breakdown","Guitar Solo","Interlude","Chorus Outro",
];

const DEFAULT_INSTRUMENTS = [
  "Guitar","Bass","Drums","Vocals","Lead Guitar","Synth","Backing Vocals",
];

const STATUS_OPTIONS = ["Draft","In Progress","Final"];
const STATUS_COLORS = { "Draft": "#666", "In Progress": "#ff9500", "Final": "#39ff14" };

function makeDefaultSongs() {
  return SONG_COLORS.map((c, i) => ({
    id: i, name: `Song ${i + 1}`, color: c,
    sections: DEFAULT_SECTIONS,
    checked: {}, status: {}, locked: {}, starred: {},
    notes: "", bpm: "", key: "",
  }));
}

function makeProject(id, name, color) {
  return { id, name, color, songs: makeDefaultSongs(), setlist: [] };
}

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function App() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("loading");
  const [menuOpen, setMenuOpen] = useState(false);
  const [screen, setScreen] = useState("songs"); // songs | setlist
  const [activeTab, setActiveTab] = useState(0);

  const [projects, setProjects] = useState(() =>
    load("db_projects", [makeProject(0, "My First Song", "#39ff14")])
  );
  const [activeProject, setActiveProject] = useState(() => load("db_active_project", 0));
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameValue, setProjectNameValue] = useState("");
  const [editingSongName, setEditingSongName] = useState(false);
  const [songNameValue, setSongNameValue] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedSetlist, setDraggedSetlist] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [newSection, setNewSection] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => { save("db_projects", projects); }, [projects]);
  useEffect(() => { save("db_active_project", activeProject); }, [activeProject]);

  useEffect(() => {
    if (phase !== "loading") return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => setPhase("fading"), 300);
          return 100;
        }
        return p + 1.2;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase === "fading") {
      const t = setTimeout(() => setPhase("app"), 1200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const project = projects.find((p) => p.id === activeProject) || projects[0];
  const song = project?.songs?.[activeTab] || project?.songs?.[0];
  const isMerge = activeTab === 4;
  const isSetlist = screen === "setlist";

  const updateProject = (id, updater) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, ...updater(p) } : p));
  };

  const updateSong = (songId, updater) => {
    updateProject(project.id, (p) => ({
      songs: p.songs.map((s) => s.id === songId ? { ...s, ...updater(s) } : s),
    }));
  };

  const addProject = () => {
    if (!newProjectName.trim()) return;
    const id = Date.now();
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    setProjects((prev) => [...prev, makeProject(id, newProjectName.trim(), color)]);
    setActiveProject(id);
    setNewProjectName("");
    setMenuOpen(false);
    setActiveTab(0);
  };

  const deleteProject = (id) => {
    if (projects.length === 1) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject === id) setActiveProject(projects[0].id);
  };

  const switchProject = (id) => {
    setActiveProject(id);
    setMenuOpen(false);
    setActiveTab(0);
    setScreen("songs");
  };

  const saveProjectName = () => {
    if (!projectNameValue.trim()) return;
    updateProject(project.id, () => ({ name: projectNameValue.trim() }));
    setEditingProjectName(false);
  };

  const saveSongName = () => {
    if (!songNameValue.trim()) return;
    updateSong(song.id, () => ({ name: songNameValue.trim() }));
    setEditingSongName(false);
  };

  const toggleChecked = (rowIndex, colIndex) => {
    if (song.locked?.[rowIndex]) return;
    const key = `${rowIndex}-${colIndex}`;
    updateSong(song.id, (s) => ({ checked: { ...s.checked, [key]: !s.checked[key] } }));
  };

  const toggleLocked = (rowIndex) => {
    updateSong(song.id, (s) => ({ locked: { ...s.locked, [rowIndex]: !s.locked?.[rowIndex] } }));
  };

  const toggleStarred = (rowIndex) => {
    updateSong(song.id, (s) => ({ starred: { ...s.starred, [rowIndex]: !s.starred?.[rowIndex] } }));
  };

  const cycleStatus = (rowIndex) => {
    if (song.locked?.[rowIndex]) return;
    updateSong(song.id, (s) => {
      const current = s.status?.[rowIndex] || "Draft";
      const next = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(current) + 1) % STATUS_OPTIONS.length];
      return { status: { ...s.status, [rowIndex]: next } };
    });
  };

  const handleDragStart = (index) => setDraggedIndex(index);
  const handleDrop = (targetIndex) => {
    if (draggedIndex === null || song.locked?.[draggedIndex]) return;
    const updated = [...song.sections];
    const item = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, item);
    updateSong(song.id, () => ({ sections: updated }));
    setDraggedIndex(null);
  };

  const addSection = () => {
    if (!newSection.trim()) return;
    updateSong(song.id, (s) => ({ sections: [...s.sections, newSection.trim()] }));
    setNewSection("");
  };

  const removeSection = (index) => {
    if (song.locked?.[index]) return;
    updateSong(song.id, (s) => {
      const newChecked = {};
      Object.entries(s.checked || {}).forEach(([key, val]) => {
        const [r, c] = key.split("-").map(Number);
        if (r !== index) {
          newChecked[`${r > index ? r - 1 : r}-${c}`] = val;
        }
      });
      return {
        sections: s.sections.filter((_, i) => i !== index),
        checked: newChecked,
      };
    });
  };

  const startEdit = (index) => {
    if (song.locked?.[index]) return;
    setEditingIndex(index);
    setEditingValue(song.sections[index]);
  };

  const saveEdit = () => {
    if (!editingValue.trim()) return;
    updateSong(song.id, (s) => {
      const updated = [...s.sections];
      updated[editingIndex] = editingValue.trim();
      return { sections: updated };
    });
    setEditingIndex(null);
  };

  // Setlist
  const addToSetlist = (songName) => {
    updateProject(project.id, (p) => ({
      setlist: [...(p.setlist || []), { id: Date.now(), name: songName }],
    }));
  };

  const removeFromSetlist = (id) => {
    updateProject(project.id, (p) => ({
      setlist: p.setlist.filter((s) => s.id !== id),
    }));
  };

  const handleSetlistDragStart = (index) => setDraggedSetlist(index);
  const handleSetlistDrop = (targetIndex) => {
    if (draggedSetlist === null) return;
    const updated = [...(project.setlist || [])];
    const item = updated[draggedSetlist];
    updated.splice(draggedSetlist, 1);
    updated.splice(targetIndex, 0, item);
    updateProject(project.id, () => ({ setlist: updated }));
    setDraggedSetlist(null);
  };

  // Merge
  const allSections = [...new Set(project.songs.flatMap((s) => s.sections))];
  const getMergeCell = (sectionName, colIndex) => {
    const results = [];
    project.songs.forEach((s) => {
      const rowIndex = s.sections.indexOf(sectionName);
      if (rowIndex !== -1 && s.checked?.[`${rowIndex}-${colIndex}`]) {
        results.push(s.color);
      }
    });
    return results;
  };

  const projectColor = project?.color || "#39ff14";

  return (
    <>
      <style>{`
        @keyframes pulse-glow {
          0%,100% { text-shadow: 0 0 8px #39ff14,0 0 20px #39ff14; }
          50% { text-shadow: 0 0 20px #39ff14,0 0 40px #39ff14; }
        }
        .loading-text { animation: pulse-glow 1.2s ease-in-out infinite; }
        @keyframes fadeOut { 0%{opacity:1} 100%{opacity:0} }
        .splash-fade { animation: fadeOut 1.1s ease-in-out forwards; }
        @keyframes slideIn { 0%{transform:translateX(-100%)} 100%{transform:translateX(0)} }
        .menu-panel { animation: slideIn 0.25s ease forwards; }
        * { box-sizing: border-box; }
        body { background:#000; margin:0; }
        .chrome-input {
          background:#050a05; border:1px solid rgba(57,255,20,0.2);
          color:#ccc; border-radius:8px; padding:8px 12px;
          width:100%; outline:none; font-size:13px;
        }
        .chrome-input:focus { border-color:rgba(57,255,20,0.6); box-shadow:0 0 8px rgba(57,255,20,0.2); }
        .icon-btn {
          background:none; border:none; cursor:pointer;
          padding:4px 6px; border-radius:6px; font-size:14px;
          line-height:1; transition:background 0.15s;
        }
        .icon-btn:hover { background:rgba(255,255,255,0.08); }
        .table-wrap {
          overflow-x:auto; border-radius:16px;
          border:1px solid rgba(57,255,20,0.25);
          margin-bottom:16px;
          -webkit-overflow-scrolling:touch;
        }
        .section-table { width:max-content; min-width:100%; border-collapse:collapse; }
        .sticky-col {
          position:sticky; left:0; z-index:2;
          background:#080d08; min-width:130px; max-width:130px;
        }
        .sticky-col-head {
          position:sticky; left:0; z-index:3;
          background:#111811; min-width:130px;
        }
        .chrome-row { transition:background 0.15s; }
        .chrome-row:hover { background:rgba(255,255,255,0.02) !important; }
        .tab-scroll { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; }
        .tab-scroll::-webkit-scrollbar { display:none; }
      `}</style>

      {/* MENU OVERLAY */}
      {menuOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:8000 }} onClick={() => setMenuOpen(false)}>
          <div
            className="menu-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              position:"absolute", top:0, left:0, bottom:0, width:"82%", maxWidth:320,
              background:"#080d08", borderRight:`1px solid ${projectColor}44`,
              display:"flex", flexDirection:"column", overflow:"hidden",
            }}
          >
            {/* Menu Header */}
            <div style={{
              padding:"20px 16px 12px",
              borderBottom:`1px solid ${projectColor}33`,
              background:"#0a0f0a",
            }}>
              <img src={LOGO_TEXT} alt="Dog Bones" style={{
                width:"100%", maxWidth:200, height:40,
                objectFit:"cover", objectPosition:"center",
                mixBlendMode:"screen", display:"block", marginBottom:4,
              }} />
              <p style={{ color:`${projectColor}88`, fontSize:9, letterSpacing:"0.3em" }}>
                PROJECTS
              </p>
            </div>

            {/* Project List */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px 0" }}>
              {projects.map((p) => (
                <div key={p.id} style={{
                  display:"flex", alignItems:"center", gap:8,
                  padding:"12px 16px", cursor:"pointer",
                  background: p.id === activeProject ? `${p.color}11` : "transparent",
                  borderLeft: p.id === activeProject ? `3px solid ${p.color}` : "3px solid transparent",
                  transition:"all 0.15s",
                }} onClick={() => switchProject(p.id)}>
                  <div style={{
                    width:10, height:10, borderRadius:"50%",
                    background:p.color, flexShrink:0,
                    boxShadow:`0 0 6px ${p.color}`,
                  }} />
                  <span style={{
                    flex:1, fontSize:13, fontWeight:600,
                    color: p.id === activeProject ? p.color : "#aaa",
                  }}>{p.name}</span>
                  {projects.length > 1 && (
                    <button className="icon-btn"
                      onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                      style={{ color:"#ff4444", fontSize:12 }}>🗑️</button>
                  )}
                </div>
              ))}
            </div>

            {/* New Project */}
            <div style={{
              padding:"12px 16px",
              borderTop:`1px solid ${projectColor}22`,
              background:"#0a0f0a",
            }}>
              <p style={{ color:"#666", fontSize:10, letterSpacing:"0.2em", marginBottom:8 }}>
                NEW PROJECT
              </p>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  className="chrome-input"
                  placeholder="Project / Song name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addProject()}
                  style={{ fontSize:12 }}
                />
                <button onClick={addProject} style={{
                  background:`${projectColor}22`,
                  border:`1px solid ${projectColor}66`,
                  color:projectColor, borderRadius:8,
                  padding:"6px 12px", cursor:"pointer",
                  fontSize:13, fontWeight:700, whiteSpace:"nowrap",
                }}>+ ADD</button>
              </div>
            </div>

            {/* Setlist & Screen nav */}
            <div style={{
              padding:"12px 16px",
              borderTop:`1px solid ${projectColor}22`,
              display:"flex", flexDirection:"column", gap:8,
            }}>
              <button onClick={() => { setScreen("songs"); setMenuOpen(false); }} style={{
                background: screen==="songs" ? `${projectColor}22` : "transparent",
                border:`1px solid ${screen==="songs" ? projectColor+"66" : "rgba(255,255,255,0.1)"}`,
                color: screen==="songs" ? projectColor : "#666",
                borderRadius:8, padding:"8px 12px", cursor:"pointer",
                fontSize:12, fontWeight:700, letterSpacing:"0.1em", textAlign:"left",
              }}>🎵 SONG ARRANGER</button>
              <button onClick={() => { setScreen("setlist"); setMenuOpen(false); }} style={{
                background: screen==="setlist" ? `${projectColor}22` : "transparent",
                border:`1px solid ${screen==="setlist" ? projectColor+"66" : "rgba(255,255,255,0.1)"}`,
                color: screen==="setlist" ? projectColor : "#666",
                borderRadius:8, padding:"8px 12px", cursor:"pointer",
                fontSize:12, fontWeight:700, letterSpacing:"0.1em", textAlign:"left",
              }}>📋 SETLIST BUILDER</button>
            </div>
          </div>
        </div>
      )}

      {/* APP */}
      <div style={{ minHeight:"100vh", background:"#000", color:"#ccc" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"12px" }}>

          {/* Top Bar */}
          <div style={{
            display:"flex", alignItems:"center", gap:10, marginBottom:12,
            padding:"10px 14px", borderRadius:14,
            background:"linear-gradient(145deg,#0a0f0a,#111811)",
            border:`1px solid ${projectColor}44`,
          }}>
            {/* Hamburger */}
            <button onClick={() => setMenuOpen(true)} style={{
              background:"none", border:"none", cursor:"pointer",
              padding:"4px 6px", borderRadius:8, flexShrink:0,
            }}>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {[0,1,2].map((i) => (
                  <div key={i} style={{
                    width:20, height:2, borderRadius:1,
                    background:projectColor,
                    boxShadow:`0 0 4px ${projectColor}`,
                  }} />
                ))}
              </div>
            </button>

            {/* Logo */}
            <img src={LOGO_TEXT} alt="Dog Bones" style={{
              height:36, objectFit:"contain",
              mixBlendMode:"screen", flexShrink:0,
            }} />

            {/* Project Name */}
            <div style={{ flex:1, overflow:"hidden" }}>
              {editingProjectName ? (
                <div style={{ display:"flex", gap:4 }}>
                  <input
                    className="chrome-input"
                    style={{ padding:"4px 8px", fontSize:12, borderColor:`${projectColor}66` }}
                    value={projectNameValue}
                    onChange={(e) => setProjectNameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveProjectName()}
                    autoFocus
                  />
                  <button className="icon-btn" onClick={saveProjectName} style={{ color:projectColor }}>✓</button>
                  <button className="icon-btn" onClick={() => setEditingProjectName(false)} style={{ color:"#666" }}>✕</button>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{
                    width:8, height:8, borderRadius:"50%",
                    background:projectColor, flexShrink:0,
                    boxShadow:`0 0 6px ${projectColor}`,
                  }} />
                  <span style={{
                    color:projectColor, fontWeight:700, fontSize:13,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>{project?.name}</span>
                  <button className="icon-btn"
                    onClick={() => { setEditingProjectName(true); setProjectNameValue(project.name); }}
                    style={{ color:`${projectColor}88`, fontSize:11, flexShrink:0 }}>✏️</button>
                </div>
              )}
            </div>

            {/* Color Picker */}
            <div style={{ position:"relative", flexShrink:0 }}>
              <button onClick={() => setColorPickerOpen(!colorPickerOpen)} style={{
                width:24, height:24, borderRadius:"50%",
                background:projectColor, border:"none", cursor:"pointer",
                boxShadow:`0 0 8px ${projectColor}`,
              }} />
              {colorPickerOpen && (
                <div style={{
                  position:"absolute", top:30, right:0, zIndex:100,
                  background:"#111", borderRadius:12, padding:10,
                  border:"1px solid rgba(255,255,255,0.1)",
                  display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6,
                }}>
                  {PROJECT_COLORS.map((c) => (
                    <button key={c} onClick={() => {
                      updateProject(project.id, () => ({ color: c }));
                      setColorPickerOpen(false);
                    }} style={{
                      width:24, height:24, borderRadius:"50%",
                      background:c, border: c===projectColor ? "2px solid #fff" : "none",
                      cursor:"pointer", boxShadow:`0 0 6px ${c}`,
                    }} />
                  ))}
                </div>
              )}
            </div>

            {/* Chrome Logo */}
            <div style={{
              width:40, height:40, borderRadius:8, overflow:"hidden",
              border:`1px solid ${projectColor}44`, flexShrink:0,
            }}>
              <img src="/launchericon-192x192.png" alt="Logo" style={{
                width:40, height:40, objectFit:"cover",
                mixBlendMode:"screen",
                filter:"sepia(1) saturate(3) hue-rotate(70deg) brightness(0.9)",
              }} />
            </div>
          </div>

          {/* SETLIST SCREEN */}
          {isSetlist ? (
            <div>
              <div style={{
                padding:"16px", borderRadius:14, marginBottom:12,
                background:"linear-gradient(145deg,#0a0f0a,#111811)",
                border:`1px solid ${projectColor}44`,
              }}>
                <h2 style={{ color:projectColor, fontSize:16, fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>
                  📋 SETLIST BUILDER
                </h2>
                <p style={{ color:"#666", fontSize:11, letterSpacing:"0.15em", marginBottom:16 }}>
                  DRAG TO REORDER — {project?.name?.toUpperCase()}
                </p>

                {/* Add to setlist */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
                  {project.songs.map((s) => (
                    <button key={s.id} onClick={() => addToSetlist(s.name)} style={{
                      background:`${s.color.hex}22`,
                      border:`1px solid ${s.color.hex}66`,
                      color:s.color.hex, borderRadius:8,
                      padding:"6px 12px", cursor:"pointer",
                      fontSize:12, fontWeight:700,
                    }}>+ {s.name}</button>
                  ))}
                </div>

                {/* Setlist */}
                {(project.setlist || []).length === 0 ? (
                  <p style={{ color:"#444", fontSize:12, textAlign:"center", padding:"20px 0" }}>
                    Tap a song above to add it to the setlist
                  </p>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {(project.setlist || []).map((item, index) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleSetlistDragStart(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleSetlistDrop(index)}
                        style={{
                          display:"flex", alignItems:"center", gap:10,
                          padding:"12px 14px", borderRadius:10,
                          background:"#0a0f0a",
                          border:`1px solid ${projectColor}33`,
                          cursor:"grab",
                          opacity: draggedSetlist === index ? 0.4 : 1,
                        }}
                      >
                        <span style={{ color:`${projectColor}66`, fontSize:16 }}>☰</span>
                        <span style={{ color:projectColor, fontWeight:700, fontSize:14, width:28 }}>
                          {index + 1}.
                        </span>
                        <span style={{ flex:1, color:"#ccc", fontSize:13 }}>{item.name}</span>
                        <button className="icon-btn" onClick={() => removeFromSetlist(item.id)}
                          style={{ color:"#ff4444" }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SONGS SCREEN */
            <div>
              {/* Song Tabs */}
              <div className="tab-scroll" style={{ marginBottom:12 }}>
                {project.songs.map((s, i) => (
                  <button key={i} onClick={() => setActiveTab(i)} style={{
                    flex:"0 0 auto", padding:"7px 12px", borderRadius:10,
                    border:`1px solid ${activeTab===i ? s.color.hex : "rgba(255,255,255,0.1)"}`,
                    background: activeTab===i ? s.color.tab : "transparent",
                    color: activeTab===i ? s.color.hex : "#555",
                    fontSize:11, fontWeight:700, cursor:"pointer",
                    letterSpacing:"0.05em", whiteSpace:"nowrap",
                    boxShadow: activeTab===i ? `0 0 10px ${s.color.hex}44` : "none",
                    transition:"all 0.2s",
                  }}>{s.name}</button>
                ))}
                <button onClick={() => setActiveTab(4)} style={{
                  flex:"0 0 auto", padding:"7px 12px", borderRadius:10,
                  border:`1px solid ${activeTab===4 ? "#fff" : "rgba(255,255,255,0.1)"}`,
                  background: activeTab===4 ? "rgba(255,255,255,0.1)" : "transparent",
                  color: activeTab===4 ? "#fff" : "#555",
                  fontSize:11, fontWeight:700, cursor:"pointer",
                  transition:"all 0.2s",
                }}>⚡ MERGE</button>
              </div>

              {/* MERGE VIEW */}
              {isMerge ? (
                <div>
                  <div style={{
                    padding:"14px 16px", borderRadius:14, marginBottom:12,
                    background:"linear-gradient(145deg,#0a0f0a,#111811)",
                    border:"1px solid rgba(255,255,255,0.1)",
                  }}>
                    <h2 style={{ color:"#fff", fontSize:16, fontWeight:700, marginBottom:4 }}>⚡ MERGE VIEW</h2>
                    <p style={{ color:"#555", fontSize:10, letterSpacing:"0.15em", marginBottom:10 }}>
                      COLOR = WHICH SONG THE PART COMES FROM
                    </p>
                    <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                      {project.songs.map((s) => (
                        <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <div style={{ width:10, height:10, borderRadius:3, background:s.color.hex }} />
                          <span style={{ color:s.color.hex, fontSize:11, fontWeight:700 }}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="section-table">
                      <thead>
                        <tr style={{ background:"#111811" }}>
                          <th className="sticky-col-head" style={{
                            padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.1)",
                            textAlign:"left", fontSize:10, color:"#aaa", letterSpacing:"0.1em",
                          }}>SECTION</th>
                          {DEFAULT_INSTRUMENTS.map((inst) => (
                            <th key={inst} style={{
                              padding:"10px 8px", borderBottom:"1px solid rgba(255,255,255,0.1)",
                              textAlign:"center", fontSize:9, color:"#aaa",
                              letterSpacing:"0.08em", minWidth:72, whiteSpace:"nowrap",
                            }}>{inst.toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allSections.map((section) => (
                          <tr key={section} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                            <td className="sticky-col" style={{ padding:"9px 12px", fontSize:11, color:"#aaa", fontWeight:600 }}>
                              {section}
                            </td>
                            {DEFAULT_INSTRUMENTS.map((_, colIndex) => {
                              const colors = getMergeCell(section, colIndex);
                              return (
                                <td key={colIndex} style={{ padding:"8px", textAlign:"center" }}>
                                  {colors.length === 0 ? (
                                    <div style={{
                                      width:18, height:18, margin:"0 auto",
                                      border:"2px solid rgba(255,255,255,0.08)",
                                      borderRadius:4, background:"#000",
                                    }} />
                                  ) : (
                                    <div style={{ display:"flex", gap:2, justifyContent:"center", flexWrap:"wrap" }}>
                                      {colors.map((c, ci) => (
                                        <div key={ci} style={{
                                          width:14, height:14, borderRadius:3,
                                          background:c.hex, boxShadow:`0 0 5px ${c.hex}88`,
                                        }} />
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
              ) : (
                /* SONG VIEW */
                <div>
                  {/* Song Name Bar */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:8, marginBottom:10,
                    padding:"10px 14px", borderRadius:12,
                    background:"linear-gradient(145deg,#0a0f0a,#111811)",
                    border:`1px solid ${song.color.hex}44`,
                  }}>
                    <div style={{
                      width:8, height:8, borderRadius:"50%",
                      background:song.color.hex, flexShrink:0,
                      boxShadow:`0 0 6px ${song.color.hex}`,
                    }} />
                    {editingSongName ? (
                      <>
                        <input
                          className="chrome-input"
                          style={{ borderColor:`${song.color.hex}66`, fontSize:13 }}
                          value={songNameValue}
                          onChange={(e) => setSongNameValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveSongName()}
                          autoFocus
                        />
                        <button className="icon-btn" onClick={saveSongName} style={{ color:song.color.hex }}>✓</button>
                        <button className="icon-btn" onClick={() => setEditingSongName(false)} style={{ color:"#666" }}>✕</button>
                      </>
                    ) : (
                      <>
                        <span style={{ color:song.color.hex, fontWeight:700, fontSize:14, flex:1 }}>{song.name}</span>
                        <button className="icon-btn"
                          onClick={() => { setEditingSongName(true); setSongNameValue(song.name); }}
                          style={{ color:`${song.color.hex}88` }}>✏️</button>
                      </>
                    )}
                  </div>

                  {/* Add Section */}
                  <div style={{
                    display:"flex", gap:8, marginBottom:10,
                    padding:"10px 14px", borderRadius:12,
                    background:"linear-gradient(145deg,#0a0f0a,#111811)",
                    border:`1px solid ${song.color.hex}33`,
                  }}>
                    <input
                      className="chrome-input"
                      placeholder="New section name..."
                      value={newSection}
                      onChange={(e) => setNewSection(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSection()}
                      style={{ borderColor:`${song.color.hex}33`, fontSize:12 }}
                    />
                    <button onClick={addSection} style={{
                      background:`${song.color.hex}22`,
                      border:`1px solid ${song.color.hex}66`,
                      color:song.color.hex, borderRadius:8,
                      padding:"6px 12px", cursor:"pointer",
                      fontSize:12, fontWeight:700, whiteSpace:"nowrap",
                    }}>+ ADD</button>
                  </div>

                  {/* Table */}
                  <div className="table-wrap" style={{ border:`1px solid ${song.color.hex}33` }}>
                    <table className="section-table">
                      <thead>
                        <tr style={{ background:"#111811" }}>
                          <th className="sticky-col-head" style={{
                            padding:"10px 12px",
                            borderBottom:`1px solid ${song.color.hex}44`,
                            textAlign:"left", fontSize:10,
                            color:song.color.hex, letterSpacing:"0.12em",
                          }}>SECTION</th>
                          {DEFAULT_INSTRUMENTS.map((inst) => (
                            <th key={inst} style={{
                              padding:"10px 8px",
                              borderBottom:`1px solid ${song.color.hex}44`,
                              textAlign:"center", fontSize:9,
                              color:song.color.hex, minWidth:72,
                              whiteSpace:"nowrap", letterSpacing:"0.08em",
                            }}>{inst.toUpperCase()}</th>
                          ))}
                          <th style={{
                            padding:"10px 8px",
                            borderBottom:`1px solid ${song.color.hex}44`,
                            textAlign:"center", fontSize:9,
                            color:song.color.hex, minWidth:110,
                            whiteSpace:"nowrap",
                          }}>STATUS / ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {song.sections.map((section, rowIndex) => {
                          const isLocked = !!song.locked?.[rowIndex];
                          const isStarred = !!song.starred?.[rowIndex];
                          const status = song.status?.[rowIndex] || "Draft";
                          return (
                            <tr
                              key={section + rowIndex}
                              draggable={!isLocked}
                              onDragStart={() => !isLocked && handleDragStart(rowIndex)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDrop(rowIndex)}
                              className="chrome-row"
                              style={{
                                borderBottom:`1px solid ${song.color.hex}18`,
                                opacity: draggedIndex === rowIndex ? 0.4 : 1,
                                cursor: isLocked ? "default" : "grab",
                                background: isStarred ? `${song.color.hex}08` : "transparent",
                              }}
                            >
                              <td className="sticky-col" style={{
                                padding:"8px 12px", fontSize:11,
                                color: isLocked ? "#555" : "#bbb", fontWeight:600,
                                background: isStarred ? `${song.color.hex}10` : "#080d08",
                              }}>
                                {editingIndex === rowIndex ? (
                                  <div style={{ display:"flex", gap:4 }}>
                                    <input
                                      className="chrome-input"
                                      style={{ padding:"3px 6px", fontSize:11 }}
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                                      autoFocus
                                    />
                                    <button className="icon-btn" onClick={saveEdit} style={{ color:song.color.hex, fontSize:12 }}>✓</button>
                                    <button className="icon-btn" onClick={() => setEditingIndex(null)} style={{ color:"#666", fontSize:12 }}>✕</button>
                                  </div>
                                ) : (
                                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                                    {isStarred && <span style={{ fontSize:10 }}>⭐</span>}
                                    {isLocked && <span style={{ fontSize:10 }}>🔒</span>}
                                    {!isLocked && <span style={{ color:`${song.color.hex}55`, fontSize:12 }}>☰</span>}
                                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                      {section}
                                    </span>
                                  </div>
                                )}
                              </td>
                              {DEFAULT_INSTRUMENTS.map((_, colIndex) => {
                                const key = `${rowIndex}-${colIndex}`;
                                const isChecked = !!song.checked?.[key];
                                return (
                                  <td key={colIndex} style={{ padding:"8px", textAlign:"center" }}>
                                    <div
                                      onClick={() => toggleChecked(rowIndex, colIndex)}
                                      style={{
                                        width:20, height:20, margin:"0 auto",
                                        border:`2px solid ${isChecked ? song.color.hex : song.color.hex+"33"}`,
                                        borderRadius:4, background:"#000",
                                        cursor: isLocked ? "default" : "pointer",
                                        position:"relative",
                                        boxShadow: isChecked ? `0 0 6px ${song.color.hex}88` : "none",
                                        transition:"all 0.15s",
                                        opacity: isLocked ? 0.5 : 1,
                                      }}
                                    >
                                      {isChecked && (
                                        <div style={{
                                          position:"absolute", left:3, top:0,
                                          width:7, height:11,
                                          border:`2px solid ${song.color.hex}`,
                                          borderTop:"none", borderLeft:"none",
                                          transform:"rotate(45deg)",
                                        }} />
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td style={{ padding:"6px 8px", textAlign:"center", whiteSpace:"nowrap" }}>
                                {/* Status */}
                                <button onClick={() => cycleStatus(rowIndex)} style={{
                                  background:`${STATUS_COLORS[status]}22`,
                                  border:`1px solid ${STATUS_COLORS[status]}66`,
                                  color:STATUS_COLORS[status],
                                  borderRadius:6, padding:"2px 6px",
                                  fontSize:9, fontWeight:700, cursor:"pointer",
                                  letterSpacing:"0.05em", marginBottom:4,
                                  display:"block", width:"100%",
                                }}>{status.toUpperCase()}</button>
                                <div style={{ display:"flex", justifyContent:"center", gap:2 }}>
                                  {/* Star */}
                                  <button className="icon-btn" onClick={() => toggleStarred(rowIndex)}
                                    style={{ fontSize:12, color: isStarred ? "#ffee00" : "#444" }}>⭐</button>
                                  {/* Lock */}
                                  <button className="icon-btn" onClick={() => toggleLocked(rowIndex)}
                                    style={{ fontSize:12, color: isLocked ? "#ff9500" : "#444" }}>🔒</button>
                                  {/* Edit */}
                                  {!isLocked && (
                                    <button className="icon-btn" onClick={() => startEdit(rowIndex)}
                                      style={{ fontSize:12, color:`${song.color.hex}88` }}>✏️</button>
                                  )}
                                  {/* Delete */}
                                  {!isLocked && (
                                    <button className="icon-btn" onClick={() => removeSection(rowIndex)}
                                      style={{ fontSize:12, color:"#ff444488" }}>🗑️</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Notes / BPM / Key */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10, marginTop:12 }}>
                    <div style={{
                      borderRadius:14, padding:14,
                      background:"linear-gradient(145deg,#0a0f0a,#111811)",
                      border:`1px solid ${song.color.hex}33`,
                    }}>
                      <h2 style={{ color:song.color.hex, fontSize:12, fontWeight:700, marginBottom:8, letterSpacing:"0.1em" }}>NOTES</h2>
                      <textarea
                        className="chrome-input"
                        style={{ height:90, resize:"none", fontFamily:"monospace", borderColor:`${song.color.hex}33` }}
                        placeholder="Session notes..."
                        value={song.notes}
                        onChange={(e) => updateSong(song.id, () => ({ notes: e.target.value }))}
                      />
                    </div>
                    <div style={{
                      borderRadius:14, padding:14,
                      background:"linear-gradient(145deg,#0a0f0a,#111811)",
                      border:`1px solid ${song.color.hex}33`,
                    }}>
                      <h2 style={{ color:song.color.hex, fontSize:12, fontWeight:700, marginBottom:8, letterSpacing:"0.1em" }}>TEMPO & KEY</h2>
                      <input className="chrome-input" style={{ marginBottom:8, borderColor:`${song.color.hex}33` }}
                        placeholder="BPM" value={song.bpm}
                        onChange={(e) => updateSong(song.id, () => ({ bpm: e.target.value }))} />
                      <input className="chrome-input" style={{ borderColor:`${song.color.hex}33` }}
                        placeholder="Key (e.g. A minor)" value={song.key}
                        onChange={(e) => updateSong(song.id, () => ({ key: e.target.value }))} />
                    </div>
                    <div style={{
                      borderRadius:14, padding:14,
                      background:"linear-gradient(145deg,#0a0f0a,#111811)",
                      border:`1px solid ${song.color.hex}33`,
                    }}>
                      <h2 style={{ color:song.color.hex, fontSize:12, fontWeight:700, marginBottom:8, letterSpacing:"0.1em" }}>TIPS</h2>
                      <ul style={{ fontSize:11, color:"#777", lineHeight:2, listStyle:"none", padding:0 }}>
                        <li><span style={{ color:song.color.hex }}>▸</span> Tap status to cycle Draft→Progress→Final</li>
                        <li><span style={{ color:song.color.hex }}>▸</span> ⭐ star your best sections</li>
                        <li><span style={{ color:song.color.hex }}>▸</span> 🔒 lock to prevent edits</li>
                        <li><span style={{ color:song.color.hex }}>▸</span> ☰ menu to switch projects</li>
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
      {(phase === "loading" || phase === "fading") && (
        <div className={phase==="fading" ? "splash-fade" : ""}
          style={{
            position:"fixed", inset:0, zIndex:9999,
            background:"#000", overflow:"hidden",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"flex-end",
          }}>
          <img src={SPLASH_IMG} alt="Dog Bones" style={{
            position:"absolute", inset:0, width:"100%", height:"100%",
            objectFit:"cover", objectPosition:"center",
          }} />
          <div style={{
            position:"absolute", inset:0,
            background:"linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 50%)",
          }} />
          {phase==="loading" && (
            <div style={{
              position:"relative", zIndex:2, width:"100%",
              padding:"0 32px 48px",
              display:"flex", flexDirection:"column", alignItems:"center", gap:12,
            }}>
              <span className="loading-text" style={{
                color:"#39ff14", fontSize:13,
                letterSpacing:"0.4em", fontFamily:"monospace", fontWeight:700,
              }}>LOADING</span>
              <div style={{
                width:"100%", height:4,
                background:"rgba(57,255,20,0.2)", borderRadius:2, overflow:"hidden",
              }}>
                <div style={{
                  height:"100%", width:`${progress}%`,
                  background:"linear-gradient(90deg,#1a7a00,#39ff14)",
                  borderRadius:2, boxShadow:"0 0 12px #39ff14",
                  transition:"width 0.03s linear",
                }} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
        }

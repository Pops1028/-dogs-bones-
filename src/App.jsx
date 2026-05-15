import { useEffect, useState } from "react";

const SPLASH_IMG = "/Screenshot_20260514_110057_ChatGPT~2.jpg";
const LOGO_TEXT = "/Screenshot_20260514_221551_Photos~2.jpg";

const SONG_COLORS = [
  { name: "green",  hex: "#39ff14", dim: "#1a4a00", tab: "rgba(57,255,20,0.15)"  },
  { name: "blue",   hex: "#00cfff", dim: "#003a4a", tab: "rgba(0,207,255,0.15)"  },
  { name: "purple", hex: "#bf5fff", dim: "#2a004a", tab: "rgba(191,95,255,0.15)" },
  { name: "orange", hex: "#ff9500", dim: "#4a2000", tab: "rgba(255,149,0,0.15)"  },
];

const DEFAULT_SECTIONS = [
  "Intro","Pre-Verse","Verse","Chorus","Between Verse",
  "2nd Verse","Breakdown","Guitar Solo","Interlude","Chorus Outro",
];

const DEFAULT_INSTRUMENTS = [
  "Guitar","Bass","Drums","Vocals","Lead Guitar","Synth","Backing Vocals",
];

const DEFAULT_SONGS = SONG_COLORS.map((c, i) => ({
  id: i,
  name: `Song ${i + 1}`,
  color: c,
  sections: DEFAULT_SECTIONS,
  checked: {},
  notes: "",
  bpm: "",
  key: "",
}));

function load(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function App() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("loading");
  const [activeTab, setActiveTab] = useState(0); // 0-3 = songs, 4 = merge
  const [songs, setSongs] = useState(() => load("db_songs", DEFAULT_SONGS));
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [newSection, setNewSection] = useState("");
  const [editingSongName, setEditingSongName] = useState(false);
  const [songNameValue, setSongNameValue] = useState("");

  useEffect(() => { save("db_songs", songs); }, [songs]);

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

  const song = songs[activeTab] || songs[0];
  const color = activeTab < 4 ? song?.color : { hex: "#aaa", dim: "#222", tab: "rgba(180,180,180,0.1)" };

  const updateSong = (id, updater) => {
    setSongs((prev) => prev.map((s) => s.id === id ? { ...s, ...updater(s) } : s));
  };

  const toggleChecked = (rowIndex, colIndex) => {
    const key = `${rowIndex}-${colIndex}`;
    updateSong(song.id, (s) => ({ checked: { ...s.checked, [key]: !s.checked[key] } }));
  };

  const handleDragStart = (index) => setDraggedIndex(index);
  const handleDrop = (targetIndex) => {
    if (draggedIndex === null) return;
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
    updateSong(song.id, (s) => {
      const newChecked = {};
      Object.entries(s.checked).forEach(([key, val]) => {
        const [r, c] = key.split("-").map(Number);
        if (r !== index) {
          const newRow = r > index ? r - 1 : r;
          newChecked[`${newRow}-${c}`] = val;
        }
      });
      return { sections: s.sections.filter((_, i) => i !== index), checked: newChecked };
    });
  };

  const startEdit = (index) => { setEditingIndex(index); setEditingValue(song.sections[index]); };
  const saveEdit = () => {
    if (!editingValue.trim()) return;
    updateSong(song.id, (s) => {
      const updated = [...s.sections];
      updated[editingIndex] = editingValue.trim();
      return { sections: updated };
    });
    setEditingIndex(null);
    setEditingValue("");
  };

  const saveSongName = () => {
    if (!songNameValue.trim()) return;
    updateSong(song.id, () => ({ name: songNameValue.trim() }));
    setEditingSongName(false);
  };

  // Merge view — collect all checked cells across all songs
  const allSections = [...new Set(songs.flatMap((s) => s.sections))];
  const getMergeCell = (sectionName, colIndex) => {
    const results = [];
    songs.forEach((s) => {
      const rowIndex = s.sections.indexOf(sectionName);
      if (rowIndex !== -1 && s.checked[`${rowIndex}-${colIndex}`]) {
        results.push(s.color);
      }
    });
    return results;
  };

  const isMerge = activeTab === 4;

  return (
    <>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { text-shadow: 0 0 8px #39ff14, 0 0 20px #39ff14; }
          50%       { text-shadow: 0 0 20px #39ff14, 0 0 40px #39ff14; }
        }
        .loading-text { animation: pulse-glow 1.2s ease-in-out infinite; }
        @keyframes fadeOut { 0% { opacity:1; } 100% { opacity:0; } }
        .splash-fade { animation: fadeOut 1.1s ease-in-out forwards; }
        * { box-sizing: border-box; }
        body { background: #000; margin: 0; }
        .chrome-text {
          background: linear-gradient(180deg, #fff 0%, #aaa 30%, #39ff14 65%, #1a7a00 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .chrome-input {
          background: #050a05;
          border: 1px solid rgba(57,255,20,0.2);
          color: #ccc; border-radius: 8px;
          padding: 8px 12px; width: 100%;
          outline: none; font-size: 13px;
        }
        .chrome-input:focus {
          border-color: rgba(57,255,20,0.6);
          box-shadow: 0 0 8px rgba(57,255,20,0.2);
        }
        .icon-btn {
          background: none; border: none; cursor: pointer;
          padding: 4px 6px; border-radius: 6px;
          font-size: 14px; line-height: 1; transition: background 0.15s;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.08); }
        .add-btn {
          background: linear-gradient(135deg, #1a3a1a, #0a1a0a);
          border: 1px solid rgba(57,255,20,0.4);
          color: #39ff14; border-radius: 8px;
          padding: 8px 16px; cursor: pointer;
          font-size: 13px; font-weight: 700;
          letter-spacing: 0.1em; transition: all 0.2s; white-space: nowrap;
        }
        .add-btn:hover { box-shadow: 0 0 12px rgba(57,255,20,0.3); }
        .glow-bar { box-shadow: 0 0 10px rgba(57,255,20,0.4); }
        .chrome-row { transition: background 0.15s; }
        .chrome-row:hover { background: rgba(255,255,255,0.02) !important; }

        /* Scrollable table with sticky first column */
        .table-wrap {
          overflow-x: auto;
          border-radius: 16px;
          border: 1px solid rgba(57,255,20,0.25);
          margin-bottom: 24px;
          -webkit-overflow-scrolling: touch;
        }
        .section-table {
          width: max-content;
          min-width: 100%;
          border-collapse: collapse;
        }
        .sticky-col {
          position: sticky;
          left: 0;
          z-index: 2;
          background: #080d08;
          min-width: 140px;
          max-width: 140px;
        }
        .sticky-col-head {
          position: sticky;
          left: 0;
          z-index: 3;
          background: #111811;
          min-width: 140px;
        }
      `}</style>

      {/* APP */}
      <div style={{ minHeight: "100vh", background: "#000", color: "#ccc" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 12px" }}>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
            padding: "12px 16px", borderRadius: 16,
            background: "linear-gradient(145deg, #0a0f0a, #111811)",
            border: "1px solid rgba(57,255,20,0.3)",
            boxShadow: "0 0 30px rgba(57,255,20,0.08)",
          }}>
            <div style={{
              width: 52, height: 52, flexShrink: 0,
              borderRadius: 10, overflow: "hidden",
              border: "1px solid rgba(57,255,20,0.3)",
              boxShadow: "0 0 12px rgba(57,255,20,0.4)",
            }}>
              <img src="/launchericon-192x192.png" alt="Logo" style={{
                width: 52, height: 52, objectFit: "cover",
                mixBlendMode: "screen",
                filter: "sepia(1) saturate(3) hue-rotate(70deg) brightness(0.9)",
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <img src={LOGO_TEXT} alt="Dog Bones" style={{
                width: "100%", maxWidth: 240, height: 48,
                objectFit: "cover", objectPosition: "center",
                mixBlendMode: "screen", display: "block",
              }} />
              <p style={{ color: "rgba(57,255,20,0.5)", fontSize: 10, letterSpacing: "0.3em", marginTop: 2 }}>
                SONG SECTION ORGANIZER
              </p>
            </div>
          </div>

          {/* Song Tabs */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 16,
            overflowX: "auto", paddingBottom: 4,
          }}>
            {songs.map((s, i) => (
              <button key={i} onClick={() => setActiveTab(i)} style={{
                flex: "0 0 auto",
                padding: "8px 14px", borderRadius: 10,
                border: `1px solid ${activeTab === i ? s.color.hex : "rgba(255,255,255,0.1)"}`,
                background: activeTab === i ? s.color.tab : "transparent",
                color: activeTab === i ? s.color.hex : "#666",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                letterSpacing: "0.05em", whiteSpace: "nowrap",
                boxShadow: activeTab === i ? `0 0 12px ${s.color.hex}44` : "none",
                transition: "all 0.2s",
              }}>
                {s.name}
              </button>
            ))}
            <button onClick={() => setActiveTab(4)} style={{
              flex: "0 0 auto",
              padding: "8px 14px", borderRadius: 10,
              border: `1px solid ${activeTab === 4 ? "#fff" : "rgba(255,255,255,0.1)"}`,
              background: activeTab === 4 ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === 4 ? "#fff" : "#666",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.05em",
              transition: "all 0.2s",
            }}>
              ⚡ MERGE
            </button>
          </div>

          {/* MERGE VIEW */}
          {isMerge ? (
            <div>
              <div style={{
                padding: "16px 20px", borderRadius: 16, marginBottom: 16,
                background: "linear-gradient(145deg, #0a0f0a, #111811)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}>
                <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: "0.1em" }}>
                  ⚡ MERGE VIEW
                </h2>
                <p style={{ color: "#666", fontSize: 11, letterSpacing: "0.15em" }}>
                  COLOR = WHICH SONG THE PART COMES FROM
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                  {songs.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color.hex }} />
                      <span style={{ color: s.color.hex, fontSize: 11, fontWeight: 700 }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="table-wrap">
                <table className="section-table">
                  <thead>
                    <tr style={{ background: "#111811" }}>
                      <th className="sticky-col-head" style={{
                        padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)",
                        textAlign: "left", fontSize: 10, letterSpacing: "0.15em", color: "#aaa",
                      }}>
                        SECTION
                      </th>
                      {DEFAULT_INSTRUMENTS.map((inst) => (
                        <th key={inst} style={{
                          padding: "12px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)",
                          textAlign: "center", whiteSpace: "nowrap",
                          fontSize: 10, letterSpacing: "0.1em", color: "#aaa",
                          minWidth: 80,
                        }}>
                          {inst.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allSections.map((section, rowIndex) => (
                      <tr key={section} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td className="sticky-col" style={{
                          padding: "10px 14px", fontSize: 12, color: "#aaa", fontWeight: 600,
                        }}>
                          {section}
                        </td>
                        {DEFAULT_INSTRUMENTS.map((_, colIndex) => {
                          const colors = getMergeCell(section, colIndex);
                          return (
                            <td key={colIndex} style={{ padding: "8px 10px", textAlign: "center" }}>
                              {colors.length === 0 ? (
                                <div style={{
                                  width: 20, height: 20, margin: "0 auto",
                                  border: "2px solid rgba(255,255,255,0.1)",
                                  borderRadius: 4, background: "#000",
                                }} />
                              ) : (
                                <div style={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                                  {colors.map((c, ci) => (
                                    <div key={ci} style={{
                                      width: 16, height: 16,
                                      borderRadius: 3,
                                      background: c.hex,
                                      boxShadow: `0 0 6px ${c.hex}88`,
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
              {/* Song Name */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 16, padding: "12px 16px", borderRadius: 16,
                background: "linear-gradient(145deg, #0a0f0a, #111811)",
                border: `1px solid ${song.color.hex}44`,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: song.color.hex,
                  boxShadow: `0 0 8px ${song.color.hex}`,
                  flexShrink: 0,
                }} />
                {editingSongName ? (
                  <>
                    <input
                      className="chrome-input"
                      style={{ borderColor: song.color.hex + "66" }}
                      value={songNameValue}
                      onChange={(e) => setSongNameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveSongName()}
                      autoFocus
                    />
                    <button className="icon-btn" onClick={saveSongName} style={{ color: song.color.hex }}>✓</button>
                    <button className="icon-btn" onClick={() => setEditingSongName(false)} style={{ color: "#666" }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ color: song.color.hex, fontWeight: 700, fontSize: 15, flex: 1 }}>
                      {song.name}
                    </span>
                    <button className="icon-btn" onClick={() => { setEditingSongName(true); setSongNameValue(song.name); }}
                      style={{ color: song.color.hex, fontSize: 13 }}>✏️</button>
                  </>
                )}
              </div>

              {/* Add Section */}
              <div style={{
                display: "flex", gap: 10, marginBottom: 16,
                padding: "12px 16px", borderRadius: 16,
                background: "linear-gradient(145deg, #0a0f0a, #111811)",
                border: `1px solid ${song.color.hex}33`,
              }}>
                <input
                  className="chrome-input"
                  placeholder="New section name..."
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSection()}
                  style={{ borderColor: song.color.hex + "33" }}
                />
                <button className="add-btn"
                  onClick={addSection}
                  style={{ borderColor: song.color.hex + "66", color: song.color.hex }}>
                  + ADD
                </button>
              </div>

              {/* Table */}
              <div className="table-wrap" style={{ border: `1px solid ${song.color.hex}33` }}>
                <table className="section-table">
                  <thead>
                    <tr style={{ background: "#111811" }}>
                      <th className="sticky-col-head" style={{
                        padding: "12px 14px",
                        borderBottom: `1px solid ${song.color.hex}44`,
                        textAlign: "left", fontSize: 10, letterSpacing: "0.15em",
                        color: song.color.hex,
                      }}>
                        SECTION
                      </th>
                      {DEFAULT_INSTRUMENTS.map((inst) => (
                        <th key={inst} style={{
                          padding: "12px 10px",
                          borderBottom: `1px solid ${song.color.hex}44`,
                          textAlign: "center", whiteSpace: "nowrap",
                          fontSize: 10, letterSpacing: "0.1em",
                          color: song.color.hex, minWidth: 80,
                        }}>
                          {inst.toUpperCase()}
                        </th>
                      ))}
                      <th style={{
                        padding: "12px 10px",
                        borderBottom: `1px solid ${song.color.hex}44`,
                        textAlign: "center", fontSize: 10,
                        color: song.color.hex, minWidth: 70,
                      }}>
                        EDIT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {song.sections.map((section, rowIndex) => (
                      <tr
                        key={section + rowIndex}
                        draggable
                        onDragStart={() => handleDragStart(rowIndex)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(rowIndex)}
                        className="chrome-row"
                        style={{
                          borderBottom: `1px solid ${song.color.hex}18`,
                          opacity: draggedIndex === rowIndex ? 0.4 : 1,
                          cursor: "grab",
                        }}
                      >
                        <td className="sticky-col" style={{
                          padding: "10px 14px", fontSize: 12,
                          color: "#aaa", fontWeight: 600,
                        }}>
                          {editingIndex === rowIndex ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input
                                className="chrome-input"
                                style={{ padding: "4px 8px", fontSize: 12 }}
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                                autoFocus
                              />
                              <button className="icon-btn" onClick={saveEdit} style={{ color: song.color.hex }}>✓</button>
                              <button className="icon-btn" onClick={() => setEditingIndex(null)} style={{ color: "#666" }}>✕</button>
                            </div>
                          ) : (
                            <>
                              <span style={{ color: song.color.hex + "66", marginRight: 6 }}>☰</span>
                              {section}
                            </>
                          )}
                        </td>
                        {DEFAULT_INSTRUMENTS.map((_, colIndex) => {
                          const key = `${rowIndex}-${colIndex}`;
                          const isChecked = !!song.checked[key];
                          return (
                            <td key={colIndex} style={{ padding: "10px", textAlign: "center" }}>
                              <div
                                onClick={() => toggleChecked(rowIndex, colIndex)}
                                style={{
                                  width: 22, height: 22, margin: "0 auto",
                                  border: `2px solid ${isChecked ? song.color.hex : song.color.hex + "44"}`,
                                  borderRadius: 5, background: "#000",
                                  cursor: "pointer", position: "relative",
                                  boxShadow: isChecked ? `0 0 8px ${song.color.hex}88` : "none",
                                  transition: "all 0.15s",
                                }}
                              >
                                {isChecked && (
                                  <div style={{
                                    position: "absolute",
                                    left: 4, top: 1,
                                    width: 8, height: 12,
                                    border: `2px solid ${song.color.hex}`,
                                    borderTop: "none", borderLeft: "none",
                                    transform: "rotate(45deg)",
                                  }} />
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ padding: "10px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <button className="icon-btn" onClick={() => startEdit(rowIndex)}
                            style={{ color: song.color.hex, marginRight: 2 }}>✏️</button>
                          <button className="icon-btn" onClick={() => removeSection(rowIndex)}
                            style={{ color: "#ff4444" }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes / BPM / Key */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 16 }}>
                <div style={{
                  borderRadius: 16, padding: 16,
                  background: "linear-gradient(145deg, #0a0f0a, #111811)",
                  border: `1px solid ${song.color.hex}33`,
                }}>
                  <h2 style={{ color: song.color.hex, fontSize: 13, fontWeight: 700, marginBottom: 10, letterSpacing: "0.1em" }}>
                    NOTES
                  </h2>
                  <textarea
                    className="chrome-input"
                    style={{ height: 100, resize: "none", fontFamily: "monospace", borderColor: song.color.hex + "33" }}
                    placeholder="Session notes..."
                    value={song.notes}
                    onChange={(e) => updateSong(song.id, () => ({ notes: e.target.value }))}
                  />
                </div>
                <div style={{
                  borderRadius: 16, padding: 16,
                  background: "linear-gradient(145deg, #0a0f0a, #111811)",
                  border: `1px solid ${song.color.hex}33`,
                }}>
                  <h2 style={{ color: song.color.hex, fontSize: 13, fontWeight: 700, marginBottom: 10, letterSpacing: "0.1em" }}>
                    TEMPO & KEY
                  </h2>
                  <input className="chrome-input" style={{ marginBottom: 8, borderColor: song.color.hex + "33" }}
                    placeholder="BPM" value={song.bpm}
                    onChange={(e) => updateSong(song.id, () => ({ bpm: e.target.value }))} />
                  <input className="chrome-input" style={{ borderColor: song.color.hex + "33" }}
                    placeholder="Key (e.g. A minor)" value={song.key}
                    onChange={(e) => updateSong(song.id, () => ({ key: e.target.value }))} />
                </div>
                <div style={{
                  borderRadius: 16, padding: 16,
                  background: "linear-gradient(145deg, #0a0f0a, #111811)",
                  border: `1px solid ${song.color.hex}33`,
                }}>
                  <h2 style={{ color: song.color.hex, fontSize: 13, fontWeight: 700, marginBottom: 10, letterSpacing: "0.1em" }}>
                    TIPS
                  </h2>
                  <ul style={{ fontSize: 11, color: "#888", lineHeight: 2, listStyle: "none", padding: 0 }}>
                    <li><span style={{ color: song.color.hex }}>▸</span> Drag rows to rearrange</li>
                    <li><span style={{ color: song.color.hex }}>▸</span> ✏️ rename a section</li>
                    <li><span style={{ color: song.color.hex }}>▸</span> 🗑️ delete a section</li>
                    <li><span style={{ color: song.color.hex }}>▸</span> MERGE to compare songs</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SPLASH */}
      {(phase === "loading" || phase === "fading") && (
        <div className={phase === "fading" ? "splash-fade" : ""}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "#000", overflow: "hidden",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "flex-end",
          }}>
          <img src={SPLASH_IMG} alt="Dog Bones" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)",
          }} />
          {phase === "loading" && (
            <div style={{
              position: "relative", zIndex: 2, width: "100%",
              padding: "0 32px 48px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            }}>
              <span className="loading-text" style={{
                color: "#39ff14", fontSize: 13,
                letterSpacing: "0.4em", fontFamily: "monospace", fontWeight: 700,
              }}>LOADING</span>
              <div style={{
                width: "100%", height: 4,
                background: "rgba(57,255,20,0.2)",
                borderRadius: 2, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: "linear-gradient(90deg, #1a7a00, #39ff14)",
                  borderRadius: 2, boxShadow: "0 0 12px #39ff14",
                  transition: "width 0.03s linear",
                }} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
                                                         }

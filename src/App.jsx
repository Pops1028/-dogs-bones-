import { useEffect, useState } from "react";

const SPLASH_IMG = "/Screenshot_20260514_110057_ChatGPT~2.jpg";
const LOGO_TEXT = "/Screenshot_20260514_221551_Photos~2.jpg";

export default function App() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("loading");
  const [draggedIndex, setDraggedIndex] = useState(null);

  const [songSections, setSongSections] = useState([
    "Intro", "Pre-Verse", "Verse", "Chorus", "Between Verse",
    "2nd Verse", "Breakdown", "Guitar Solo", "Interlude", "Chorus Outro",
  ]);

  const instruments = [
    "Guitar", "Bass", "Drums", "Vocals", "Lead Guitar", "Synth", "Backing Vocals",
  ];

  const [checked, setChecked] = useState({});

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

  const toggleChecked = (rowIndex, colIndex) => {
    const key = `${rowIndex}-${colIndex}`;
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDragStart = (index) => setDraggedIndex(index);
  const handleDrop = (targetIndex) => {
    if (draggedIndex === null) return;
    const updated = [...songSections];
    const item = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, item);
    setSongSections(updated);
    setDraggedIndex(null);
  };

  const timelineWidths = ["15%","20%","55%","70%","25%","55%","35%","30%","20%","60%"];
  const timelineOffsets = ["0%","10%","0%","5%","15%","0%","10%","20%","5%","0%"];

  const chrome = "linear-gradient(180deg, #e8e8e8 0%, #a0a0a0 30%, #39ff14 60%, #1a7a00 100%)";
  const chromeBorder = "1px solid rgba(57,255,20,0.3)";
  const cardBg = "linear-gradient(145deg, #0a0a0a, #111411)";

  return (
    <>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { text-shadow: 0 0 8px #39ff14, 0 0 20px #39ff14; }
          50%       { text-shadow: 0 0 20px #39ff14, 0 0 40px #39ff14; }
        }
        .loading-text { animation: pulse-glow 1.2s ease-in-out infinite; }
        @keyframes fadeOut {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        .splash-fade { animation: fadeOut 1.1s ease-in-out forwards; }
        * { box-sizing: border-box; }
        body { background: #000; margin: 0; }

        .chrome-text {
          background: linear-gradient(180deg, #ffffff 0%, #aaaaaa 30%, #39ff14 65%, #1a7a00 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .chrome-card {
          background: linear-gradient(145deg, #0a0f0a, #111811);
          border: 1px solid rgba(57,255,20,0.25);
          box-shadow: 0 0 20px rgba(57,255,20,0.05), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .chrome-header {
          background: linear-gradient(180deg, #1a1a1a 0%, #0a0f0a 100%);
          border-bottom: 1px solid rgba(57,255,20,0.3);
        }
        .chrome-row:hover {
          background: linear-gradient(90deg, rgba(57,255,20,0.05), transparent) !important;
        }
        .chrome-row-dragging {
          opacity: 0.4;
          background: rgba(57,255,20,0.1) !important;
        }
        .chrome-input {
          background: #050a05;
          border: 1px solid rgba(57,255,20,0.2);
          color: #ccc;
          border-radius: 8px;
          padding: 8px 12px;
          width: 100%;
          outline: none;
        }
        .chrome-input:focus {
          border-color: rgba(57,255,20,0.6);
          box-shadow: 0 0 8px rgba(57,255,20,0.2);
        }
        .chrome-checkbox {
          accent-color: #39ff14;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .glow-bar {
          box-shadow: 0 0 10px rgba(57,255,20,0.5), 0 0 20px rgba(57,255,20,0.2);
        }
      `}</style>

      {/* APP */}
      <div style={{ minHeight: "100vh", background: "#000", color: "#ccc" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 32,
            padding: "16px 20px", borderRadius: 16,
            background: "linear-gradient(145deg, #0a0f0a, #111811)",
            border: "1px solid rgba(57,255,20,0.3)",
            boxShadow: "0 0 30px rgba(57,255,20,0.08)",
          }}>
            <div style={{
              width: 60, height: 60, flexShrink: 0,
              borderRadius: 12, overflow: "hidden",
              border: "1px solid rgba(57,255,20,0.3)",
              boxShadow: "0 0 12px rgba(57,255,20,0.2)",
            }}>
              <img
                src="/launchericon-192x192.png"
                alt="Logo"
                style={{ width: 60, height: 60, objectFit: "cover", mixBlendMode: "screen" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <img
                src={LOGO_TEXT}
                alt="Dog Bones"
                style={{
                  width: "100%", maxWidth: 280, height: 55,
                  objectFit: "cover", objectPosition: "center",
                  mixBlendMode: "screen", display: "block",
                }}
              />
              <p style={{ color: "rgba(57,255,20,0.5)", fontSize: 11, letterSpacing: "0.3em", marginTop: 2 }}>
                SONG SECTION ORGANIZER
              </p>
            </div>
          </div>

          {/* Grid Table */}
          <div style={{
            overflowX: "auto", borderRadius: 16,
            border: "1px solid rgba(57,255,20,0.25)",
            boxShadow: "0 0 30px rgba(57,255,20,0.05)",
            marginBottom: 24,
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "linear-gradient(180deg, #111811, #0a0f0a)" }}>
                  <th style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid rgba(57,255,20,0.3)",
                    textAlign: "left", minWidth: 160,
                    position: "sticky", left: 0,
                    background: "#111811",
                    fontSize: 12, letterSpacing: "0.15em",
                    background: "linear-gradient(180deg, #ffffff 0%, #aaaaaa 30%, #39ff14 65%, #1a7a00 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                    SONG SECTION
                  </th>
                  {instruments.map((inst) => (
                    <th key={inst} style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid rgba(57,255,20,0.3)",
                      textAlign: "center", whiteSpace: "nowrap",
                      fontSize: 11, letterSpacing: "0.1em",
                      background: "linear-gradient(180deg, #ffffff 0%, #aaaaaa 30%, #39ff14 65%, #1a7a00 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}>
                      {inst.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {songSections.map((section, rowIndex) => (
                  <tr
                    key={section}
                    draggable
                    onDragStart={() => handleDragStart(rowIndex)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(rowIndex)}
                    className={`chrome-row ${draggedIndex === rowIndex ? "chrome-row-dragging" : ""}`}
                    style={{ cursor: "grab", borderBottom: "1px solid rgba(57,255,20,0.1)" }}
                  >
                    <td style={{
                      padding: "12px 16px", fontWeight: 600,
                      position: "sticky", left: 0,
                      background: "#080d08",
                      color: "#aaa", fontSize: 13,
                    }}>
                      <span style={{ color: "rgba(57,255,20,0.4)", marginRight: 8 }}>☰</span>
                      {section}
                    </td>
                    {instruments.map((_, colIndex) => {
                      const key = `${rowIndex}-${colIndex}`;
                      return (
                        <td key={colIndex} style={{ padding: "12px 16px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className="chrome-checkbox"
                            checked={!!checked[key]}
                            onChange={() => toggleChecked(rowIndex, colIndex)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DAW Timeline */}
          <div style={{
            borderRadius: 16, padding: 24, marginBottom: 24,
            background: "linear-gradient(145deg, #0a0f0a, #111811)",
            border: "1px solid rgba(57,255,20,0.25)",
            boxShadow: "0 0 30px rgba(57,255,20,0.05)",
          }}>
            <h2 className="chrome-text" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, letterSpacing: "0.1em" }}>
              DAW TIMELINE
            </h2>
            <p style={{ color: "rgba(57,255,20,0.4)", fontSize: 11, letterSpacing: "0.2em", marginBottom: 20 }}>
              STUDIO ARRANGEMENT VIEW
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {songSections.map((section, index) => (
                <div key={section + "tl"} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 110, fontSize: 11, color: "#888", letterSpacing: "0.05em", flexShrink: 0 }}>
                    {section.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, position: "relative", height: 28 }}>
                    <div
                      className="glow-bar"
                      style={{
                        position: "absolute", height: "100%",
                        left: timelineOffsets[index] || "0%",
                        width: timelineWidths[index] || "50%",
                        background: "linear-gradient(90deg, #1a3a1a, #39ff14)",
                        borderRadius: 6,
                        display: "flex", alignItems: "center", paddingLeft: 8,
                      }}
                    >
                      <span style={{ fontSize: 10, color: "#000", fontWeight: 700, opacity: 0.8 }}>
                        {section}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div style={{
              borderRadius: 16, padding: 20,
              background: "linear-gradient(145deg, #0a0f0a, #111811)",
              border: "1px solid rgba(57,255,20,0.25)",
            }}>
              <h2 className="chrome-text" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>
                NOTES
              </h2>
              <textarea
                className="chrome-input"
                style={{ height: 140, resize: "none", fontFamily: "monospace" }}
                placeholder="Session notes..."
              />
            </div>

            <div style={{
              borderRadius: 16, padding: 20,
              background: "linear-gradient(145deg, #0a0f0a, #111811)",
              border: "1px solid rgba(57,255,20,0.25)",
            }}>
              <h2 className="chrome-text" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>
                TEMPO & KEY
              </h2>
              <input className="chrome-input" style={{ marginBottom: 10 }} placeholder="BPM (e.g. 120)" />
              <input className="chrome-input" placeholder="Key (e.g. A minor)" />
            </div>

            <div style={{
              borderRadius: 16, padding: 20,
              background: "linear-gradient(145deg, #0a0f0a, #111811)",
              border: "1px solid rgba(57,255,20,0.25)",
            }}>
              <h2 className="chrome-text" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>
                TIPS
              </h2>
              <ul style={{ fontSize: 12, color: "#888", lineHeight: 2, listStyle: "none", padding: 0 }}>
                <li><span style={{ color: "#39ff14" }}>▸</span> Drag sections to rearrange</li>
                <li><span style={{ color: "#39ff14" }}>▸</span> Green = active session mode</li>
                <li><span style={{ color: "#39ff14" }}>▸</span> Timeline shows structure flow</li>
                <li><span style={{ color: "#39ff14" }}>▸</span> Check instruments per section</li>
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* SPLASH */}
      {(phase === "loading" || phase === "fading") && (
        <div
          className={phase === "fading" ? "splash-fade" : ""}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "#000", overflow: "hidden",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "flex-end",
          }}
        >
          <img src={SPLASH_IMG} alt="Dog Bones" style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)",
          }} />
          {phase === "loading" && (
            <div style={{
              position: "relative", zIndex: 2,
              width: "100%", padding: "0 32px 48px",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 12,
            }}>
              <span className="loading-text" style={{
                color: "#39ff14", fontSize: 13,
                letterSpacing: "0.4em", fontFamily: "monospace", fontWeight: 700,
              }}>
                LOADING
              </span>
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

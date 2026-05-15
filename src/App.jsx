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
      `}</style>

      {/* APP — always visible underneath */}
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-8 flex items-center gap-3">
            <div style={{
              background: "#000",
              borderRadius: 8,
              overflow: "hidden",
              width: 55,
              height: 55,
              flexShrink: 0,
            }}>
              <img
                src="/192.png"
                alt="Dog Bones Logo"
                style={{
                  width: 55,
                  height: 55,
                  objectFit: "contain",
                  mixBlendMode: "screen",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <img
                src={LOGO_TEXT}
                alt="Dog Bones"
                style={{
                  width: "100%",
                  maxWidth: 320,
                  height: 60,
                  objectFit: "cover",
                  objectPosition: "center",
                  mixBlendMode: "screen",
                  display: "block",
                }}
              />
              <p className="text-gray-400 text-sm mt-1">Song Section Organizer</p>
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-zinc-900 shadow-2xl">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zinc-800 text-left">
                  <th className="p-4 border-b border-gray-700 sticky left-0 bg-zinc-800 z-10 min-w-[180px]">
                    Song Section
                  </th>
                  {instruments.map((inst) => (
                    <th key={inst} className="p-4 border-b border-gray-700 text-center whitespace-nowrap">
                      {inst}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {songSections.map((section, rowIndex) => (
                  <tr key={section} draggable
                    onDragStart={() => handleDragStart(rowIndex)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(rowIndex)}
                    className={`cursor-move transition-colors ${
                      draggedIndex === rowIndex ? "opacity-40 bg-zinc-700" : "hover:bg-zinc-800"
                    }`}>
                    <td className="p-4 border-b border-gray-800 font-semibold sticky left-0 bg-zinc-900">
                      <span className="mr-2 text-gray-500">☰</span>{section}
                    </td>
                    {instruments.map((_, colIndex) => {
                      const key = `${rowIndex}-${colIndex}`;
                      return (
                        <td key={colIndex} className="p-4 border-b border-gray-800 text-center">
                          <input type="checkbox"
                            className="w-5 h-5 accent-green-400 cursor-pointer"
                            checked={!!checked[key]}
                            onChange={() => toggleChecked(rowIndex, colIndex)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DAW Timeline */}
          <div className="mt-10 bg-zinc-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">DAW Timeline View</h2>
            <p className="text-gray-400 text-sm mb-6">Green-themed studio arrangement view</p>
            <div className="space-y-3">
              {songSections.map((section, index) => (
                <div key={section + "tl"} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-300 shrink-0">{section}</div>
                  <div className="flex-1 relative h-8">
                    <div className="absolute h-full rounded-md flex items-center px-2"
                      style={{
                        left: timelineOffsets[index] || "0%",
                        width: timelineWidths[index] || "50%",
                        background: "linear-gradient(90deg, #16a34a, #4ade80)",
                        boxShadow: "0 0 8px rgba(74,222,128,0.3)",
                      }}>
                      <span className="text-xs text-black font-semibold truncate opacity-70">
                        {section}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-3">Notes</h2>
              <textarea
                className="w-full h-40 bg-zinc-950 p-3 rounded-xl text-sm text-gray-200 resize-none focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="Session notes..."
              />
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-3">Tempo & Key</h2>
              <input className="w-full mb-3 p-2 bg-zinc-950 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500" placeholder="BPM (e.g. 120)" />
              <input className="w-full p-2 bg-zinc-950 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500" placeholder="Key (e.g. A minor)" />
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-3">Tips</h2>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>🎵 Drag sections to rearrange</li>
                <li>🟢 Green theme = active session mode</li>
                <li>📊 Use timeline for structure flow</li>
                <li>✅ Check instruments per section</li>
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* SPLASH — sits on top and fades away */}
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
                boxShadow: "0 0 10px rgba(57,255,20,0.3)",
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

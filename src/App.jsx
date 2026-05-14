

import { useEffect, useState } from "react";

export default function App() { const [loading, setLoading] = useState(true);

const [songSections, setSongSections] = useState([ "Intro", "Pre-Verse", "Verse", "Chorus", "Between Verse", "2nd Verse", "Breakdown", "Guitar Solo", "Interlude", "Chorus Outro" ]);

const instruments = [ "Guitar", "Bass", "Drums", "Vocals", "Lead Guitar", "Synth", "Backing Vocals" ];

const [draggedIndex, setDraggedIndex] = useState(null);

useEffect(() => { const t = setTimeout(() => setLoading(false), 2500); return () => clearTimeout(t); }, []);

const handleDragStart = (index) => setDraggedIndex(index);

const handleDrop = (targetIndex) => { if (draggedIndex === null) return;

const updated = [...songSections];
const item = updated[draggedIndex];

updated.splice(draggedIndex, 1);
updated.splice(targetIndex, 0, item);

setSongSections(updated);
setDraggedIndex(null);

};

if (loading) { return ( <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden"> <style>{@keyframes glow { 0% { filter: drop-shadow(0 0 10px #00ff66); transform: scale(0.95); opacity: 0; } 50% { filter: drop-shadow(0 0 25px #00ff66); transform: scale(1.05); opacity: 1; } 100% { filter: drop-shadow(0 0 15px #00ff66); transform: scale(1); opacity: 1; } } .glow { animation: glow 2.2s ease-in-out forwards; }}</style>

<div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />

    <img
      src="/logo.png"
      alt="Dog Bones"
      className="w-60 h-60 object-contain glow z-10"
    />
  </div>
);

}

return ( <div className="min-h-screen bg-black text-white p-6"> <div className="max-w-7xl mx-auto"> <div className="mb-8"> <h1 className="text-4xl font-bold mb-2">Dog Bones 🎸</h1> <p className="text-gray-400">Song Section Organizer</p> </div>

<div className="overflow-x-auto rounded-2xl border border-gray-800 bg-zinc-900 shadow-2xl">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-zinc-800 text-left">
            <th className="p-4 border-b border-gray-700 sticky left-0 bg-zinc-800 z-10 min-w-[180px]">
              Song Section
            </th>

            {instruments.map((instrument) => (
              <th key={instrument} className="p-4 border-b border-gray-700 text-center">
                {instrument}
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
              className="cursor-move hover:bg-zinc-800"
            >
              <td className="p-4 border-b border-gray-800 font-semibold sticky left-0 bg-inherit">
                ☰ {section}
              </td>

              {instruments.map((instrument) => (
                <td key={instrument} className="p-4 border-b border-gray-800 text-center">
                  <input type="checkbox" className="w-5 h-5 accent-green-400" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="mt-10 bg-zinc-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
      <h2 className="text-2xl font-bold mb-2">DAW Timeline View</h2>
      <p className="text-gray-400 text-sm mb-6">Green-themed studio arrangement view</p>

      <div className="space-y-4">
        {songSections.map((section, index) => (
          <div key={section + "timeline"} className="flex items-center gap-4">
            <div className="w-32 text-sm text-gray-300">{section}</div>
            <div className="flex-1 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-400 shadow-lg" />
          </div>
        ))}
      </div>
    </div>

    <div className="grid md:grid-cols-3 gap-6 mt-8">
      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold mb-3">Notes</h2>
        <textarea className="w-full h-40 bg-zinc-950 p-3 rounded-xl" />
      </div>

      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold mb-3">Tempo & Key</h2>
        <input className="w-full mb-3 p-2 bg-zinc-950 rounded" placeholder="BPM" />
        <input className="w-full p-2 bg-zinc-950 rounded" placeholder="Key" />
      </div>

      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold mb-3">Tips</h2>
        <ul className="text-sm text-gray-300 space-y-2">
          <li>Drag sections to rearrange</li>
          <li>Green theme = active session mode</li>
          <li>Use timeline for structure flow</li>
        </ul>
      </div>
    </div>
  </div>
</div>

); }

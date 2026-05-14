import { useState } from "react";

export default function App() { const [songSections, setSongSections] = useState([ "Intro", "Pre-Verse", "Verse", "Chorus", "Between Verse", "2nd Verse", "Breakdown", "Guitar Solo", "Interlude", "Chorus Outro" ]);

const instruments = [ "Guitar", "Bass", "Drums", "Vocals", "Lead Guitar", "Synth", "Backing Vocals" ];

const [draggedIndex, setDraggedIndex] = useState(null);

const handleDragStart = (index) => { setDraggedIndex(index); };

const handleDrop = (targetIndex) => { if (draggedIndex === null) return;

const updatedSections = [...songSections];
const draggedItem = updatedSections[draggedIndex];

updatedSections.splice(draggedIndex, 1);
updatedSections.splice(targetIndex, 0, draggedItem);

setSongSections(updatedSections);
setDraggedIndex(null);

};

return ( <div className="min-h-screen bg-black text-white p-6"> <div className="max-w-7xl mx-auto"> <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"> <div> <h1 className="text-4xl font-bold mb-2">Dog Bones 🎸</h1> <p className="text-gray-400"> Drag-and-Drop Song Organizer </p> </div>

<div className="bg-zinc-900 border border-gray-800 rounded-2xl px-5 py-3 text-sm text-gray-300 shadow-xl">
        Hold and drag song sections to rearrange your structure.
      </div>
    </div>

    <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-zinc-900 shadow-2xl">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-zinc-800 text-left">
            <th className="p-4 border-b border-gray-700 sticky left-0 bg-zinc-800 z-10 min-w-[220px]">
              Song Section
            </th>

            {instruments.map((instrument) => (
              <th
                key={instrument}
                className="p-4 border-b border-gray-700 min-w-[140px] text-center"
              >
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
              className={`cursor-move transition-all duration-200 ${
                rowIndex % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950"
              } hover:bg-zinc-800`}
            >
              <td className="p-4 border-b border-gray-800 font-semibold sticky left-0 bg-inherit z-10">
                <div className="flex items-center gap-3">
                  <span className="text-red-400 text-lg">☰</span>
                  {section}
                </div>
              </td>

              {instruments.map((instrument) => (
                <td
                  key={instrument}
                  className="p-4 border-b border-gray-800 text-center"
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-red-500"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="grid md:grid-cols-3 gap-6 mt-8">
      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800 shadow-xl">
        <h2 className="text-xl font-bold mb-3">Song Notes</h2>
        <textarea
          placeholder="Write arrangement notes here..."
          className="w-full h-40 bg-zinc-950 border border-gray-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800 shadow-xl">
        <h2 className="text-xl font-bold mb-3">Tempo & Key</h2>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="BPM"
            className="w-full bg-zinc-950 border border-gray-700 rounded-xl p-3"
          />

          <input
            type="text"
            placeholder="Song Key"
            className="w-full bg-zinc-950 border border-gray-700 rounded-xl p-3"
          />
        </div>
      </div>

      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800 shadow-xl">
        <h2 className="text-xl font-bold mb-3">Arrangement Tips</h2>

        <ul className="space-y-2 text-gray-300 text-sm">
          <li>• Drag sections to test new song flow</li>
          <li>• Use breakdowns to create tension</li>
          <li>• Add silence before final chorus</li>
          <li>• Layer harmonies during outros</li>
        </ul>
      </div>
    </div>
  </div>
</div>

); }

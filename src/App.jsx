export default function App() { const songSections = [ "Intro", "Pre-Verse", "Verse", "Chorus", "Between Verse", "2nd Verse", "Breakdown", "Guitar Solo", "Interlude", "Chorus Outro" ];

const instruments = [ "Guitar", "Bass", "Drums", "Vocals", "Lead Guitar", "Synth", "Backing Vocals" ];

return ( <div className="min-h-screen bg-black text-white p-6"> <div className="max-w-7xl mx-auto"> <div className="mb-8"> <h1 className="text-4xl font-bold mb-2">Dog Bones 🎸</h1> <p className="text-gray-400"> Song Section Organizer </p> </div>

<div className="overflow-x-auto rounded-2xl border border-gray-800 bg-zinc-900 shadow-2xl">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-zinc-800 text-left">
            <th className="p-4 border-b border-gray-700 sticky left-0 bg-zinc-800 z-10 min-w-[180px]">
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
              className={rowIndex % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950"}
            >
              <td className="p-4 border-b border-gray-800 font-semibold sticky left-0 bg-inherit z-10">
                {section}
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
      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold mb-3">Song Notes</h2>
        <textarea
          placeholder="Write arrangement notes here..."
          className="w-full h-40 bg-zinc-950 border border-gray-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
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

      <div className="bg-zinc-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold mb-3">Quick Ideas</h2>

        <ul className="space-y-2 text-gray-300 text-sm">
          <li>• Add harmony in chorus</li>
          <li>• Strip drums during breakdown</li>
          <li>• Extend guitar solo section</li>
          <li>• Add clean guitar intro</li>
        </ul>
      </div>
    </div>
  </div>
</div>

); }

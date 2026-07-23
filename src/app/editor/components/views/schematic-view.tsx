"use client";

interface SchematicViewProps {
  schematicSvg: string;
  topModuleName: string;
  handleRunSynthesis: () => void;
}

export default function SchematicView({
  schematicSvg,
  topModuleName,
  handleRunSynthesis,
}: SchematicViewProps) {
  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-white overflow-auto">
      {schematicSvg ? (
        <div
          className="w-full h-full max-w-4xl flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: schematicSvg }}
        />
      ) : (
        <div className="text-slate-600 text-center space-y-3">
          <div className="text-4xl">🗺️</div>
          <div className="font-bold text-slate-900">Elaborated Schematic Netlist</div>
          <p className="text-xs text-slate-600 max-w-md">
            Run Synthesis (F11) to elaborate netlist gates for &apos;{topModuleName}&apos;.
          </p>
          <button
            onClick={handleRunSynthesis}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-blue-700"
          >
            ▶ Run Synthesis Now
          </button>
        </div>
      )}
    </div>
  );
}

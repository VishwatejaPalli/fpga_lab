"use client";

interface SourcesPanelProps {
  files: Record<string, string>;
  topModuleName: string;
  selectedFileItem: string;
  selectFile: (path: string) => void;
  handleDeleteFileWithConfirm: (path: string) => void;
  sourcesTab: "hierarchy" | "libraries" | "compile_order";
  setSourcesTab: (tab: "hierarchy" | "libraries" | "compile_order") => void;
}

export default function SourcesPanel({
  files,
  topModuleName,
  selectedFileItem,
  selectFile,
  handleDeleteFileWithConfirm,
  sourcesTab,
  setSourcesTab,
}: SourcesPanelProps) {
  const hdlFiles = Object.keys(files).filter(
    (f) => f.endsWith(".v") || f.endsWith(".sv") || f.endsWith(".vhd")
  );
  const xdcFiles = Object.keys(files).filter((f) => f.endsWith(".xdc"));

  return (
    <div className="w-72 border-r border-[#c4d2e2] flex flex-col shrink-0 overflow-hidden bg-[#f4f7fc]">
      <div className="h-8 border-b border-[#c4d2e2] flex items-center justify-between px-3 bg-[#e4ebf5] shrink-0">
        <span className="font-bold text-[11px] text-[#1e3a8a]">Sources</span>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
          <span>Updating 🔄</span>
        </div>
      </div>

      <div className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-1 bg-white">
        <div className="pl-1 space-y-1">
          <div className="flex items-center gap-1 text-slate-700 font-bold">
            <span>▾</span> <span className="text-[#d97706]">📁</span> Design Sources ({hdlFiles.length})
          </div>

          <div className="pl-4 space-y-1">
            {hdlFiles.map((path) => {
              const isTop = path.includes(topModuleName) || path.includes("uart_tx.v");
              const isSelected = selectedFileItem === path;
              return (
                <div
                  key={path}
                  onClick={() => selectFile(path)}
                  className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                    isSelected ? "bg-[#2b579a] text-white font-bold" : "text-slate-800 hover:bg-slate-200/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span>📄</span>
                    <span className="truncate">{path.split("/").pop()}</span>
                    {isTop && (
                      <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-700 rounded border border-emerald-300 font-bold">
                        top
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFileWithConfirm(path);
                    }}
                    className="text-red-500 hover:text-red-700 px-1 font-bold"
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pl-1 pt-2 space-y-1">
          <div className="flex items-center gap-1 text-slate-700 font-bold">
            <span>▾</span> <span className="text-[#d97706]">📁</span> Constraints
          </div>

          <div className="pl-4 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span>📁</span> constrs_1
            </div>
            {xdcFiles.map((path) => (
              <div
                key={path}
                onClick={() => selectFile(path)}
                className={`pl-4 flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                  selectedFileItem === path
                    ? "bg-[#2b579a] text-white font-bold"
                    : "text-slate-800 hover:bg-slate-200/60"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span>📜</span>
                  <span className="truncate">{path.split("/").pop()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-7 border-t border-[#c4d2e2] bg-[#e4ebf5] flex items-center px-1 text-[10px] shrink-0 font-medium">
        {(["hierarchy", "libraries", "compile_order"] as const).map((st) => (
          <button
            key={st}
            onClick={() => setSourcesTab(st)}
            className={`px-2.5 py-1 rounded-t capitalize transition-colors ${
              sourcesTab === st
                ? "bg-white text-[#1e3a8a] font-bold border-t-2 border-t-[#2b579a]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="h-36 border-t border-[#c4d2e2] bg-[#f8fafc] p-2 text-[11px] overflow-y-auto">
        <div className="font-bold text-[#1e3a8a] border-b border-[#cbd5e1] pb-1 mb-2 flex items-center justify-between">
          <span>Properties</span>
          <span className="text-slate-500 font-mono text-[9px]">{selectedFileItem}</span>
        </div>

        {selectedFileItem ? (
          <div className="space-y-1 text-slate-700 font-mono text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Name:</span>{" "}
              <span className="text-slate-900 font-bold">{selectedFileItem.split("/").pop()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Path:</span>{" "}
              <span className="truncate text-slate-800">{selectedFileItem}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Type:</span>{" "}
              <span className="text-blue-700">
                {selectedFileItem.endsWith(".xdc") ? "XDC Constraints" : "Verilog Source"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Target Part:</span>{" "}
              <span className="text-slate-800">xc7z020clg400-1</span>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 italic text-center pt-4">Select an object to see properties</div>
        )}
      </div>
    </div>
  );
}

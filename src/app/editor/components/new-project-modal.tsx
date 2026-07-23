"use client";

import { Board } from "../hooks/useProjectState";

interface NewProjectModalProps {
  isNewProjectOpen: boolean;
  setIsNewProjectOpen: (open: boolean) => void;
  newProjName: string;
  setNewProjName: (name: string) => void;
  newProjPart: string;
  setNewProjPart: (part: string) => void;
  newProjLang: string;
  setNewProjLang: (lang: string) => void;
  newProjTop: string;
  setNewProjTop: (top: string) => void;
  boards: Board[];
  handleCreateNewProject: (e: React.FormEvent) => void;
}

export default function NewProjectModal({
  isNewProjectOpen,
  setIsNewProjectOpen,
  newProjName,
  setNewProjName,
  newProjPart,
  setNewProjPart,
  newProjLang,
  setNewProjLang,
  newProjTop,
  setNewProjTop,
  boards,
  handleCreateNewProject,
}: NewProjectModalProps) {
  if (!isNewProjectOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <form
        onSubmit={handleCreateNewProject}
        className="w-full max-w-lg bg-white border border-[#b0c4de] rounded-2xl shadow-2xl overflow-hidden text-slate-800"
      >
        <div className="px-6 py-4 bg-[#2b579a] text-white flex items-center justify-between font-bold text-sm">
          <span className="flex items-center gap-2">
            <span>📁</span> Create New FPGA Project
          </span>
          <button
            type="button"
            onClick={() => setIsNewProjectOpen(false)}
            className="text-white/80 hover:text-white font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs font-medium">
          <div>
            <label className="block text-slate-700 mb-1">Project Name</label>
            <input
              type="text"
              required
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1">Target FPGA Board</label>
            <select
              value={newProjPart}
              onChange={(e) => setNewProjPart(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none"
            >
              {boards.length > 0 ? (
                boards.map((b) => (
                  <option key={b.id} value={`${b.boardType} (${b.fpgaFamily})`}>
                    {b.name} ({b.fpgaFamily})
                  </option>
                ))
              ) : (
                <>
                  <option value="pynq-z2 (xc7z020clg400-1)">
                    PYNQ-Z2 (Zynq-7000 xc7z020clg400-1)
                  </option>
                  <option value="basys3 (xc7a35tcpg236-1)">
                    Basys3 (Artix-7 xc7a35tcpg236-1)
                  </option>
                  <option value="arty-a7 (xc7a35tcsg324-1)">
                    Arty-A7 (Artix-7 xc7a35tcsg324-1)
                  </option>
                </>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 mb-1">Target Language</label>
              <select
                value={newProjLang}
                onChange={(e) => setNewProjLang(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                <option value="Verilog">Verilog</option>
                <option value="SystemVerilog">SystemVerilog</option>
                <option value="VHDL">VHDL</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 mb-1">Top Module Name</label>
              <input
                type="text"
                required
                value={newProjTop}
                onChange={(e) => setNewProjTop(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 text-xs">
          <button
            type="button"
            onClick={() => setIsNewProjectOpen(false)}
            className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-[#2b579a] hover:bg-[#1e3a8a] text-white font-bold rounded-lg shadow-md"
          >
            Create Project & Launch
          </button>
        </div>
      </form>
    </div>
  );
}

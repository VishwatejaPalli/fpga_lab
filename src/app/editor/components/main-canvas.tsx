"use client";

import { TabItem, Board } from "../hooks/useProjectState";
import ProjectSummaryView from "./views/project-summary-view";
import MonacoEditorView from "./views/monaco-editor-view";
import SchematicView from "./views/schematic-view";
import WaveformView from "./views/waveform-view";
import DeviceFloorplanView from "./views/device-floorplan-view";

interface MainCanvasProps {
  openTabs: TabItem[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  activeMainTab: string;
  setActiveMainTab: (tab: any) => void;
  activeFile: string;
  setActiveFile: (file: string) => void;
  activeCode: string;
  setActiveCode: (code: string) => void;
  setSaveStatus: (status: "saved" | "saving" | "unsaved") => void;
  closeTab: (e: React.MouseEvent, id: string) => void;
  files: Record<string, string>;

  // Project Summary View Props
  projectName: string;
  projectPath: string;
  productFamily: string;
  projectPart: string;
  topModuleName: string;
  targetLanguage: string;
  simulatorLanguage: string;
  targetSimulator: string;
  summarySubtab: "overview" | "dashboard";
  setSummarySubtab: (sub: "overview" | "dashboard") => void;
  handleOpenSettings: () => void;
  boards: Board[];
  selectedBoardId: string;
  setSelectedBoardId: (id: string) => void;
  handleRunSimulation: () => void;
  handleRunSynthesis: () => void;
  lutUsage: number;
  ffUsage: number;
  bramUsage: number;
  dspUsage: number;
  wnsValue: string;
  synthStatus: string;

  // Waveform View Props
  waves: any;
  globalRadix: "hex" | "bin" | "dec";
  setGlobalRadix: (radix: "hex" | "bin" | "dec") => void;

  // Schematic View Props
  schematicSvg: string;
  placementData?: any;
}

export default function MainCanvas({
  openTabs,
  activeTabId,
  setActiveTabId,
  activeMainTab,
  setActiveMainTab,
  activeFile,
  setActiveFile,
  activeCode,
  setActiveCode,
  setSaveStatus,
  closeTab,
  files,

  projectName,
  projectPath,
  productFamily,
  projectPart,
  topModuleName,
  targetLanguage,
  simulatorLanguage,
  targetSimulator,
  summarySubtab,
  setSummarySubtab,
  handleOpenSettings,
  boards,
  selectedBoardId,
  setSelectedBoardId,
  handleRunSimulation,
  handleRunSynthesis,
  lutUsage,
  ffUsage,
  bramUsage,
  dspUsage,
  wnsValue,
  synthStatus,

  waves,
  globalRadix,
  setGlobalRadix,
  schematicSvg,
  placementData,
}: MainCanvasProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#e4ecf6]">
      {/* Canvas Tabs Header */}
      <div className="h-8 border-b border-[#c4d2e2] bg-[#dce6f5] flex items-center px-1 overflow-x-auto shrink-0">
        {openTabs.map((t) => {
          const isActive = activeTabId === t.id;
          return (
            <div
              key={t.id}
              onClick={() => {
                setActiveTabId(t.id);
                if (t.type === "view") {
                  setActiveMainTab(t.id.replace("view:", "") as any);
                } else {
                  const path = t.id.replace("file:", "");
                  setActiveFile(path);
                  setActiveCode(files[path] || "");
                  setActiveMainTab("editor");
                }
              }}
              className={`h-7 px-3 text-[11px] font-semibold flex items-center gap-2 border-r border-[#cbd5e1] cursor-pointer select-none transition-all rounded-t ${
                isActive
                  ? "bg-white text-[#1e3a8a] border-t-2 border-t-[#2b579a] font-bold shadow-sm"
                  : "text-slate-600 hover:bg-white/60"
              }`}
            >
              <span>
                {t.type === "view" ? "📊" : "📄"} {t.label}
              </span>
              {t.id !== "view:project_summary" && (
                <button
                  onClick={(e) => closeTab(e, t.id)}
                  className="w-3.5 h-3.5 rounded hover:bg-slate-200 flex items-center justify-center text-[10px]"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative overflow-auto min-h-0 bg-[#f8fafc]">
        {activeMainTab === "project_summary" && (
          <ProjectSummaryView
            projectName={projectName}
            projectPath={projectPath}
            productFamily={productFamily}
            projectPart={projectPart}
            topModuleName={topModuleName}
            targetLanguage={targetLanguage}
            simulatorLanguage={simulatorLanguage}
            targetSimulator={targetSimulator}
            summarySubtab={summarySubtab}
            setSummarySubtab={setSummarySubtab}
            handleOpenSettings={handleOpenSettings}
            boards={boards}
            selectedBoardId={selectedBoardId}
            setSelectedBoardId={setSelectedBoardId}
            handleRunSimulation={handleRunSimulation}
            handleRunSynthesis={handleRunSynthesis}
            lutUsage={lutUsage}
            ffUsage={ffUsage}
            wnsValue={wnsValue}
            synthStatus={synthStatus}
          />
        )}

        {activeMainTab === "editor" && (
          <MonacoEditorView
            activeFile={activeFile}
            activeCode={activeCode}
            setActiveCode={setActiveCode}
            setSaveStatus={setSaveStatus}
          />
        )}

        {activeMainTab === "schematic" && (
          <SchematicView
            schematicSvg={schematicSvg}
            topModuleName={topModuleName}
            handleRunSynthesis={handleRunSynthesis}
          />
        )}

        {activeMainTab === "waveform" && (
          <WaveformView
            waves={waves}
            globalRadix={globalRadix}
            setGlobalRadix={setGlobalRadix}
            handleRunSimulation={handleRunSimulation}
          />
        )}

        {activeMainTab === "device" && (
          <DeviceFloorplanView
            projectPart={projectPart}
            synthStatus={synthStatus}
            topModuleName={topModuleName}
            lutUsage={lutUsage}
            ffUsage={ffUsage}
            bramUsage={bramUsage}
            dspUsage={dspUsage}
            wnsValue={wnsValue}
            handleRunSynthesis={handleRunSynthesis}
            placementData={placementData}
          />
        )}
      </div>
    </div>
  );
}

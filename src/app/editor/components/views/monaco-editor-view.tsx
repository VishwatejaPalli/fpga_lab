"use client";

import Editor from "@monaco-editor/react";
import { useTheme } from "@/components/theme-provider";

interface MonacoEditorViewProps {
  activeFile: string;
  activeCode: string;
  setActiveCode: (code: string) => void;
  setSaveStatus: (status: "saved" | "saving" | "unsaved") => void;
}

export default function MonacoEditorView({
  activeFile,
  activeCode,
  setActiveCode,
  setSaveStatus,
}: MonacoEditorViewProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  if (!activeFile) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500 italic">
        Select a source file from Sources tree to edit
      </div>
    );
  }

  const language =
    activeFile.endsWith(".v") || activeFile.endsWith(".sv")
      ? "verilog"
      : activeFile.endsWith(".vhd") || activeFile.endsWith(".vhdl")
      ? "vhdl"
      : activeFile.endsWith(".xdc") || activeFile.endsWith(".tcl")
      ? "tcl"
      : "plaintext";

  return (
    <Editor
      height="100%"
      language={language}
      theme={isLight ? "vs" : "vs-dark"}
      value={activeCode}
      onChange={(val) => {
        setActiveCode(val || "");
        setSaveStatus("unsaved");
      }}
      options={{
        minimap: { enabled: true },
        fontSize: 13,
        fontFamily: "Consolas, 'Courier New', monospace",
        scrollBeyondLastLine: false,
        smoothScrolling: true,
      }}
    />
  );
}

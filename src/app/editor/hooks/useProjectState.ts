"use client";

import { useState, useEffect, useCallback } from "react";

export interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  status: string;
  capabilities: string[];
}

export interface TabItem {
  id: string;
  label: string;
  type: "file" | "view";
}

export interface RecentProject {
  id: string;
  name: string;
  path: string;
  targetBoard: string;
  topModule: string;
  lastModified: string;
  fileCount: number;
}

export function useProjectState(files: Record<string, string>) {
  const [viewMode, setViewMode] = useState<"welcome" | "workspace">("welcome");

  // New Project Wizard State
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjName, setNewProjName] = useState("my_fpga_project");
  const [newProjPart, setNewProjPart] = useState("pynq-z2 (xc7z020clg400-1)");
  const [newProjLang, setNewProjLang] = useState("Verilog");
  const [newProjTop, setNewProjTop] = useState("top_module");

  // Active Dropdown Menu
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Active Main Canvas Tab
  const [activeMainTab, setActiveMainTab] = useState<
    "project_summary" | "editor" | "schematic" | "waveform" | "device" | "timing" | "utilization"
  >("project_summary");

  // Subtabs State
  const [sourcesTab, setSourcesTab] = useState<"hierarchy" | "libraries" | "compile_order">("hierarchy");
  const [summarySubtab, setSummarySubtab] = useState<"overview" | "dashboard">("overview");
  const [bottomDockTab, setBottomDockTab] = useState<"tcl" | "messages" | "log" | "reports" | "runs">("runs");

  // Dynamic Project Properties
  const [projectName, setProjectName] = useState("uart_tx_project");
  const [projectPath] = useState("C:/Users/palli/fpga_workspace");
  const [productFamily] = useState("Zynq-7000");
  const [projectPart, setProjectPart] = useState("pynq-z2 (xc7z020clg400-1)");
  const [topModuleName, setTopModuleName] = useState("tb_uart_tx");
  const [targetLanguage, setTargetLanguage] = useState("Verilog");
  const [simulatorLanguage] = useState("Mixed");
  const [targetSimulator] = useState("FPGA Simulator");

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "simulation" | "synthesis" | "implementation">("general");

  const [draftProjectName, setDraftProjectName] = useState(projectName);
  const [draftProjectPart, setDraftProjectPart] = useState(projectPart);
  const [draftTargetLanguage, setDraftTargetLanguage] = useState(targetLanguage);
  const [draftTopModule, setDraftTopModule] = useState(topModuleName);
  const [draftSimTime, setDraftSimTime] = useState(1000);
  const [draftVerilogVer, setDraftVerilogVer] = useState("Verilog 2001");
  const [draftDefaultLib, setDraftDefaultLib] = useState("xil_defaultlib");

  // Recent Projects List
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([
    {
      id: "p1",
      name: "uart_tx_project",
      path: "C:/Users/palli/fpga_workspace/uart_tx_project",
      targetBoard: "pynq-z2",
      topModule: "tb_uart_tx",
      lastModified: "2 minutes ago",
      fileCount: 3,
    },
    {
      id: "p2",
      name: "blinky_demo",
      path: "C:/Users/palli/fpga_workspace/blinky_demo",
      targetBoard: "pynq-z2",
      topModule: "blinky",
      lastModified: "1 hour ago",
      fileCount: 2,
    },
    {
      id: "p3",
      name: "ripple_carry_adder_demo",
      path: "C:/Users/palli/fpga_workspace/ripple_carry_adder_demo",
      targetBoard: "basys3",
      topModule: "tb_ripple_adder",
      lastModified: "Yesterday",
      fileCount: 2,
    },
  ]);

  // Open Tabs & Active File State
  const [openTabs, setOpenTabs] = useState<TabItem[]>([
    { id: "view:project_summary", label: "Project Summary", type: "view" },
    { id: "file:rtl/uart_tx.v", label: "uart_tx.v", type: "file" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("view:project_summary");
  const [activeFile, setActiveFile] = useState<string>("rtl/uart_tx.v");
  const [activeCode, setActiveCode] = useState<string>(files["rtl/uart_tx.v"] || "");
  const [selectedFileItem, setSelectedFileItem] = useState<string>("rtl/uart_tx.v");

  // Boards & Sessions State
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  // Modal Confirm Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Fetch Boards
  useEffect(() => {
    fetch("/api/boards")
      .then((res) => res.json())
      .then((data) => {
        if (data.boards && data.boards.length > 0) {
          setBoards(data.boards);
          if (!selectedBoardId) {
            setSelectedBoardId(data.boards[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Sessions
  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        if (data.sessions && Array.isArray(data.sessions)) {
          setActiveSessions(data.sessions);
        }
      })
      .catch(() => {});
  }, []);

  // Sync active code when active file or files map changes
  useEffect(() => {
    if (activeFile && files[activeFile] !== undefined) {
      setActiveCode(files[activeFile]);
    }
  }, [activeFile, files]);

  const openTab = useCallback(
    (id: string, label: string, type: "file" | "view") => {
      setOpenTabs((prev) => {
        if (!prev.some((t) => t.id === id)) {
          return [...prev, { id, label, type }];
        }
        return prev;
      });
      setActiveTabId(id);
      if (type === "view") {
        setActiveMainTab(id.replace("view:", "") as any);
      } else {
        setActiveMainTab("editor");
      }
    },
    []
  );

  const closeTab = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setOpenTabs((prev) => {
        const nextTabs = prev.filter((t) => t.id !== id);
        if (activeTabId === id && nextTabs.length > 0) {
          const last = nextTabs[nextTabs.length - 1];
          setActiveTabId(last.id);
          if (last.type === "view") {
            setActiveMainTab(last.id.replace("view:", "") as any);
          } else {
            const path = last.id.replace("file:", "");
            setActiveFile(path);
            setActiveCode(files[path] || "");
            setActiveMainTab("editor");
          }
        }
        return nextTabs;
      });
    },
    [activeTabId, files]
  );

  const selectFile = useCallback(
    (path: string) => {
      setActiveFile(path);
      setSelectedFileItem(path);
      if (files[path] !== undefined) {
        setActiveCode(files[path]);
        openTab(`file:${path}`, path.split("/").pop() || path, "file");
      }
    },
    [files, openTab]
  );

  const handleOpenSettings = useCallback(() => {
    setDraftProjectName(projectName);
    setDraftProjectPart(projectPart);
    setDraftTargetLanguage(targetLanguage);
    setDraftTopModule(topModuleName);
    setIsSettingsOpen(true);
  }, [projectName, projectPart, targetLanguage, topModuleName]);

  const handleApplySettings = useCallback(
    (appendTclLogs: (lines: string[]) => void) => {
      setProjectName(draftProjectName);
      setProjectPart(draftProjectPart);
      setTargetLanguage(draftTargetLanguage);
      setTopModuleName(draftTopModule);
      appendTclLogs([
        `Tcl% set_property part ${draftProjectPart.split(" ")[1] || draftProjectPart} [current_project]`,
        `INFO: Updated project settings for '${draftProjectName}'.`,
      ]);
    },
    [draftProjectName, draftProjectPart, draftTargetLanguage, draftTopModule]
  );

  const handleSaveSettings = useCallback(
    (appendTclLogs: (lines: string[]) => void) => {
      handleApplySettings(appendTclLogs);
      setIsSettingsOpen(false);
    },
    [handleApplySettings]
  );

  return {
    viewMode,
    setViewMode,
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
    activeMenu,
    setActiveMenu,
    activeMainTab,
    setActiveMainTab,
    sourcesTab,
    setSourcesTab,
    summarySubtab,
    setSummarySubtab,
    bottomDockTab,
    setBottomDockTab,
    projectName,
    setProjectName,
    projectPath,
    productFamily,
    projectPart,
    setProjectPart,
    topModuleName,
    setTopModuleName,
    targetLanguage,
    setTargetLanguage,
    simulatorLanguage,
    targetSimulator,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    draftProjectName,
    setDraftProjectName,
    draftProjectPart,
    setDraftProjectPart,
    draftTargetLanguage,
    setDraftTargetLanguage,
    draftTopModule,
    setDraftTopModule,
    draftSimTime,
    setDraftSimTime,
    draftVerilogVer,
    setDraftVerilogVer,
    draftDefaultLib,
    setDraftDefaultLib,
    recentProjects,
    setRecentProjects,
    openTabs,
    setOpenTabs,
    activeTabId,
    setActiveTabId,
    activeFile,
    setActiveFile,
    activeCode,
    setActiveCode,
    selectedFileItem,
    setSelectedFileItem,
    boards,
    selectedBoardId,
    setSelectedBoardId,
    activeSessions,
    confirmModal,
    setConfirmModal,
    openTab,
    closeTab,
    selectFile,
    handleOpenSettings,
    handleApplySettings,
    handleSaveSettings,
  };
}

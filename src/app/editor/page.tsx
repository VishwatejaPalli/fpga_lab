"use client";

import ConfirmModal from "@/components/confirm-modal";
import { useWorkspaceFiles, EXAMPLE_PROJECTS } from "./hooks/useWorkspaceFiles";
import { useSynthesisRunner } from "./hooks/useSynthesisRunner";
import { useSimulationRunner } from "./hooks/useSimulationRunner";
import { useProjectState } from "./hooks/useProjectState";
import { useTclConsole } from "./hooks/useTclConsole";

import EditorHeader from "./components/editor-header";
import EditorMenuBar from "./components/editor-menu-bar";
import QuickToolbar from "./components/quick-toolbar";
import WelcomeScreen from "./components/welcome-screen";
import FlowNavigator from "./components/flow-navigator";
import SourcesPanel from "./components/sources-panel";
import MainCanvas from "./components/main-canvas";
import BottomConsoleDock from "./components/bottom-console-dock";
import NewProjectModal from "./components/new-project-modal";
import ProjectSettingsModal from "./components/project-settings-modal";

export default function EditorPage() {
  const { files, setFiles, saveStatus, setSaveStatus, handleDeleteFile, syncAllFilesToServer } =
    useWorkspaceFiles();

  const {
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
    recentProjects,
    openTabs,
    setOpenTabs,
    activeTabId,
    setActiveTabId,
    activeFile,
    setActiveFile,
    activeCode,
    setActiveCode,
    selectedFileItem,
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
    handleApplySettings: handleApplySettingsState,
    handleSaveSettings: handleSaveSettingsState,
  } = useProjectState(files);

  const {
    lastSynthResult,
    isSynthesizing,
    isImplementing,
    isBitgen,
    synthStatus,
    implStatus,
    wnsValue,
    tnsValue,
    lutUsage,
    ffUsage,
    bramUsage,
    dspUsage,
    schematicSvg,
    historyJobs,
    handleRunSynthesis,
    handleRunImplementation,
    handleGenerateBitstream,
  } = useSynthesisRunner();

  const { isSimulating, waves, globalRadix, setGlobalRadix, handleRunSimulation } =
    useSimulationRunner();

  const { tclLogs, tclInput, setTclInput, tclBottomRef, appendTclLogs, handleTclSubmit } =
    useTclConsole(projectName, projectPath);

  // Wrapper handlers connecting state & hooks
  const handleLoadExample = (exampleKey: string) => {
    const ex = EXAMPLE_PROJECTS[exampleKey];
    if (!ex) return;
    setProjectName(ex.name);
    setProjectPart(ex.targetBoard);
    setTopModuleName(ex.topModule);
    setFiles(ex.files);

    const firstFile = Object.keys(ex.files)[0];
    setActiveFile(firstFile);
    setActiveCode(ex.files[firstFile]);
    setOpenTabs([
      { id: "view:project_summary", label: "Project Summary", type: "view" },
      { id: `file:${firstFile}`, label: firstFile.split("/").pop() || firstFile, type: "file" },
    ]);
    setActiveTabId("view:project_summary");
    setActiveMainTab("project_summary");
    setViewMode("workspace");
    appendTclLogs([`INFO: Loaded example project '${ex.name}'.`]);
  };

  const handleCreateNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    const pName = newProjName.trim() || "my_fpga_project";
    const topMod = newProjTop.trim() || "top_module";

    const starterFiles: Record<string, string> = {
      [`rtl/${topMod}.v`]: `module ${topMod}(\n    input wire clk,\n    input wire rst_n,\n    output reg [3:0] led\n);\n    always @(posedge clk or negedge rst_n) begin\n        if (!rst_n) led <= 0;\n        else led <= led + 1;\n    end\nendmodule`,
      "constraints/pynq_z2.xdc": `## XDC Constraints for ${pName}\nset_property -dict { PACKAGE_PIN H16 IOSTANDARD LVCMOS33 } [get_ports { clk }];`,
    };

    setProjectName(pName);
    setProjectPart(newProjPart);
    setTargetLanguage(newProjLang);
    setTopModuleName(topMod);
    setFiles(starterFiles);

    const firstFile = `rtl/${topMod}.v`;
    setActiveFile(firstFile);
    setActiveCode(starterFiles[firstFile]);
    setOpenTabs([
      { id: "view:project_summary", label: "Project Summary", type: "view" },
      { id: `file:${firstFile}`, label: `${topMod}.v`, type: "file" },
    ]);
    setActiveTabId(`file:${firstFile}`);
    setActiveMainTab("editor");
    setIsNewProjectOpen(false);
    setViewMode("workspace");

    appendTclLogs([
      `INFO: Created new FPGA project '${pName}' targeting ${newProjPart}.`,
    ]);
  };

  const handleDeleteFileWithConfirm = (path: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Source File",
      message: `Are you sure you want to delete source file '${path}' from project?`,
      confirmText: "Delete File",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await handleDeleteFile(path);
        appendTclLogs([`INFO: Removed file ${path}`]);
      },
    });
  };

  const handleRunSynthesisWrapper = () => {
    setBottomDockTab("tcl");
    handleRunSynthesis(
      selectedBoardId,
      topModuleName,
      projectPart,
      files,
      appendTclLogs,
      openTab,
      syncAllFilesToServer
    );
  };

  const handleRunSimulationWrapper = () => {
    setBottomDockTab("tcl");
    handleRunSimulation(files, appendTclLogs, openTab);
  };

  const handleRunImplementationWrapper = () => {
    setBottomDockTab("tcl");
    handleRunImplementation(appendTclLogs, openTab);
  };

  const handleGenerateBitstreamWrapper = () => {
    setBottomDockTab("tcl");
    handleGenerateBitstream(projectName, appendTclLogs);
  };

  const handleTclSubmitWrapper = (e: React.FormEvent) => {
    handleTclSubmit(e, {
      runSynthesis: handleRunSynthesisWrapper,
      runSimulation: handleRunSimulationWrapper,
      runImplementation: handleRunImplementationWrapper,
      generateBitstream: handleGenerateBitstreamWrapper,
      openTab,
    });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans select-none bg-[#e8eef8] text-[#1e293b]">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col border-b border-[#bdcce0] text-xs shrink-0 bg-[#e0e8f8]">
        <EditorHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          projectName={projectName}
          projectPath={projectPath}
        />

        <EditorMenuBar
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          setIsNewProjectOpen={setIsNewProjectOpen}
          setViewMode={setViewMode}
          openTab={openTab}
          handleOpenSettings={handleOpenSettings}
          handleRunSimulation={handleRunSimulationWrapper}
          handleRunSynthesis={handleRunSynthesisWrapper}
          handleRunImplementation={handleRunImplementationWrapper}
          handleGenerateBitstream={handleGenerateBitstreamWrapper}
          setBottomDockTab={setBottomDockTab}
        />

        {viewMode === "workspace" && (
          <QuickToolbar
            handleOpenSettings={handleOpenSettings}
            openTab={openTab}
            handleRunSimulation={handleRunSimulationWrapper}
            isSimulating={isSimulating}
            handleRunSynthesis={handleRunSynthesisWrapper}
            isSynthesizing={isSynthesizing}
            handleRunImplementation={handleRunImplementationWrapper}
            isImplementing={isImplementing}
            handleGenerateBitstream={handleGenerateBitstreamWrapper}
            isBitgen={isBitgen}
            projectPart={projectPart}
          />
        )}
      </div>

      {/* 2. Main Body: Welcome Landing Screen or IDE Workspace */}
      {viewMode === "welcome" ? (
        <WelcomeScreen
          setIsNewProjectOpen={setIsNewProjectOpen}
          setViewMode={setViewMode}
          handleLoadExample={handleLoadExample}
          handleOpenSettings={handleOpenSettings}
          boards={boards}
          activeSessions={activeSessions}
          recentProjects={recentProjects}
          setProjectName={setProjectName}
          setTopModuleName={setTopModuleName}
        />
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden bg-[#e4ecf6]">
          <FlowNavigator
            handleOpenSettings={handleOpenSettings}
            openTab={openTab}
            handleRunSimulation={handleRunSimulationWrapper}
            handleRunSynthesis={handleRunSynthesisWrapper}
            handleRunImplementation={handleRunImplementationWrapper}
            handleGenerateBitstream={handleGenerateBitstreamWrapper}
          />

          <SourcesPanel
            files={files}
            topModuleName={topModuleName}
            selectedFileItem={selectedFileItem}
            selectFile={selectFile}
            handleDeleteFileWithConfirm={handleDeleteFileWithConfirm}
            sourcesTab={sourcesTab}
            setSourcesTab={setSourcesTab}
          />

          <MainCanvas
            openTabs={openTabs}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            activeMainTab={activeMainTab}
            setActiveMainTab={setActiveMainTab}
            activeFile={activeFile}
            setActiveFile={setActiveFile}
            activeCode={activeCode}
            setActiveCode={setActiveCode}
            setSaveStatus={setSaveStatus}
            closeTab={closeTab}
            files={files}
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
            handleRunSimulation={handleRunSimulationWrapper}
            handleRunSynthesis={handleRunSynthesisWrapper}
            lutUsage={lutUsage}
            ffUsage={ffUsage}
            bramUsage={bramUsage}
            dspUsage={dspUsage}
            wnsValue={wnsValue}
            synthStatus={synthStatus}
            waves={waves}
            globalRadix={globalRadix}
            setGlobalRadix={setGlobalRadix}
            schematicSvg={schematicSvg}
          />
        </div>
      )}

      {/* 3. Bottom Console Dock */}
      {viewMode === "workspace" && (
        <BottomConsoleDock
          bottomDockTab={bottomDockTab}
          setBottomDockTab={setBottomDockTab}
          synthStatus={synthStatus}
          wnsValue={wnsValue}
          tnsValue={tnsValue}
          lutUsage={lutUsage}
          ffUsage={ffUsage}
          bramUsage={bramUsage}
          dspUsage={dspUsage}
          tclLogs={tclLogs}
          tclInput={tclInput}
          setTclInput={setTclInput}
          tclBottomRef={tclBottomRef}
          handleTclSubmit={handleTclSubmitWrapper}
          historyJobs={historyJobs}
        />
      )}

      {/* Modals */}
      <NewProjectModal
        isNewProjectOpen={isNewProjectOpen}
        setIsNewProjectOpen={setIsNewProjectOpen}
        newProjName={newProjName}
        setNewProjName={setNewProjName}
        newProjPart={newProjPart}
        setNewProjPart={setNewProjPart}
        newProjLang={newProjLang}
        setNewProjLang={setNewProjLang}
        newProjTop={newProjTop}
        setNewProjTop={setNewProjTop}
        boards={boards}
        handleCreateNewProject={handleCreateNewProject}
      />

      <ProjectSettingsModal
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        draftProjectName={draftProjectName}
        setDraftProjectName={setDraftProjectName}
        draftProjectPart={draftProjectPart}
        setDraftProjectPart={setDraftProjectPart}
        draftTargetLanguage={draftTargetLanguage}
        setDraftTargetLanguage={setDraftTargetLanguage}
        draftTopModule={draftTopModule}
        setDraftTopModule={setDraftTopModule}
        draftSimTime={draftSimTime}
        setDraftSimTime={setDraftSimTime}
        draftVerilogVer={draftVerilogVer}
        setDraftVerilogVer={setDraftVerilogVer}
        handleSaveSettings={() => handleSaveSettingsState(appendTclLogs)}
        handleApplySettings={() => handleApplySettingsState(appendTclLogs)}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

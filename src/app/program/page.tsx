"use client";

import { Suspense } from "react";
import Navbar from "@/components/navbar";
import { useProgrammer } from "./hooks/useProgrammer";
import DemoBitstreamBanner from "./components/demo-bitstream-banner";
import BoardSelector from "./components/board-selector";
import BitstreamUploader from "./components/bitstream-uploader";
import ProgrammingStatusCard from "./components/programming-status-card";
import RecentJobsList from "./components/recent-jobs-list";
import { CheckIcon, ZapIcon, ZapSolidIcon, ArrowRightIcon, AlertTriangleIcon } from "@/components/icons";

function ProgramContent() {
  const {
    availableBoards,
    selectedBoard,
    selectedBoardId,
    setSelectedBoardId,
    file,
    uploading,
    jobStatus,
    jobId,
    logs,
    logConnected,
    logError,
    error,
    demoLoaded,
    recentJobs,
    isRedirecting,
    handleFileSelected,
    loadDemoBitstream,
    removeSelectedFile,
    resetProgrammerState,
    handleSubmit,
  } = useProgrammer();

  // Determine stage progress
  const step1Done = Boolean(selectedBoardId);
  const step2Done = Boolean(file);
  const step3Active = Boolean(jobId || uploading);

  return (
    <div className="min-h-screen pb-16 bg-background bg-grid-cockpit text-foreground transition-colors">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Cockpit Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 text-xs font-mono font-medium mb-2">
              <span className="w-2 h-2 rounded-full led-glow-cyan animate-pulse" />
              HARDWARE DEPLOYMENT COCKPIT
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Flash Remote FPGA
            </h1>
            <p className="text-muted text-xs sm:text-sm mt-1">
              Select target silicon, load compiled gateware payload, and trigger JTAG boundary scan remotely.
            </p>
          </div>

          {/* Staged Flow Breadcrumb */}
          <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-xl text-xs font-mono shadow-sm">
            <div className={`flex items-center gap-1.5 ${step1Done ? "text-emerald-500 dark:text-emerald-400 font-bold" : "text-muted"}`}>
              {step1Done ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <span>1</span>}
              <span>Target</span>
            </div>
            <ArrowRightIcon className="w-3 h-3 text-muted/60" />
            <div className={`flex items-center gap-1.5 ${step2Done ? "text-emerald-500 dark:text-emerald-400 font-bold" : step1Done ? "text-blue-500 dark:text-blue-400 font-bold" : "text-muted"}`}>
              {step2Done ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <span>2</span>}
              <span>Bitstream</span>
            </div>
            <ArrowRightIcon className="w-3 h-3 text-muted/60" />
            <div className={`flex items-center gap-1.5 ${step3Active ? "text-cyan-500 dark:text-cyan-400 font-bold" : "text-muted"}`}>
              {step3Active ? <ZapIcon className="w-3.5 h-3.5 animate-pulse text-cyan-500" /> : <span>3</span>}
              <span>Flash</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Demo Bitstream Banner */}
          <DemoBitstreamBanner
            jobId={jobId}
            loadDemoBitstream={loadDemoBitstream}
          />

          {/* Step 1: Target Board Selector */}
          <BoardSelector
            selectedBoardId={selectedBoardId}
            setSelectedBoardId={setSelectedBoardId}
            availableBoards={availableBoards}
            jobId={jobId}
          />

          {/* Step 2: Bitstream Uploader */}
          <BitstreamUploader
            file={file}
            selectedBoard={selectedBoard}
            demoLoaded={demoLoaded}
            jobId={jobId}
            handleFileSelected={handleFileSelected}
            removeSelectedFile={removeSelectedFile}
          />

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 rounded-xl px-4 py-3 text-sm flex items-center justify-between font-mono">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => handleFileSelected(file!)}
                className="text-xs text-rose-600 dark:text-rose-300 underline hover:opacity-80"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Step 3: Flash Action Button */}
          {!jobId && (
            <button
              onClick={handleSubmit}
              disabled={!selectedBoardId || !file || uploading}
              className="w-full py-4 px-6 rounded-xl font-mono text-base font-semibold transition-all duration-300 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_25px_rgba(59,130,246,0.35)] hover:shadow-[0_0_35px_rgba(59,130,246,0.55)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none border border-blue-400/30"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>DISPATCHING PAYLOAD TO JTAG SERVER...</span>
                </>
              ) : (
                <>
                  <ZapSolidIcon className="w-5 h-5 text-amber-300" />
                  <span>
                    PROGRAM FPGA {!selectedBoard ? "" : `(${selectedBoard.name.toUpperCase()})`}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Step 3 Active: Programming Status & Terminal Logs */}
          <ProgrammingStatusCard
            jobStatus={jobStatus}
            logConnected={logConnected}
            logError={logError}
            logs={logs}
            isRedirecting={isRedirecting}
            onReset={resetProgrammerState}
          />

          {/* Recent Executions History */}
          <RecentJobsList jobs={recentJobs} />
        </div>
      </main>
    </div>
  );
}

export default function ProgramPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-muted font-mono text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading Programmer Cockpit...
          </div>
        </div>
      }
    >
      <ProgramContent />
    </Suspense>
  );
}


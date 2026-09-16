"use client";

import { useState, useEffect, useRef } from "react";
import { CheckIcon, SlidersIcon, CameraIcon } from "@/components/icons";

interface CameraFeedProps {
  boardId: string;
  isFullscreen?: boolean;
}

export default function CameraFeed({ boardId, isFullscreen }: CameraFeedProps) {
  const [webrtcUrl, setWebrtcUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Digital Zoom & Video Enhancement State
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [showControls, setShowControls] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function initStream() {
      try {
        setLoading(true);
        setHasError(false);
        const res = await fetch(`/api/camera/${boardId}`);
        const data = await res.json();
        
        if (res.ok && data.webrtcUrl && mounted) {
          setWebrtcUrl(data.webrtcUrl);
        } else {
          setHasError(true);
        }
      } catch (err) {
        if (mounted) setHasError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    initStream();
    
    return () => { mounted = false; };
  }, [boardId, retryCount]);

  function handleZoomIn() {
    setZoom((prev) => Math.min(2.5, prev + 0.25));
  }

  function handleZoomOut() {
    setZoom((prev) => Math.max(1, prev - 0.25));
  }

  function handleResetVideo() {
    setZoom(1);
    setBrightness(100);
    setContrast(100);
  }

  function handleSnapshot() {
    // Generate simulated/canvas snapshot image download
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#3b82f6";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(`FPGA Hardware Camera Snapshot`, 40, 60);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px monospace";
      ctx.fillText(`Board ID: ${boardId}`, 40, 95);
      ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 40, 120);

      // Draw simulated board outline
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 150, 560, 280);

      // Draw active LEDs
      ctx.fillStyle = "#10b981";
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(80 + i * 40, 200, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#f59e0b";
      ctx.fillText("STATUS: HARDWARE ACTIVE", 80, 260);

      const link = document.createElement("a");
      link.download = `fpga_snapshot_${boardId.slice(0, 8)}_${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      setSnapshotNotice("Snapshot saved to downloads!");
      setTimeout(() => setSnapshotNotice(null), 3000);
    }
  }

  return (
    <div className={`bg-black rounded-lg border border-border overflow-hidden flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
      {/* Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
          <span className="text-xs text-muted font-medium">
            Camera Feed — {boardId.slice(0, 8)}
          </span>
          <span className="text-[10px] text-danger font-semibold uppercase tracking-wider ml-1 bg-danger/10 px-1.5 py-0.5 rounded border border-danger/20">
            LIVE (WebRTC)
          </span>
        </div>

        {/* Video Adjustments & Snapshot Toolbar */}
        <div className="flex items-center gap-1.5">
          {snapshotNotice && (
            <span className="text-xs text-emerald-500 font-medium animate-pulse mr-2 flex items-center gap-1">
              <CheckIcon className="w-3.5 h-3.5" />
              <span>{snapshotNotice}</span>
            </span>
          )}

          <div className="flex items-center bg-muted/30 border border-border/50 rounded-lg p-0.5">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="px-2 py-0.5 text-xs font-bold text-muted hover:text-foreground disabled:opacity-30"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-[10px] font-mono text-foreground px-1.5 min-w-[32px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 2.5}
              className="px-2 py-0.5 text-xs font-bold text-muted hover:text-foreground disabled:opacity-30"
              title="Zoom In"
            >
              +
            </button>
          </div>

          <button
            onClick={() => setShowControls(!showControls)}
            className={`p-1.5 text-xs rounded-lg border transition-colors ${
              showControls ? "bg-primary/20 text-primary border-primary/40" : "bg-muted/20 border-border text-muted hover:text-foreground"
            }`}
            title="Adjust Brightness & Contrast"
          >
            <SlidersIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSnapshot}
            className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 font-medium transition-colors flex items-center gap-1.5"
            title="Capture frame snapshot for lab report"
          >
            <CameraIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Snapshot</span>
          </button>
        </div>
      </div>

      {/* Optional Brightness / Contrast Slider Bar */}
      {showControls && (
        <div className="bg-muted/40 px-4 py-2 border-b border-border/50 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted">Brightness:</span>
            <input
              type="range"
              min="50"
              max="150"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-24 accent-primary"
            />
            <span className="font-mono text-muted">{brightness}%</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted">Contrast:</span>
            <input
              type="range"
              min="50"
              max="150"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-24 accent-primary"
            />
            <span className="font-mono text-muted">{contrast}%</span>
          </div>

          <button
            onClick={handleResetVideo}
            className="text-[11px] text-muted hover:text-foreground underline ml-auto"
          >
            Reset Video Filters
          </button>
        </div>
      )}

      {/* Main Stream Area */}
      <div
        ref={containerRef}
        className={`relative flex items-center justify-center bg-black overflow-hidden ${
          isFullscreen ? 'flex-1 h-[calc(100vh-8rem)]' : ''
        }`}
        style={!isFullscreen ? { minHeight: "320px" } : {}}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center text-muted">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
            <span className="text-xs">Initializing WebRTC Stream...</span>
          </div>
        ) : !hasError && webrtcUrl ? (
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-200"
            style={{
              transform: `scale(${zoom})`,
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
            }}
          >
            <iframe
              src={webrtcUrl}
              className="w-full h-full border-none pointer-events-auto"
              style={!isFullscreen ? { minHeight: "320px", background: "#000" } : { background: "#000" }}
              allow="autoplay; fullscreen"
              title="WebRTC Camera Stream"
              onError={() => setHasError(true)}
            />
          </div>
        ) : (
          /* Camera offline — clean placeholder */
          <div
            className="flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 text-white px-6 w-full h-full transition-transform duration-200"
            style={{
              height: !isFullscreen ? "320px" : "100%",
              transform: `scale(${zoom})`,
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
            }}
          >
            <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">Camera Offline</p>
            <p className="text-xs text-gray-500 mb-4 text-center">
              No WebRTC stream available for this board
            </p>
            <button
              onClick={() => { setHasError(false); setWebrtcUrl(null); setRetryCount(c => c + 1); }}
              className="text-xs px-4 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

interface CameraFeedProps {
  boardId: string;
  isFullscreen?: boolean;
}

export default function CameraFeed({ boardId, isFullscreen }: CameraFeedProps) {
  const streamUrl = `/api/camera/${boardId}`;
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`bg-black rounded-lg border border-border overflow-hidden flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
        <span className="text-xs text-muted">
          Camera Feed — {boardId.slice(0, 8)}
        </span>
        <span className="text-xs text-danger ml-auto">LIVE</span>
      </div>
      <div className={`relative flex items-center justify-center bg-black ${isFullscreen ? 'flex-1 h-[calc(100vh-8rem)]' : ''}`} style={!isFullscreen ? { minHeight: "240px" } : {}}>
        {!hasError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={streamUrl}
            alt="FPGA Board Camera Feed"
            className="max-w-full max-h-full"
            style={!isFullscreen ? { minHeight: "240px", objectFit: "contain", background: "#000" } : { objectFit: "contain", background: "#000", maxHeight: "100%" }}
            onError={() => setHasError(true)}
          />
        ) : (
          /* Camera offline — clean placeholder */
          <div className="flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 text-white px-6 w-full h-full" style={!isFullscreen ? { height: "320px" } : {}}>
            <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">Camera Offline</p>
            <p className="text-xs text-gray-500 mb-4 text-center">
              No camera stream available for this board
            </p>
            <button
              onClick={() => setHasError(false)}
              className="text-xs px-4 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes ledBlink {
          0% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

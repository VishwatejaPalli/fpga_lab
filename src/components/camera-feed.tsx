"use client";

import { useState } from "react";

interface CameraFeedProps {
  boardId: string;
}

export default function CameraFeed({ boardId }: CameraFeedProps) {
  const streamUrl = `/api/camera/${boardId}`;
  const [hasError, setHasError] = useState(false);

  return (
    <div className="bg-black rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
        <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
        <span className="text-xs text-muted">
          Camera Feed — {boardId.slice(0, 8)}
        </span>
        <span className="text-xs text-danger ml-auto">LIVE</span>
      </div>
      <div className="relative" style={{ minHeight: "240px" }}>
        {!hasError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={streamUrl}
            alt="FPGA Board Camera Feed"
            className="w-full h-auto"
            style={{ minHeight: "240px", objectFit: "contain", background: "#000" }}
            onError={() => setHasError(true)}
          />
        ) : (
          /* Demo mode — animated FPGA board simulation */
          <div className="flex flex-col items-center justify-center h-80 bg-gradient-to-b from-gray-900 to-gray-800 text-white px-6">
            {/* Simulated board SVG */}
            <div className="relative w-full max-w-sm">
              {/* Board outline */}
              <div className="border-2 border-green-800 rounded-lg bg-green-950/50 p-4">
                <div className="text-xs text-green-400 font-mono mb-3 text-center opacity-70">
                  FPGA Development Board
                </div>

                {/* Simulated LED row */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-xs text-gray-400 mr-2">LEDs:</span>
                  {[0,1,2,3,4,5,6,7].map((i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full"
                      style={{
                        background: i % 2 === 0 ? '#22c55e' : '#1a1a2e',
                        boxShadow: i % 2 === 0 ? '0 0 8px #22c55e' : 'none',
                        animation: `ledBlink ${1 + i * 0.3}s ease-in-out infinite alternate`,
                      }}
                    />
                  ))}
                </div>

                {/* Simulated 7-segment display */}
                <div className="flex items-center justify-center gap-1 mb-4">
                  <span className="text-xs text-gray-400 mr-2">Display:</span>
                  <div className="font-mono text-2xl text-red-500 tracking-widest"
                       style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>
                    <span className="demo-counter">F</span>
                    <span className="demo-counter" style={{ animationDelay: '0.2s' }}>P</span>
                    <span className="demo-counter" style={{ animationDelay: '0.4s' }}>G</span>
                    <span className="demo-counter" style={{ animationDelay: '0.6s' }}>A</span>
                  </div>
                </div>

                {/* Simulated switch row */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-gray-400 mr-2">SW:</span>
                  {[1,0,1,1,0,1,0,1].map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <div className={`w-2 h-4 rounded-sm ${v ? 'bg-blue-400' : 'bg-gray-600'}`} />
                      <span className="text-[8px] text-gray-500">{i}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              📷 Demo Mode — Camera feed simulated (no hardware connected)
            </p>
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

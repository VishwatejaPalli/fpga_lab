"use client";

import { useEffect, useRef, useState } from "react";

interface VirtualIOProps {
  boardId: string;
}

export default function VirtualIO({ boardId }: VirtualIOProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [switches, setSwitches] = useState<boolean[]>(Array(8).fill(false));
  const [activeButtons, setActiveButtons] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Establish WebSocket connection to send GPIO commands over UART
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/uart/${boardId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [boardId]);

  const sendCommand = (cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Simulate typing the command into the UART console
      wsRef.current.send(JSON.stringify({ type: "uart-input", data: cmd + "\r\n" }));
    }
  };

  const handleSwitchToggle = (index: number) => {
    const newSwitches = [...switches];
    newSwitches[index] = !newSwitches[index];
    setSwitches(newSwitches);
    
    // Send command, e.g., "SW3=1"
    sendCommand(`SW${index}=${newSwitches[index] ? 1 : 0}`);
  };

  const handleButtonPress = (index: number) => {
    setActiveButtons(prev => new Set(prev).add(index));
    sendCommand(`BTN${index}=1`);
  };

  const handleButtonRelease = (index: number) => {
    setActiveButtons(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    sendCommand(`BTN${index}=0`);
  };

  return (
    <div className="card p-5 border-border shadow-lg">
      <h2 className="font-semibold mb-6 flex items-center gap-2 text-lg">
        🎛️ Virtual I/O Panel
      </h2>
      
      <div className="space-y-8">
        {/* Switches Section */}
        <div>
          <h3 className="text-sm text-muted font-medium mb-4 uppercase tracking-wider">Switches (SW7 - SW0)</h3>
          <div className="flex flex-row-reverse justify-end gap-3 sm:gap-4 flex-wrap">
            {switches.map((isOn, idx) => (
              <div key={`sw-${idx}`} className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handleSwitchToggle(idx)}
                  className={`relative w-8 h-14 rounded-md transition-all duration-300 shadow-inner border flex flex-col justify-end p-1 ${
                    isOn 
                      ? "bg-primary/20 border-primary shadow-[inset_0_0_10px_rgba(59,130,246,0.3)]" 
                      : "bg-background border-border"
                  }`}
                  aria-pressed={isOn}
                >
                  <div 
                    className={`w-full h-1/2 rounded shadow-sm transition-transform duration-300 ${
                      isOn 
                        ? "bg-primary translate-y-[-100%]" 
                        : "bg-muted/50 translate-y-0"
                    }`}
                  />
                </button>
                <span className="text-[10px] font-mono text-muted">SW{idx}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/50 w-full" />

        {/* Buttons Section */}
        <div>
          <h3 className="text-sm text-muted font-medium mb-4 uppercase tracking-wider">Push Buttons (BTN3 - BTN0)</h3>
          <div className="flex flex-row-reverse justify-end gap-4 sm:gap-6 flex-wrap">
            {[0, 1, 2, 3].map((idx) => {
              const isPressed = activeButtons.has(idx);
              return (
                <div key={`btn-${idx}`} className="flex flex-col items-center gap-2">
                  <button
                    onMouseDown={() => handleButtonPress(idx)}
                    onMouseUp={() => handleButtonRelease(idx)}
                    onMouseLeave={() => isPressed && handleButtonRelease(idx)}
                    onTouchStart={(e) => { e.preventDefault(); handleButtonPress(idx); }}
                    onTouchEnd={(e) => { e.preventDefault(); handleButtonRelease(idx); }}
                    className={`w-12 h-12 rounded-full border-2 transition-all duration-150 flex items-center justify-center ${
                      isPressed
                        ? "bg-danger border-danger shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-95"
                        : "bg-background border-danger/50 shadow-md hover:border-danger hover:bg-danger/10"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full ${isPressed ? 'bg-danger-600' : 'bg-danger/20'}`} />
                  </button>
                  <span className="text-[10px] font-mono text-muted">BTN{idx}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted mt-6">
        Interacting with these controls sends UART commands (e.g. <code>SW0=1</code>) to the FPGA.
      </p>
    </div>
  );
}

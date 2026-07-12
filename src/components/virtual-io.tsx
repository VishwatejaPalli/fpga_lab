"use client";

import { useEffect, useRef, useState } from "react";

interface VirtualIOProps {
  boardId: string;
}

interface VirtualIoConfig {
  switchCount: number;
  buttonCount: number;
  ledCount: number;
  sevenSegCount: number;
}

const SevenSegmentDigit = ({ char, colorClass }: { char: string, colorClass: string }) => {
  const segments: Record<string, boolean[]> = {
    '0': [true, true, true, true, true, true, false],
    '1': [false, true, true, false, false, false, false],
    '2': [true, true, false, true, true, false, true],
    '3': [true, true, true, true, false, false, true],
    '4': [false, true, true, false, false, true, true],
    '5': [true, false, true, true, false, true, true],
    '6': [true, false, true, true, true, true, true],
    '7': [true, true, true, false, false, false, false],
    '8': [true, true, true, true, true, true, true],
    '9': [true, true, true, true, false, true, true],
    'A': [true, true, true, false, true, true, true],
    'B': [false, false, true, true, true, true, true],
    'C': [true, false, false, true, true, true, false],
    'D': [false, true, true, true, true, false, true],
    'E': [true, false, false, true, true, true, true],
    'F': [true, false, false, false, true, true, true],
    '-': [false, false, false, false, false, false, true],
    ' ': [false, false, false, false, false, false, false],
  };
  
  const active = segments[char] || segments[' '];
  
  return (
    <svg viewBox="0 0 40 60" className="w-8 h-12 bg-gray-900 p-1 rounded-sm border border-gray-800">
      <polygon points="10,4 30,4 26,8 14,8" className={active[0] ? colorClass : 'fill-gray-800'} />
      <polygon points="32,6 32,26 28,22 28,10" className={active[1] ? colorClass : 'fill-gray-800'} />
      <polygon points="32,34 32,54 28,50 28,38" className={active[2] ? colorClass : 'fill-gray-800'} />
      <polygon points="10,56 30,56 26,52 14,52" className={active[3] ? colorClass : 'fill-gray-800'} />
      <polygon points="8,34 8,54 12,50 12,38" className={active[4] ? colorClass : 'fill-gray-800'} />
      <polygon points="8,6 8,26 12,22 12,10" className={active[5] ? colorClass : 'fill-gray-800'} />
      <polygon points="10,30 30,30 26,32 14,32 14,28 26,28" className={active[6] ? colorClass : 'fill-gray-800'} />
    </svg>
  );
};

export default function VirtualIO({ boardId }: VirtualIOProps) {
  const wsRef = useRef<WebSocket | null>(null);
  
  const [config, setConfig] = useState<VirtualIoConfig>({
    switchCount: 8,
    buttonCount: 4,
    ledCount: 16,
    sevenSegCount: 4
  });
  const [showSettings, setShowSettings] = useState(false);

  const [switches, setSwitches] = useState<boolean[]>(Array(16).fill(false));
  const [activeButtons, setActiveButtons] = useState<Set<number>>(new Set());
  const [leds, setLeds] = useState<boolean[]>(Array(16).fill(false));
  const [sevenSeg, setSevenSeg] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<"blue" | "green" | "red" | "orange">("blue");

  // Load config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`virtual-io-config-${boardId}`);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {}
    }
  }, [boardId]);

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem(`virtual-io-config-${boardId}`, JSON.stringify(config));
  }, [config, boardId]);

  const switchColors = {
    blue: { bg: "bg-blue-500/20 border-blue-500 shadow-[inset_0_0_10px_rgba(59,130,246,0.3)]", thumb: "bg-blue-50" },
    green: { bg: "bg-emerald-500/20 border-emerald-500 shadow-[inset_0_0_10px_rgba(16,185,129,0.3)]", thumb: "bg-emerald-50" },
    red: { bg: "bg-rose-500/20 border-rose-500 shadow-[inset_0_0_10px_rgba(244,63,94,0.3)]", thumb: "bg-rose-50" },
    orange: { bg: "bg-amber-500/20 border-amber-500 shadow-[inset_0_0_10px_rgba(245,158,11,0.3)]", thumb: "bg-amber-50" }
  };

  const buttonColors = {
    blue: { active: "bg-blue-500 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-95", activeDot: "bg-blue-700", inactiveDot: "bg-blue-500/20", hover: "hover:border-blue-500 hover:bg-blue-500/10 border-blue-500/30" },
    green: { active: "bg-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-95", activeDot: "bg-emerald-700", inactiveDot: "bg-emerald-500/20", hover: "hover:border-emerald-500 hover:bg-emerald-500/10 border-emerald-500/30" },
    red: { active: "bg-rose-500 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)] scale-95", activeDot: "bg-rose-700", inactiveDot: "bg-rose-500/20", hover: "hover:border-rose-500 hover:bg-rose-500/10 border-rose-500/30" },
    orange: { active: "bg-amber-500 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-95", activeDot: "bg-amber-700", inactiveDot: "bg-amber-500/20", hover: "hover:border-amber-500 hover:bg-amber-500/10 border-amber-500/30" }
  };

  const ledColors = {
    blue: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]",
    green: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]",
    red: "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]",
    orange: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"
  };

  const segColors = {
    blue: "fill-blue-500",
    green: "fill-emerald-500",
    red: "fill-rose-500",
    orange: "fill-amber-500"
  };

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/uart/${boardId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "uart-data" && msg.data) {
          const text = msg.data.toString();
          
          const ledMatch = text.match(/LEDS=([0-9A-Fa-f]+)/);
          if (ledMatch) {
            const hex = ledMatch[1];
            const num = parseInt(hex, 16);
            if (!isNaN(num)) {
              const newLeds = Array(16).fill(false);
              for (let i = 0; i < 16; i++) {
                newLeds[i] = (num & (1 << i)) !== 0;
              }
              setLeds(newLeds);
            }
          }

          const segMatch = text.match(/SEG=([0-9A-Za-z\-]+)/);
          if (segMatch) {
            setSevenSeg(segMatch[1].toUpperCase());
          }
        }
      } catch (e) {}
    };

    return () => {
      ws.close();
    };
  }, [boardId]);

  const sendCommand = (cmd: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "uart-input", data: cmd + "\r\n" }));
    }
  };

  const handleSwitchToggle = (index: number) => {
    const newSwitches = [...switches];
    newSwitches[index] = !newSwitches[index];
    setSwitches(newSwitches);
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

  const displaySegs = sevenSeg.padStart(config.sevenSegCount, '0').slice(-config.sevenSegCount).split('');

  return (
    <div className="card p-5 border-border shadow-lg relative">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
        <h2 className="font-semibold flex items-center gap-2 text-lg">
          🎛️ Virtual I/O Panel
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50">
            {(["blue", "green", "red", "orange"] as const).map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-4 h-4 rounded-full border transition-all duration-200 ${
                  color === "blue" ? "bg-blue-500 border-blue-600" :
                  color === "green" ? "bg-emerald-500 border-emerald-600" :
                  color === "red" ? "bg-rose-500 border-rose-600" :
                  "bg-amber-500 border-amber-600"
                } ${
                  selectedColor === color 
                    ? "ring-2 ring-primary/40 scale-110 shadow-sm" 
                    : "opacity-60 hover:opacity-100"
                }`}
                title={`Switch to ${color}`}
              />
            ))}
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
            title="Configure I/O"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="bg-muted/30 border border-border/50 p-4 rounded-lg mb-6 shadow-inner transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Configure Components
            </h4>
            <button onClick={() => setShowSettings(false)} className="text-muted hover:text-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {/* Default Presets */}
          <div className="flex gap-2 mb-6 pb-4 border-b border-border/50">
            <span className="text-xs text-muted-foreground self-center mr-2">Presets:</span>
            <button 
              onClick={() => setConfig({ switchCount: 16, buttonCount: 5, ledCount: 16, sevenSegCount: 4 })}
              className="text-xs px-2.5 py-1 bg-background border border-border rounded hover:bg-muted transition-colors"
            >
              Basys 3
            </button>
            <button 
              onClick={() => setConfig({ switchCount: 2, buttonCount: 4, ledCount: 4, sevenSegCount: 0 })}
              className="text-xs px-2.5 py-1 bg-background border border-border rounded hover:bg-muted transition-colors"
            >
              PYNQ-Z2
            </button>
            <button 
              onClick={() => setConfig({ switchCount: 10, buttonCount: 2, ledCount: 10, sevenSegCount: 6 })}
              className="text-xs px-2.5 py-1 bg-background border border-border rounded hover:bg-muted transition-colors"
            >
              DE10-Lite
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                <label>Switches</label>
                <span>{config.switchCount}</span>
              </div>
              <input type="range" min="0" max="16" value={config.switchCount} onChange={(e) => setConfig({...config, switchCount: parseInt(e.target.value)})} className="w-full accent-primary" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                <label>Push Buttons</label>
                <span>{config.buttonCount}</span>
              </div>
              <input type="range" min="0" max="8" value={config.buttonCount} onChange={(e) => setConfig({...config, buttonCount: parseInt(e.target.value)})} className="w-full accent-primary" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                <label>LEDs</label>
                <span>{config.ledCount}</span>
              </div>
              <input type="range" min="0" max="16" value={config.ledCount} onChange={(e) => setConfig({...config, ledCount: parseInt(e.target.value)})} className="w-full accent-primary" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                <label>7-Segment Digits</label>
                <span>{config.sevenSegCount}</span>
              </div>
              <input type="range" min="0" max="8" value={config.sevenSegCount} onChange={(e) => setConfig({...config, sevenSegCount: parseInt(e.target.value)})} className="w-full accent-primary" />
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-8 relative z-10">
        
        {/* Output Row (LEDs & 7-Seg) */}
        {(config.ledCount > 0 || config.sevenSegCount > 0) && (
          <div className="flex flex-wrap justify-between items-end gap-6 bg-muted/20 p-4 rounded-lg border border-border/50">
            
            {/* 7-Segment Display */}
            {config.sevenSegCount > 0 && (
              <div>
                <h3 className="text-xs text-muted font-medium mb-3 uppercase tracking-wider">7-Segment Display</h3>
                <div className="flex flex-row-reverse justify-end gap-1 bg-black p-2 rounded-lg border border-gray-800 shadow-inner inline-flex">
                  {displaySegs.map((char, idx) => (
                    <SevenSegmentDigit key={`seg-${idx}`} char={char} colorClass={segColors[selectedColor]} />
                  ))}
                </div>
              </div>
            )}

            {/* LEDs */}
            {config.ledCount > 0 && (
              <div>
                <h3 className="text-xs text-muted font-medium mb-3 uppercase tracking-wider text-right">LEDs</h3>
                <div className="flex flex-row-reverse justify-end gap-3 sm:gap-4 flex-wrap">
                  {Array.from({ length: config.ledCount }).map((_, idx) => {
                    const isOn = leds[idx];
                    return (
                      <div key={`led-${idx}`} className="flex flex-col items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border border-gray-700 transition-all duration-75 ${isOn ? ledColors[selectedColor] : 'bg-gray-800'}`} />
                        <span className="text-[10px] font-mono text-muted">L{idx}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
          </div>
        )}

        {(config.ledCount > 0 || config.sevenSegCount > 0) && (config.switchCount > 0 || config.buttonCount > 0) && (
          <div className="h-px bg-border/50 w-full" />
        )}

        {/* Input Row (Switches & Buttons) */}
        <div className="flex flex-wrap justify-between items-start gap-8">
          
          {/* Switches Section */}
          {config.switchCount > 0 && (
            <div className="flex-1 min-w-[200px]">
              <h3 className="text-xs text-muted font-medium mb-4 uppercase tracking-wider">Switches</h3>
              <div className="flex flex-row-reverse justify-end gap-3 sm:gap-4 flex-wrap">
                {Array.from({ length: config.switchCount }).map((_, idx) => {
                  const isOn = switches[idx];
                  return (
                    <div key={`sw-${idx}`} className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => handleSwitchToggle(idx)}
                        className={`relative w-8 h-14 rounded-md transition-all duration-300 shadow-inner border flex flex-col justify-end p-1 ${
                          isOn 
                            ? switchColors[selectedColor].bg 
                            : "bg-background border-border"
                        }`}
                        aria-pressed={isOn}
                      >
                        <div 
                          className={`w-full h-1/2 rounded shadow-sm transition-transform duration-300 ${
                            isOn 
                              ? `${switchColors[selectedColor].thumb} translate-y-[-100%]` 
                              : "bg-muted/50 translate-y-0"
                          }`}
                        />
                      </button>
                      <span className="text-[10px] font-mono text-muted">SW{idx}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buttons Section */}
          {config.buttonCount > 0 && (
            <div>
              <h3 className="text-xs text-muted font-medium mb-4 uppercase tracking-wider text-right">Push Buttons</h3>
              <div className="flex flex-row-reverse justify-end gap-4 sm:gap-6 flex-wrap">
                {Array.from({ length: config.buttonCount }).map((_, idx) => {
                  const isPressed = activeButtons.has(idx);
                  const currentBtnColor = buttonColors[selectedColor];
                  return (
                    <div key={`btn-${idx}`} className="flex flex-col items-center gap-2">
                      <button
                        onMouseDown={() => handleButtonPress(idx)}
                        onMouseUp={() => handleButtonRelease(idx)}
                        onMouseLeave={() => isPressed && handleButtonRelease(idx)}
                        onTouchStart={(e) => { e.preventDefault(); handleButtonPress(idx); }}
                        onTouchEnd={(e) => { e.preventDefault(); handleButtonRelease(idx); }}
                        className={`w-12 h-12 rounded-full border-2 transition-all duration-150 flex items-center justify-center bg-background ${
                          isPressed
                            ? currentBtnColor.active
                            : currentBtnColor.hover
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full ${isPressed ? currentBtnColor.activeDot : currentBtnColor.inactiveDot}`} />
                      </button>
                      <span className="text-[10px] font-mono text-muted">BTN{idx}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
      <p className="text-xs text-muted mt-6 text-center border-t border-border/30 pt-4">
        Send UART outputs to drive indicators: <code>LEDS=FF</code> or <code>SEG=1234</code>.
      </p>
    </div>
  );
}

interface BoardCardProps {
  board: {
    id: string;
    name: string;
    fpgaFamily: string;
    boardType: string;
    status: string;
    capabilities: string[];
  };
  onSelect?: (boardId: string) => void;
}

const capabilityIcons: Record<string, string> = {
  led: "💡",
  uart: "📟",
  camera: "📷",
  switches: "🔘",
  ethernet: "🌐",
  display: "🖥️",
};

export default function BoardCard({ board, onSelect }: BoardCardProps) {
  return (
    <div
      className="card cursor-pointer transition-all hover:shadow-lg active:scale-[0.98] touch-manipulation"
      onClick={() => onSelect?.(board.id)}
    >
      {/* FPGA board image */}
      <div className="mb-4 -mx-6 -mt-6 rounded-t-xl overflow-hidden border-b border-border">
        <img
          src="/fpga-board.svg"
          alt={`${board.name} FPGA board`}
          className="w-full h-32 object-cover"
        />
      </div>

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg">{board.name}</h3>
          <p className="text-muted text-sm">{board.fpgaFamily}</p>
        </div>
        <span className={`badge badge-${board.status}`}>{board.status}</span>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        <span className="text-xs text-muted bg-background px-2 py-0.5 rounded">
          {board.boardType}
        </span>
      </div>

      {board.capabilities.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          {board.capabilities.map((cap) => (
            <span
              key={cap}
              title={cap}
              className="text-lg"
            >
              {capabilityIcons[cap] || "⚙️"}
            </span>
          ))}
        </div>
      )}

      {board.status === "free" && (
        <button
          className="btn-primary w-full text-sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(board.id);
          }}
        >
          Select Board
        </button>
      )}

      {board.status === "busy" && (
        <div className="text-center text-sm text-warning py-2">
          Currently in use
        </div>
      )}

      {board.status === "offline" && (
        <div className="text-center text-sm text-danger py-2">
          Board offline
        </div>
      )}
    </div>
  );
}

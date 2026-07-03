interface BoardCardProps {
  board: {
    id: string;
    name: string;
    fpgaFamily: string;
    boardType: string;
    boardImageUrl?: string | null;
    status: string;
    capabilities: string[];
  };
  onSelect?: (boardId: string) => void;
}

const defaultBoardImageUrl = "/campus-1.jpg";

const boardImageByType: Record<
  string,
  { imageUrl: string; manufacturer: string; model: string }
> = {
  basys3: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/106/6255/Basys3-Rev.C-obl-1000__14394.1749749725.png?c=2",
    manufacturer: "Digilent",
    model: "Basys 3",
  },
  nexysa7: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/629/5235/NexysA7-obl-600__85101.1670975737.jpg?c=2",
    manufacturer: "Digilent",
    model: "Nexys A7",
  },
  "pynq-z2": {
    imageUrl: "https://www.tulembedded.com/FPGA/images/01_PYNQ-Z2.jpg",
    manufacturer: "TUL",
    model: "PYNQ-Z2",
  },
  pynqz2: {
    imageUrl: "https://www.tulembedded.com/FPGA/images/01_PYNQ-Z2.jpg",
    manufacturer: "TUL",
    model: "PYNQ-Z2",
  },
  de10lite: {
    imageUrl:
      "https://www.terasic.com.tw/attachment/archive/1021/image/DE10-Lite_45.jpg",
    manufacturer: "Terasic",
    model: "DE10-Lite",
  },
  "de10-lite": {
    imageUrl:
      "https://www.terasic.com.tw/attachment/archive/1021/image/DE10-Lite_45.jpg",
    manufacturer: "Terasic",
    model: "DE10-Lite",
  },
  icebreaker: {
    imageUrl:
      "https://docs.icebreaker-fpga.org/assets/img/icebreaker/icebreaker-iso_png_project-body_1024x1024.webp",
    manufacturer: "1BitSquared",
    model: "iCEBreaker",
  },
};

function getBoardImageMeta(boardType: string) {
  const exact = boardImageByType[boardType.toLowerCase()];
  if (exact) return exact;

  const normalized = boardType.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    boardImageByType[normalized] || {
      imageUrl: defaultBoardImageUrl,
      manufacturer: "FPGA Vendor",
      model: "Board",
    }
  );
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
  const boardImage = getBoardImageMeta(board.boardType);
  const configuredImage = board.boardImageUrl?.trim();
  const boardImageUrl = configuredImage || boardImage.imageUrl;
  const boardImageAlt = `${boardImage.model} by ${boardImage.manufacturer}`;

  return (
    <div
      className="card cursor-pointer group transition-all hover:shadow-[0_8px_30px_rgba(59,130,246,0.2)] active:scale-[0.98] touch-manipulation"
      onClick={() => onSelect?.(board.id)}
    >
      <div className="mb-4 overflow-hidden rounded-lg border border-border bg-background/50 relative group-hover:border-accent/50 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-0 dark:opacity-60 z-10 transition-opacity"></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={boardImageUrl}
          alt={boardImageAlt}
          className="h-36 w-full object-cover dark:mix-blend-screen group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src.endsWith(defaultBoardImageUrl)) return;
            img.src = defaultBoardImageUrl;
          }}
        />
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="z-20 relative">
          <h3 className="font-semibold text-lg text-foreground group-hover:text-accent transition-colors">{board.name}</h3>
          <p className="text-muted text-sm">{board.fpgaFamily}</p>
        </div>
        <span className={`badge badge-${board.status}`}>{board.status}</span>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        <span className="text-[10px] font-mono tracking-wider uppercase text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(139,92,246,0.1)]">
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
        <div className="text-center text-sm font-medium text-amber-400/80 py-2 bg-amber-500/5 rounded-lg border border-amber-500/10 mt-2">
          Currently in use
        </div>
      )}

      {board.status === "offline" && (
        <div className="text-center text-sm font-medium text-red-400/80 py-2 bg-red-500/5 rounded-lg border border-red-500/10 mt-2">
          Board offline
        </div>
      )}
    </div>
  );
}

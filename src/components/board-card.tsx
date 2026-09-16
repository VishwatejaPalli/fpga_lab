import {
  LightbulbIcon,
  TerminalIcon,
  CameraIcon,
  SlidersIcon,
  GlobeIcon,
  MonitorIcon,
  SettingsIcon,
  BellIcon,
  BellOffIcon,
} from "@/components/icons";

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
  isNotified?: boolean;
  onToggleNotify?: (boardId: string) => void;
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
  // --- Xilinx / AMD Spartan family ---
  "spartan3e": {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Xilinx_Spartan-3E_%28XC3S500E%29.jpg/1280px-Xilinx_Spartan-3E_%28XC3S500E%29.jpg",
    manufacturer: "Xilinx",
    model: "Spartan-3E Starter Kit",
  },
  "spartan-3e": {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Xilinx_Spartan-3E_%28XC3S500E%29.jpg/1280px-Xilinx_Spartan-3E_%28XC3S500E%29.jpg",
    manufacturer: "Xilinx",
    model: "Spartan-3E Starter Kit",
  },
  spartan3: {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Xilinx_Spartan-3E_%28XC3S500E%29.jpg/1280px-Xilinx_Spartan-3E_%28XC3S500E%29.jpg",
    manufacturer: "Xilinx",
    model: "Spartan-3 Starter Kit",
  },
  "spartan-3": {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Xilinx_Spartan-3E_%28XC3S500E%29.jpg/1280px-Xilinx_Spartan-3E_%28XC3S500E%29.jpg",
    manufacturer: "Xilinx",
    model: "Spartan-3 Starter Kit",
  },
  // --- Xilinx / AMD Kintex family ---
  kintex7: {
    imageUrl:
      "https://www.xilinx.com/content/dam/xilinx/imgs/kits/whats-inside/kc705-evaluation-kit-image.png",
    manufacturer: "AMD / Xilinx",
    model: "Kintex-7 KC705",
  },
  "kintex-7": {
    imageUrl:
      "https://www.xilinx.com/content/dam/xilinx/imgs/kits/whats-inside/kc705-evaluation-kit-image.png",
    manufacturer: "AMD / Xilinx",
    model: "Kintex-7 KC705",
  },
  kc705: {
    imageUrl:
      "https://www.xilinx.com/content/dam/xilinx/imgs/kits/whats-inside/kc705-evaluation-kit-image.png",
    manufacturer: "AMD / Xilinx",
    model: "Kintex-7 KC705",
  },
  // --- Xilinx / AMD Virtex family ---
  virtex7: {
    imageUrl:
      "https://www.xilinx.com/content/dam/xilinx/imgs/kits/whats-inside/vc707-evaluation-kit-image.png",
    manufacturer: "AMD / Xilinx",
    model: "Virtex-7 VC707",
  },
  "virtex-7": {
    imageUrl:
      "https://www.xilinx.com/content/dam/xilinx/imgs/kits/whats-inside/vc707-evaluation-kit-image.png",
    manufacturer: "AMD / Xilinx",
    model: "Virtex-7 VC707",
  },
  vc707: {
    imageUrl:
      "https://www.xilinx.com/content/dam/xilinx/imgs/kits/whats-inside/vc707-evaluation-kit-image.png",
    manufacturer: "AMD / Xilinx",
    model: "Virtex-7 VC707",
  },
  // --- Digilent Arty A7 (Artix-7) ---
  artya7: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/551/5048/ArtyA7-obl-600__56099.1670977099.jpg?c=2",
    manufacturer: "Digilent",
    model: "Arty A7",
  },
  "arty-a7": {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/551/5048/ArtyA7-obl-600__56099.1670977099.jpg?c=2",
    manufacturer: "Digilent",
    model: "Arty A7",
  },
  // --- Digilent Arty S7 (Spartan-7) ---
  artys7: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/587/5128/ArtyS7-obl-600__60182.1670976824.jpg?c=2",
    manufacturer: "Digilent",
    model: "Arty S7",
  },
  "arty-s7": {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/587/5128/ArtyS7-obl-600__60182.1670976824.jpg?c=2",
    manufacturer: "Digilent",
    model: "Arty S7",
  },
  // --- Digilent Zybo Z7 (Zynq-7000) ---
  zyboz7: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/560/5064/Zybo-Z7-obl-600__81537.1670977044.jpg?c=2",
    manufacturer: "Digilent",
    model: "Zybo Z7",
  },
  "zybo-z7": {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/560/5064/Zybo-Z7-obl-600__81537.1670977044.jpg?c=2",
    manufacturer: "Digilent",
    model: "Zybo Z7",
  },
  // --- Digilent Cmod A7 (Artix-7 module) ---
  cmoda7: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/549/5045/Cmod-A7-obl-600__75498.1670977111.jpg?c=2",
    manufacturer: "Digilent",
    model: "Cmod A7",
  },
  "cmod-a7": {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/549/5045/Cmod-A7-obl-600__75498.1670977111.jpg?c=2",
    manufacturer: "Digilent",
    model: "Cmod A7",
  },
  // --- Digilent Nexys Video (Artix-7) ---
  nexysvideo: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/485/4899/NexysVideo-obl-600__72846.1670977237.jpg?c=2",
    manufacturer: "Digilent",
    model: "Nexys Video",
  },
  "nexys-video": {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/485/4899/NexysVideo-obl-600__72846.1670977237.jpg?c=2",
    manufacturer: "Digilent",
    model: "Nexys Video",
  },
  // --- Avnet ZedBoard (Zynq-7000) ---
  zedboard: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/390/5653/zedboard-obl-600__56072.1694704381.jpg?c=2",
    manufacturer: "Avnet / Digilent",
    model: "ZedBoard",
  },
  // --- Digilent Genesys 2 (Kintex-7) ---
  genesys2: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/480/4889/Genesys2-obl-600__26498.1670977252.jpg?c=2",
    manufacturer: "Digilent",
    model: "Genesys 2",
  },
  "genesys-2": {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/480/4889/Genesys2-obl-600__26498.1670977252.jpg?c=2",
    manufacturer: "Digilent",
    model: "Genesys 2",
  },
  // --- Digilent Eclypse Z7 (Zynq-7000) ---
  eclypsez7: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/613/5189/Eclypse-Z7-obl-600__13376.1670976910.jpg?c=2",
    manufacturer: "Digilent",
    model: "Eclypse Z7",
  },
  "eclypse-z7": {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/613/5189/Eclypse-Z7-obl-600__13376.1670976910.jpg?c=2",
    manufacturer: "Digilent",
    model: "Eclypse Z7",
  },
  // --- Terasic DE0-Nano (Cyclone IV) ---
  de0nano: {
    imageUrl:
      "https://www.terasic.com.tw/attachment/archive/593/image/DE0-Nano_45.jpg",
    manufacturer: "Terasic",
    model: "DE0-Nano",
  },
  "de0-nano": {
    imageUrl:
      "https://www.terasic.com.tw/attachment/archive/593/image/DE0-Nano_45.jpg",
    manufacturer: "Terasic",
    model: "DE0-Nano",
  },
  // --- Terasic DE1-SoC (Cyclone V SoC) ---
  de1soc: {
    imageUrl:
      "https://www.terasic.com.tw/attachment/archive/836/image/DE1-SoC_45.jpg",
    manufacturer: "Terasic",
    model: "DE1-SoC",
  },
  "de1-soc": {
    imageUrl:
      "https://www.terasic.com.tw/attachment/archive/836/image/DE1-SoC_45.jpg",
    manufacturer: "Terasic",
    model: "DE1-SoC",
  },
  // --- Sipeed Tang Nano 9K (Gowin GW1NR-9) ---
  tangnano9k: {
    imageUrl:
      "https://wiki.sipeed.com/hardware/assets/Tang/Nano-9K/9K.png",
    manufacturer: "Sipeed",
    model: "Tang Nano 9K",
  },
  "tang-nano-9k": {
    imageUrl:
      "https://wiki.sipeed.com/hardware/assets/Tang/Nano-9K/9K.png",
    manufacturer: "Sipeed",
    model: "Tang Nano 9K",
  },
  // --- Lattice iCEstick (iCE40HX-1K) ---
  icestick: {
    imageUrl:
      "https://www.latticesemi.com/-/media/LatticeSemi/Images/Products/DevelopmentKitsAndBoards/iCEstick/iCEstick-Main-Image.ashx",
    manufacturer: "Lattice Semiconductor",
    model: "iCEstick",
  },
  "ice-stick": {
    imageUrl:
      "https://www.latticesemi.com/-/media/LatticeSemi/Images/Products/DevelopmentKitsAndBoards/iCEstick/iCEstick-Main-Image.ashx",
    manufacturer: "Lattice Semiconductor",
    model: "iCEstick",
  },
  // --- Digilent Nexys 4 DDR (Artix-7) ---
  nexys4ddr: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/488/4903/Nexys4DDR-obl-600__72652.1670977227.jpg?c=2",
    manufacturer: "Digilent",
    model: "Nexys 4 DDR",
  },
  "nexys-4-ddr": {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/488/4903/Nexys4DDR-obl-600__72652.1670977227.jpg?c=2",
    manufacturer: "Digilent",
    model: "Nexys 4 DDR",
  },
  nexys4: {
    imageUrl:
      "https://cdn11.bigcommerce.com/s-7gavg/images/stencil/1280x1280/products/488/4903/Nexys4DDR-obl-600__72652.1670977227.jpg?c=2",
    manufacturer: "Digilent",
    model: "Nexys 4 DDR",
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

function getCapabilityIcon(cap: string) {
  switch (cap.toLowerCase()) {
    case "led":
      return <LightbulbIcon className="w-3.5 h-3.5 text-amber-500" />;
    case "uart":
      return <TerminalIcon className="w-3.5 h-3.5 text-cyan-500" />;
    case "camera":
      return <CameraIcon className="w-3.5 h-3.5 text-emerald-500" />;
    case "switches":
      return <SlidersIcon className="w-3.5 h-3.5 text-indigo-500" />;
    case "ethernet":
      return <GlobeIcon className="w-3.5 h-3.5 text-blue-500" />;
    case "display":
      return <MonitorIcon className="w-3.5 h-3.5 text-purple-500" />;
    default:
      return <SettingsIcon className="w-3.5 h-3.5 text-muted" />;
  }
}

export default function BoardCard({ board, onSelect, isNotified, onToggleNotify }: BoardCardProps) {
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
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${
            board.status === "free"
              ? "led-glow-green"
              : board.status === "busy" || board.status === "allocated"
              ? "led-glow-amber animate-pulse"
              : "led-glow-red"
          }`} />
          <span className={`badge badge-${board.status}`}>{board.status}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-mono tracking-wider uppercase text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(139,92,246,0.1)]">
          {board.boardType}
        </span>
        <span className="text-[10px] font-mono text-muted/70 bg-muted/15 border border-border/50 px-1.5 py-0.5 rounded">
          hw:{board.id.slice(0, 8)}
        </span>
      </div>

      {board.capabilities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {board.capabilities.map((cap) => (
            <span
              key={cap}
              title={cap}
              className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted/30 border border-border text-foreground"
            >
              {getCapabilityIcon(cap)}
              <span className="capitalize">{cap}</span>
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

      {(board.status === "busy" || board.status === "allocated") && (
        <div className="space-y-2 mt-2">
          <div className="text-center text-xs font-medium text-amber-400/80 py-1.5 bg-amber-500/5 rounded-lg border border-amber-500/10">
            Currently in use
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleNotify?.(board.id);
            }}
            className={`w-full text-xs py-1.5 px-3 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
              isNotified
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-muted/40 text-muted hover:text-foreground border-border hover:bg-muted"
            }`}
          >
            {isNotified ? (
              <BellIcon className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <BellOffIcon className="w-3.5 h-3.5 text-muted" />
            )}
            <span>{isNotified ? "Notifying when free" : "Notify me when free"}</span>
          </button>
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

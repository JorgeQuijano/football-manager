import type { MatchSideState } from "@/engine";

export interface FramePlayer {
  x: number;
  y: number;
  num: number;
  side: "home" | "away";
  ring?: boolean;
  /** live stamina (0-100); a gauge ring is drawn when legs are going */
  legs?: number;
}

export interface Frame {
  players: FramePlayer[];
  ball: { x: number; y: number } | null;
  flash?: string | null;
}

/** Screen coords (0-100) for a formation slot, mirroring the pitch for one side. */
export const slotScreen = (
  side: MatchSideState,
  slot: number,
  mirror: boolean
): { x: number; y: number } => {
  const c = side.coords[slot] ?? [50, 50];
  const x = mirror ? 100 - c[0] : c[0];
  const y = mirror ? 100 - c[1] : c[1];
  return { x, y };
};

const luminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

export function drawFrame(
  cv: HTMLCanvasElement,
  frame: Frame,
  homeColor: string,
  awayColor: string
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (!w || !h) return;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (cv.width !== pw || cv.height !== ph) {
    cv.width = pw;
    cv.height = ph;
  }
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const X = (x: number) => (x / 100) * w;
  const Y = (y: number) => (y / 100) * h;

  // grass
  ctx.fillStyle = "#0C1B14";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(46,213,115,0.05)";
  for (let i = 0; i < 8; i += 2) ctx.fillRect(0, (i / 8) * h, w, h / 8);

  // lines
  ctx.strokeStyle = "rgba(46,213,115,0.32)";
  ctx.lineWidth = 1;
  const inset = 2;
  ctx.strokeRect(X(inset), Y(inset), w - 2 * X(inset), h - 2 * Y(inset));
  ctx.beginPath();
  ctx.moveTo(0, Y(50));
  ctx.lineTo(w, Y(50));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(50), Y(50), Math.min(w, h) * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  const boxW = w * 0.56;
  const boxH = h * 0.15;
  ctx.strokeRect((w - boxW) / 2, 0, boxW, boxH);
  ctx.strokeRect((w - boxW) / 2, h - boxH, boxW, boxH);
  const sixW = w * 0.3;
  const sixH = h * 0.055;
  ctx.strokeRect((w - sixW) / 2, 0, sixW, sixH);
  ctx.strokeRect((w - sixW) / 2, h - sixH, sixW, sixH);
  ctx.fillStyle = "rgba(46,213,115,0.55)";
  ctx.fillRect((w - sixW) / 2 + sixW * 0.2, 0, sixW * 0.6, 3);
  ctx.fillRect((w - sixW) / 2 + sixW * 0.2, h - 3, sixW * 0.6, 3);
  ctx.beginPath();
  ctx.arc(X(50), Y(11), 2, 0, Math.PI * 2);
  ctx.arc(X(50), Y(89), 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(46,213,115,0.4)";
  ctx.fill();

  // players
  const R = Math.max(9, Math.min(13, w * 0.028));
  for (const p of frame.players) {
    const col = p.side === "home" ? homeColor : awayColor;
    const px = X(p.x);
    const py = Y(p.y);
    // legs gauge: a ring that drains with stamina (only once it starts to matter)
    if (p.legs !== undefined && p.legs < 72) {
      const frac = Math.max(0, Math.min(1, p.legs / 100));
      ctx.beginPath();
      ctx.arc(px, py, R + 3, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.strokeStyle = p.legs >= 62 ? "#7BE495" : p.legs >= 45 ? "#FFB020" : "#FF6B6B";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    if (p.ring) {
      ctx.beginPath();
      ctx.arc(px, py, R + 3, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
    ctx.fillStyle = luminance(col) > 0.55 ? "#0B1B12" : "#F5FFF8";
    ctx.font = `700 ${Math.round(R * 1.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(p.num), px, py + 0.5);
  }

  // ball
  if (frame.ball) {
    const bx = X(frame.ball.x);
    const by = Y(frame.ball.y);
    ctx.beginPath();
    ctx.arc(bx, by, Math.max(4, R * 0.48), 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();
  }

  // flash
  if (frame.flash) {
    const size = Math.round(w * 0.1);
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 4;
    ctx.strokeText(frame.flash, w / 2, h * 0.42);
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.fillText(frame.flash, w / 2, h * 0.42);
  }
}

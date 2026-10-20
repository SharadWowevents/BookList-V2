export const INK_W = 1000;
export const INK_COLORS = { k: null, r: "#D2463C", o: "#E08A1E", g: "#2F9E5B", b: "#2F7FD8", p: "#8A5CD6" };
export const HL_COLORS = { y: "#FACC15", hg: "#34D399", hb: "#60A5FA", hp: "#F472B6" };
export const INK_TOOLS = ["pen", "pcl", "hl", "ln"];
export const SIZES = {
  pen: [2.5, 5, 10],
  pcl: [1.6, 3, 6],
  hl: [14, 26, 40],
  ln: [2.5, 5, 10],
  er: [10, 22, 44]
};

export function parseInk(raw) {
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const list = Array.isArray(d && d.s) ? d.s : [];
    return list.slice(0, 4000).filter(st => Array.isArray(st) && INK_TOOLS.includes(st[0]) && Array.isArray(st[3]) && st[3].length >= 3)
      .map(st => [
        st[0],
        st[0] === "hl" ? (HL_COLORS[st[1]] ? st[1] : "y") : (st[1] in INK_COLORS ? st[1] : "k"),
        Math.max(0.5, Math.min(60, +st[2] || 4)),
        st[3].slice(0, 30000 - (st[3].length % 3 ? st[3].length % 3 : 0)).map(n => Math.round(+n || 0))
      ]);
  } catch {
    return [];
  }
}

export const serializeInk = (strokes) => JSON.stringify({ v: 1, s: strokes });

export const getInkInk = () => {
  if (typeof window === 'undefined') return '#16191A';
  return getComputedStyle(document.body).color || '#16191A';
};

export function drawStroke(g, st, dx = 0, dy = 0) {
  const [tool, ck, w, pts] = st;
  const n = Math.floor(pts.length / 3);
  if (!n) return;
  const X = i => pts[i * 3] + dx;
  const Y = i => pts[i * 3 + 1] + dy;
  const P = i => pts[i * 3 + 2];

  g.save();
  const col = tool === "hl" ? HL_COLORS[ck] : (INK_COLORS[ck] || getInkInk());
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineJoin = "round";
  g.lineCap = tool === "hl" ? "square" : "round";

  if (tool === "hl" || tool === "ln") {
    if (tool === "hl") { g.globalAlpha = 0.36; }
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(X(0), Y(0));
    if (n === 1) g.lineTo(X(0) + 0.1, Y(0));
    for (let i = 1; i < n; i++) g.lineTo(X(i), Y(i));
    g.stroke();
  } else {
    if (tool === "pcl") g.globalAlpha = 0.8;
    const wp = i => w * (0.35 + 0.075 * P(i));
    if (n === 1) {
      g.beginPath();
      g.arc(X(0), Y(0), wp(0) / 2, 0, Math.PI * 2);
      g.fill();
    }
    let mx = X(0), my = Y(0);
    for (let i = 1; i < n; i++) {
      const nx = (X(i - 1) + X(i)) / 2, ny = (Y(i - 1) + Y(i)) / 2;
      g.beginPath();
      g.lineWidth = wp(i);
      g.moveTo(mx, my);
      g.quadraticCurveTo(X(i - 1), Y(i - 1), nx, ny);
      g.stroke();
      mx = nx;
      my = ny;
    }
    if (n > 1) {
      g.beginPath();
      g.lineWidth = wp(n - 1);
      g.moveTo(mx, my);
      g.lineTo(X(n - 1), Y(n - 1));
      g.stroke();
    }
  }
  g.restore();
}

export function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inkToPng(raw, h = 600) {
  const strokes = parseInk(raw);
  const W = 1600, k = W / INK_W, H = Math.max(200, Math.round(h * k));
  let maxY = 0;
  strokes.forEach(st => {
    for (let i = 1; i < st[3].length; i += 3) maxY = Math.max(maxY, st[3][i] + st[2]);
  });
  const hh = Math.min(H, Math.max(240, Math.round((maxY + 40) * k)));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = hh;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, hh);
  g.setTransform(k, 0, 0, k, 0, 0);
  strokes.forEach(st => drawStroke(g, st));
  return strokes.length ? c.toDataURL("image/png") : null;
}


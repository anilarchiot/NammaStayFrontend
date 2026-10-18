// Milestone share card (My investment) — drawn on a canvas, no money amounts.
export const CARD_THEMES = {
  night: { name: 'Night', bg: '#101A3D', ray: '#16244F', accent: '#F2B33D', medal: '#1C9A6C', medalText: '#FFFFFF', text: '#FFFFFF', sub: '#C9D3EE', chip: 'rgba(255,255,255,0.10)', confetti: ['#F2B33D', '#3CC48F', '#FFFFFF', '#E8836B'] },
  sunrise: { name: 'Sunrise', bg: '#FBF3DE', ray: '#F4E6C0', accent: '#C2412D', medal: '#E2A03F', medalText: '#101A3D', text: '#101A3D', sub: '#4F5B78', chip: 'rgba(16,26,61,0.07)', confetti: ['#C2412D', '#1C9A6C', '#E2A03F', '#2D5FA6'] },
  forest: { name: 'Forest', bg: '#0F5E43', ray: '#136B4D', accent: '#F2B33D', medal: '#FBF3DE', medalText: '#0F5E43', text: '#FFFFFF', sub: '#CDEBDD', chip: 'rgba(255,255,255,0.12)', confetti: ['#F2B33D', '#FBF3DE', '#9FE3C4', '#E8836B'] },
};
export const CARD_SIZES = { post: [1080, 1350, 'Post (4:5)'], story: [1080, 1920, 'Story (9:16)'], square: [1080, 1080, 'Square'] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const month = (d) => { if (!d) return ''; const [y, m] = String(d).slice(0, 7).split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

function badge(m) {
  if (/^p\d+$/.test(m.key)) return [m.key === 'p100' ? '100%' : m.key.slice(1) + '%', m.key === 'p100' ? 'BREAK-EVEN' : 'PAID BACK'];
  return ({ guests_100: ['100', 'GUESTS'], guests_1000: ['1,000', 'GUESTS'], lakh_month: ['₹1L', 'IN ONE MONTH'], first_booking: ['1st', 'BOOKING'], first_profit: ['1st', 'PROFIT MONTH'] })[m.key] || ['★', 'MILESTONE'];
}
function rand(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
function wrap(g, text, maxW) {
  const words = String(text).split(' '); const lines = []; let line = '';
  words.forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  if (line) lines.push(line); return lines.slice(0, 3);
}
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/** Draws the card and returns the canvas. o = { m, property, openedOn, pct, showPct, theme, size } */
export async function drawMilestoneCard(o) {
  const T = CARD_THEMES[o.theme] || CARD_THEMES.night; const [W, H] = CARD_SIZES[o.size] || CARD_SIZES.post;
  try { await Promise.all(['800 80px Sora', '700 40px Sora', '600 40px Manrope', '800 40px Manrope'].map((f) => document.fonts.load(f))); } catch { /* fallback fonts */ }
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const tall = H / W; const cx = W / 2;
  const L = { story: { top: 380, gap: 400, R: 240, title: 88, line: 98, after: 250, sub: 48, small: 38, foot: 150 },
              post: { top: 130, gap: 300, R: 185, title: 74, line: 84, after: 200, sub: 42, small: 34, foot: 92 },
              square: { top: 90, gap: 230, R: 150, title: 62, line: 70, after: 175, sub: 38, small: 30, foot: 70 } }[o.size] || null;
  const top = L.top; const my = top + L.gap; const R = L.R;
  // background + sunburst
  g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = T.ray;
  for (let i = 0; i < 24; i += 2) { const a1 = (i / 24) * Math.PI * 2; const a2 = ((i + 1) / 24) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx, my); g.lineTo(cx + Math.cos(a1) * 2000, my + Math.sin(a1) * 2000); g.lineTo(cx + Math.cos(a2) * 2000, my + Math.sin(a2) * 2000); g.closePath(); g.fill(); }
  // confetti
  const r = rand([...String(o.m.key) + o.property].reduce((a, ch) => a + ch.charCodeAt(0), 7));
  for (let i = 0; i < 46; i++) {
    const x = r() * W; const y = r() * (my + R * 0.8); if (Math.hypot(x - cx, y - my) < R + 70 || Math.abs(y - top + 12) < 34) continue;
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI); g.fillStyle = T.confetti[i % T.confetti.length]; g.globalAlpha = 0.85;
    if (i % 3 === 0) { g.beginPath(); g.arc(0, 0, 7 + r() * 6, 0, Math.PI * 2); g.fill(); } else g.fillRect(-12, -5, 24 + r() * 10, 10);
    g.restore();
  }
  // label
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = T.accent; g.font = '700 34px Sora, Manrope, sans-serif';
  if ('letterSpacing' in g) g.letterSpacing = '8px'; g.fillText('MILESTONE UNLOCKED', cx, top); if ('letterSpacing' in g) g.letterSpacing = '0px';
  // ribbons
  const ribbon = (dx, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx + dx - 55, my + R * 0.55); g.lineTo(cx + dx + 55, my + R * 0.55);
    g.lineTo(cx + dx + 55 + dx * 0.2, my + R + R * 0.45); g.lineTo(cx + dx + dx * 0.2, my + R + R * 0.3); g.lineTo(cx + dx - 55 + dx * 0.2, my + R + R * 0.45); g.closePath(); g.fill(); };
  ribbon(-70, T.accent); ribbon(70, T.medal);
  // medal
  g.fillStyle = T.accent; g.beginPath(); g.arc(cx, my, R + 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = T.medal; g.beginPath(); g.arc(cx, my, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = T.medalText; g.globalAlpha = 0.35; g.lineWidth = 4; g.setLineDash([10, 12]); g.beginPath(); g.arc(cx, my, R - 22, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  const [big, small] = badge(o.m);
  g.fillStyle = T.medalText; g.textBaseline = 'middle'; g.font = `800 ${big.length > 3 ? R * 0.52 : R * 0.68}px Sora, Manrope, sans-serif`; g.fillText(big, cx, my - R * 0.08, R * 1.6);
  g.font = `800 ${Math.round(R * 0.13)}px Manrope, sans-serif`; if ('letterSpacing' in g) g.letterSpacing = '4px'; g.fillText(small, cx, my + R * 0.42, R * 1.5); if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.textBaseline = 'alphabetic';
  // title + property
  let y = my + R + L.after;
  g.fillStyle = T.text; g.font = `800 ${L.title}px Sora, Manrope, sans-serif`;
  wrap(g, o.m.title, W - 160).forEach((ln) => { g.fillText(ln, cx, y); y += L.line; });
  g.fillStyle = T.sub; g.font = `600 ${L.sub}px Manrope, sans-serif`; g.fillText(o.property, cx, y + 6, W - 160); y += L.sub + 22;
  g.font = `600 ${L.small}px Manrope, sans-serif`; g.fillText(`Reached in ${month(o.m.achieved_on)}`, cx, y + 6); y += L.small + 40;
  // chips
  const chips = [o.openedOn ? `Hosting since ${month(o.openedOn)}` : null, o.showPct && o.pct != null && !/^p\d+$/.test(o.m.key) ? `${Math.floor(o.pct)}% of investment paid back` : null].filter(Boolean);
  if (chips.length && tall > 1.05) {
    g.font = '700 30px Manrope, sans-serif'; const pad = 26; const gap = 18; const ws = chips.map((t) => g.measureText(t).width + pad * 2); const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
    let x = cx - total / 2;
    chips.forEach((t, i) => { g.fillStyle = T.chip; const h = 62; const rr = 31; const w = ws[i];
      g.beginPath(); g.moveTo(x + rr, y); g.arcTo(x + w, y, x + w, y + h, rr); g.arcTo(x + w, y + h, x, y + h, rr); g.arcTo(x, y + h, x, y, rr); g.arcTo(x, y, x + w, y, rr); g.closePath(); g.fill();
      g.fillStyle = T.text; g.fillText(t, x + w / 2, y + 41); x += w + gap; });
  }
  // footer
  const logo = await loadImg('assets/img/logo.png');
  const fy = H - L.foot; g.textAlign = 'left'; g.font = '800 34px Sora, Manrope, sans-serif';
  const label = 'Managed with NammaStay'; const lw = g.measureText(label).width; const lx = cx - (lw + 76) / 2;
  if (logo) { g.save(); g.beginPath(); g.arc(lx + 28, fy - 12, 28, 0, Math.PI * 2); g.clip(); g.drawImage(logo, lx, fy - 40, 56, 56); g.restore(); }
  g.fillStyle = T.text; g.fillText(label, lx + 76, fy); g.textAlign = 'center'; g.fillStyle = T.sub; g.font = '600 26px Manrope, sans-serif'; g.fillText('thenammastay.com', cx, fy + 44);
  return c;
}

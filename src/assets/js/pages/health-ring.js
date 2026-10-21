// Score ring used by the Business health page and dashboard card.
export const COLOR = { green: '#1C9A6C', amber: '#C9831F', red: '#C2412D', unknown: '#8A8F9E' };

export function ring(score, size = 132) {
  const r = size / 2 - 10; const c = 2 * Math.PI * r; const pct = score == null ? 0 : score / 100;
  const col = score == null ? COLOR.unknown : score >= 75 ? COLOR.green : score >= 55 ? COLOR.amber : COLOR.red;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Health score ${score == null ? 'not available' : score + ' out of 100'}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#E9E3D1" stroke-width="12"></circle>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Sora, sans-serif" font-weight="800" font-size="${size * 0.3}" fill="#101A3D">${score == null ? '—' : score}</text></svg>`;
}

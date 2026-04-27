const sharp = require("sharp");

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}`);

function generateBarChartSvg(data, { title, width = 600, height = 350, barColor = "#6c63ff" }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const pad = { top: 50, right: 20, bottom: 70, left: 60 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const barCount = data.length;
  const gap = chartW / barCount;
  const barWidth = Math.max(Math.min(gap * 0.65, 24), 4);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="${barColor}" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="${barColor}" stop-opacity="1"/>
      </linearGradient>
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="#1e1e2e" rx="12"/>
    <text x="${width / 2}" y="30" text-anchor="middle" fill="#cdd6f4" font-family="sans-serif" font-size="15" font-weight="bold">${title}</text>`;

  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (chartH / gridLines) * i;
    const val = Math.round(maxVal - (maxVal / gridLines) * i);
    svg += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#313244" stroke-width="1"/>`;
    svg += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="#a6adc8" font-family="sans-serif" font-size="11">${val}</text>`;
  }

  data.forEach((d, i) => {
    const barH = (d.value / maxVal) * chartH;
    const x = pad.left + gap * i + (gap - barWidth) / 2;
    const y = pad.top + chartH - barH;
    const radius = Math.min(barWidth / 2, 3);

    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barH, 1)}" fill="url(#barGrad)" rx="${radius}" filter="url(#shadow)">
      <title>${d.label}: ${d.value}</title>
    </rect>`;
  });

  data.forEach((d, i) => {
    const labelX = pad.left + gap * i + gap / 2;
    svg += `<text x="${labelX}" y="${height - 12}" text-anchor="end" fill="#a6adc8" font-family="sans-serif" font-size="9" transform="rotate(-50, ${labelX}, ${height - 12})">${d.label}</text>`;
  });

  svg += `</svg>`;
  return svg;
}

async function renderSvgToPng(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
}

module.exports = { generateBarChartSvg, renderSvgToPng, DAY_NAMES, HOUR_LABELS };

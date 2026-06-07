import { useState } from 'react';
import styles from './BodyWeightChart.module.css';

const W = 320, H = 140, PAD = { top: 10, right: 10, bottom: 28, left: 36 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function formatShortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function BodyWeightChart({ log, unit }) {
  const [tooltip, setTooltip] = useState(null);

  // Use last 60 entries
  const points = log.slice(-60);
  if (points.length < 2) {
    return (
      <div className={styles.wrap}>
        <div className={styles.noData}>Log at least 2 entries to see the trend.</div>
      </div>
    );
  }

  const weights = points.map(p => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const px = i => PAD.left + (i / (points.length - 1)) * INNER_W;
  const py = w => PAD.top + INNER_H - ((w - minW) / range) * INNER_H;

  const polyline = points.map((p, i) => `${px(i)},${py(p.weight)}`).join(' ');
  const area = `M${px(0)},${py(points[0].weight)} ` +
    points.map((p, i) => `L${px(i)},${py(p.weight)}`).join(' ') +
    ` L${px(points.length - 1)},${PAD.top + INNER_H} L${px(0)},${PAD.top + INNER_H} Z`;

  // Y-axis ticks
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = minW + (i / ticks) * range;
    return { y: py(v), label: v.toFixed(1) };
  });

  // X-axis labels: first, middle, last
  const xLabels = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} preserveAspectRatio="xMidYMid meet">
        {/* Y grid + ticks */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="9" fill="var(--text-hint)">{t.label}</text>
          </g>
        ))}

        {/* Area fill */}
        <path d={area} fill="var(--brand)" fillOpacity="0.12" />

        {/* Line */}
        <polyline points={polyline} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots — sparse to avoid clutter */}
        {points.map((p, i) => {
          if (i !== 0 && i !== points.length - 1 && i % Math.ceil(points.length / 8) !== 0) return null;
          return (
            <circle
              key={i}
              cx={px(i)} cy={py(p.weight)} r="4"
              fill="var(--brand)" stroke="var(--bg-primary)" strokeWidth="2"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setTooltip({ i, x: px(i), y: py(p.weight), p })}
              onMouseLeave={() => setTooltip(null)}
              onTouchStart={() => setTooltip(t => t?.i === i ? null : { i, x: px(i), y: py(p.weight), p })}
            />
          );
        })}

        {/* X-axis labels */}
        {xLabels.filter(i => i < points.length).map(i => (
          <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-hint)">
            {formatShortDate(points[i].date)}
          </text>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect x={tooltip.x - 36} y={tooltip.y - 30} width="72" height="22" rx="4"
              fill="var(--text-primary)" fillOpacity="0.9" />
            <text x={tooltip.x} y={tooltip.y - 15} textAnchor="middle" fontSize="10" fill="var(--bg-primary)" fontWeight="600">
              {tooltip.p.weight} {unit} · {formatShortDate(tooltip.p.date)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

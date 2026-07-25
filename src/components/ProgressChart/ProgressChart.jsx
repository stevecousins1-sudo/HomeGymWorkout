import { useState, useMemo } from 'react';
import { e1rmSeries, fromLb } from '../../lib/strength';
import styles from './ProgressChart.module.css';

function shortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProgressChart({ exerciseName, history }) {
  const [tooltip, setTooltip] = useState(null);

  // Plot estimated 1RM rather than heaviest weight: it accounts for reps, so
  // a set of 8 that beats last week's set of 5 shows up as the progress it is.
  const { dataPoints, unit } = useMemo(() => {
    const series = e1rmSeries(exerciseName, history, 12);
    const u = series[series.length - 1]?.unit || 'lb';
    return {
      unit: u,
      dataPoints: series.map(p => ({
        date: p.date,
        weight: Math.round(fromLb(p.e1rm, u) * 10) / 10,
        source: p.weight > 0 && p.reps > 0 ? `${p.weight} × ${p.reps}` : null,
      })),
    };
  }, [exerciseName, history]);

  if (dataPoints.length < 2) {
    return (
      <div className={styles.noData}>
        {dataPoints.length === 0 ? 'No data yet for this exercise' : 'Need at least 2 sessions to chart progress'}
      </div>
    );
  }

  const W = 320, H = 160;
  const PAD = { top: 16, right: 16, bottom: 28, left: 38 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const weights  = dataPoints.map(p => p.weight);
  const minW     = Math.min(...weights);
  const maxW     = Math.max(...weights);
  const range    = maxW - minW || 1;
  const pMin     = minW - range * 0.15;
  const pMax     = maxW + range * 0.15;
  const pRange   = pMax - pMin;

  const xPos = i => PAD.left + (i / (dataPoints.length - 1)) * cW;
  const yPos = w => PAD.top + (1 - (w - pMin) / pRange) * cH;

  const polyline = dataPoints.map((p, i) => `${xPos(i)},${yPos(p.weight)}`).join(' ');

  const yTicks = [0.15, 0.5, 0.85].map(r => {
    const w = pMin + r * pRange;
    return { label: Math.round(w), y: yPos(w) };
  });

  const xLabels = [...new Set([0, Math.floor((dataPoints.length - 1) / 2), dataPoints.length - 1])];

  return (
    <div className={styles.wrap} onClick={() => setTooltip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
        {/* Grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
              stroke="var(--border)" strokeDasharray="4 3" strokeWidth="1" />
            <text x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="9" fill="var(--text-hint)">
              {t.label}
            </text>
          </g>
        ))}

        {/* Line */}
        <polyline points={polyline} fill="none" stroke="var(--brand)" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Fill area */}
        <polyline
          points={`${PAD.left},${PAD.top + cH} ${polyline} ${xPos(dataPoints.length - 1)},${PAD.top + cH}`}
          fill="var(--brand)" fillOpacity="0.08" stroke="none"
        />

        {/* Dots */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={xPos(i)} cy={yPos(p.weight)} r="5"
            fill={tooltip?.i === i ? 'var(--brand)' : 'var(--bg-primary)'}
            stroke="var(--brand)" strokeWidth="2.5"
            style={{ cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); setTooltip(tooltip?.i === i ? null : { i, p }); }}
          />
        ))}

        {/* Tooltip */}
        {tooltip && (() => {
          const tx   = xPos(tooltip.i);
          const ty   = yPos(tooltip.p.weight);
          const flip = tx > W * 0.6;
          const rx   = flip ? tx - 98 : tx + 10;
          return (
            <g>
              <rect x={rx} y={ty - 30} width="88" height={tooltip.p.source ? 56 : 42} rx="6"
                fill="var(--bg-primary)" stroke="var(--border)" strokeWidth="1" />
              <text x={rx + 44} y={ty - 15} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">
                {shortDate(tooltip.p.date)}
              </text>
              <text x={rx + 44} y={ty + 1} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary)">
                {tooltip.p.weight} {unit}
              </text>
              <text x={rx + 44} y={ty + 13} textAnchor="middle" fontSize="8.5" fill="var(--text-hint)">
                est. 1RM
              </text>
              {tooltip.p.source && (
                <text x={rx + 44} y={ty + 24} textAnchor="middle" fontSize="9" fill="var(--text-hint)">
                  {tooltip.p.source} {unit}
                </text>
              )}
            </g>
          );
        })()}

        {/* X labels */}
        {xLabels.map(i => (
          <text key={i} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-hint)">
            {shortDate(dataPoints[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

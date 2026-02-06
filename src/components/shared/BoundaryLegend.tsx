import { BOUNDARY_META, BOUNDARY_REFS } from '../../types/geometry';
import type { BoundaryKey } from '../../types/trace';

export function BoundaryLegend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: '#0f172a',
        borderRadius: 6,
        marginBottom: 12,
        border: '1px solid #1e293b',
      }}
    >
      {Object.entries(BOUNDARY_META).map(([key, meta]) => (
        <div
          key={key}
          title={BOUNDARY_REFS[key as BoundaryKey]}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'help' }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: meta.color,
              boxShadow: `0 0 4px ${meta.color}44`,
            }}
          />
          <span
            style={{
              color: meta.color,
              fontWeight: 700,
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            }}
          >
            {key}
          </span>
          <span style={{ color: '#64748b' }}>= {meta.desc}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: 'linear-gradient(90deg, #166534, #22c55e)',
          }}
        />
        <span style={{ color: '#64748b' }}>Committed trunk</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: 'linear-gradient(90deg, #a16207, #f59e0b)',
          }}
        />
        <span style={{ color: '#64748b' }}>Wet cement</span>
      </div>
    </div>
  );
}

import type { BoundaryMove, BoundaryKey } from '../../types/trace';
import { BOUNDARY_META } from '../../types/geometry';

interface BoundaryMovementsProps {
  moves: BoundaryMove[];
}

export function BoundaryMovements({ moves }: BoundaryMovementsProps) {
  if (moves.length === 0) return null;

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: '12px 14px',
        border: '1px solid #334155',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Boundary Movements
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {moves.map((bm, i) => {
          const meta = BOUNDARY_META[bm.boundary as BoundaryKey];
          if (!meta) return null;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 4,
                background: `${meta.color}11`,
                border: `1px solid ${meta.color}33`,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <span style={{ color: '#94a3b8' }}>{bm.replica}.</span>
              <span style={{ color: meta.color, fontWeight: 700 }}>{bm.boundary}</span>
              <span style={{ color: '#475569' }}>{bm.from}</span>
              <span style={{ color: '#64748b' }}>&rarr;</span>
              <span style={{ color: meta.color }}>{bm.to}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

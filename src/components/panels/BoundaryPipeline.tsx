import type { ReplicaState, BoundaryKey } from '../../types/trace';
import { BOUNDARY_META } from '../../types/geometry';

interface BoundaryPipelineProps {
  replica: string;
  data: ReplicaState;
  maxIdx: number;
  highlight?: boolean;
}

const BOUNDARIES: BoundaryKey[] = ['T', 'D', 'A', 'C', 'E'];

export function BoundaryPipeline({ replica, data, maxIdx, highlight }: BoundaryPipelineProps) {
  const scale = maxIdx > 0 ? 100 / (maxIdx + 1) : 100;
  const crashed = data.crashed;
  const danger = data.danger;
  const allZero = data.T === 0 && data.D === 0 && data.A === 0 && data.C === 0 && data.E === 0 && data.log.length === 0;

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: 2,
        ...(highlight
          ? {
              boxShadow: '0 0 8px #f59e0b44, 0 0 2px #f59e0b66',
              outline: '1px solid #f59e0b44',
              borderRadius: 4,
              padding: '2px 4px',
              transition: 'box-shadow 0.3s, outline 0.3s',
            }
          : { transition: 'box-shadow 0.3s, outline 0.3s' }),
      }}
    >
      {/* Replica label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 13,
            fontWeight: 700,
            color: '#e2e8f0',
            width: 28,
          }}
        >
          {replica}
        </span>
        {data.leader && (
          <span
            style={{
              fontSize: 9,
              background: '#a855f7',
              color: '#fff',
              padding: '1px 6px',
              borderRadius: 3,
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            LEADER
          </span>
        )}
        {crashed && (
          <span
            style={{
              fontSize: 9,
              background: '#ef4444',
              color: '#fff',
              padding: '1px 6px',
              borderRadius: 3,
              fontWeight: 600,
            }}
          >
            CRASHED
          </span>
        )}
        {data.recovered && (
          <span
            style={{
              fontSize: 9,
              background: '#f59e0b',
              color: '#000',
              padding: '1px 6px',
              borderRadius: 3,
              fontWeight: 600,
            }}
          >
            RECOVERED
          </span>
        )}
        {data.partitioned && (
          <span
            style={{
              fontSize: 9,
              background: '#6b7280',
              color: '#fff',
              padding: '1px 6px',
              borderRadius: 3,
              fontWeight: 600,
            }}
          >
            PARTITIONED
          </span>
        )}
        <span
          style={{
            fontSize: 9,
            color: '#94a3b8',
            marginLeft: 'auto',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          epoch {data.epoch}
        </span>
      </div>

      {/* The pipeline bar */}
      <div
        style={{
          position: 'relative',
          height: 32,
          background: '#1e293b',
          borderRadius: 4,
          overflow: 'hidden',
          border: danger
            ? '2px solid #ef4444'
            : crashed
              ? '1px solid #475569'
              : '1px solid #334155',
          opacity: crashed ? 0.5 : 1,
        }}
      >
        {/* Trimmed region */}
        {data.T > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${data.T * scale}%`,
              background:
                'repeating-linear-gradient(45deg, #1e293b, #1e293b 3px, #0f172a 3px, #0f172a 6px)',
            }}
          />
        )}
        {/* Committed trunk */}
        {data.C > data.T && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${data.T * scale}%`,
              width: `${(data.C - data.T) * scale}%`,
              background: 'linear-gradient(90deg, #166534, #22c55e)',
              opacity: 0.7,
            }}
          />
        )}
        {/* Wet cement */}
        {data.E > data.C && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${data.C * scale}%`,
              width: `${(data.E - data.C) * scale}%`,
              background: danger
                ? 'repeating-linear-gradient(45deg, #7f1d1d, #7f1d1d 4px, #991b1b 4px, #991b1b 8px)'
                : 'linear-gradient(90deg, #a16207, #f59e0b)',
              opacity: 0.6,
            }}
          />
        )}

        {/* Log entries */}
        {data.log.map((entry, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(entry.idx - 0.4) * scale}%`,
              top: 4,
              bottom: 4,
              width: `${0.8 * scale}%`,
              minWidth: 22,
              background:
                entry.epoch === data.epoch
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.06)',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#e2e8f0',
              fontFamily: "'JetBrains Mono', monospace",
              border:
                danger && entry.val === 'X'
                  ? '1px solid #ef4444'
                  : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {entry.val}
            <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 2 }}>e{entry.epoch}</span>
          </div>
        ))}

        {/* All-zero empty state indicator */}
        {allZero && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              pointerEvents: 'none',
            }}
          >
            {BOUNDARIES.map((b) => (
              <span
                key={b}
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: BOUNDARY_META[b].color,
                  fontFamily: "'JetBrains Mono', monospace",
                  opacity: 0.7,
                }}
              >
                {b}=0
              </span>
            ))}
          </div>
        )}

        {/* Boundary markers */}
        {!allZero && BOUNDARIES.map((b) => {
          const val = data[b];
          if (val === 0 && b !== 'T') return null;
          const meta = BOUNDARY_META[b];
          return (
            <div
              key={b}
              style={{
                position: 'absolute',
                left: `${val * scale}%`,
                top: b === 'D' ? 0 : b === 'A' ? 8 : undefined,
                bottom: b === 'D' ? 8 : b === 'A' ? 0 : 0,
                height: b === 'C' ? '100%' : 6,
                width: b === 'C' ? 2 : 8,
                background: meta.color,
                borderRadius: b === 'C' ? 0 : 2,
                transform: 'translateX(-50%)',
                zIndex: b === 'C' ? 10 : 5,
                boxShadow: `0 0 4px ${meta.color}66`,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: b === 'C' ? -14 : -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 8,
                  fontWeight: 700,
                  color: meta.color,
                  fontFamily: "'JetBrains Mono', monospace",
                  whiteSpace: 'nowrap',
                }}
              >
                {b}={val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

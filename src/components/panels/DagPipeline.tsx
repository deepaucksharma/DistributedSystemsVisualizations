import type { ReplicaState } from '../../types/trace';

interface DagPipelineProps {
  replica: string;
  data: ReplicaState;
  highlight?: boolean;
}

/** Format CRDT state for human-readable display */
function formatCrdtState(state: unknown): string {
  if (typeof state === 'string') return state;
  if (state === null || state === undefined) return 'empty';

  // Handle common CRDT state shapes
  const obj = state as Record<string, unknown>;

  // G-Set / OR-Set: { addSet: [...], removeSet?: [...] }
  if (Array.isArray(obj.addSet)) {
    const adds = (obj.addSet as string[]).join(', ');
    const removes = Array.isArray(obj.removeSet) && (obj.removeSet as string[]).length > 0
      ? ` \\ {${(obj.removeSet as string[]).join(', ')}}`
      : '';
    return `{${adds}}${removes}`;
  }

  // G-Counter: { counts: { R1: 3, R2: 1 } }
  if (obj.counts && typeof obj.counts === 'object') {
    const entries = Object.entries(obj.counts as Record<string, number>);
    return entries.map(([k, v]) => `${k}:${v}`).join(', ');
  }

  // Fallback: compact JSON
  return JSON.stringify(state);
}

/** Extract vector clock from CRDT state or separate field */
function extractVectorClock(data: ReplicaState): Record<string, number> | null {
  // Check for vectorClock in crdtState
  if (data.crdtState && typeof data.crdtState === 'object') {
    const obj = data.crdtState as Record<string, unknown>;
    if (obj.vectorClock && typeof obj.vectorClock === 'object') {
      return obj.vectorClock as Record<string, number>;
    }
  }
  return null;
}

/**
 * DAG-aware BoundaryPipeline variant.
 * For DAG/CRDT history shapes, we don't show T/D/A/C/E linear bars.
 * Instead we show per-replica state snapshots, CRDT values, and vector clocks.
 */
export function DagPipeline({ replica, data, highlight }: DagPipelineProps) {
  const crashed = data.crashed;
  const vectorClock = extractVectorClock(data);
  const showEpoch = data.epoch > 0; // DAG systems often don't use epochs

  return (
    <div
      style={{
        position: 'relative',
        marginBottom: 6,
        ...(highlight
          ? {
              boxShadow: '0 0 8px #f59e0b44, 0 0 2px #f59e0b66',
              outline: '1px solid #f59e0b44',
              borderRadius: 4,
              padding: '2px 4px',
            }
          : {}),
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
            width: 40,
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
        {data.danger && (
          <span
            style={{
              fontSize: 9,
              background: '#ef444444',
              color: '#ef4444',
              padding: '1px 6px',
              borderRadius: 3,
              fontWeight: 600,
              border: '1px solid #ef444444',
            }}
          >
            DANGER
          </span>
        )}
        {showEpoch && (
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
        )}
      </div>

      {/* State snapshot */}
      <div
        style={{
          background: data.danger ? '#7f1d1d11' : '#1e293b',
          borderRadius: 4,
          padding: '6px 10px',
          border: data.danger
            ? '1px solid #ef444444'
            : crashed
              ? '1px solid #475569'
              : '1px solid #334155',
          opacity: crashed ? 0.5 : 1,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* CRDT state */}
        {data.crdtState ? (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                color: '#f472b6',
                fontSize: 9,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              state:
            </span>
            <span>{formatCrdtState(data.crdtState)}</span>
          </div>
        ) : (
          /* Show log entries as DAG events */
          data.log.map((entry, i) => (
            <div
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 8px',
                borderRadius: 4,
                background: '#f472b622',
                border: '1px solid #f472b644',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{entry.val}</span>
              {entry.epoch > 0 && (
                <span style={{ color: '#64748b', fontSize: 9 }}>@e{entry.epoch}</span>
              )}
            </div>
          ))
        )}

        {data.log.length === 0 && !data.crdtState && (
          <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
            empty state
          </span>
        )}

        {/* Vector clock */}
        {vectorClock && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginLeft: 'auto',
              padding: '1px 6px',
              borderRadius: 3,
              background: '#f472b611',
              border: '1px solid #f472b622',
            }}
          >
            <span
              style={{
                fontSize: 8,
                color: '#f472b6',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              VC:
            </span>
            {Object.entries(vectorClock).map(([r, v]) => (
              <span
                key={r}
                style={{
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: v > 0 ? '#e2e8f0' : '#475569',
                }}
              >
                {r}:{v}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

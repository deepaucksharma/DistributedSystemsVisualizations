import type { Observation } from '../../types/trace';

interface ObservationPanelProps {
  observations: Observation[];
}

const CONSISTENCY_COLORS: Record<string, string> = {
  linearizable: '#22c55e',
  sequential: '#3b82f6',
  causal: '#f59e0b',
  eventual: '#ef4444',
};

const TYPE_LABELS: Record<string, string> = {
  clientWrite: 'WRITE',
  clientRead: 'READ',
  txnCommit: 'TXN',
  externalEffect: 'EFFECT',
};

export function ObservationPanel({ observations }: ObservationPanelProps) {
  if (!observations || observations.length === 0) return null;

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
        Client Observations
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {observations.map((obs, i) => {
          const consistencyColor = obs.consistency
            ? CONSISTENCY_COLORS[obs.consistency] || '#94a3b8'
            : '#94a3b8';
          const typeLabel = TYPE_LABELS[obs.type] || obs.type.toUpperCase();

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '6px 10px',
                background: `${consistencyColor}0d`,
                border: `1px solid ${consistencyColor}33`,
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              {/* Type badge */}
              <span
                style={{
                  background: '#ec489922',
                  color: '#ec4899',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontSize: 9,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  marginTop: 1,
                }}
              >
                {typeLabel}
              </span>

              {/* Actor + result */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      color: '#e2e8f0',
                      fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                    }}
                  >
                    {obs.actor}
                  </span>
                  {obs.targetReplica && (
                    <>
                      <span style={{ color: '#475569' }}>&rarr;</span>
                      <span
                        style={{
                          color: '#94a3b8',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                        }}
                      >
                        {obs.targetReplica}
                      </span>
                    </>
                  )}
                  {obs.result && (
                    <span
                      style={{
                        color: '#f8fafc',
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        marginLeft: 4,
                      }}
                    >
                      = {obs.result}
                    </span>
                  )}
                </div>
                {obs.detail && (
                  <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                    {obs.detail}
                  </div>
                )}
              </div>

              {/* Consistency tag */}
              {obs.consistency && (
                <span
                  style={{
                    background: `${consistencyColor}22`,
                    color: consistencyColor,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 9,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${consistencyColor}44`,
                  }}
                >
                  {obs.consistency}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

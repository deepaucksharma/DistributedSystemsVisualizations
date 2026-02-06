import type { ControlPlaneState } from '../../types/trace';

interface ControlPlaneProps {
  controlPlane: ControlPlaneState;
}

export function ControlPlane({ controlPlane }: ControlPlaneProps) {
  const { configs, currentConfigEpoch, shardMap, notes } = controlPlane;

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
        Control Plane
      </div>

      {/* Current config epoch */}
      {currentConfigEpoch !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            fontSize: 11,
          }}
        >
          <span style={{ color: '#94a3b8' }}>Config epoch:</span>
          <span
            style={{
              fontWeight: 700,
              color: '#14b8a6',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {currentConfigEpoch}
          </span>
        </div>
      )}

      {/* Config timeline */}
      {configs && configs.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
            Configuration History
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {configs.map((config, i) => {
              const isActive = config.epoch === currentConfigEpoch;
              return (
                <div
                  key={i}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: isActive ? '#14b8a622' : '#0f172a',
                    border: `1px solid ${isActive ? '#14b8a6' : '#334155'}`,
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <div
                    style={{
                      color: isActive ? '#14b8a6' : '#64748b',
                      fontWeight: 700,
                      marginBottom: 2,
                    }}
                  >
                    cfg {config.epoch}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    [{config.members.join(', ')}]
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shard map */}
      {shardMap && shardMap.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
            Shard Map
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {shardMap.map((shard, i) => (
              <div
                key={i}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: '#0f172a',
                  border: '1px solid #334155',
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <div style={{ color: '#8b5cf6', fontWeight: 700, marginBottom: 2 }}>
                  {shard.shard}
                </div>
                <div style={{ color: '#94a3b8' }}>
                  cfg {shard.configEpoch}: [{shard.replicas.join(', ')}]
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, marginTop: 4 }}>
          {notes}
        </div>
      )}
    </div>
  );
}

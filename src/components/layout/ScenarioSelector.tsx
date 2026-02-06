import type { ScenarioMeta } from '../../types/scenario';
import { GEOMETRIES } from '../../types/geometry';

interface ScenarioSelectorProps {
  scenarios: ScenarioMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Callback to enter compare mode: (leftId, rightId) */
  onCompare?: (leftId: string, rightId: string) => void;
  /** Compact mode for compare view — hides tier headers, smaller padding */
  compact?: boolean;
}

export function ScenarioSelector({ scenarios, activeId, onSelect, onCompare, compact }: ScenarioSelectorProps) {
  // Group by tier
  const byTier = new Map<number, ScenarioMeta[]>();
  for (const s of scenarios) {
    const arr = byTier.get(s.tier) || [];
    arr.push(s);
    byTier.set(s.tier, arr);
  }

  const tierLabels: Record<number, string> = {
    1: 'Core Mechanics',
    2: 'Extended Mechanics',
    3: 'DAG / CRDT',
  };

  const activeScenario = scenarios.find((s) => s.id === activeId);
  const hasCompareWith = activeScenario?.compareWith && !compact;

  return (
    <div
      className="scenario-selector"
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: compact ? '8px 10px' : '12px 14px',
        marginBottom: compact ? 8 : 16,
        border: '1px solid #334155',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: compact ? 6 : 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
          }}
        >
          {compact ? 'Select Scenario' : 'Scenarios'}
        </div>
        {hasCompareWith && onCompare && (
          <button
            onClick={() => onCompare(activeId, activeScenario!.compareWith!)}
            title={`Compare with ${scenarios.find((s) => s.id === activeScenario!.compareWith)?.title || activeScenario!.compareWith}`}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: 4,
              color: '#94a3b8',
              fontSize: 10,
              padding: '2px 8px',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 12 }}>&#x2194;</span>
            Compare
          </button>
        )}
      </div>
      {[1, 2, 3].map((tier) => {
        const items = byTier.get(tier);
        if (!items || items.length === 0) return null;
        return (
          <div key={tier} style={{ marginBottom: compact ? 4 : 8 }}>
            {!compact && (
              <div
                style={{
                  fontSize: 9,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Tier {tier}: {tierLabels[tier]}
              </div>
            )}
            <div style={{ display: 'flex', gap: compact ? 4 : 6, flexWrap: 'wrap' }}>
              {items.map((s) => {
                const isActive = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    title={s.description}
                    style={{
                      background: isActive ? '#334155' : 'transparent',
                      border: `1px solid ${isActive ? '#64748b' : '#334155'}`,
                      borderRadius: 6,
                      padding: compact ? '2px 6px' : '4px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: compact ? 4 : 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: compact ? 10 : 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#f8fafc' : '#94a3b8',
                      }}
                    >
                      {s.title}
                    </span>
                    {!compact && (
                      <span style={{ display: 'flex', gap: 2 }}>
                        {s.geometries.slice(0, 3).map((g) => {
                          const geo = GEOMETRIES[g];
                          return (
                            <span
                              key={g}
                              style={{
                                fontSize: 9,
                                color: geo.color,
                                opacity: 0.7,
                              }}
                              title={geo.label}
                            >
                              {geo.icon}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

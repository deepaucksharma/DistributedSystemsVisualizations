import { useState, useRef, useEffect } from 'react';
import type { ScenarioMeta } from '../../types/scenario';
import { GEOMETRIES } from '../../types/geometry';

interface ScenarioSelectorProps {
  scenarios: ScenarioMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  onCompare?: (leftId: string, rightId: string) => void;
  compact?: boolean;
}

const TIER_LABELS: Record<number, string> = {
  1: 'Core Mechanics',
  2: 'Extended Mechanics',
  3: 'DAG / CRDT',
};

export function ScenarioSelector({ scenarios, activeId, onSelect, onCompare, compact }: ScenarioSelectorProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const activeScenario = scenarios.find((s) => s.id === activeId);
  const hasCompareWith = activeScenario?.compareWith && !compact;

  // Group by tier
  const byTier = new Map<number, ScenarioMeta[]>();
  for (const s of scenarios) {
    const arr = byTier.get(s.tier) || [];
    arr.push(s);
    byTier.set(s.tier, arr);
  }

  // Compact mode: simple dropdown
  if (compact) {
    return (
      <div style={{ position: 'relative' }} ref={panelRef}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '4px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc', flex: 1, textAlign: 'left' }}>
            {activeScenario?.title || activeId}
          </span>
          <span style={{ fontSize: 9, color: '#64748b' }}>{open ? '\u25B2' : '\u25BC'}</span>
        </button>
        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: 6,
              padding: '6px 0',
              zIndex: 100,
              maxHeight: 300,
              overflowY: 'auto',
              boxShadow: '0 8px 24px #0008',
            }}
          >
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => { onSelect(s.id); setOpen(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  background: s.id === activeId ? '#334155' : 'transparent',
                  border: 'none',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 11,
                  color: s.id === activeId ? '#f8fafc' : '#94a3b8',
                  fontWeight: s.id === activeId ? 600 : 400,
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full mode: collapsible header
  return (
    <div ref={panelRef} style={{ marginBottom: 16 }}>
      {/* Active scenario bar — always visible */}
      <div
        style={{
          background: '#1e293b',
          border: `1px solid ${open ? '#475569' : '#334155'}`,
          borderRadius: open ? '8px 8px 0 0' : 8,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'border-radius 0.15s',
        }}
      >
        <button
          onClick={() => setOpen(!open)}
          onMouseEnter={(e) => {
            (e.currentTarget.querySelector('[data-selector-pill]') as HTMLElement | null)
              ?.style.setProperty('border-color', '#60a5fa');
          }}
          onMouseLeave={(e) => {
            (e.currentTarget.querySelector('[data-selector-pill]') as HTMLElement | null)
              ?.style.setProperty('border-color', '#475569');
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            padding: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Scenario
          </span>
          {/* Dropdown pill — looks like a select control */}
          <span
            data-selector-pill=""
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#0f172a',
              border: `1px solid ${open ? '#60a5fa' : '#475569'}`,
              borderRadius: 6,
              padding: '4px 10px 4px 12px',
              transition: 'border-color 0.15s',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
              {activeScenario?.title || activeId}
            </span>
            {/* Geometry icons */}
            <span style={{ display: 'flex', gap: 3 }}>
              {activeScenario?.geometries.map((g) => {
                const geo = GEOMETRIES[g];
                return (
                  <span
                    key={g}
                    title={`${geo.label}: ${geo.desc}`}
                    style={{ fontSize: 11, color: geo.color }}
                  >
                    {geo.icon}
                  </span>
                );
              })}
            </span>
            {/* Chevron */}
            <span
              style={{
                fontSize: 10,
                color: '#64748b',
                transition: 'transform 0.15s',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                marginLeft: 2,
              }}
            >
              ▾
            </span>
          </span>
        </button>

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
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12 }}>&#x2194;</span>
            Compare
          </button>
        )}
      </div>

      {/* Collapsible tier list */}
      {open && (
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #475569',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: '6px 0',
            maxHeight: 420,
            overflowY: 'auto',
          }}
        >
          {[1, 2, 3].map((tier) => {
            const items = byTier.get(tier);
            if (!items || items.length === 0) return null;
            return (
              <div key={tier}>
                {/* Tier header */}
                <div
                  style={{
                    fontSize: 9,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                    padding: '8px 14px 4px',
                  }}
                >
                  Tier {tier}: {TIER_LABELS[tier]}
                </div>

                {/* Scenario rows */}
                {items.map((s) => {
                  const isActive = s.id === activeId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { onSelect(s.id); setOpen(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        background: isActive ? '#334155' : 'transparent',
                        border: 'none',
                        borderLeft: isActive ? '2px solid #60a5fa' : '2px solid transparent',
                        padding: '5px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = '#1e293b99';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Scenario title */}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? '#f8fafc' : '#cbd5e1',
                          flex: 1,
                        }}
                      >
                        {s.title}
                      </span>

                      {/* Geometry icons */}
                      <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                        {s.geometries.map((g) => {
                          const geo = GEOMETRIES[g];
                          return (
                            <span
                              key={g}
                              title={`${geo.label}: ${geo.desc}`}
                              style={{
                                fontSize: 11,
                                color: geo.color,
                                opacity: isActive ? 1 : 0.6,
                                cursor: 'help',
                              }}
                            >
                              {geo.icon}
                            </span>
                          );
                        })}
                      </span>

                      {/* Compare indicator */}
                      {s.compareWith && (
                        <span
                          title={`Compares with: ${scenarios.find((x) => x.id === s.compareWith)?.title || s.compareWith}`}
                          style={{
                            fontSize: 9,
                            color: '#475569',
                            cursor: 'help',
                            flexShrink: 0,
                          }}
                        >
                          ↔
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

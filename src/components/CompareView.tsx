import { useMemo, type ReactNode } from 'react';
import type { Trace } from '../types/trace';
import { TraceViewer } from './TraceViewer';

interface CompareViewProps {
  leftTrace: Trace;
  rightTrace: Trace;
  leftSelector: ReactNode;
  rightSelector: ReactNode;
  onExit: () => void;
}

export function CompareView({
  leftTrace,
  rightTrace,
  leftSelector,
  rightSelector,
  onExit,
}: CompareViewProps) {
  const leftLabel = useMemo(() => leftTrace.title, [leftTrace]);
  const rightLabel = useMemo(() => rightTrace.title, [rightTrace]);

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
        background: '#0f172a',
        color: '#e2e8f0',
        minHeight: '100vh',
      }}
    >
      {/* Compare mode header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 10,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 700,
            }}
          >
            Compare Mode
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {leftLabel}
            <span style={{ color: '#475569', margin: '0 8px' }}>vs</span>
            {rightLabel}
          </span>
        </div>
        <button
          onClick={onExit}
          style={{
            background: '#334155',
            border: '1px solid #475569',
            borderRadius: 4,
            color: '#e2e8f0',
            fontSize: 11,
            padding: '4px 12px',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Exit Compare
        </button>
      </div>

      {/* Side-by-side viewers */}
      <div
        className="compare-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
        }}
      >
        <div
          style={{
            borderRight: '2px solid #334155',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 45px)',
          }}
        >
          <TraceViewer
            trace={leftTrace}
            scenarioSelector={leftSelector}
          />
        </div>
        <div
          style={{
            overflow: 'auto',
            maxHeight: 'calc(100vh - 45px)',
          }}
        >
          <TraceViewer
            trace={rightTrace}
            scenarioSelector={rightSelector}
          />
        </div>
      </div>
    </div>
  );
}

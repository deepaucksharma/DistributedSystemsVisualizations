import type { InvariantCheck } from '../../types/trace';
import { INVARIANT_DESCS } from '../../types/geometry';

interface InvariantChecklistProps {
  checks: InvariantCheck[];
}

/** Find the best matching tooltip for an invariant name */
function getInvariantTooltip(invariant: string): string | undefined {
  // Try exact match first, then prefix match
  for (const [key, desc] of Object.entries(INVARIANT_DESCS)) {
    if (invariant.startsWith(key)) return desc;
  }
  return undefined;
}

export function InvariantChecklist({ checks }: InvariantChecklistProps) {
  if (checks.length === 0) return null;

  const allPass = checks.every((c) => c.holds);

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: '12px 14px',
        border: `1px solid ${allPass ? '#334155' : '#ef444466'}`,
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
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>Invariant Checks</span>
        <span
          style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 3,
            fontWeight: 600,
            background: allPass ? '#16653444' : '#7f1d1d44',
            color: allPass ? '#22c55e' : '#ef4444',
            border: `1px solid ${allPass ? '#22c55e33' : '#ef444433'}`,
          }}
        >
          {allPass ? 'ALL PASS' : 'VIOLATION'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {checks.map((check, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              padding: '2px 0',
            }}
          >
            <span
              style={{
                fontSize: 12,
                width: 16,
                textAlign: 'center',
                color: check.holds ? '#22c55e' : '#ef4444',
              }}
            >
              {check.holds ? '\u2713' : '\u2717'}
            </span>
            <span
              style={{
                color: check.holds ? '#94a3b8' : '#fca5a5',
                fontWeight: check.holds ? 400 : 600,
                minWidth: 140,
                cursor: getInvariantTooltip(check.invariant) ? 'help' : undefined,
              }}
              title={getInvariantTooltip(check.invariant)}
            >
              {check.invariant}
            </span>
            {check.detail && (
              <span style={{ color: '#475569', fontSize: 10 }}>{check.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

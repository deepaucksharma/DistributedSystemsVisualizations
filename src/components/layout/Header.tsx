import type { Trace } from '../../types/trace';

interface HeaderProps {
  trace: Trace;
}

export function Header({ trace }: HeaderProps) {
  const consistencyModel = trace.spec.consistency_model || trace.consistencyModel;

  return (
    <div style={{ marginBottom: 16 }}>
      <h1
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: '#f8fafc',
          margin: 0,
          letterSpacing: '-0.02em',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        {trace.title}
      </h1>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0', lineHeight: 1.4 }}>
        {trace.description}
      </p>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 8,
          fontSize: 11,
          color: '#64748b',
          flexWrap: 'wrap',
        }}
      >
        <span>
          Spec: <strong style={{ color: '#94a3b8' }}>{trace.spec.type}</strong>
        </span>
        {consistencyModel && (
          <span>
            Consistency: <strong style={{ color: '#94a3b8' }}>{consistencyModel}</strong>
          </span>
        )}
        <span>
          Fault model: <strong style={{ color: '#94a3b8' }}>{trace.environment?.fault_model || trace.failureModel}</strong>
        </span>
        {trace.environment?.timing_model && (
          <span>
            Timing: <strong style={{ color: '#94a3b8' }}>{trace.environment.timing_model}</strong>
          </span>
        )}
      </div>
      {trace.spec.invariants && trace.spec.invariants.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 6,
            flexWrap: 'wrap',
          }}
        >
          {trace.spec.invariants.map((inv, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                color: '#64748b',
                padding: '1px 6px',
                borderRadius: 3,
                border: '1px solid #334155',
                background: '#0f172a',
              }}
            >
              {inv}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

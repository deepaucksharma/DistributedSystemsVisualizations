import type { Step } from '../../types/trace';

interface StepNavigationProps {
  steps: Step[];
  stepIndex: number;
  setStepIndex: (idx: number) => void;
  goNext: () => void;
  goPrev: () => void;
}

export function StepNavigation({
  steps,
  stepIndex,
  setStepIndex,
  goNext,
  goPrev,
}: StepNavigationProps) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <button
        onClick={goPrev}
        disabled={isFirst}
        style={{
          background: isFirst ? '#1e293b' : '#334155',
          color: isFirst ? '#475569' : '#e2e8f0',
          border: '1px solid #475569',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          cursor: isFirst ? 'default' : 'pointer',
          fontWeight: 600,
        }}
      >
        &larr; Prev
      </button>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setStepIndex(i)}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                border: 'none',
                cursor: 'pointer',
                background:
                  i === stepIndex
                    ? s.invariants_ok
                      ? '#22c55e'
                      : '#ef4444'
                    : i < stepIndex
                      ? s.invariants_ok
                        ? '#166534'
                        : '#7f1d1d'
                      : '#1e293b',
                transition: 'background 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={goNext}
        disabled={isLast}
        style={{
          background: isLast ? '#1e293b' : '#334155',
          color: isLast ? '#475569' : '#e2e8f0',
          border: '1px solid #475569',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          cursor: isLast ? 'default' : 'pointer',
          fontWeight: 600,
        }}
      >
        Next &rarr;
      </button>

      <span
        style={{
          fontSize: 12,
          color: '#64748b',
          minWidth: 50,
          textAlign: 'right',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {stepIndex + 1}/{steps.length}
      </span>
    </div>
  );
}

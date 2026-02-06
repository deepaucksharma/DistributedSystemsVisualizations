import type { Step } from '../../types/trace';

interface NarrationBoxProps {
  step: Step;
}

export function NarrationBox({ step }: NarrationBoxProps) {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 12,
        border: step.invariants_ok ? '1px solid #334155' : '1px solid #ef4444',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: step.invariants_ok ? '#f8fafc' : '#fca5a5',
          marginBottom: 4,
        }}
      >
        Step {step.id}: {step.event}
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{step.narration}</div>
    </div>
  );
}

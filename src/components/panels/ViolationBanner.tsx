import type { Violation } from '../../types/trace';

interface ViolationBannerProps {
  violation: Violation;
}

export function ViolationBanner({ violation }: ViolationBannerProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
        border: '1px solid #ef4444',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#fca5a5',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 4,
        }}
      >
        &#9888; INVARIANT VIOLATION &mdash; {violation.law}
      </div>
      <div style={{ fontSize: 13, color: '#fde8e8', lineHeight: 1.5, marginBottom: 6 }}>
        {violation.detail}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#fca5a5',
            fontStyle: 'italic',
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'help',
          }}
          title={`See ${violation.framework_ref} in the framework reference for the formal treatment of this invariant`}
        >
          Framework ref: {violation.framework_ref}
        </span>
        {violation.bug_class && (
          <span
            style={{
              fontSize: 9,
              color: '#ef4444',
              padding: '1px 6px',
              borderRadius: 3,
              border: '1px solid #ef444444',
              background: '#ef444411',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            title={`Bug class identifier: ${violation.bug_class}`}
          >
            {violation.bug_class}
          </span>
        )}
      </div>
    </div>
  );
}

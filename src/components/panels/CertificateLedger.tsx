import type { Certificate, CertificateType, BoundaryMove, BoundaryKey } from '../../types/trace';
import { CERT_COLORS, CERT_DESCRIPTIONS, BOUNDARY_META, BOUNDARY_REFS } from '../../types/geometry';

interface CertificateCardProps {
  cert: Certificate;
  linkedMoves?: BoundaryMove[];
}

function CertificateCard({ cert, linkedMoves }: CertificateCardProps) {
  const color = CERT_COLORS[cert.type as CertificateType] || '#94a3b8';
  const isInvalid = cert.valid === false;

  return (
    <div
      style={{
        padding: '6px 10px',
        background: isInvalid ? '#7f1d1d11' : `${color}0d`,
        border: `1px solid ${isInvalid ? '#ef444444' : `${color}33`}`,
        borderRadius: 6,
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span
          style={{
            background: isInvalid ? '#ef4444' : color,
            color: '#000',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 3,
            fontSize: 10,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            marginTop: 1,
            cursor: 'help',
          }}
          title={CERT_DESCRIPTIONS[cert.type as CertificateType] || cert.type}
        >
          {cert.type}
          {isInvalid && ' (INVALID)'}
        </span>
        <span style={{ color: '#cbd5e1', lineHeight: 1.4 }}>{cert.detail}</span>
      </div>

      {/* Certificate evidence (quorum, boundary) */}
      {cert.evidence && cert.evidence.quorum && cert.evidence.quorum.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span style={{ color: '#475569' }}>quorum:</span>
          <span style={{ color: '#94a3b8' }}>{'{' + cert.evidence.quorum.join(', ') + '}'}</span>
          {cert.evidence.boundary && (
            <>
              <span style={{ color: '#475569', marginLeft: 4 }}>moves</span>
              <span style={{ color: '#94a3b8' }}>
                {cert.evidence.boundary} {cert.evidence.from}&rarr;{cert.evidence.to}
              </span>
            </>
          )}
        </div>
      )}

      {/* Linked boundary movements */}
      {linkedMoves && linkedMoves.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 6,
            paddingTop: 4,
            borderTop: '1px solid #334155',
          }}
        >
          <span style={{ fontSize: 9, color: '#475569', alignSelf: 'center' }}>justifies:</span>
          {linkedMoves.map((bm, i) => {
            const meta = BOUNDARY_META[bm.boundary as BoundaryKey];
            if (!meta) return null;
            return (
              <span
                key={i}
                title={BOUNDARY_REFS[bm.boundary as BoundaryKey] || bm.boundary}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: `${meta.color}11`,
                  border: `1px solid ${meta.color}33`,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'help',
                }}
              >
                <span style={{ color: '#94a3b8' }}>{bm.replica}.</span>
                <span style={{ color: meta.color, fontWeight: 700 }}>{bm.boundary}</span>
                <span style={{ color: '#475569' }}>{bm.from}&rarr;{bm.to}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CertificateLedgerProps {
  certificates: Certificate[];
  boundaryMoves?: BoundaryMove[];
}

export function CertificateLedger({ certificates, boundaryMoves }: CertificateLedgerProps) {
  // Link boundary movements to certificates based on type heuristics:
  // - authority certs don't typically justify boundary moves
  // - commit certs justify C and A moves
  // - trim certs justify T moves
  const getCertLinkedMoves = (cert: Certificate): BoundaryMove[] => {
    if (!boundaryMoves || boundaryMoves.length === 0) return [];

    switch (cert.type) {
      case 'commit':
        return boundaryMoves.filter(
          (m) => m.boundary === 'C' || m.boundary === 'A'
        );
      case 'trim':
        return boundaryMoves.filter((m) => m.boundary === 'T');
      case 'authority':
        return []; // Authority doesn't directly move boundaries
      default:
        // For other cert types, link moves that have a justified_by reference
        return boundaryMoves.filter((m) => m.justified_by?.type === cert.type);
    }
  };

  // Check for unjustified boundary moves (moves with no corresponding cert)
  const hasUnjustifiedMoves =
    boundaryMoves &&
    boundaryMoves.length > 0 &&
    certificates.length === 0 &&
    boundaryMoves.some((m) => m.boundary === 'C' || m.boundary === 'T');

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: '12px 14px',
        border: '1px solid #334155',
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
        <span>Certificates Issued</span>
        {hasUnjustifiedMoves && (
          <span
            style={{
              fontSize: 9,
              color: '#f59e0b',
              padding: '1px 6px',
              borderRadius: 3,
              border: '1px solid #f59e0b33',
              background: '#f59e0b11',
            }}
            title="Boundary moved without a justifying certificate"
          >
            &#9888; unjustified move
          </span>
        )}
      </div>
      {certificates.length === 0 ? (
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
          No certificates this step
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {certificates.map((cert, i) => (
            <CertificateCard
              key={i}
              cert={cert}
              linkedMoves={getCertLinkedMoves(cert)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

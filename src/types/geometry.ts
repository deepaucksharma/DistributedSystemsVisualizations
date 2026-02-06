// ─── Geometry, Boundary, and Certificate visual metadata ───
// Maps framework ontology concepts to display properties.

import type { GeometryKey, BoundaryKey, CertificateType } from './trace';

// --- Geometry Metadata (§4.1-4.5, §5.1-5.5, §6) ---

export interface GeometryMeta {
  label: string;
  color: string;
  icon: string;
  desc: string;
}

export const GEOMETRIES: Record<GeometryKey, GeometryMeta> = {
  safety:      { label: 'Safety',      color: '#22c55e', icon: '◎', desc: 'Quorum intersection — who must confirm' },
  authority:   { label: 'Authority',   color: '#a855f7', icon: '⚑', desc: 'Epoch fencing — who may write' },
  coupling:    { label: 'Coupling',    color: '#f59e0b', icon: '⊗', desc: 'Sets × Epochs — why both matter' },
  resource:    { label: 'Resource',    color: '#06b6d4', icon: '▤', desc: 'Retention & trim — what history is kept' },
  observation: { label: 'Observation', color: '#ec4899', icon: '◉', desc: 'Read/write contracts — what clients see' },
  ownership:   { label: 'Ownership',   color: '#14b8a6', icon: '⬡', desc: 'Sharding — who owns what keyspace' },
  membership:  { label: 'Membership',  color: '#8b5cf6', icon: '⊞', desc: 'Config epochs — who is in the group' },
  causality:   { label: 'Causality',   color: '#f472b6', icon: '⇶', desc: 'Partial order — DAG and CALM' },
  composition: { label: 'Composition', color: '#f97316', icon: '⊕', desc: 'Transactions & externalization' },
  failure:     { label: 'Failure',     color: '#ef4444', icon: '⚡', desc: 'Fault model — what can break' },
  liveness:    { label: 'Liveness',    color: '#eab308', icon: '∞', desc: 'Progress — will certs keep forming?' },
};

// --- Boundary Metadata (§2.5) ---

export interface BoundaryMeta {
  label: string;
  color: string;
  desc: string;
}

export const BOUNDARY_META: Record<BoundaryKey, BoundaryMeta> = {
  T: { label: 'Trim',    color: '#6b7280', desc: 'History before this is gone' },
  D: { label: 'Durable', color: '#3b82f6', desc: 'Persisted to stable storage' },
  A: { label: 'Applied', color: '#8b5cf6', desc: 'Applied to state machine' },
  C: { label: 'Commit',  color: '#22c55e', desc: 'On the committed trunk' },
  E: { label: 'End',     color: '#f59e0b', desc: 'Last appended (may be wet cement)' },
};

// --- Certificate Colors (§3.2) ---

export const CERT_COLORS: Record<CertificateType, string> = {
  authority:      '#a855f7',
  commit:         '#22c55e',
  read:           '#ec4899',
  trim:           '#06b6d4',
  externalization: '#f97316',
  transaction:    '#6366f1',
};

// --- Certificate Type Descriptions (§3.2) ---

export const CERT_DESCRIPTIONS: Record<CertificateType, string> = {
  authority:       '§4.2 — Proves a replica won an election and holds the right to write in this epoch',
  commit:          '§4.1 — Proves a quorum acked an entry, making it part of the committed trunk (C advances)',
  read:            '§4.5 — Proves a read observed a state that is at least as fresh as C (linearizable read)',
  trim:            '§4.4 — Proves all replicas have confirmed entries below T are durable, so they can be discarded',
  externalization: '§5.4 — Records that an external side effect was sent (idempotency key for exactly-once)',
  transaction:     '§5.4 — Proves all shards in a cross-shard transaction agreed to commit',
};

// --- Boundary Framework References (§2.5) ---

export const BOUNDARY_REFS: Record<BoundaryKey, string> = {
  T: '§2.5 Trim — entries before T are permanently discarded. Invariant: T ≤ C (can only trim committed entries)',
  D: '§2.5 Durable — entries up to D are fsynced to stable storage. Invariant: D ≤ E (can only durably store what exists)',
  A: '§2.5 Applied — entries up to A have been applied to the state machine. Invariant: A ≤ C (only apply committed)',
  C: '§2.5 Commit — entries up to C are on the committed trunk. Requires quorum certificate. C is monotone non-decreasing.',
  E: '§2.5 End — the last appended entry. Entries between C and E are "wet cement" — may be rolled back.',
};

// --- Invariant Descriptions ---

export const INVARIANT_DESCS: Record<string, string> = {
  'T ≤ C': '§2.5 — Can only trim entries that are committed. Trimming uncommitted entries loses data.',
  'D ≤ E': '§2.5 — Can only durably store entries that exist in the log.',
  'A ≤ E': '§2.5 — Can only apply entries that exist in the log.',
  'A ≤ C': '§3.2 — Only apply committed entries to the state machine. Applying wet cement exposes phantom state.',
  'Authority uniqueness': '§4.2 — At most one valid leader per (configEpoch, leaderEpoch). Prevents split brain.',
  'Authority fencing': '§4.2 — Old leaders must be fenced (step down) when a higher epoch exists.',
  'C monotone': '§4.1 — The commit frontier never decreases. Committed entries are permanent.',
  'Trunk monotonicity': '§4.3 Coupling Law — Committed entries must be monotone in (epoch, index). Prevents Figure-8.',
  'D ≥ C': '§3.1/§5.5 — Committed entries must be durable (fsynced). D < C means this replica claims committed data it cannot back with stable storage.',
  'Set monotone': '§5.3 CALM — G-Set elements are never removed. The set only grows.',
  'Events monotone': '§5.3 CALM — Event log only grows. Events are never removed.',
  'VC monotone': '§2.2 — Vector clock entries never decrease on the same replica.',
  'Convergence': '§5.3 CALM — All non-partitioned replicas should eventually hold the same state.',
};

// --- Message Type Colors ---

export const MESSAGE_COLORS: Record<string, string> = {
  request:     '#60a5fa',
  replication: '#a78bfa',
  ack:         '#34d399',
  election:    '#a855f7',
  reconfig:    '#14b8a6',
  snapshot:    '#06b6d4',
  heartbeat:   '#64748b',
  vote:        '#8b5cf6',
};

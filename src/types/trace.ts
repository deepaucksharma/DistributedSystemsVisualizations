// ─── Core Type Definitions ───
// Maps 1:1 to the framework ontology defined in docs/specs/spec1.md and spec3.md.
// This is the single source of truth for the trace data model.

// --- Geometry Keys (§4.1-4.5, §5.1-5.5, §6) ---

export type GeometryKey =
  | 'safety'       // §4.1 — quorum intersection, commit rules
  | 'authority'    // §4.2 — epochs, fencing, leadership
  | 'coupling'     // §4.3 — sets × epochs (the coupling law)
  | 'resource'     // §4.4 — retention, snapshots, trim
  | 'observation'  // §4.5 — read/write contracts, client illusion
  | 'ownership'    // §5.1 — sharding, shard maps
  | 'membership'   // §5.2 — config epochs, reconfiguration
  | 'causality'    // §5.3 — DAG, CALM, coordination cuts
  | 'composition'  // §5.4 — transactions, externalization
  | 'failure'      // §5.5 — fault model as first-class axis
  | 'liveness';    // §6.1-6.2 — FLP, progress conditions

// --- Boundary Keys (§2.5) ---

export type BoundaryKey = 'T' | 'D' | 'A' | 'C' | 'E';

// --- Coordinate (§2.3) ---
// The full address of a log entry in the history space.
// Lexicographic ordering: (configEpoch, leaderEpoch, index)
// The coupling law requires monotonicity in this ordering for committed entries.

export interface Coordinate {
  shard?: string;           // consensus group (optional for single-shard)
  configEpoch?: number;     // membership configuration version
  leaderEpoch: number;      // authority era (term/view)
  index: number;            // position within that era's history
}

// --- Log Entry (§2.3 Coordinates) ---

export interface LogEntry {
  idx: number;
  val: string;
  epoch: number;              // leader epoch (authority era)
  configEpoch?: number;       // membership config version (for multi-config scenarios)
  origin_leader?: string;     // which leader appended this entry
}

// --- Replica State (§2.5 Boundary Lattice + §2.3 Coordinates) ---

export interface ReplicaState {
  // Authority / coordinate context
  shard?: string;
  configEpoch?: number;
  epoch: number;

  // Status flags
  leader?: boolean;
  crashed?: boolean;
  recovered?: boolean;
  partitioned?: boolean;
  danger?: boolean;

  // Boundaries: T/D/A/C/E as per boundary lattice
  // Invariants: T ≤ C, D ≤ E, A ≤ E, and if applying committed only: A ≤ C
  T: number;
  D: number;
  A: number;
  C: number;
  E: number;

  // Log entries (for line-shaped histories)
  log: LogEntry[];

  // For DAG/CRDT mode
  crdtState?: unknown;
}

// --- Spec (§1.1 — the abstract object being implemented) ---
// Determines what counts as correct behavior and what counts as a violation.

export interface Spec {
  type: string;                         // e.g., "Linearizable Register", "Causal Store"
  invariant?: string;                   // legacy single invariant (backward-compat)
  consistency_model?: ConsistencyModel; // what consistency guarantee is promised
  invariants?: string[];                // abstract invariants that must always hold
  observations?: string[];              // observable operations (reads, writes, side effects)
}

// --- Environment Contract (§1.2 — what the system assumes about the world) ---
// Different environments require different certificates and enable different bugs.

export interface Environment {
  fault_model: FailureModel;            // what can fail and how
  storage_model?: string;               // e.g., "durable fsync", "volatile"
  network_model?: string;               // e.g., "async: omission, delay, reorder"
  timing_model?: string;                // "asynchronous" | "partial synchrony"
}

// --- Certificate Types (§3.2) ---

export type CertificateType =
  | 'authority'
  | 'commit'
  | 'read'
  | 'trim'
  | 'externalization'
  | 'transaction';

// Certificate evidence: the proof that justifies a boundary movement.
// The certificate principle (§3.1): every boundary movement must point at a certificate.
export interface CertificateEvidence {
  quorum?: string[];          // which replicas contributed to this proof
  boundary?: BoundaryKey;     // which boundary this justifies moving
  from?: number;              // boundary moved from
  to?: number;                // boundary moved to
  configEpoch?: number;       // config context of evidence
}

export interface Certificate {
  type: CertificateType;
  holder: string;
  epoch?: number;
  shard?: string;
  detail: string;
  evidence?: CertificateEvidence;
  valid?: boolean;            // false = invalid cert (e.g., insufficient quorum)
}

// --- Messages (§1.2) ---

export type MessageType =
  | 'request'
  | 'replication'
  | 'ack'
  | 'election'
  | 'reconfig'
  | 'snapshot'
  | 'heartbeat'
  | 'vote';

export interface Message {
  from: string;
  to: string;
  label: string;
  type: MessageType | string;
  epoch?: number;
  delivered?: boolean;        // false = in-flight or dropped
}

// --- Observations (§4.5) ---

export type ObservationType =
  | 'clientWrite'
  | 'clientRead'
  | 'txnCommit'
  | 'externalEffect';

export interface Observation {
  type: ObservationType;
  actor: string;
  targetReplica?: string;
  opId?: string;              // idempotency key / txn id
  result?: string;
  consistency?: 'linearizable' | 'sequential' | 'causal' | 'eventual' | 'bounded-stale';
  detail?: string;
}

// --- Boundary Movement (derived, §2.5) ---
// The certificate principle: justified_by should reference the cert that proves this move is safe.

export interface BoundaryMove {
  replica: string;
  boundary: BoundaryKey;
  from: number;
  to: number;
  justified_by?: Certificate | null;
}

// --- Violations (§7.2) ---

export type BugClass =
  | 'phantom_commit'
  | 'split_brain'
  | 'resurrected_history'
  | 'zombie_side_effect'
  | 'read_anomaly'
  | 'data_loss_after_ack'
  | 'trim_cliff'
  | 'reconfig_split_brain'
  | 'election_storm';

export interface Violation {
  type: string;
  law: string;
  detail: string;
  framework_ref: string;
  bug_class?: BugClass;
}

// --- Invariant Checks ---

export interface InvariantCheck {
  invariant: string;
  holds: boolean;
  detail?: string;
}

// --- History Tree (§2.2) ---

export interface HistoryBranch {
  branch_id: string;
  epoch: number;
  entries: LogEntry[];
  status: 'active' | 'pruned';
}

export interface HistoryTree {
  committed_trunk: LogEntry[];
  branches: HistoryBranch[];
}

// --- Control Plane (§5.1-5.2) ---

export interface Config {
  epoch: number;
  members: string[];
}

export interface ShardOwnership {
  shard: string;
  configEpoch: number;
  replicas: string[];
}

export interface ControlPlaneState {
  configs?: Config[];
  currentConfigEpoch?: number;
  shardMap?: ShardOwnership[];
  notes?: string;
}

// --- Step (One Frame in the Storyboard) ---

export interface Step {
  id: number;
  event: string;
  narration: string;

  replicas: Record<string, ReplicaState>;

  // Optional enrichments
  history_tree?: HistoryTree;
  controlPlane?: ControlPlaneState;

  // Runtime events
  messages: Message[];
  certificates: Certificate[];
  observations?: Observation[];

  // Derived / explanatory metadata
  boundaries_moved: BoundaryMove[];
  invariants_ok: boolean;
  violation?: Violation;
  geometry_highlight: GeometryKey | null;
  invariants_checked?: InvariantCheck[];
}

// --- Trace (Top-level) ---

export type ConsistencyModel = 'linearizable' | 'sequential' | 'causal' | 'eventual';
export type FailureModel = 'crash-only' | 'crash-recovery' | 'byzantine';
export type HistoryShape = 'line' | 'dag';

export interface Trace {
  id?: string;
  title: string;
  description: string;
  framework_refs?: string[];

  spec: Spec;
  environment?: Environment;
  consistencyModel?: ConsistencyModel;
  failureModel: FailureModel | string;
  historyShape?: HistoryShape;
  livenessAssumptions?: string;

  geometries?: GeometryKey[];
  shards?: string[];
  hasControlPlane?: boolean;

  steps: Step[];
}

// --- Step Diff (for change highlighting) ---

export interface StepDiff {
  boundaries_changed: Array<{ replica: string; boundary: BoundaryKey; old: number; new: number }>;
  entries_added: Array<{ replica: string; entry: LogEntry }>;
  entries_removed: Array<{ replica: string; entry: LogEntry }>;
  epoch_changed: Array<{ replica: string; old: number; new: number }>;
  role_changed: Array<{ replica: string; old: string; new: string }>;
  flags_changed: Array<{ replica: string; flag: string; old: boolean; new: boolean }>;
  certs_issued: Certificate[];
  violation_appeared: boolean;
  violation_resolved: boolean;
}

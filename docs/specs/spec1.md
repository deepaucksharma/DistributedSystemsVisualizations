Here’s the architecture document, problem‑first and mapped explicitly to the framework’s ontology. I’ll keep it conceptual and structural (data + flows), not visual-styling‑heavy.

---

# 0. Problem Statement

We’re not trying to build “a Raft visualizer” or “a Kafka GUI.” We’re trying to solve this problem:

> Given a non-trivial distributed protocol, how do you:
> - See **what actually happened** in a run (including failures and interleavings),
> - Connect that behavior to **abstract invariants** (safety, liveness, consistency),
> - Explain **why** each rule (epochs, quorums, retention, etc.) exists,
> - And keep those explanations **in sync** with the real implementation or model?

The constraints:

- The protocol lives in a **high-dimensional space** (epochs, quorums, trim cliffs, control plane, externalization, liveness).
- Static diagrams (even SVG) are brittle and lie as soon as code changes.
- ASCII is too limited to represent all dimensions at once.
- We want a system where **data is primary** and visuals are views on that data.

So we need:

1. A **canonical trace model** that matches our conceptual framework.
2. A **scenario model**: curated traces illustrating specific geometries/failures.
3. A **visual grammar** that can be rendered automatically from traces.
4. A clear mapping from **framework concepts → data objects → scenario traces → visual elements**.

---

# 1. Conceptual Ontology (What We Must Represent)

From our “physics” framework, the core concepts we must encode are:

- **Spec / illusion**: abstract object (linearizable register, causal store, CRDT, etc.).
- **Consistency model**: linearizable vs sequential vs causal vs eventual.
- **Execution geometry**: events, messages, partial order (happens-before), traces.
- **Knowledge geometry**: what nodes know; certificates as proof objects.
- **History object**: line vs DAG, tree+trunk vs branches, coordinates (Shard, ConfigEpoch, LeaderEpoch, Index).
- **Boundary lattice**: T (Trim), C (Commit), E (End), D (Durable), A (Applied).
- **Safety geometry**: quorums, commit rules.
- **Time geometry**: epochs/terms/views, authority, fencing, trunk monotonicity in (epoch, index).
- **Resource geometry**: retention, snapshots, trim cliff.
- **Space/ownership geometry**: shards, membership, config epochs, joint consensus.
- **Causality geometry**: total order vs partial order (CRDTs, causal metadata).
- **Coordination geometry**: which invariants require consensus vs can be monotone/coord‑free.
- **Failure model geometry**: crash vs crash-recovery vs Byzantine.
- **Observation semantics**: read/write APIs; what frontiers they consult; what illusions they offer.
- **API/delivery semantics**: at-most/at-least/exactly-once.
- **Liveness**: timing assumptions, failure detectors, progress conditions.

The architecture must have a place for *each* of these in the data model, scenario model, and visual model.

---

# 2. Overall System Architecture (Problem → Solution Skeleton)

## 2.1 High-level components

1. **Trace Producers** (outside the viewer)
   - A simulator, model checker, or instrumented system that:
     - Executes the protocol under some scenario.
     - Emits a sequence of steps: events + full distributed state snapshots.

2. **Canonical Trace Model**
   - A JSON/TS-typed object representing:
     - Global metadata (spec, failure model, history shape).
     - Steps, each with:
       - Replica states (T/D/A/C/E, epoch, log).
       - Messages.
       - Certificates.
       - Observations (client-visible events, external effects).
       - Invariants & violations (optional).
       - Geometry focus tags, if any.

3. **Trace Normalizer / Annotator**
   - Offline or at load time:
     - Computes derived fields (boundary movements, geometry_highlight).
     - Optionally checks invariants (safety, coupling, resource, etc.).
     - Optionally filters “boring” steps.

4. **Trace Viewer (React)**
   - Given a trace object, renders:
     - **Space view**: replica “pipelines” (boundary lattice across replicas).
     - **Time view**: message/authority evolution.
     - **Knowledge/cert ledger**: which certs justified which boundary moves.
     - **Narration**: natural-language explanation per step.
     - **Geometry bar**: which conceptual axis is being illustrated (safety, authority, coupling, resource, observation, failure).

5. **Scenario Library**
   - A catalog of canonical traces (e.g. Figure‑8, trim cliff, reconfig, etc.), each:
     - Tagged with the geometries it illustrates.
     - Linked to sections in the written framework.

## 2.2 Data-first workflow

1. Design or modify protocol.
2. Run scenario in simulator or instrumented tests.
3. Export trace JSON.
4. Normalize trace (derive moves, tags).
5. Drop into viewer and docs: visuals update automatically.

No manual diagram updates.

---

# 3. Data Model (Canonical Trace Schema)

This is the “one true model” the rest of the system uses. I’ll write it in TypeScript-like pseudo-typing, but you can think of it as JSON schema.

## 3.1 Top-level Trace

```ts
type Trace = {
  id: string;
  title: string;
  description: string;

  // Framework-level metadata
  spec: {
    type: string;                 // e.g. "Linearizable Register"
    invariant?: string;           // e.g. "Single committed value per index"
  };
  consistencyModel?: "linearizable" | "sequential" | "causal" | "eventual";
  failureModel: "crash-only" | "crash-recovery" | "byzantine";
  historyShape: "line" | "dag";
  livenessAssumptions?: string;   // e.g. "partial synchrony, eventually perfect FD"

  // Axes in play for this trace
  geometries?: Array<
    "safety" | "authority" | "coupling" | "resource" | "observation" |
    "space" | "causality" | "coordination" | "failure" | "liveness"
  >;

  // Optional multi-shard / control-plane info
  shards?: string[];              // e.g. ["s1", "s2"], or omitted for single-group traces
  hasControlPlane?: boolean;      // if control-plane events are present

  steps: Step[];
};
```

## 3.2 Step (One Frame/State in the Storyboard)

```ts
type Step = {
  id: number;
  event: string;                  // e.g. "R1 replicates X to R2"
  narration: string;

  // State per replica (and optionally per shard)
  replicas: Record<string, ReplicaState>;

  // Control-plane state (optional)
  controlPlane?: ControlPlaneState;

  // Runtime events at this step
  messages: Message[];
  certificates: Certificate[];
  observations?: Observation[];   // client-visible interactions, external effects

  // Derived / explanatory metadata
  boundaries_moved?: BoundaryMove[]; // usually derived
  invariants_ok?: boolean;
  violation?: Violation;
  geometry_highlight?: GeomKey;   // which conceptual axis this step is about
};
```

Where:

```ts
type GeomKey = keyof typeof GEOMETRIES;  // "safety" | "authority" | ...
```

## 3.3 ReplicaState (History + Boundaries + Flags)

This is where the **history object + boundary lattice + coordinates** live.

```ts
type ReplicaState = {
  // Authority / coordinate context
  shard?: string;                 // which shard/group this replica is in
  configEpoch?: number;           // membership version
  epoch: number;                  // leaderEpoch/term/view for this group

  // Status
  leader?: boolean;
  crashed?: boolean;
  recovered?: boolean;
  partitioned?: boolean;
  danger?: boolean;               // e.g. about to violate a law (for teaching)

  // Boundaries: T/D/A/C/E as per boundary lattice
  T: number;                      // trim frontier
  D: number;                      // durable frontier
  A: number;                      // applied frontier
  C: number;                      // local view of commit frontier (usually same across replicas)
  E: number;                      // end of log (last appended index)

  // Log entries (for line-shaped histories)
  log: LogEntry[];

  // For DAG/CRDT mode, we may add:
  crdtState?: any;                // shape depends on CRDT; or summary
};
```

`LogEntry` encodes **(Epoch, Index) + value**, which is crucial for coupling:

```ts
type LogEntry = {
  idx: number;
  val: string;                    // symbolic value
  epoch: number;                  // leaderEpoch that wrote this entry
  // For more realism, you could add term, client opId, etc.
};
```

## 3.4 Certificates = Knowledge Objects

Direct mapping from **knowledge geometry** to data.

```ts
type CertificateType =
  | "authority"      // leader election / fencing
  | "commit"         // entry is on committed trunk
  | "read"           // read reflects at least some frontier
  | "trim"           // safe to advance T
  | "externalization"// safe to emit side effects
  | "transaction";   // multi-shard atomicity

type Certificate = {
  type: CertificateType;
  holder: string;                // usually a replica id
  epoch?: number;                // in which epoch this cert is valid
  shard?: string;                // if relevant
  detail: string;                // human-readable explanation
};
```

## 3.5 Messages = Time Geometry & Liveness Hooks

Messages form the **time view**.

```ts
type MessageType = "request" | "replication" | "ack" | "election" | "reconfig" | "snapshot" | string;

type Message = {
  from: string;
  to: string;
  label: string;                 // "append(X, idx=1,e=1)", "voteReq", etc.
  type: MessageType;
};
```

These allow us to show interleavings that cause coupling issues, election storms, etc.

## 3.6 Observations = Client + World Interface

Obs/Observation is where we encode **API semantics + externalization**:

```ts
type ObservationType = "clientWrite" | "clientRead" | "txnCommit" | "externalEffect";

type Observation = {
  type: ObservationType;
  actor: string;                 // client id or external system
  targetReplica?: string;        // where request went
  opId?: string;                 // idempotency key, txn id, etc.
  result?: string;               // read value, commit/abort, etc.
  consistency?: "linearizable" | "seq" | "causal" | "eventual";
  detail?: string;               // explanation ("read served from leader C=5", etc.)
};
```

This will be crucial when showing:

- “This read was linearizable because it consulted C on the leader.”
- Or “This read was stale because it came from follower Aᵣ < C.”

## 3.7 BoundaryMove (Derived)

We don’t want to maintain this by hand; it’s a **diff**:

```ts
type BoundaryKey = "T" | "D" | "A" | "C" | "E";

type BoundaryMove = {
  replica: string;
  boundary: BoundaryKey;
  from: number;
  to: number;
};
```

Computed by comparing consecutive `replicas` states.

## 3.8 Violations / Invariants

This connects traces to abstract laws:

```ts
type Violation = {
  type: string;           // "coupling", "safety", "resource", ...
  law: string;            // "Trunk monotonicity in (Epoch, Index)"
  detail: string;         // human explanation
  framework_ref: string;  // e.g. "§4.3 Coupling Law: sets × epochs"
};
```

The trace producer or normalizer can set these when an invariant check fails.

## 3.9 Control Plane State (Space / Ownership Geometry)

When we represent reconfiguration, sharding, etc.:

```ts
type Config = {
  epoch: number;
  members: string[];          // replica ids
};

type ShardOwnership = {
  shard: string;
  configEpoch: number;
  replicas: string[];
};

type ControlPlaneState = {
  configs?: Config[];         // historical configs for this group
  currentConfigEpoch?: number;
  shardMap?: ShardOwnership[];// which shard → which config
  notes?: string;             // textual explanation
};
```

This allows us to show:

- Membership changes,
- Joint configs,
- Shard remapping.

---

# 4. Mapping Framework Concepts → Data → Scenarios → Visuals

Here’s a compact mapping table for the core concepts.

### 4.1 Spec & Consistency

- **Concept**: Abstract spec & consistency model.
- **Data**:
  - `trace.spec`, `trace.consistencyModel`.
- **Scenarios**:
  - Linearizable register (Figure‑8),
  - Causal CRDT store,
  - Eventually consistent log.
- **Visual**:
  - Header/metadata panel,
  - Consistency tags on observations (reads/writes).

### 4.2 Execution Geometry (Events, Traces)

- **Concept**: Partial order of events, messages.
- **Data**:
  - `steps[]`,
  - `steps[i].messages[]`,
  - Implicit order by `id`.
- **Scenarios**:
  - Any; especially ones with interleavings (Figure‑8, election storms).
- **Visual**:
  - Step sequence and message list per frame.
  - Progress bar across steps.

### 4.3 Knowledge & Certificates

- **Concept**: Nodes only know what they have evidence for; certs encode knowledge.
- **Data**:
  - `step.certificates[]` (authority, commit, read, trim, externalization, txn).
- **Scenarios**:
  - Authority election,
  - Commit formation,
  - Snapshot+trim,
  - Externalization (exactly-once).
- **Visual**:
  - Certificate cards per step,
  - Geometry highlight “safety”/“authority”,
  - Arrows showing which boundaries these certs advance.

### 4.4 History Object & Coordinates

- **Concept**: Tree of histories with a committed trunk; positions are (Shard, ConfigEpoch, LeaderEpoch, Index) or CRDT EventID+CausalMetadata.
- **Data**:
  - `ReplicaState.{shard,configEpoch,epoch}`,
  - `ReplicaState.log[]` entries `(idx,val,epoch)`,
  - `trace.historyShape`.
- **Scenarios**:
  - Figure‑8,
  - Split-brain & branch truncation,
  - Multi-shard ops.
- **Visual**:
  - Per-replica “pipeline” lane showing:
    - Trimmed region,
    - Committed trunk ([T..C]),
    - Wet cement ([C..E]),
    - Entries labeled with `val@e`.

### 4.5 Boundary Lattice

- **Concept**: T ≤ C ≤ E; D/A per replica; partial order invariants.
- **Data**:
  - `ReplicaState.{T,D,A,C,E}`,
  - `step.boundaries_moved[]` (derived).
- **Scenarios**:
  - Normal commit,
  - Trim & snapshot,
  - Trim cliff.
- **Visual**:
  - Boundary markers on each lane,
  - Legend for T/D/A/C/E,
  - Boundary movements panel per step.

### 4.6 Safety Geometry (Quorums)

- **Concept**: Commit = majority has durable entry (or appropriate quorum for failure model).
- **Data**:
  - Quorum membership often implicit in `detail` of commit certificate, e.g. `"quorum={R1,R2,R3}"`,
  - Or scenario metadata if you want explicit quorums.
- **Scenarios**:
  - Figure‑8 (majority with X, but not committed),
  - Normal commit vs under-replicated commit.
- **Visual**:
  - Commit certificate card,
  - Change in C across replicas,
  - Geometry highlight “safety”.

### 4.7 Time Geometry (Epochs, Fencing, Coupling)

- **Concept**: Epochs order authority; trunk monotonic in (epoch,index).
- **Data**:
  - `ReplicaState.epoch`,
  - `LogEntry.epoch`,
  - `Certificate.type="authority"` with `cert.epoch`,
  - `Violation.type="coupling"` for illegal old-epoch commits.
- **Scenarios**:
  - Figure‑8,
  - Split-brain leader change,
  - Zombie leader after re-election.
- **Visual**:
  - Epoch labels per replica,
  - Entries showing `e1` vs `e2`,
  - Violation banner when a step tries to commit an old epoch against a newer committed value.

### 4.8 Resource Geometry (Retention, Snapshots, Cliff)

- **Concept**: T moves; log before T is gone, replay only possible if position ≥ T.
- **Data**:
  - `ReplicaState.T`,
  - Control-plane events for snapshot creation & trim (via `cert.type="trim"`),
  - Violation when a replica’s `A` (or desired start) < T and no snapshot.
- **Scenarios**:
  - Trim cliff (replica down beyond retention),
  - Snapshot-based catch-up.
- **Visual**:
  - Grey “trimmed” region on lanes,
  - Snapshot/trim cert cards,
  - Narration: “Replica R3 fell off the cliff; must reseed.”

### 4.9 Space / Ownership Geometry (Shards, Membership)

- **Concept**: Keyspace partitioned; membership evolves via ConfigEpochs.
- **Data**:
  - `ReplicaState.shard`,
  - `ReplicaState.configEpoch`,
  - `ControlPlaneState.configs[]` and `shardMap[]`.
- **Scenarios**:
  - Config change with joint quorum,
  - Shard migration.
- **Visual**:
  - Optional top “control-plane” lane showing configs over time,
  - Shard labels on replicas,
  - Color bands for config epochs.

### 4.10 Causality Geometry (CRDT / DAG)

- **Concept**: Partial order; operations with causal metadata; merge instead of commit.
- **Data**:
  - `trace.historyShape = "dag"`,
  - `ReplicaState.crdtState` or `log` with `causalMetadata` (if you extend LogEntry),
  - No global C; maybe per-replica “seen frontier”.
- **Scenarios**:
  - Two replicas updating a CRDT and converging,
  - Causal read semantics.
- **Visual**:
  - Instead of a single C line, show local fronts + merge results,
  - Possibly a reduced DAG depiction or just state diffs, rather than index-based lanes.

### 4.11 Coordination Geometry (CALM)

- **Concept**: Which parts of the spec need consensus vs can be CRDT/coord‑free.
- **Data**:
  - Per-scenario metadata: `geometries` includes `"coordination"`,
  - Possibly flags on operations: `requiresCoordination: true/false`.
- **Scenarios**:
  - Bank transfer (needs consensus) vs counter increment (CRDT ok).
- **Visual**:
  - Highlight which operations go through consensus pipeline vs local-merge pipeline,
  - Annotations in narration.

### 4.12 Failure Model Geometry

- **Concept**: Crash-only vs crash-recovery vs Byzantine → impacts quorum rules & cert validity.
- **Data**:
  - `trace.failureModel`,
  - If Byzantine: certs include signatures/quorum sizes.
- **Scenarios**:
  - Crash recovery with fsync vs without,
  - Byzantine double-vote.
- **Visual**:
  - Failure model displayed in header,
  - Maybe stricter styling for BFT-specific certs.

### 4.13 Observation & API Semantics

- **Concept**: Where do reads/writes go? What consistency/ delivery guarantee is offered?
- **Data**:
  - `Observations[]` with `type`, `consistency`, `result`.
- **Scenarios**:
  - Leader read vs follower read,
  - Quorum read,
  - At-most vs at-least vs exactly-once.
- **Visual**:
  - A small “observation panel” per step showing client interactions,
  - Color-coded by consistency.

### 4.14 Liveness Geometry

- **Concept**: Under what timing assumptions do certs continue to form and C advance?
- **Data**:
  - `trace.livenessAssumptions`,
  - Steps showing repeated failed elections, eventually successful one.
- **Scenarios**:
  - Election storm and eventual stabilization,
  - Quorum loss and recovery.
- **Visual**:
  - Narration + messages reflecting instability vs stable epochs,
  - Geometry highlight “liveness” on relevant steps.

---

# 5. Scenario Model

Each scenario is essentially:

- One `Trace` (JSON),
- Plus some tags that locate it in the “book.”

```ts
type ScenarioMeta = {
  id: string;
  title: string;
  description: string;
  traceFile: string;             // path to JSON
  frameworkRefs: string[];       // e.g. ["§4.3 Coupling Law", "§2.2 History Tree"]
  geometries: GeomKey[];         // which axes it illustrates
};
```

Examples:

- `figure8_epoch_coupling`
  - geometries: ["safety", "authority", "coupling", "failure"]
  - frameworkRefs: ["§4.3 Coupling Law", "§2.3 History Tree"]

- `trim_cliff_replay_impossible`
  - geometries: ["resource", "failure", "liveness"]
  - frameworkRefs: ["§4.4 Resource Geometry"]

- `reconfig_joint_consensus`
  - geometries: ["space", "safety", "time"]

- `causal_crdt_merge`
  - geometries: ["causality", "coordination", "observation"]

The viewer just receives a `Trace`. The **scenario catalog** is how humans discover which trace to look at and why.

---

# 6. Visual Architecture (High-Level, Not Styling)

The viewer you wrote already aligns well:

- **Header**
  - Shows `trace.title`, `description`, `spec.type`, `failureModel`.
- **Geometry Bar**
  - Highlights `step.geometry_highlight`.
- **Boundary Legend**
  - Explains T/D/A/C/E.

- **Step Navigation**
  - Progress bar across `steps`.
  - Step details: `event`, `narration`.

- **Violation Banner**
  - Shows `step.violation` if present.

- **Space / History View**
  - For each `[replica, state]`, uses `BoundaryLattice` to render:
    - Trimmed region, committed trunk, wet cement,
    - Log entries (with epoch),
    - T/D/A/C/E markers.

- **Time / Messages View**
  - `step.messages` displayed as simple from→to rows.

- **Knowledge / Certificates View**
  - `step.certificates` displayed as cards.

- **Boundary Movements Panel**
  - `step.boundaries_moved` displayed as small chips.

That covers the line-shaped history cases. DAG/CRDT would slightly change the history view, but use the same Step/Replica model.

---

# 7. Generation & Normalization Pipeline

Conceptual steps:

1. **Scenario execution**
   - Simulator / model checker / real system produces a sequence of global states (`ReplicaState`s) + events (messages, certs, observations).
   - Produces a rough `Trace` with minimal derived data.

2. **Normalization**
   - Takes raw `Trace`:
     - Computes `boundaries_moved` per step using diffs.
     - Optionally checks invariants and sets `invariants_ok` / `violation`.
     - Optionally infers `geometry_highlight`.

3. **Storage**
   - Writes normalized `Trace` to e.g. `traces/figure8.json`.

4. **Viewer**
   - Loads JSON,
   - Displays via `<TraceViewer trace={normalizeTrace(rawTrace)} />`.

5. **Docs**
   - MDX or site integrates viewer components directly.
   - If needed, static renders can be generated from the trace (e.g. PNG snapshots).

---

# 8. Summary

Problem-first recap:

- **Problem**: How to see, explain, and *trust* the behavior of complex distributed protocols, in a way that’s aligned with an explicit conceptual framework (spec, histories, geometries), and that stays in sync with evolving code and proofs.

- **Core solution idea**: Treat everything as **data**:

  - Define a canonical Trace model that directly reflects the framework:
    - Execution, knowledge, history, boundaries, certificates, observations.
  - Let simulators / tests emit traces in that model.
  - Let the viewer be a pure function: `Trace → interactive storyboard`, with each frame showing:
    - Replica pipelines (boundary lattice),
    - Messages,
    - Certificates,
    - Invariants and geometry axes.

From here, we can safely move to “actual visualization details,” because the architecture now has a clear mapping:

- Every axis in the framework has a dedicated **data object**,
- Each axis appears in at least one curated **scenario**,
- And each axis has a clear **visual hook** in the viewer.

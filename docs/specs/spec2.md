# Architecture Doc: Auto-Generated Storyboards for “The Physics of Distributed Systems”
## Problem-first → ontology → data model → scenarios → visuals → generation pipeline

This document pins down the **overall architecture** so it maps *exactly* to the framework’s ontology we built: refinement/spec, histories (Line/DAG), coordinates, boundary lattice, certificates, coupling, resource cliffs, sharding/control-plane, composition/externalization, observation contracts, and liveness.

It is deliberately **not a UI spec** yet. It defines **what exists** (objects), **what happens** (events/scenarios), and **what must be shown** (visual tokens), so the visualization can be automatically generated and kept correct.

---

## 0) The Fundamental Problem (what we are actually building)
We want a system that:

> Takes a machine-readable description of a distributed execution (a **scenario trace**) + a stated model (spec + fault/timing assumptions + protocol semantics) and **compiles** it into a sequence of frames that **provably correspond** to the framework’s concepts—so diagrams are always consistent with the model and update automatically when rules change.

### Non-goals (important)
- Not “a Raft visualizer” or “a Kafka visualizer” specifically.
- Not hand-authored snapshots per step (that defeats correctness + maintainability).
- Not trying to prove protocols correct formally; we’re compiling **canonical traces** and checking **local/global invariants** aligned with the refinement contract.

---

## 1) Ontology (the nouns our system must represent)
These are the irreducible concepts from the framework; the architecture must represent each explicitly:

1) **Specification / Refinement contract** (what illusion is sold; what observations count)
2) **Environment model** (fault model + timing model + storage model)
3) **Execution substrate** (events/messages/disk ops; happens-before; traces)
4) **History object** (truth structure: Line vs DAG vs Hybrid)
5) **Authority regime** (epochs/terms/views, fencing)
6) **Commit/decision** (what becomes irreversible; committed trunk)
7) **Coordinates** (Shard/Group, ConfigEpoch, LeaderEpoch, Index) or DAG event IDs + causal metadata
8) **Boundary lattice** (per-replica E/D/A; cluster C/T; optional stability frontiers)
9) **Certificates** (authority/commit/read/trim/externalization/transaction) as knowledge/proof objects
10) **Coupling law** (sets × epochs: why quorum counting alone is insufficient)
11) **Resource geometry** (retention, snapshot, trim cliff `x < T`)
12) **Observation semantics** (read/write contract matrix; linearizable vs sequential vs causal vs eventual)
13) **Space/ownership** (shards, control plane, membership changes, joint intersection)
14) **Composition** (transactions across histories; external side effects; delivery semantics)
15) **Liveness** (partial synchrony + failure detector; progress conditions)

---

## 2) Solution Overview (what we build)
A **Trace → Frames → Storyboard** compiler with three layers:

### Layer A — Inputs (authored or generated)
- **Scenario Trace (Event DSL)**: minimal events only (no precomputed “replicas state” snapshots)
- **Model config**: spec + environment + semantics toggles (e.g., coupling enforced vs naive)
- Optional: protocol adapters/simulators emitting the same event DSL

### Layer B — Compiler (physics engine)
- Applies events to state
- Derives boundaries, certificates, trunk/branch status, and checks invariants
- Produces a sequence of **Frames** (render-ready, fully derived)

### Layer C — Renderers
- Space view (replicated history lanes)
- Time view (messages/authority timeline)
- Certificate ledger (irreversible actions + proof + dependencies)
- Export to HTML (interactive) and/or PNG/PDF (book)

This architecture guarantees automatic updates: changing semantics or traces regenerates frames; frames regenerate visuals.

---

## 3) Core Data Model (objects) — canonical IR
Below is the minimal set of objects we need. (Names are conceptual; implement as TypeScript types + JSON Schema.)

### 3.1 Model / Contract objects

**`SpecContract`**
- `specType`: e.g., linearizable register, serializable txns, causal store, CRDT set
- `observations`: what counts as observable behavior
  - `apiResponses`
  - `externalEffects`
- `consistencyModel`: linearizable / sequential / causal / eventual / bounded-staleness
- `invariants`: machine-checkable invariants (where possible)

**`EnvironmentModel`**
- `faultModel`: crash-stop | crash-recovery | byzantine
- `timingModel`: async | partial-synchrony
- `storageModel`: stable | lossy | reorder | corrupt (choose minimal subset early)
- `failureDomains` (optional): racks/az; correlated failures

**`SemanticsConfig`** (the “physics knobs”)
- `historyShape`: line | dag | hybrid
- `quorumPolicy`: majority | byz | dynamic (with constraints)
- `durabilityPolicy`: ackAfterAppend | ackAfterFsync | etc.
- `applyPolicy`: applyCommittedOnly | allowSpeculativeApply (requires rollback semantics)
- `couplingPolicy`: enforceEpochCoupling true/false (to demonstrate Figure-8 class)
- `trimPolicy`: snapshotBased | retentionBased
- `readPolicy`: leaderBarrier | quorumRead | followerStale | causalRead
- `externalizationPolicy`: outbox+fence | idempotencyKeys | none (to show zombie bugs)
- `membershipPolicy`: jointConsensus | unsafeDirect (for teaching failure)

These configs are critical: they let one trace compile into both “correct” and “naive” storyboards.

---

### 3.2 System topology objects

**`Cluster`**
- `groups`: list of `Group` (data plane) and optionally `ControlPlaneGroup`
- `externalWorld`: sinks/systems affected by side effects

**`Group`** (the unit of a history object)
- `groupId`
- `members: ReplicaId[]`
- `configEpoch` (versioned membership)
- `authority`: current leaderEpoch + leader id (or DAG writer set)
- `history`: `LineHistory` or `DagHistory`

**`Replica`**
- `replicaId`
- `status`: alive|crashed|partitioned|recovering
- `localLog` (for Line) or `localEvents` (for DAG)
- `frontiers`: `E`, `D`, `A` (per replica)
- `knownClusterFrontiers` (optional): what this replica believes about `C` and `T`

**`ControlPlaneGroup`**
- Same as Group, but the history entries are metadata:
  - shard map versions
  - membership configs
  - fencing tokens
  - leadership assignments

This is first-class because it issues the coordinates used by data plane groups.

---

### 3.3 History objects (truth representation)

**`LineHistory`**
- entries keyed by `Index`
- each entry carries `leaderEpoch` and `payload`
- supports truncation (branch pruning)
- trunk prefix defined by commit frontier `C`

**`DagHistory`**
- events keyed by `EventID`
- each event carries `causalMetadata` (vector clock / dotted version)
- merge laws define convergence
- “commit” may be replaced by “stability frontier” depending on spec (but still expressible as a frontier + certificate)

**`Coordinates`**
- Line: `(groupId, shardId?, configEpoch, leaderEpoch, index)`
- DAG: `(groupId, shardId?, configEpoch, eventId, causalMetadata)`

---

### 3.4 Boundary lattice objects (frontiers)

**Per-replica frontiers**
- `Eᵣ`: appended end
- `Dᵣ`: durable end
- `Aᵣ`: applied end

**Per-group frontiers**
- `C`: commit frontier (committed trunk end) — Line systems
- `T`: trim/log-start frontier (earliest available history)
- Optional stable frontiers (e.g., transactional stability, read-committed stability)

**Key architectural rule**
- `C` and `T` are **group-level facts** (with per-replica knowledge lag if we choose to model it), not just copied fields on each replica.

---

### 3.5 Certificates (proof objects)
A certificate is a structured object emitted by the compiler when it can be justified under the model.

**`Certificate`**
- `type`: authority | commit | read | trim | externalization | transaction
- `scope`: groupId (and possibly shard/map/config epoch)
- `claims`: what it asserts (e.g., “leaderEpoch=5 is authoritative”, “C advanced to 10”)
- `evidence`: quorum acks/votes, signatures, leases, fence tokens, etc.
- `dependsOn`: references to environment assumptions + semantics knobs

Certificates are the formalization of “knowledge collapses uncertainty.”

---

### 3.6 Event DSL (what scenarios are authored in)
This is the key: **author events, not frames**.

**`Event`** (examples)
- Execution/messaging:
  - `send`, `recv`, `ack`, `timeout`, `heartbeat`
- Authority/time:
  - `electLeader`, `stepDown`, `fence`
- Log mutations:
  - `appendEntry`, `truncateFrom`, `installSnapshot`
- Disk semantics:
  - `fsyncUpTo`, `crash`, `recover`
- Resource:
  - `advanceTrimTo`, `retentionDelete`
- Ownership/membership:
  - `proposeConfig`, `enterJointConfig`, `exitJointConfig`, `updateShardMap`
- Observation/externalization:
  - `clientWrite`, `clientRead`
  - `emitEffect` (payment/email) with idempotency key / fence token metadata
- Transactions:
  - `txnPrepare`, `txnCommit`, `txnAbort`

This DSL is protocol-agnostic; protocol adapters can emit it.

---

## 4) Compiler Output: Frames (render-ready derived state)
A **`Frame`** is the unit of visualization. It is computed, not authored.

**`Frame` contains**
- `frameId`, `stepId`, narration strings
- `groupStates`: replicas + histories + frontiers
- `timeView`: normalized list of message arrows/events for this frame
- `issuedCertificates`: list emitted in this step
- `irreversibleActions`: derived list (“advanced C”, “trimmed to T”, “served linearizable read”, “emitted effect”)
- `boundaryDiffs`: computed diff from previous frame
- `invariantChecks`: pass/fail + explanation + framework reference
- `geometryHighlight`: safety/authority/coupling/resource/observation/failure/etc. (derived or tagged)

This directly supports the storyboard format.

---

## 5) Mapping Table: Framework concept → Data object → Scenario → Visual token
This is the heart of “architecture maps to ontology”.

| Framework concept | Data object(s) | Canonical scenario(s) | Visual representation (storyboard) |
|---|---|---|---|
| Spec refinement | `SpecContract` + `invariantChecks` | Any; especially read anomalies & externalization | “Spec box” + violation banners referencing spec |
| Fault+timing model | `EnvironmentModel` | Liveness collapse; byz quorum; durability failures | Global badge + certificate dependency notes |
| Execution substrate (events/traces) | `Event[]` + `timeView` | All | Time view (message/election timeline) |
| History shape (Line/DAG/Hybrid) | `SemanticsConfig.historyShape`, `LineHistory`/`DagHistory` | Line: replication/commit; DAG: concurrent updates converge | Space view lanes: linear slots vs DAG braid/merge marks |
| Authority geometry (epochs/fencing) | `electLeader`, `LeaderEpoch`, `AuthorityCert` | Split brain / zombie leader | Epoch bands + fencing markers; authority cert in ledger |
| Safety geometry (quorum) | `quorumPolicy`, `CommitCert evidence` | Normal commit, flexible quorum edge cases | Quorum gate spans lanes; C moves only with cert |
| Coupling law (sets×epochs) | `couplingPolicy`, commit validity predicate | Figure-8 class trace | Highlight: “naive would advance C here” vs “blocked” + adoption/truncation |
| Committed trunk vs wet cement | `C`, local logs beyond `C` | Leader change and truncation | Solid trunk region vs striped tail; scissors for truncation |
| Boundary lattice (E/D/A/C/T) | `frontiers` + `boundaryDiffs` | Crash recovery; apply lag; trim cliff | Per-lane ticks for E/D/A; group-wide C/T vertical rules |
| Resource geometry (trim cliff) | `T`, retention events, snapshot | Replica down > retention | Gray void <T; “bridge out” + snapshot install or reseed |
| Knowledge/certificates | `Certificate[]`, `irreversibleActions` | Every “boundary advance” moment | Ledger panel: action → cert → dependsOn |
| Observation semantics | `clientRead`, `readPolicy`, `ReadCert` | Leader read vs follower read; bounded staleness | Read taps on lanes (C vs Aᵣ) + read cert ledger |
| Determinism | apply rules, nondeterminism events | Divergent state despite same log | “apply determinism” warnings + record-nondeterminism entries |
| Space/ownership (shards) | `ShardMapVersion`, `Group` per shard | Cross-shard invariant or move | Multi-group lanes; control plane track updates mapping |
| Membership/reconfig | `ConfigEpoch`, joint config events | Unsafe direct reconfig; joint consensus | ConfigEpoch bands; joint quorum gates across old+new |
| Transactions (composition) | `TransactionCert`, prepare/commit events | 2PC blocking; commit/abort | Transaction lane/overlay + txn cert ledger |
| Externalization | effect events + `ExternalizationCert` | Zombie side effects | “world boundary” track + fence/idempotency marker |
| Delivery semantics | opId/idempotency keys | at-least-once vs effectively-once | Duplicate detection markers + ledger explanation |
| Liveness | timeouts/elections/backpressure model | election storms, overload | Progress loop panel: timeouts→elections→cert gathering |

---

## 6) Scenario Library (the “atlas” we compile)
We maintain a curated set of scenario traces. Each scenario is small, canonical, and checks a specific law.

**Core Line scenarios**
1) Normal replication → commit frontier advances
2) Epoch change → wet cement truncated
3) Figure-8 class coupling: naive quorum counting vs epoch-coupled commit
4) Crash-recovery durability mismatch: ack-before-fsync vs ack-after-fsync
5) Apply lag and rollback: applying speculative entries (if allowed) vs committed-only
6) Trim cliff: lagging replica/consumer falls behind `T`
7) Reconfiguration: unsafe direct transition vs joint intersection
8) Read semantics: leader barrier read vs follower stale read vs quorum read
9) Externalization: zombie leader duplicates side effects; fix via fencing/outbox/idempotency
10) Liveness collapse: failure detector + overload → election storm, no progress

**DAG/CRDT region**
11) Concurrent updates converge via merge (no total order)
12) CALM cut: monotone aggregate in DAG; non-monotone invariant forced into Line subgroup

**Hybrid**
13) Sharded line histories + txn layer; show composition costs and liveness hazards

---

## 7) Visual System (generated, not hand-drawn)
The storyboard is a *layout*, fed by frames:

### Panel A — Space view (history lanes)
- Rows = replicas (and optionally control plane group)
- X = history position (index or event id ordering projection)
- Solid trunk `[T..C]`, striped wet cement `(C..E]`, gray void `<T`
- Group-wide vertical rules for `C` and `T`
- Per-replica ticks for `Eᵣ, Dᵣ, Aᵣ`
- Epoch color bands on tails
- Scissors for truncation, camera for snapshot, fence for authority changes

### Panel B — Time view (interleaving justification)
- Message arrows, elections, partitions/heals, timeouts
- Step numbers that match frontier changes in space view (optional but powerful)

### Panel C — Certificate ledger (proof + irreversible action)
Auto-generated table:
- action taken
- boundary moved
- certificate used
- dependencies (fault model, coupling policy, durability policy)

This is how “knowledge geometry” becomes visible and auditable.

---

## 8) Implementation Plan (phased, correctness-first)
### Phase 1 — MVP (Line, single group)
- Event DSL subset: electLeader, appendEntry, send/ack, fsync, crash/recover, truncate, clientWrite
- Derived: per-replica `E/D/A`, group `C/T`
- Commit policy: majority + optional fsync requirement
- Render: space view + time view + ledger
- Scenario set: (1) normal commit, (3) Figure-8 naive vs coupled

### Phase 2 — Coupling + truncation + read contracts
- Add epoch-coupled commit validity
- Add read events + read certificates (leader barrier vs follower)
- Add invariant checks for “phantom commit” and “read sees impossible history”

### Phase 3 — Resource + snapshots (trim cliff)
- Add trim, snapshot install, retention delete
- Enforce `x ≥ T` theorem visually and in checks

### Phase 4 — Control plane, sharding, membership reconfig
- Introduce control-plane group whose history issues shard map + config epochs
- Add joint consensus scenario and unsafe reconfig scenario

### Phase 5 — Composition (transactions + externalization)
- Add transaction decisions + external world effects + fencing/idempotency

### Phase 6 — DAG/CRDT region + CALM gate
- Add DAG histories and merge semantics
- Show coordination cut routing

---

## 9) Key design decisions (so we don’t drift later)
1) **Events are authored; frames are derived.** No manual replica snapshots in scenario files.
2) **C and T are group-level.** If we represent per-replica “known C”, it’s explicit.
3) **Certificates are compiler output.** They are not narrative decorations.
4) **Coupling is a certificate validity rule**, not a special-case “step”.
5) **Control plane is a first-class history object**, not a footnote.
6) **External effects are part of refinement**, so they live in the model and visuals.

---

## 10) Next step: freeze the schemas
Before visualization details, we should freeze:
- the **Event DSL** (minimal vocabulary + fields)
- the **Frame schema** (what renderers consume)
- the **SemanticsConfig knobs** (so we can compile naive vs correct)

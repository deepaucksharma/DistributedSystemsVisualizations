# The Complete Physics of Distributed Systems  
## A Unified Framework for Reasoning About Any Replicated Data System

---

# Part I: Foundations

## 1.1 The Ultimate Goal: Spec Refinement

The core problem is not “build a log” or “run consensus.” It is:

> Make a distributed system behave like some **simple abstract object** under failures and concurrency.

Everything else—logs, epochs, quorums, CRDTs, leases, snapshots—is implementation detail relative to this goal.

### The Refinement Contract

- You have an **abstract specification**:
  - A set of states
  - A set of operations
  - Invariants that must always hold
  - Allowed histories (traces of operations and responses)

- A **distributed implementation** is correct if every observable behavior **refines** that spec:
  - Every concurrent execution can be “explained” as some allowed abstract execution (possibly after reordering overlapping operations, depending on the consistency model).

### Examples of Abstract Objects

| Abstract Object         | Key Properties                                      |
|-------------------------|-----------------------------------------------------|
| Linearizable register   | Single-copy illusion; respects real-time ordering  |
| Serializable database   | Transactions appear atomic and isolated            |
| Snapshot-isolated DB    | Reads see a consistent snapshot, writes serialized |
| Causal store            | Observes happens-before; no causal anomalies       |
| Grow-only set (CRDT)   | Monotonic convergence; coordination-free possible  |

### Step Zero for Any Design

Before you talk about Raft vs Paxos vs CRDTs:

1. **What spec are we trying to emulate?**
2. **What consistency model does that imply?**
   - Linearizable, sequential, serializable, snapshot-isolated, causal, eventual, etc.
3. **What invariants are non-negotiable?**
   - E.g., “no lost updates,” “no double-spend,” “no dangling references.”

Only with those answers does the rest of the machinery have meaning.

---

## 1.2 Execution Substrate: Events, Traces, and Partial Orders

Under everything lies a very simple execution model.

### Basic Elements

- **Processes**: nodes that maintain local state.
- **Messages**: asynchronous communication between processes.
- **Events**: atomic occurrences:
  - Local steps: append log entry, move a boundary, apply operation.
  - Send and receive of messages.
  - Disk ops: write, fsync, read.

### The Happens-Before Relation (→)

Define a partial order over events:

- If event A occurs before event B on the same process: `A → B`.
- If A is a send and B is the corresponding receive: `A → B`.
- Transitivity: if `A → B` and `B → C`, then `A → C`.

This yields:

- **Concurrent events** `A ∥ B` when neither `A → B` nor `B → A`.

### Key Notions

- **Trace**: a total order of events consistent with `→`.  
  Think “one possible serialization of what happened.”

- **Consistent cut**: a set of events closed under `→`:
  - If B is in the cut and `A → B`, then A is also in the cut.
  - Think “a global logical snapshot in time.”

### How This Connects to Correctness

- **Safety properties**: “No bad trace exists.”
  - E.g., no trace where two different values are both decided for the same slot.

- **Liveness properties**: “Every fair execution can be extended to a good trace.”
  - E.g., every request is eventually followed by a matching response.

Higher-level constructs—logs, CRDTs, transactions—are just ways of constraining which traces are possible.

---

## 1.3 Knowledge Geometry: What Nodes Can Actually Know

Nodes never see the global state; they only see local history.

### Knowledge Model

For a process `p` at some time:

- Its **local state** is consistent with some set of **possible global states**.
- `p` **knows** a fact φ if φ holds in **all** globally possible states consistent with its local state.
- Knowledge grows as `p` receives more messages and updates its local state.

### Fundamental Principle

> A node may only safely take an **irreversible action** when it knows that doing so cannot be contradicted by any admissible future messages (under the failure model).

### Examples of Irreversible Actions and Required Knowledge

| Action                         | Knowledge Required                                       |
|--------------------------------|----------------------------------------------------------|
| Declare a value committed      | “This value is on the permanent trunk.”                 |
| Serve a linearizable read      | “My view reflects all prior commits.”                   |
| Trim old log entries           | “State captures all effects; these entries are unneeded for any valid recovery.” |
| Execute external side effect   | “No future leader/zombie can legitimately re-emit this effect.” |
| Accept writes as leader        | “I am the unique authority for this epoch/config.”      |

This is where **certificates** come in: they are explicit evidence that shrinks uncertainty enough to justify an irreversible step.

---

# Part II: The History Mechanism

## 2.1 Why Logs? (Operations, Not Data Structures)

Replicating arbitrary data structures (like B-trees) is hard:

- Many internal states.
- Complex mutation patterns.
- Hard to define a simple, global notion of “same structure.”

Instead, we replicate **operations**:

- Represent each state transition as an entry in an **append-only log**.
- Each node:
  - Stores a log,
  - Applies log entries in order to a **deterministic state machine**.

If two nodes have the same prefix of the log and the same starting state, they reach the same result.  
So the hard problem reduces to:

> Keep a collection of nodes in sync on a shared history of operations.

---

## 2.2 History Shape: Line vs DAG

The history the system maintains can take two canonical shapes:

| Shape                       | Structure          | Convergence Mechanism      | Coordination Need         |
|-----------------------------|--------------------|----------------------------|---------------------------|
| **Line (Total Order)**     | Single sequence    | Branch pruning (truncation) | Requires consensus/log    |
| **DAG (Partial Order)**    | Causality graph    | Merge/CRDT rules           | Coordination-free possible (if monotone) |

- Line systems: replicated logs, Raft, Paxos, primary-backup with epochs.
- DAG systems: CRDTs, causal stores, gossip-based convergence.

This **history shape axis** is fundamental: it decides whether you even need consensus.

---

## 2.3 History Tree and Committed Trunk

Even in “line” systems, you don’t maintain a perfect line during failures.

### The History Tree

Consider a single consensus group:

```text
                    ┌─ [6a] ─ [7a] ─ [8a]  (epoch 3 suffix - may be pruned)
                    │
[1] ─ [2] ─ [3] ─ [4] ─ [5]
                    │
                    └─ [6b] ─ [7b]         (epoch 4 suffix - may become trunk)

     └─────────────────┘
      Committed Trunk (1–5)
```

Definitions:

- **History Tree**  
  All entries ever appended across all epochs and leadership changes.

- **Committed Trunk**  
  The maximal prefix that *all future valid executions must preserve*.

- **Speculative Branches**  
  Suffixes beyond the trunk, produced by specific leaders/epochs; may be pruned.

- **Branch Pruning**  
  Recovery procedure in which losing branches are truncated to rejoin the trunk.

- **Wet Cement Region**  
  The portion of the history tree that is:
  - Appended on some nodes,
  - Not yet proven to be on the trunk,
  - Eligible for pruning if authority shifts.

### Critical Insight

> Commitment is a property of the **trunk**, not of “how many replicas hold an entry.”

An entry is “committed” if and only if protocol rules ensure it lies on the trunk in all future valid executions.

---

## 2.4 The Coordinate System for History

A log index alone is not enough. History entries live in a rich context.

### General Coordinate Tuple

For a line-based consensus group:

```text
(Shard / Group, ConfigEpoch, LeaderEpoch, Index)
```

| Component         | Meaning                                  | Why It Matters                            |
|-------------------|------------------------------------------|-------------------------------------------|
| Shard / Group     | Consensus domain                        | Disambiguates ownership                  |
| ConfigEpoch       | Membership version                      | Safe reconfiguration                     |
| LeaderEpoch       | Leadership era (term, view)            | Fences zombies, orders histories by era  |
| Index             | Position within that era’s history      | Total order *inside* an epoch            |

For DAG systems, coordinates may be `(EventId, CausalMetadata)`, but the idea is the same: every event’s authority context is explicitly versioned.

### Lexicographic Ordering

To compare two log positions:

- First compare `(ConfigEpoch, LeaderEpoch)`,
- Then `Index`.

For example:

```text
(ce: 1, le: 3, idx: 17) < (ce: 1, le: 4, idx: 1) < (ce: 1, le: 4, idx: 2)
```

This 2D (or 3D with config) ordering is essential to:

- Decide which history is “more up to date.”
- Define truncation and catch-up rules correctly across epochs.

---

## 2.5 The Boundary Lattice

Real implementations don’t just have “the HWM.” They maintain several frontiers with strict ordering constraints.

### Per-Replica Boundaries

For each replica `r`:

- `Eᵣ` – **End/Append frontier**  
  Last index this replica has any bytes for.

- `Dᵣ` – **Durable frontier**  
  Last index this replica has safely persisted (e.g., fsync’d).

- `Aᵣ` – **Applied frontier**  
  Last index whose operation has been applied to the local state machine.

### Cluster-Wide Boundaries

- `C` – **Commit frontier**  
  Last index on the committed trunk (globally irreversible for agreed spec).

- `T` – **Trim frontier**  
  First index still retained in the log. History `< T` is gone or only present in materialized state (snapshots, compaction).

Optionally:

- `S` – **Stable read frontier**  
  A point known to be safe for consistent reads (may be `C` or slightly behind).

### Lattice Invariants (line systems)

These must always hold (under the intended semantics):

- `T ≤ C ≤ Eᵣ` for any replica `r` considered “up to date.”
- `T ≤ Aᵣ ≤ C` if applying only committed entries.
- `Dᵣ ≤ Eᵣ` (you cannot durably have more than you have appended).

Viewed as a lattice, boundaries must evolve monotonically and respect these partial order constraints.

### Visual Representation

```text
Log:  [1][2][3][4][5][6][7][8][9][10][11][12]
       ↑           ↑              ↑     ↑
       T           A              C     E

Legend:
T = Trimmed start       (history before this gone from log)
A = Applied frontier    (entries applied to state machine)
C = Commit frontier     (entries safe on trunk)
E = Append frontier     (entries local but not necessarily committed)
```

A large class of “impossible” bugs are precisely violations of these invariants during complex event interleavings (restart + truncation + snapshot + delayed fsync).

---

# Part III: Certificates as Proofs

## 3.1 Certificates: Knowledge in Concrete Form

We can now formalize the intuition:

> A boundary may only advance if we can attach a **certificate** that remains valid under the failure model and epoch rules.

### What Is a Certificate?

- A piece of evidence (often a set of messages or votes) that:
  - Once observed, shrinks a node’s uncertainty enough to take an irreversible step.
  - Remains valid even if more messages later arrive, within the failure model.

- Its validity depends on:
  - Quorum structure.
  - Epoch/term constraints.
  - Durability semantics.
  - Failure model (crash / crash-recovery / Byzantine).

Certificates are how we encode “who must have what, when” into something that a node can use to update its knowledge.

---

## 3.2 Certificate Types

### Authority / Leadership Certificate

- Proves: “This replica is the unique authorized leader for (group, configEpoch, leaderEpoch).”
- Constructed via:
  - Election protocols,
  - Majority votes,
  - Leases (time-bounded authority).

### Commit Certificate

- Proves: “Entry at coordinate X is on the trunk: it cannot be superseded by any valid future history.”
- Usually built from:
  - Quorum of acks for that entry,
  - Within a specific epoch and configuration.

### Read Certificate

- Proves: “This read observes at least all effects up to frontier F, in an authority-consistent way.”
- Examples:
  - Leader read-index in Raft-like protocols.
  - Majority read in quorum systems.
  - Lease-based read from a follower.

### Trim / Snapshot Certificate

- Proves: “State at frontier S contains all effects ≤ S; it is safe to raise T to S and discard earlier log.”
- Typically:
  - Snapshot persisted,
  - All nodes that matter for recovery are at or beyond S (or can be brought to S).

### Externalization Certificate

- Proves: “This external effect (e.g., sending to a payment system) corresponds to a committed history entry and cannot be safely re-emitted by a zombie later.”
- Realized by:
  - Idempotency keys bounded by log positions,
  - Outbox patterns,
  - Fencing tokens shared with external systems.

### Transaction Certificate

- Proves: “A multi-shard or multi-key operation is decided as commit or abort.”
- Often:
  - Prepared/commit records in per-shard logs,
  - Coordinator’s decision recorded and replicated.

The main abstraction:

> Every dangerous boundary movement (commit, trim, external side effect) should point at a clearly-defined certificate type.

---

# Part IV: Core Geometries

## 4.1 Safety Geometry: Quorums and Set Intersection

**Question:** Who must have an entry for it to be safely declared part of the trunk?

### Quorum Systems

A quorum system `Q` is a family of subsets of replicas with the property:

- **Intersection**:  
  Any two quorums in `Q` intersect in at least one correct node (under the failure model).

Examples:

| Failure Model                          | Nodes | Tolerated Faults f | Quorum Size      |
|----------------------------------------|-------|---------------------|------------------|
| Crash-only                             | n     | f                   | `⌊n/2⌋ + 1`      |
| Crash-recovery (with disks)           | n     | f                   | ≥ majority, but on *durable* entries |
| Byzantine (arbitrary faults)          | 3f+1  | f                   | 2f+1             |

### Intersection Invariant

Because every valid leader and every valid commit must involve some quorum in `Q`:

- Quorums intersect,
- So any decision supported by a valid quorum is “remembered” in any future quorum.

This property underlies commit certificates: we rely on intersection to prevent conflicting decisions.

### Commit Rule (Crash-Recovery, Line Systems)

An entry at coordinate X may be committed only if:

1. There exists quorum `Q ∈ Q` of replicas that:
   - Have X in their log (≥ `Eᵣ`), and
   - Have durably stored it (≥ `Dᵣ`), and

2. The certificate attesting to this quorum is consistent with:
   - The current epoch rules,
   - Configuration rules.

Relaxed or “flexible” systems weaken these requirements deliberately, trading off safety for availability or throughput.

---

## 4.2 Time Geometry: Epochs, Authority, and Fencing

**Question:** When multiple leaders and partitions exist, which timeline wins?

### Epochs / Terms / Views

- Monotonically increasing **epoch number** for each group.
- Each leader election:
  - Increments epoch,
  - Produces a *single valid leader* per epoch (or none).

Epoch rules:

1. A replica only accepts writes from a leader whose epoch it considers current.
2. Once a replica learns of a higher epoch, it:
   - Rejects all messages from lower-epoch leaders,
   - Potentially steps down if it was a leader.

This ensures ** authority fencing**:

- Old leaders cannot continue mutating the trunk in parallel with newer ones.
- Messages from old epochs can be safely ignored or treated as stale.

---

## 4.3 Coupling Safety and Time: Monotonicity in (Epoch, Index)

Pure quorum counting by index is not enough in the presence of epochs.

### The Coupling Rule

> A commit certificate must be **monotone** in `(LeaderEpoch, Index)`, not just in `Index`.

Otherwise you can re-interpret past quorums in new epochs in contradictory ways.

### Generalized “Figure 8” Problem

A classic failure pattern:

1. Leader in **epoch e1** appends X at index i, replicates to a majority, but:
   - Crashes before fully committing.
2. New leader in **epoch e2 > e1** is elected from nodes that:
   - May not have X at index i.
   - May overwrite index i with Y.
3. Later, a node from epoch e1 (with X) is elected leader in **epoch e3 > e2**.
   - It sees: “X at i is on a majority.”
   - If it commits X purely on quorum counts, history now contradicts the Y timeline created in e2.

Fix pattern (Raft-style, generalized):

- A leader may only:
  - Commit entries that are guaranteed to be on the authoritative trunk of its own epoch.
- Often enforced via:
  - “Leader must commit at least one new entry in its current term after which all prior entries covered become committed.”
  - Or stronger log comparison rules at election time.

The essential invariant:

> Trunk commitment order is monotone in `(ConfigEpoch, LeaderEpoch, Index)` across the entire history tree.

---

## 4.4 Resource Geometry: Retention, Snapshots, and the Cliff

**Question:** How long is enough history retained for correct recovery and catch-up?

Recall:

- `C`: commit frontier (end of trunk).
- `T`: trim frontier (start of retained log).

### Catch-Up Condition

A lagging node at position `x` can catch up by log replay **iff**:

```text
x ≥ T
```

If `x < T`, entries it needs no longer exist in the log.

### Two Retention Patterns

1. **Snapshot-based retention**

   - System periodically takes a snapshot at index `S`.
   - Sets `T = S` and deletes log entries `< S`.
   - A node at `x < S`:
     - Installs snapshot (jump to S),
     - Replays `[S+1 .. C]`.

2. **Retention-based (time/size) with log as product**

   - System deletes log entries by time or size.
   - `T` advances independently of snapshots.
   - A node at `x < T`:
     - Cannot recover via log alone.
     - Must be reseeded/reset, or considered to have missed data.

**The Cliff:**

- `x ≥ T`: “normal replication regime.”
- `x < T`: “cliff zone” — you are out of the replication protocol, into disaster recovery protocol.

### Safe Trim Invariant

Before moving `T` to `T'`:

1. There exists a snapshot or equivalent materialization at or beyond `T'`.
2. Nodes that matter (for quorums, catch-up) can:
   - Either already reach `T'`, or
   - Be brought to `T'` using snapshot + remaining log.

Otherwise, you risk:
- Catch-up impossibility,
- Or silent data loss for nodes that believe they are still within normal replication regime.

---

# Part V: Extended Geometries

## 5.1 Space / Ownership Geometry: Shards and Membership

**Two orthogonal questions:**

### 5.1.1 Sharding: Mapping Keyspace → Groups

- System divides its data into **shards** or **partitions**.
- Each shard/group:
  - Has its own trunk, epochs, quorums, boundaries.
- The shard map:
  - Must itself be consistent and versioned.
  - Is often stored in a separate metadata service (itself a consensus group).

### 5.1.2 Membership: Changing Replica Sets Safely

- Replica set for a group evolves over **ConfigEpoch**:
  - ConfigEpoch 1: {A, B, C}
  - ConfigEpoch 2: {C, D, E}
- Safe reconfiguration requires:
  - Temporary **joint configurations**.
  - Quorums that intersect both old and new configs.

**Reconfiguration Safety:**

- Unsafe:
  - Old quorum: {A, B}
  - New quorum: {D, E}
  - No intersection → can commit conflicting values.

- Safe:
  - Joint quorum: majority of old + majority of new.
  - Guarantees intersection during transition.

**Key point:**  
The control plane (membership, shard maps) is itself a history object, with its own epochs, certificates, and quorums.

---

## 5.2 Causality Geometry: Partial Order and CALM

Not all histories need a single total order. Many can live in a DAG of events.

### Total vs Partial Order

| Aspect                   | Total Order (Line)           | Partial Order (DAG)                       |
|--------------------------|------------------------------|-------------------------------------------|
| Structure                | Single sequence              | Causality graph                           |
| Conflicting concurrent ops | Forbidden by construction  | Allowed; resolved by merge semantics      |
| Coordination need        | High (consensus required)    | Lower (coordination-free possible)        |
| Typical use              | Strong invariants, serializable state machines | Eventually consistent CRDTs, logs of facts |

### CALM Principle (Informal)

> A computation whose outputs are **monotone** in its inputs (adding inputs never invalidates outputs) can be implemented without coordination in an eventually consistent way.

- Monotone examples:
  - Growing a set of facts.
  - Computing reachability in a graph (with only edges added).

- Non-monotone examples:
  - Exactly-once uniqueness.
  - “Balance is exactly $100.”
  - “No two seats sold for same seat.”

**Design implication:**

- Use line + consensus only for **non-monotone** invariants.
- Use DAG + CRDTs + gossip for **monotone** computations where convergence is enough.

This is how you decide “where do we pay for consensus?”

---

## 5.3 Failure Geometry: What Can Go Wrong and What That Implies

Failure model shapes everything:

### Typical Models

| Model          | Assumptions                                  | Consequences                              |
|----------------|----------------------------------------------|-------------------------------------------|
| Crash-stop     | Nodes halt, never return                     | No disk recovery; simpler reasoning       |
| Crash-recovery | Nodes halt and may return with disk intact   | Must distinguish in-memory vs durable     |
| Byzantine      | Nodes can behave arbitrarily (malicious)     | Need signatures, larger quorums, stronger certificates |

Effects:

- **Quorums**:  
  Crash-only: majority; Byzantine: 2f+1 of 3f+1.

- **Certificates**:  
  Crash-only: counts of acks; Byzantine: signed votes.

- **Durability**:
  - In crash-recovery, `Dᵣ` (durable frontier) matters for commit.
  - In crash-only (no recovery), in-memory may be enough if you accept loss on total outage.

Your safety/time/resource geometries must be stated explicitly *relative* to the failure geometry.

---

## 5.4 Observation Geometry: Read Paths and Consistency

So far we’ve mostly discussed how the trunk is built. Now: what **illusion** do reads/writes present?

### The Read/Write Contract Matrix

| API Type           | Executes At        | Frontier Consulted | Certificate Needed             | Consistency Level       |
|--------------------|--------------------|--------------------|--------------------------------|-------------------------|
| Strong write       | Leader             | C                  | Commit cert on C               | Linearizable write ack  |
| Weak write         | Any replica        | Eᵣ                 | None                           | Eventual / best effort  |
| Strong read        | Leader + barrier   | C (current epoch)  | Authority + read cert          | Linearizable read       |
| Follower read      | Follower           | Aᵣ                 | None                           | Potentially stale       |
| Quorum read        | Quorum of replicas | max(Aᵣ) or Cᵢ      | Quorum read cert               | Bounded-staleness, etc. |
| Causal read/write  | Any, with clocks   | Causal frontier    | Vector-clock/causal cert       | Causal consistency      |

### Linearizable Read Requirements

To implement linearizable reads:

1. The reader must ensure it observes at least the current committed frontier `C` in the highest known epoch.
2. It must ensure no newer epoch has started since it made that observation (lease or check).
3. The result must correspond to a cut that includes all prior committed writes.

Any system promising “strong reads” must specify:

- From where reads are served (leader vs follower vs quorum).
- How they are attached to a read certificate verifying that frontier.

---

## 5.5 Composition Geometry: Transactions and Externalization

### Multi-key / Multi-shard Transactions

When operations span multiple keys or shards:

- Need **transactional guarantees**:
  - Atomicity (all-or-nothing),
  - Isolation (no intermediate states observed).

Distributed transactions:

- Use:
  - Two-Phase Commit (2PC) over multiple consensus groups, or
  - Multi-shard consensus protocols.

Certificates:

- **Prepare certificates**: shards have persistently voted “yes” to commit, but have not yet committed.
- **Decision certificates**: commit/abort decisions logged durably so participants can resolve in-doubt states.

Trickiness:

- 2PC can be blocking under failures.
- Liveness must be analyzed carefully.

### Externalization and Exactly-Once Effects

When the system drives **external side effects** (payments, emails, etc.):

- Internal commit and external effect must be tightly coupled.

Common patterns:

- **Outbox pattern**:
  - Commit intent to an internal log.
  - A separate reliable process pushes side effects from the log.

- **Idempotency keys**:
  - External systems ignore duplicate effects with the same key.

- **Fencing tokens**:
  - External system accepts commands only from the holder of the current fence (epoch).

“Exactly-once” at the API level is:

- Idempotent state machine operations,
- Plus idempotent external effects,
- Plus strong commit + fencing to prevent zombies from duplicating effects.

---

# Part VI: Liveness and Synchrony

## 6.1 FLP and Why Liveness Is Conditional

**FLP Impossibility:**

> In a fully asynchronous system with even one crash-prone process, no deterministic algorithm can guarantee both safety *and* termination of consensus.

Implication:

- You cannot unconditionally guarantee that `C` will advance.
- You can (and must) guarantee safety regardless of timing.
- Liveness is always under **assumptions**.

---

## 6.2 Partial Synchrony and Failure Detectors

Real systems assume **partial synchrony**:

- There exists an unknown Global Stabilization Time (GST) after which:
  - Message delays are bounded,
  - Process speeds are bounded.

Plus **failure detectors**:

- Timeouts, heartbeats, eventually suspect permanently failed nodes accurately.

Liveness conditions for a line system:

1. **Leader stability**
   - Eventually, a correct leader holds the highest epoch and doesn’t get spuriously replaced.

2. **Quorum availability**
   - Eventually, the leader can reliably talk to a quorum of replicas.

3. **Resource availability**
   - Disk not full; snapshots and retention not permanently blocking progress.

Under these, you get:

- Elections stabilize,
- Leader can collect certificates,
- Commit frontier `C` moves forward,
- Clients see progress consistent with the spec.

---

# Part VII: The Complete Reasoning Framework

## 7.1 Design / Analysis Checklist

For any distributed data system, a complete, physics-level understanding answers:

### Foundation Layer

1. **Specification (The Illusion)**
   - What abstract object are we implementing?
   - What consistency model is required?
   - What invariants must never be violated?

2. **History Shape (Line vs DAG)**
   - Do we need a total order (replicated log) or is a partial order + merge sufficient (CRDTs)?
   - Where can we avoid consensus by using monotone computations (CALM)?

3. **Failure Model**
   - Crash-stop, crash-recovery, Byzantine?
   - What is “durable” state?
   - How many failures must we tolerate?

---

### Mechanism Layer

4. **Authority / Epochs**
   - How is leadership chosen and represented?
   - How do we fence zombies?
   - What is the coordinate system `(Shard, ConfigEpoch, LeaderEpoch, Index)`?

5. **Commit Rules (Safety × Time Coupling)**
   - Exactly when does an entry move onto the committed trunk?
   - What commit certificates are required?
   - How do we ensure monotonicity in `(Epoch, Index)`?

6. **Boundaries and Invariants**
   - What are `Eᵣ`, `Dᵣ`, `Aᵣ`, `C`, `T`?
   - What partial order constraints must always hold between them?
   - How are they updated on recovery, snapshot install, crashes?

7. **History Retention and Materialization**
   - Snapshot vs pure retention vs compaction:
     - When and how are snapshots taken?
     - When and how is `T` moved?
   - Under what conditions can a lagging node catch up by replay?
   - What happens when it cannot (`x < T`)?

---

### Composition Layer

8. **Ownership / Sharding**
   - How is the keyspace partitioned into groups?
   - Where is the shard map stored and how is it updated?
   - What is the ConfigEpoch model for membership?

9. **Membership / Reconfiguration**
   - How do replica sets change?
   - How do we guarantee quorum intersection across configurations?
   - Are configuration changes part of the log itself?

10. **Transactions / Multi-key Operations**
    - Do we support cross-key or cross-shard transactions?
    - What transaction certificates exist (prepare, commit, abort)?
    - How do transaction time and per-shard trunks interact?

11. **Externalization**
    - How are external side effects tied to trunk entries?
    - What fencing / idempotency / outbox pattern prevents zombie duplication?
    - What exactly-once or at-least-once semantics are offered?

---

### Interface Layer

12. **Observation (Read/Write Semantics)**
    - From where are writes accepted (leader only, any replica)?
    - From where are reads served (leader, follower, quorum)?
    - Which boundaries (`C`, `Aᵣ`, others) do they consult?
    - What certificates ensure their consistency model?

13. **Coordination Cuts**
    - Which invariants require coordination/consensus?
    - Which computations can remain coordination-free (CRDTs, gossip)?
    - Is the system architected to push as much as possible into the cheaper regime?

14. **Delivery Semantics**
    - For each operation: at-most-once, at-least-once, exactly-once?
    - How are retries handled?
    - How is dedup implemented (IDs, log position, idempotent state transitions)?

---

### Liveness Layer

15. **Synchrony Assumptions**
    - What timing model is assumed (partial synchrony)?
    - How are timeouts and failure detectors configured?
    - Under what conditions are nodes suspected and leaders replaced?

16. **Progress Guarantees**
    - Under which assumptions will:
      - Elections stabilize?
      - Quorums form?
      - Certificates be obtainable?
      - `C` advance indefinitely (unless no requests)?
    - What happens under overload or sustained partial failures?

---

## 7.2 Failure → Framework Mapping

When things go wrong in production, mapping symptoms to framework components tells you what invariant failed:

| Symptom / Bug Class           | Likely Violated Component                    |
|-------------------------------|---------------------------------------------|
| **Phantom commits**           | Commit certificate / epoch coupling broken  |
| **Resurrected history**       | Authority fencing failed (zombie effects)   |
| **Split brain**               | Authority certificates overlapped; epochs mismanaged |
| **Zombie side effects**       | Externalization certificates missing/weak   |
| **Read anomalies**            | Read certificates insufficient; wrong frontier |
| **Data loss on recovery**     | Durability invariant: `Dᵣ < C` at crash     |
| **Trim cliff / stuck replica**| Retention invariant: `T` advanced without safe catch-up path |
| **Reconfig split brain**      | ConfigEpoch transition without intersecting quorums |
| **No progress despite availability** | Liveness preconditions not met; failure detector or synchrony assumptions violated |

---

## 7.3 The Physics Engine

A distributed system, at this level, is:

> A machine that **constructs, commits, materializes, trims, and exposes a history** under a given failure model, while trying to make progress under partial synchrony, in a way that refines a specified abstract object.

To understand or design such a machine:

1. **Name the spec** (what illusion you promise).
2. **Name the history** (shape, coordinates).
3. **Name the certificates** (proofs for each irreversible step).
4. **Name the boundaries** (E/D/A/C/T and their invariants).
5. **Name the geometries** (safety, time, resource, space, causality, coordination, failure, observation, composition).
6. **Name the liveness conditions** (timing assumptions under which progress is guaranteed).

If you can do that, you’re not reasoning about “Raft vs Kafka vs CRDTs”; you’re reasoning about the underlying physics that all of them instantiate in different ways.
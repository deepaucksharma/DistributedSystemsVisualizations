# The Complete Physics of Distributed Systems (Enhanced)
## A Unified Framework for Reasoning About Any Replicated Data System

This is a “physics engine,” not a catalog of protocols. It gives you a small set of **objects, coordinates, boundaries, and certificates** that let you derive why systems must do what they do—and predict the failure modes when they don’t.

---

# Part I — Foundations

## 1.1 The Ultimate Goal: Spec Refinement (What illusion are we selling?)
The fundamental problem is not “build a log” or “run consensus.” It is:

> Make a distributed implementation behave like a **simple abstract object** (a spec) under concurrency and failures.

### Refinement contract (informal but precise)
- There is an **abstract specification**: state space, operations, invariants, and a set of **allowed histories** (often defined by a consistency model).
- The distributed implementation is **correct** if every **observable behavior** (client responses + externally visible effects) can be mapped to some allowed abstract history.

All machinery—logs, quorums, epochs, CRDTs, snapshots, certificates, transactions—exists only to enforce this refinement under an explicit **fault + timing model**.

**Examples of abstract objects**
| Abstract object | Allowed histories / key property |
|---|---|
| Linearizable register | Single-copy illusion consistent with real time |
| Sequentially consistent register | Per-client order preserved; real time may be violated |
| Serializable database | Equivalent to some serial transaction order |
| Causal store | Respects happens-before |
| CRDT grow-only set | Convergent merge; monotonic growth |

**Step zero for any design**
1) What spec are we refining?  
2) What observations count (reads, acks, side effects)?  
3) What failures are in-scope, and what does “survive failure” mean?  
4) Which invariants are non-negotiable?

---

## 1.2 Execution Substrate: Events, Traces, Partial Orders
Distributed protocols run on a substrate of:
- **Processes** with local state
- **Messages** (delayed, dropped, duplicated, reordered)
- **Storage events** (write, flush/fsync, read, corruption assumptions)
- **Local steps** (state transitions)

### Happens-before (→) defines the unavoidable partial order
- Program order on a process: `A → B`
- Send/receive edge: `send(m) → recv(m)`
- Transitive closure

**Trace:** a total order (linearization) consistent with `→`.  
**Safety property:** “no bad trace exists.”  
**Liveness property:** “under fairness/synchrony assumptions, good events eventually happen.”

This matters because the *only* thing a protocol can do is restrict which traces are possible.

---

## 1.3 Knowledge Geometry: What a node can safely conclude
Nodes do not act on global truth; they act on **what they can know** from local state + received messages.

> A node may take an **irreversible action** only when it has enough evidence that no admissible future messages can invalidate it.

This is the bridge to **certificates**: evidence that collapses uncertainty.

**Irreversible actions that require knowledge**
| Action | What must be known (informally) |
|---|---|
| Declare entry committed / decided | This fact will remain true across allowed failovers |
| Serve linearizable read | My view reflects all operations that should precede this read |
| Trim history | Removed history is not required for any correct recovery |
| External side effect | A zombie cannot later repeat/contradict this effect |
| Accept writes as leader | I am the unique authorized sequencer now |

---

## 1.4 The Environment Contract: Failure + Timing Model (make it explicit)
You cannot reason correctly without stating:
- **Fault model:** crash-stop vs crash-recovery (with stable storage) vs Byzantine
- **Storage model:** can disks lose data? reorder writes? corrupt bits? (often abstracted as “stable storage”)
- **Network model:** omission, delay, duplication, reordering
- **Timing model:** asynchronous vs partial synchrony; what does “eventually” mean?

**Safety** is (ideally) unconditional under the fault model.  
**Liveness** is always conditional on timing assumptions (FLP reality).

---

# Part II — The History Mechanism (the thing you’re actually building)

## 2.1 The Object of Truth: A History Object
Stop starting with “leader” or “quorum.” Start with what the system produces:

> A distributed system is a machine that **constructs, commits, materializes, trims, and exposes a history**.

### History shape axis (the first major fork)
| Shape | Structure | How conflicts resolve | Coordination requirement |
|---|---|---|---|
| **Line** (total order) | single sequence | losers are pruned (truncation) | requires strong coordination somewhere |
| **DAG** (partial order) | causality graph | merge/join semantics | coordination-free possible for monotone semantics |

**Line region:** consensus / replicated logs / primary-backup with epochs  
**DAG region:** CRDTs / causal stores / gossip + merge

This axis determines whether you must pay the “total order tax.”

---

## 2.2 The Reality of Line Systems: History Tree + Committed Trunk
Even “line” systems temporarily produce a **tree of competing suffixes** (due to partitions and leadership churn).

- **History tree:** all suffixes ever produced by competing authorities
- **Committed trunk:** prefix that will never be pruned in any valid future execution
- **Wet cement:** appended-but-not-committed region that is *eligible for deletion*

```
[1]-[2]-[3]-[4]-[5]
                 \
                  [6a]-[7a]    (speculative branch)
                 /
             [6b]-[7b]-[8b]    (competing speculative branch)

Committed trunk: [1..5]
```

**Core meaning of commitment**
> “Committed” means: this prefix is on the trunk in **all future executions allowed by the protocol + fault model**.

This is stronger than “many replicas have it.” The missing piece is authority/time coupling.

---

## 2.3 Coordinates: where an operation/event lives
Log position is not “just an index.” You need enough coordinates to disambiguate *space, membership, authority, and order.*

### Coordinate tuple (general, line systems)
**(Group/Shard, ConfigEpoch, LeaderEpoch, Index)**

- **Group/Shard:** which ownership domain (one consensus group)
- **ConfigEpoch:** which membership configuration is in force
- **LeaderEpoch:** which authority era (term/view)
- **Index:** order within that era’s history

For DAG systems, replace `(LeaderEpoch, Index)` with `(EventID, CausalMetadata)` (vector clock / dotted version vector), but the same idea holds: events live in a versioned context.

---

## 2.4 Determinism Geometry (often omitted, always paid)
State machine replication relies on:

> Same operations + same order ⇒ same state

But real programs are not automatically deterministic (time, randomness, threads, iteration order, floating point, I/O).

**Design options**
1) **Constrain execution** (single-threaded apply, deterministic runtime)
2) **Record nondeterminism in the history** (turn it into explicit inputs)
3) **Fence nondeterminism behind externalization rules** (see Part V)

If this axis is ignored, you get “perfect consensus over divergent states.”

---

## 2.5 The Boundary Lattice (watermarks done correctly)
“HWM/LWM” are instances of a more general boundary lattice. These are the system’s measurable frontiers.

### Common frontiers (line systems)
Per replica `r`:
- **Eᵣ**: appended end (bytes in the log)
- **Dᵣ**: durable end (stable storage; depends on your storage model)
- **Aᵣ**: applied end (state machine executed)

Cluster / group:
- **C**: commit frontier (end of committed trunk)
- **T**: trim frontier (history < T is unavailable for replay)
- **(optional) Stable frontier(s)**: e.g., “safe for transactional reads,” “safe under read_committed,” etc.

### Key point: it’s a lattice, not a total chain
Many systems allow (for performance):
- apply-before-durable (crash requires replay)
- append-before-commit (wet cement)
- durable-before-apply (log persisted, state not caught up)

So prefer **partial-order invariants**:
- `T ≤ C`
- `Dᵣ ≤ Eᵣ`
- `Aᵣ ≤ Eᵣ`
- If your spec says “ack implies durable,” then ack ⇒ `Dᵣ` advanced on required set
- If your spec says “apply only committed,” then `Aᵣ ≤ C` (otherwise you must support rollback/compensation)

### The universal “cliff theorem”
> Catch-up by replay is possible **iff** the needed position `x` satisfies `x ≥ T`.

If `x < T`, you are in snapshot/reseed/disaster-recovery territory.

---

# Part III — Certificates (proof-carrying distributed systems)

## 3.1 The certificate principle
Most brutal bugs are “we advanced a boundary without proof that would survive the failure model.”

> A boundary may advance only when you can attach a **certificate** whose validity is preserved under the stated failures and authority rules.

Certificates operationalize “knowledge.”

---

## 3.2 Certificate taxonomy (minimal and universal)
| Certificate | Answers | Used to safely do |
|---|---|---|
| **Authority certificate** | “Who is allowed to append now?” | accept writes; reject zombies |
| **Commit certificate** | “What history is irreversible?” | advance `C`; serve strong reads |
| **Read certificate** | “What frontier does this read reflect?” | linearizable/causal/bounded-stale reads |
| **Trim/Snapshot certificate** | “What history can be deleted safely?” | advance `T` without breaking recovery |
| **Externalization certificate** | “Can side effects happen exactly once?” | emit effects; avoid zombie repeats |
| **Transaction certificate** | “Is a multi-domain op decided atomically?” | commit/abort across shards |

Certificate validity depends on:
- fault model (crash vs Byzantine)
- quorum structure (static/dynamic)
- authority regime (epochs/leases)
- durability semantics (what counts as “stored”)

---

# Part IV — The Core Laws (“Geometries”), with correct coupling

## 4.1 Safety geometry (sets): quorum intersection and commit
**Question:** who must confirm an operation before it is irreversible?

A fault-tolerant quorum system is a family of sets with an intersection property strong enough that two conflicting decisions cannot both obtain valid certificates under the fault model.

- Crash faults: majority quorums are the canonical solution
- Byzantine faults: typically `3f+1` with `2f+1` quorums (plus signatures)

**Important generalization:** some systems use **dynamic quorums** (e.g., “in-sync set”), which can weaken intersection unless guarded by rules (min size, no unclean election, etc.). That’s not “wrong”—it’s a different refinement contract.

---

## 4.2 Authority geometry (epochs/terms/views): one writer, enforceably
**Question:** when multiple leaders exist due to partitions, who is authoritative?

Epochs are not just labels—they are **fencing**:

- Authority is versioned by **LeaderEpoch**
- Nodes reject actions from stale epochs
- Clients/servers must ensure old leaders cannot keep mutating reality (fencing tokens, leases, signatures, etc.)

If authority is not enforceable, you don’t have a safety story, only luck.

---

## 4.3 The Coupling Law (sets × epochs): why quorum counting alone can be wrong
This is the generalized “Figure 8” phenomenon:

> Set-based replication evidence is not sufficient once you allow epoch transitions and truncation.

**Coupling requirement**
A commit certificate must remain valid **under the authority regime that will preserve it**.

Equivalently:
- The committed trunk must be monotone not only in `Index`, but in **(LeaderEpoch, Index)** (and across `ConfigEpoch` during reconfiguration).

This is why some protocols require “anchor the current epoch” before older-epoch entries can be considered irrevocable: they are ensuring the trunk can’t later be replaced by a different authoritative branch.

---

## 4.4 Resource geometry (history): retention, snapshots, and trim correctness
**Question:** how do we bound history without breaking recovery?

Two families:
- **Snapshot-based:** state machine is the product; snapshots let you advance `T` safely
- **Retention-based / history-as-product:** the history is the product; trimming loses information by design

**Safe trim requires a trim certificate** that aligns with your recovery story:
- If recovery relies on replay, you cannot trim what lagging nodes still need
- If recovery uses snapshot install, you must guarantee snapshots exist and are transferable

---

## 4.5 Observation geometry (client illusion): what reads/writes mean
The commit frontier answers “what is stable,” but clients ask “what can I observe?”

**Read/write contract matrix**
For every API, specify:
1) where it executes (leader/follower/quorum/local)
2) which frontier it consults (`C`, `Aᵣ`, causal frontier, lease)
3) what certificate supports it
4) what consistency it provides (linearizable/sequential/causal/eventual/bounded-stale)

**Linearizable reads** require more than “read from leader” in general:
- you must also ensure the leader’s authority is current (lease/quorum barrier)
- and the read is ordered against the committed trunk

---

# Part V — Scaling, Composition, and “Where consensus is actually needed”

## 5.1 Space/Ownership geometry: shards + control plane
Once you shard:
- you have **many history objects**
- cross-shard invariants are no longer “free”

You need:
- a **ShardMap** (keyspace → group) that is authoritative and versioned
- a **control plane history** (metadata is itself a replicated state machine)

A huge class of production failures is “data plane is correct, control plane isn’t.”

---

## 5.2 Membership geometry: configuration epochs and safe reconfiguration
Membership changes are time-varying set geometry:

- version membership with **ConfigEpoch**
- require **intersection across configuration transitions** (joint consensus / overlap)

Unsafe reconfig allows two disjoint configurations to each obtain “valid” commit certificates for conflicting histories.

---

## 5.3 Causality geometry + CALM: total order vs merge, coordination cuts
**Key system design question**
> Do you need a total order, or can you accept partial order + merge semantics?

**CALM lens**
- **Monotone invariants** can often be computed without coordination (DAG + merge)
- **Non-monotone invariants** (uniqueness, “exactly once,” constraints) require coordination somewhere

Architecturally: use strong Line+certificates only at the non-monotone “cuts.”

---

## 5.4 Composition geometry: transactions and externalization
### Multi-domain atomicity (transactions)
Cross-shard operations require an additional decision layer:
- 2PC over replicated participants, or
- replicated transaction decisions, or
- sagas/compensation if you weaken the spec

This adds new certificates (transaction commit/abort) and new liveness hazards (blocking).

### Externalization (effects outside the history)
The “zombie side effect” problem is universal:
- old authorities replaying/re-emitting effects

Solutions are **externalization certificates**:
- outbox/inbox patterns
- idempotency keys (dedupe)
- fencing tokens enforced by the external system

“Exactly-once” is not magic; it’s **identity + dedupe + fencing + a committed trunk**.

---

## 5.5 Failure geometry (fault model) as a first-class axis
Different fault models change required certificate strength:
- crash-stop vs crash-recovery (stable storage assumptions)
- Byzantine (signatures, larger quorums)
- correlated failures / rack awareness (what does “independent” mean?)

“Durable” is not a property of a byte; it’s part of the refinement contract.

---

# Part VI — Liveness and Synchrony (progress is conditional)

## 6.1 FLP reality (why liveness must assume timing)
In a fully asynchronous network with failures, deterministic consensus termination can’t be guaranteed (FLP).

So real systems assume **partial synchrony**:
- eventually, delays are bounded “long enough”
- failure detectors become “eventually accurate”

## 6.2 Progress conditions (what must become true for `C` to advance)
Progress requires:
- stable authority (leader/epoch stops flapping)
- quorum reachability under the fault model
- resources: disk space, bounded lag vs trim, snapshot availability
- overload control (backpressure); otherwise you get “liveness collapse” via self-inflicted timeouts

**Meta-law**
> Liveness is the ability to keep gathering certificates.

---

# Part VII — The Complete Reasoning Framework

## 7.1 Unified checklist (covers line systems, DAG systems, and hybrids)
### Foundation
1) **Specification:** what abstract object, what observations, what invariants?  
2) **History shape:** Line, DAG, or hybrid; what is “truth”?  
3) **Fault + timing model:** crash/byz? storage? partial synchrony assumptions?

### Core mechanics (per history object / per shard)
4) **Authority:** how is the writer chosen and fenced?  
5) **Commit:** what certificate makes history irreversible?  
6) **Coupling:** why can’t epoch transitions break commit (Figure-8 class)?  
7) **Boundaries:** define `E, D, A, C, T` (+ any stable frontiers), and invariants.  
8) **Materialization & trim:** replay vs snapshot; how does `T` advance safely?

### Scale & composition
9) **Ownership/sharding:** keyspace → groups; versioned mapping; control plane history.  
10) **Membership:** configuration epochs; safe transition rule.  
11) **Composition:** transactions and externalization; what certificates prevent duplicates/zombies?  
12) **Coordination cuts (CALM):** where is total order/consensus truly required?

### Interface
13) **Observation contracts:** per API, where it executes, what frontier it consults, what consistency it guarantees.  
14) **Delivery semantics:** at-most/least/effectively-once; identity/dedupe/fencing story.

### Liveness
15) **Progress assumptions:** under what conditions do authority + commit certificates keep forming?

---

## 7.2 Failure-mode → violated framework component mapping
| Bug class | What broke | Framework diagnosis |
|---|---|---|
| Phantom commit (ack then vanishes) | commit certificate wasn’t valid under authority coupling | sets×epochs coupling violated |
| Split brain | overlapping/unenforced authority certificates | fencing/authority regime failure |
| Resurrected history | old branch treated as trunk | trunk monotonicity violated |
| Zombie side effects | externalization not fenced/idempotent | missing externalization certificate |
| Read anomaly | read certificate weaker than claimed | observation contract mismatch |
| Data loss after “durable ack” | durability semantics didn’t match certificate | `D` frontier not actually advanced |
| Trim cliff | requester behind `T` without snapshot path | resource geometry violation |
| Reconfig split brain | config epochs without joint intersection | membership geometry broken |
| No progress / election storms | failure detector + overload destabilize authority | synchrony/liveness conditions violated |

---

## One-sentence summary (“the physics law”)
A distributed system is a machine that **constructs, commits, materializes, trims, composes, and exposes a history**—backed by **certificates**—under an explicit **fault + timing model**, to refine a chosen abstract specification.

If you want, the next improvement is to turn this into a *single formal page* of definitions (history object, coordinates, boundary lattice, certificate validity) plus 3 canonical traces that *force* the coupling law, trim law, and externalization fencing law. That page becomes the book’s “periodic table.”
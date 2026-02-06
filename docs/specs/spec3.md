# Trace Visualization Architecture
## Grounded in "The Complete Physics of Distributed Systems"

---

## 0. Design Principle

The visualization system is **not a diagramming tool**. It is:

> A set of **views** over an **executable trace**, where every visual element maps 1:1 to an object in the framework's ontology.

Nothing gets drawn that doesn't have a name in the Model.
Nothing in the Model gets omitted from the visual grammar.

---

## 1. Ontology → Data Model

Every object in the framework becomes a type in the trace format. This section is the single source of truth for "what exists."

### 1.1 Foundation Objects

These are the context that frames every trace. They don't change step-to-step — they're declared once per scenario.

| Framework Concept | Model Section | Data Object | Fields |
|---|---|---|---|
| Abstract specification | §1.1 Spec Refinement | `Spec` | `type`, `consistency_model`, `invariants[]`, `observations[]` |
| Fault + timing model | §1.4 Environment Contract | `Environment` | `fault_model` (crash-stop / crash-recovery / byzantine), `storage_model`, `network_model`, `timing_model` |
| History shape | §2.1 History Shape Axis | `HistoryShape` | `shape` (line / dag / hybrid), `conflict_resolution` |
| Replica set | §5.1-5.2 Space/Membership | `ReplicaSet` | `replicas[]`, `config_epoch`, `shard_id` |

**Why these matter for visualization:**
- `Spec` determines what counts as a violation (the illusion we're trying to sell).
- `Environment` determines what certificates are *valid* (crash-recovery needs durable storage; byzantine needs signatures).
- `HistoryShape` determines the primary view mode (pipeline lanes for Line; DAG view for DAG).
- `ReplicaSet` determines the visual topology (how many lanes, membership changes).

### 1.2 Per-Replica State (the Boundary Lattice)

This is the core of every frame. From §2.5:

| Boundary | Model Definition | Semantics |
|---|---|---|
| `E` (End/Append) | Last index this replica has any bytes for | "I've received this much" |
| `D` (Durable) | Last index safely persisted (fsync) | "I can survive a crash up to here" |
| `A` (Applied) | Last index applied to state machine | "My state reflects this much" |
| `C` (Commit) | End of committed trunk (cluster-wide) | "This much is irreversible" |
| `T` (Trim) | First index still in log | "History before this is gone" |

**Lattice invariants** (from §2.5, these are what we CHECK every step):
- `T ≤ C` (can't trim uncommitted)
- `D_r ≤ E_r` (can't durably store what you haven't received)
- `A_r ≤ E_r` (can't apply what you haven't received)
- If spec says "ack ⇒ durable": ack only when `D_r` advanced on quorum
- If spec says "apply only committed": `A_r ≤ C`

**Data structure per replica per step:**

```
ReplicaState {
  id:             string          // "R1", "R2", etc.
  epoch:          EpochCoord      // (config_epoch, leader_epoch)
  boundaries: {
    T:            int
    D:            int
    A:            int
    C:            int
    E:            int
  }
  log:            LogEntry[]      // entries currently in this replica's log
  role:           leader | follower | candidate | offline
  flags:          crashed | recovered | partitioned | none
}
```

### 1.3 Coordinates (where every entry lives)

From §2.3 — a log index alone is never enough:

```
Coordinate {
  shard:          string          // which consensus group
  config_epoch:   int             // which membership configuration
  leader_epoch:   int             // which authority era
  index:          int             // position within that era
}
```

```
LogEntry {
  coord:          Coordinate
  value:          any             // the operation payload
  origin_leader:  string          // who appended it
}
```

**Lexicographic ordering** (from §2.3):
`(config_epoch, leader_epoch, index)` — this is what determines "more up to date."

### 1.4 History Tree (the thing that actually exists during failures)

From §2.2 — even "line" systems produce a tree during partitions:

```
HistoryTree {
  committed_trunk:  LogEntry[]    // prefix that all futures must preserve
  branches: [                     // speculative suffixes
    {
      branch_id:    string
      epoch:        EpochCoord
      entries:      LogEntry[]
      status:       active | pruned
    }
  ]
}
```

This is critical because the Figure-8 scenario is *about* competing branches. The pipeline view must show branches, not just a single line.

### 1.5 Certificates (proof objects)

From §3.2 — the 6 certificate types:

```
Certificate {
  type:           authority | commit | read | trim | externalization | transaction
  epoch:          EpochCoord      // authority context
  issued_by:      string          // which node created it
  evidence: {
    quorum:       string[]        // which replicas contributed
    boundary:     string          // which boundary this justifies moving
    from:         int             // boundary value before
    to:           int             // boundary value after
  }
  valid:          bool            // does this certificate hold under the environment?
  detail:         string          // human-readable explanation
}
```

**The certificate principle** (§3.1): every boundary movement must point at a certificate. If a boundary moves without one, that's a visualization-level warning.

### 1.6 Messages

From §1.2 — the happens-before substrate:

```
Message {
  from:           string
  to:             string
  type:           request | replication | ack | vote | heartbeat | snapshot
  payload:        string          // human-readable label
  epoch:          EpochCoord      // authority context of sender
  delivered:      bool            // false = in-flight or dropped
}
```

### 1.7 Geometry Tags

From §4.1–4.5 + §5.1–5.5 — every step is "about" one or more geometries:

```
enum Geometry {
  // Core (Part IV)
  safety          // §4.1 — quorum intersection, commit rules
  authority       // §4.2 — epochs, fencing, leadership
  coupling        // §4.3 — sets × epochs (the coupling law)
  resource        // §4.4 — retention, snapshots, trim
  observation     // §4.5 — read/write contracts, client illusion

  // Extended (Part V)
  ownership       // §5.1 — sharding, shard maps
  membership      // §5.2 — config epochs, reconfiguration
  causality       // §5.3 — DAG, CALM, coordination cuts
  composition     // §5.4 — transactions, externalization
  failure         // §5.5 — fault model as first-class axis

  // Liveness (Part VI)
  liveness        // §6.1-6.2 — FLP, progress conditions
}
```

### 1.8 Violations (when invariants break)

From §7.2 — the failure-mode → framework mapping:

```
Violation {
  type:           Geometry        // which geometry broke
  law:            string          // the specific invariant
  detail:         string          // what happened
  framework_ref:  string          // "§4.3 Coupling Law"
  bug_class:      string          // from §7.2 table: phantom_commit | split_brain | ...
}
```

The §7.2 bug classes, each needing at least one scenario:

| Bug Class | Framework Diagnosis | Geometry |
|---|---|---|
| `phantom_commit` | commit cert invalid under authority coupling | coupling |
| `split_brain` | overlapping authority certificates | authority |
| `resurrected_history` | old branch treated as trunk | coupling |
| `zombie_side_effect` | externalization not fenced | composition |
| `read_anomaly` | read cert weaker than claimed | observation |
| `data_loss_after_ack` | D frontier not actually advanced | failure |
| `trim_cliff` | requester behind T without snapshot path | resource |
| `reconfig_split_brain` | config epochs without joint intersection | membership |
| `election_storm` | failure detector + overload destabilize authority | liveness |

---

## 2. Canonical Trace Format

A trace is a scenario: one run of one protocol under specific conditions.

```
Trace {
  // ── Scenario metadata ──
  id:               string
  title:            string
  description:      string
  framework_refs:   string[]          // ["§4.3", "§7.2 phantom_commit"]

  // ── Foundation (set once) ──
  spec:             Spec
  environment:      Environment
  history_shape:    HistoryShape
  initial_replicas: ReplicaSet

  // ── The trace itself ──
  steps:            Step[]
}

Step {
  id:               int
  event:            string            // short: "R1 appends X at idx 1"
  narration:        string            // longer: explains WHY this matters

  // ── State snapshot ──
  replicas:         Map<string, ReplicaState>
  history_tree:     HistoryTree       // optional: when branches matter

  // ── What happened this step ──
  messages:         Message[]
  certificates:     Certificate[]
  boundaries_moved: BoundaryMovement[]

  // ── Framework annotations ──
  geometry_active:  Geometry[]        // which geometries are "in play"
  invariants_ok:    bool
  violation:        Violation | null  // if invariants_ok == false
  invariants_checked: InvariantCheck[] // which invariants were verified
}

BoundaryMovement {
  replica:          string
  boundary:         T | D | A | C | E
  from:             int
  to:               int
  justified_by:     Certificate | null  // the certificate principle
}

InvariantCheck {
  invariant:        string            // "T ≤ C", "D_r ≤ E_r", etc.
  holds:            bool
  detail:           string            // if violated, explain
}
```

---

## 3. Scenario Catalog

Each scenario is a trace that **teaches one or more framework concepts** by showing them in action. Organized by the §7.1 checklist.

### Tier 1: Core Mechanics (must have — these teach the fundamental laws)

| # | Scenario | Framework Sections | Geometries | Bug Class Shown |
|---|---|---|---|---|
| 1 | **Happy path: write → replicate → commit → read** | §2.1-2.5, §3.2, §4.1, §4.5 | safety, observation | (none — baseline) |
| 2 | **Figure-8: epoch×quorum coupling violation** | §4.3, §7.2 | coupling, authority, safety | phantom_commit, resurrected_history |
| 3 | **Split brain: two leaders, same epoch** | §4.2, §7.2 | authority, failure | split_brain |
| 4 | **Trim cliff: lagging replica falls behind T** | §2.5, §4.4, §7.2 | resource | trim_cliff |
| 5 | **Snapshot install: recovering past the cliff** | §4.4 | resource | (fix for trim_cliff) |
| 6 | **Stale read: follower read vs linearizable read** | §4.5, §3.2 read cert | observation | read_anomaly |

### Tier 2: Extended Mechanics (important — composition and scale)

| # | Scenario | Framework Sections | Geometries | Bug Class Shown |
|---|---|---|---|---|
| 7 | **Zombie side effect: old leader emits payment** | §5.4 externalization | composition | zombie_side_effect |
| 8 | **Unsafe reconfig: disjoint quorums** | §5.2, §7.2 | membership | reconfig_split_brain |
| 9 | **Safe reconfig: joint consensus** | §5.2 | membership | (fix for #8) |
| 10 | **Election storm: liveness collapse under overload** | §6.1-6.2 | liveness | election_storm |
| 11 | **Cross-shard transaction: 2PC over replicated groups** | §5.4 transactions | composition, ownership | (shows txn certs) |
| 12 | **Data loss after ack: fsync lie** | §1.4, §5.5 | failure | data_loss_after_ack |

### Tier 3: DAG / CRDT Region (if we extend beyond Line systems)

| # | Scenario | Framework Sections | Geometries |
|---|---|---|---|
| 13 | **CRDT convergence: concurrent adds, eventual merge** | §2.1 DAG, §5.3 CALM | causality |
| 14 | **Coordination cut: where consensus is actually needed** | §5.3 CALM | causality, safety |

### Scenario Dependencies (learning order)

```
1 (happy path)
├── 2 (Figure-8)     ← needs: commit, epoch, quorum from #1
├── 3 (split brain)  ← needs: authority from #1
├── 4 (trim cliff)   ← needs: boundaries from #1
│   └── 5 (snapshot) ← needs: trim cliff from #4
├── 6 (stale read)   ← needs: commit frontier from #1
├── 7 (zombie)       ← needs: epoch, commit from #1
├── 10 (elections)   ← needs: authority from #1
└── 12 (fsync lie)   ← needs: durable boundary from #1

8 (unsafe reconfig)  ← needs: quorum from #1
└── 9 (safe reconfig) ← needs: #8

11 (cross-shard txn) ← needs: commit from #1, ownership concept
```

---

## 4. Visual Grammar → Framework Mapping

Every visual element maps to exactly one framework concept. No decorative elements.

### 4.1 Primary View: History Pipeline (for Line systems)

**What it shows:** The boundary lattice per replica, per step.

| Visual Element | Framework Object | Encoding |
|---|---|---|
| Horizontal lane | Replica | One row per replica |
| Green region `[T..C]` | Committed trunk (§2.2) | Filled green band |
| Yellow region `[C..E]` | Wet cement (§2.2) | Filled amber band |
| Hatched region `[0..T]` | Trimmed history (§2.5) | Grey diagonal hatch |
| Boundary markers on lane | T, D, A, C, E (§2.5) | Colored ticks/lines with labels |
| Entry boxes in lane | LogEntry with Coordinate | Box showing value + epoch |
| Red-hatched region | Invariant violation zone | Danger pattern |
| Epoch color band | LeaderEpoch (§2.3) | Background tint on lane |
| Role badge (LEADER, etc) | Authority (§4.2) | Label on replica |
| Status badge (CRASHED, etc) | Fault model event (§1.4) | Label on replica, opacity change |

**Lattice invariant checking** (visual):
- If `A_r > E_r` → red warning on A marker
- If `T > C` → red warning on both
- If `D_r > E_r` → red warning on D marker
- These are not cosmetic — they're the §2.5 invariants rendered as visual assertions.

### 4.2 Secondary View: History Tree (when branches matter)

**What it shows:** The tree structure from §2.2 — committed trunk + speculative branches.

| Visual Element | Framework Object | Encoding |
|---|---|---|
| Main horizontal line | Committed trunk | Solid green line with entry boxes |
| Branching lines | Speculative branches | Dashed lines, colored by epoch |
| Branch labels | (LeaderEpoch, Index) | Coordinate shown at branch point |
| Pruning animation | Truncation / branch pruning | Branch fades out / gets crossed |

**When to show this view:** Scenarios 2 (Figure-8), 3 (split brain), 8 (unsafe reconfig) — anywhere branches are the point.

### 4.3 Certificate Ledger

**What it shows:** Which certificates were issued, and which boundary movements they justify.

| Visual Element | Framework Object | Encoding |
|---|---|---|
| Certificate card | Certificate (§3.2) | Colored card: type label + detail |
| Color by type | Certificate taxonomy | authority=purple, commit=green, read=pink, trim=cyan, extern=orange, txn=indigo |
| Boundary movement pill | BoundaryMovement | "R1.C: 0→1" with color of boundary |
| "Justified by" link | Certificate principle (§3.1) | Arrow or visual connection: movement → cert |
| Missing cert warning | §3.1 violation | ⚠ on boundary movement without cert |

### 4.4 Message Sequence

**What it shows:** The happens-before substrate (§1.2).

| Visual Element | Framework Object | Encoding |
|---|---|---|
| Vertical lanes | Processes (replicas + clients) | Columns |
| Arrows between lanes | Messages | Colored by type |
| Epoch annotations | Authority context of message | Small label on arrow |
| Dropped message | Network fault | Dashed arrow with ✕ |

### 4.5 Geometry Indicator Bar

**What it shows:** Which of the framework's geometries are "active" in the current step.

| Visual Element | Framework Object | Encoding |
|---|---|---|
| Colored chip per geometry | §4.1-4.5, §5.1-5.5, §6 | Lit up = active, dimmed = inactive |
| Active geometry description | The "Question" each geometry answers | Tooltip or subtitle |

### 4.6 Violation Banner

**What it shows:** When an invariant is violated (§7.2).

| Visual Element | Framework Object | Encoding |
|---|---|---|
| Red banner | Violation object | Always visible when invariants_ok=false |
| Law name | The specific invariant that broke | Header |
| Detail | What happened | Body text |
| Framework reference | §X.Y link | Footer |
| Bug class | §7.2 mapping | Tag |

### 4.7 Invariant Checklist (optional detail panel)

**What it shows:** Every invariant checked at this step, pass/fail.

| Invariant | Status | Detail |
|---|---|---|
| `T ≤ C` | ✓ | 0 ≤ 1 |
| `D_r ≤ E_r` for R1 | ✓ | 0 ≤ 1 |
| Trunk monotone in (epoch, idx) | ✗ | X@(e=1,i=1) vs Y@(e=2,i=1) |

---

## 5. Generator Architecture

### 5.1 Data Flow

```
[Trace Source]           [Trace JSON]          [Views]
                  
TLA+ model checker  ─┐                    ┌─ History Pipeline (HTML/React)
                     ├──→  Canonical   ──→ ├─ History Tree (SVG/React)
Protocol simulator  ─┤     Trace JSON      ├─ Certificate Ledger (table)
                     │                     ├─ Message Sequence (Mermaid or React)
Real system logs    ─┘                     ├─ Geometry Bar
                                           ├─ Violation Banner
                                           └─ Invariant Checklist
```

### 5.2 Generator Responsibilities

The generator is a **pure function**: `Trace → View[]`. It does NOT:
- Simulate anything (traces come from outside)
- Make layout decisions ad hoc (grammar is fixed)
- Draw anything manually (everything is data-driven)

It DOES:
- **Validate** the trace against lattice invariants at every step
- **Diff** consecutive steps to determine what changed (for animation/highlighting)
- **Select** interesting frames (where boundaries move, certs are issued, violations occur)
- **Render** each frame using the fixed visual grammar
- **Cross-reference** every visual element to framework sections

### 5.3 Frame Selection Rules

Not every step needs a frame. Emit a frame when:

| Condition | Why it's interesting |
|---|---|
| C moves | Commitment happened — safety geometry in action |
| T moves | Trim happened — resource geometry in action |
| Epoch changes | Authority changed — authority geometry |
| Certificate issued | Proof object created — certificate principle |
| invariants_ok flips to false | Violation — the teachable moment |
| invariants_ok flips to true | Fix — resolution of violation |
| Replica crashes/recovers | Fault model event |
| Client-visible event (read/write response) | Observation geometry |
| Branch created or pruned | History tree changes |
| External side effect | Externalization/composition geometry |

### 5.4 Step Diffing

For highlighting and animation, the generator computes per-step diffs:

```
StepDiff {
  boundaries_changed:   { replica, boundary, old, new }[]
  entries_added:        { replica, entry }[]
  entries_removed:      { replica, entry }[]     // truncation
  epoch_changed:        { replica, old, new }[]
  role_changed:         { replica, old, new }[]
  flags_changed:        { replica, old, new }[]
  certs_issued:         Certificate[]
  violation_appeared:   bool
  violation_resolved:   bool
}
```

Changed elements get visual emphasis (glow, pulse, border). Unchanged elements stay muted.

---

## 6. Cross-Reference System

Every visual element carries a framework reference. This serves two purposes:
1. **Learning:** clicking/hovering any element tells you which framework concept it represents
2. **Validation:** we can verify coverage — every framework section has at least one scenario that exercises it

### 6.1 Reference Index

```
FrameworkRef {
  section:    string        // "§4.3"
  title:      string        // "The Coupling Law"
  question:   string        // "Why can't epoch transitions break commit?"
}
```

### 6.2 Coverage Matrix

| Framework Section | Concept | Scenarios That Exercise It |
|---|---|---|
| §1.1 | Spec refinement | All (every trace declares a spec) |
| §1.4 | Fault model | 3, 10, 12 |
| §2.2 | History tree / trunk | 2, 3 |
| §2.3 | Coordinates | 2 (epoch ordering is the point) |
| §2.5 | Boundary lattice | 1, 4, 5 |
| §3.1 | Certificate principle | All (every cert is shown) |
| §3.2 | Certificate taxonomy | 1 (commit), 2 (authority+commit), 6 (read), 4-5 (trim), 7 (extern), 11 (txn) |
| §4.1 | Safety geometry | 1, 2 |
| §4.2 | Authority geometry | 2, 3, 10 |
| §4.3 | Coupling law | 2 (primary), 8 |
| §4.4 | Resource geometry | 4, 5 |
| §4.5 | Observation geometry | 6 |
| §5.1 | Ownership/sharding | 11 |
| §5.2 | Membership | 8, 9 |
| §5.3 | Causality/CALM | 13, 14 |
| §5.4 | Composition | 7 (extern), 11 (txn) |
| §5.5 | Failure geometry | 12 |
| §6.1-6.2 | Liveness | 10 |
| §7.2 | Bug class mapping | 2-12 (one scenario per bug class) |

---

## 7. Implementation Plan

### Phase 1: Core Engine + Happy Path
- Define JSON schema for Trace format (validate with JSON Schema)
- Build trace validator (checks lattice invariants at every step)
- Build React renderer for: History Pipeline, Certificate Ledger, Geometry Bar
- Implement Scenario 1 (happy path) as first trace
- Step navigation with keyboard + progress bar

### Phase 2: The Coupling Law (the framework's hardest concept)
- Add History Tree view (branching visualization)
- Add Violation Banner + Invariant Checklist
- Implement Scenario 2 (Figure-8)
- Implement Scenario 3 (split brain)
- Step diffing + change highlighting

### Phase 3: Resource + Observation
- Implement Scenarios 4-5 (trim cliff + snapshot)
- Implement Scenario 6 (stale read)
- Add read certificate visualization
- Add the "cliff" visual (replica falling off the edge of retained history)

### Phase 4: Composition + Extended
- Implement Scenario 7 (zombie side effect)
- Implement Scenarios 8-9 (reconfig)
- Add externalization certificate visualization
- Add multi-shard view (Scenario 11)

### Phase 5: Liveness + DAG
- Implement Scenario 10 (election storm)
- Implement Scenario 12 (fsync lie)
- Add timeline/sequence view for message patterns
- Optional: DAG view for Scenarios 13-14

### Phase 6: Trace Sources
- Build a minimal protocol simulator that emits traces
- TLA+ trace export adapter
- Real system log adapter

---

## 8. Open Questions

1. **Interactivity level:** Step-through only? Or allow "what-if" branching (change a message delivery, see different outcome)?

2. **Comparison mode:** Show two traces side-by-side (correct protocol vs buggy protocol)?

3. **Zoom levels:** 
   - High: scenario overview (which boundaries moved when, which certs issued)
   - Mid: step-by-step (current prototype level)
   - Low: message-level sequence diagram

4. **DAG systems:** The visual grammar above is Line-centric. DAG systems need a fundamentally different primary view (graph, not pipeline). Defer or design now?

5. **Multi-shard:** Scenario 11 needs a way to show multiple consensus groups side by side. How does the pipeline view extend?

6. **Animation vs static:** Animated transitions between steps, or static frames with manual navigation? (Animations help show "what changed" but add complexity.)
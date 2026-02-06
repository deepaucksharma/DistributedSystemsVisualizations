# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive trace-based visualizations for "The Complete Physics of Distributed Systems" framework. This is **not** a generic visualization library — every visual element maps 1:1 to a concept in the framework's ontology (specs, histories, boundaries, certificates, geometries).

The parent repo (`../`) also contains static SVG diagrams in `../Diagrams-2/`. This `Visualizations/` directory focuses on the **interactive React trace viewer**.

## Architecture

### Core Design Principle
**Data is primary, visuals are views on data.** The system follows: `Trace JSON → React Viewer → Interactive Storyboard`. No manual diagram updates — traces drive everything.

### Current State
- `sample-trace-visualizer.jsx` — Single-file React component implementing the trace viewer with an embedded Figure-8 scenario trace. No build system, package.json, or framework scaffolding yet.
- `docs/` — Framework reference documents and architectural specs.

### Key Data Model (defined in docs/specs/spec1.md)
- **Trace**: Top-level object with metadata (spec, failure model, history shape) and an array of Steps
- **Step**: One frame in the storyboard — contains replica states, messages, certificates, boundary movements, violations, and geometry highlights
- **ReplicaState**: Boundaries (T/D/A/C/E), epoch, log entries, role/status flags
- **LogEntry**: `{idx, val, epoch}` — the (Epoch, Index) coordinate is critical for coupling law
- **Certificate**: One of 6 types (authority, commit, read, trim, externalization, transaction)
- **Violation**: Links to framework section refs (e.g., "§4.3 Coupling Law")

### Framework Ontology (from docs/MainReference1.md and MainReference2.md)
The framework defines 6 "geometries" — each a distinct axis of reasoning:
- **Safety** (§4.1): Quorum intersection, commit rules
- **Authority** (§4.2): Epochs/terms, fencing, leadership
- **Coupling** (§4.3): Sets × Epochs — the Figure-8 problem (hardest concept)
- **Resource** (§4.4): Retention, snapshots, trim cliff
- **Observation** (§4.5): Read/write contracts, consistency levels
- **Failure** (§5.5): Crash-stop vs crash-recovery vs Byzantine

The **boundary lattice** invariants (`T ≤ C`, `D_r ≤ E_r`, `A_r ≤ E_r`) must be checked/preserved at every step.

### Scenario Catalog (from docs/specs/spec2.md)
14 planned scenarios organized in tiers:
- **Tier 1** (core): Happy path, Figure-8, split brain, trim cliff, snapshot install, stale read
- **Tier 2** (extended): Zombie side effect, unsafe/safe reconfig, election storm, cross-shard txn, fsync lie
- **Tier 3** (DAG/CRDT): CRDT convergence, coordination cuts

Only the Figure-8 scenario is currently implemented (embedded in `sample-trace-visualizer.jsx`).

### React Components (in sample-trace-visualizer.jsx)
- `DistributedSystemsTraceVisualizer` — Main app: step navigation, keyboard controls (arrow keys), layout
- `BoundaryLattice` — Per-replica pipeline bar showing T/D/A/C/E markers, committed trunk (green), wet cement (amber), trimmed region (hatched), log entries with epoch labels
- `CertificateCard` — Renders certificate with type-colored badge
- `MessageArrow` — From→To message display with type coloring
- `ViolationBanner` — Red banner for invariant violations with framework references
- `GeometryBar` — Highlights which geometry axis is active per step
- `BoundaryLegend` — Legend for T/D/A/C/E boundaries

## Development Notes

- The JSX file uses React hooks (useState, useMemo, useCallback) and inline styles throughout — no CSS files
- Color scheme: dark theme (#0f172a background), monospace fonts (JetBrains Mono/Fira Code)
- Trace data is currently hardcoded; the architecture spec (docs/specs/spec1.md) defines the canonical JSON trace format for external trace loading
- When adding new scenarios, follow the `FIGURE_8_TRACE` structure — each step must include all replica states, not just deltas
- The `boundaries_moved` field should be auto-derived from step diffs (currently hand-authored)
- `invariants_ok: false` triggers violation display; always include a `violation` object with `framework_ref` when this is set

## Docs Structure
- `docs/MainReference1.md` — Framework v1: foundational theory (specs, histories, boundaries, certificates, geometries)
- `docs/MainReference2.md` — Framework v2 (enhanced): same concepts with tighter coupling law treatment and determinism geometry
- `docs/specs/spec1.md` — Visualization system architecture: data model, scenario model, visual grammar, generator pipeline
- `docs/specs/spec2.md` — Detailed visual grammar spec: ontology→data mapping, scenario catalog with dependencies, coverage matrix, implementation phases
- `docs/specs/spec3.md` — Detailed visual grammar spec: ontology→data model types (ReplicaState, Coordinate, HistoryTree, Certificate, Message, Violation), canonical trace format, scenario catalog with tiers and learning-order dependencies, visual element→framework mapping tables, generator architecture (data flow, diffing, frame selection), cross-reference/coverage matrix, and phased implementation plan

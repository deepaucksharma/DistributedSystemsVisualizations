import type { Trace, Step, BoundaryMove, BoundaryKey, GeometryKey } from '../types/trace';
import { checkInvariants } from './validator';

const BOUNDARIES: BoundaryKey[] = ['T', 'D', 'A', 'C', 'E'];

/**
 * Auto-derive boundaries_moved by diffing consecutive steps.
 */
function deriveBoundaryMoves(prev: Step, curr: Step): BoundaryMove[] {
  const moves: BoundaryMove[] = [];
  const allReplicas = new Set([
    ...Object.keys(prev.replicas),
    ...Object.keys(curr.replicas),
  ]);

  for (const replicaId of allReplicas) {
    const prevR = prev.replicas[replicaId];
    const currR = curr.replicas[replicaId];
    if (!prevR || !currR) continue;

    for (const b of BOUNDARIES) {
      if (prevR[b] !== currR[b]) {
        moves.push({
          replica: replicaId,
          boundary: b,
          from: prevR[b],
          to: currR[b],
        });
      }
    }
  }

  return moves;
}

/**
 * Infer geometry_highlight from step content when not explicitly set.
 *
 * Heuristics (ordered by specificity):
 * - violation present → coupling (or violation.type if it maps to a geometry)
 * - controlPlane changed → membership
 * - multi-shard activity → ownership
 * - C moved → safety
 * - epoch changed → authority
 * - crash/recovery → failure
 * - T moved → resource
 * - observation present → observation
 * - externalization/txn certs → composition
 */
function inferGeometryHighlight(
  step: Step,
  prevStep: Step | null,
  derivedMoves: BoundaryMove[]
): GeometryKey | null {
  // Violation → use violation type as geometry if it's a valid geometry key
  if (step.violation) {
    const vtype = step.violation.type as GeometryKey;
    const validGeometries: GeometryKey[] = [
      'safety', 'authority', 'coupling', 'resource', 'observation',
      'ownership', 'membership', 'causality', 'composition', 'failure', 'liveness',
    ];
    if (validGeometries.includes(vtype)) return vtype;
    return 'coupling';
  }

  // Control plane present → membership or ownership
  if (step.controlPlane) {
    if (step.controlPlane.shardMap && step.controlPlane.shardMap.length > 0) return 'ownership';
    return 'membership';
  }

  // Check for externalization/transaction certs → composition
  for (const cert of step.certificates) {
    if (cert.type === 'externalization' || cert.type === 'transaction') return 'composition';
  }

  // Check what boundaries moved
  const movedBoundaries = new Set(derivedMoves.map((m) => m.boundary));

  // C moved → safety
  if (movedBoundaries.has('C')) return 'safety';

  // Epoch changed → authority
  if (prevStep) {
    for (const [rid, state] of Object.entries(step.replicas)) {
      const prev = prevStep.replicas[rid];
      if (prev && state.epoch !== prev.epoch) return 'authority';
    }
  }

  // Crash/recovery → failure
  for (const state of Object.values(step.replicas)) {
    if (state.crashed || state.recovered) return 'failure';
  }

  // T moved → resource
  if (movedBoundaries.has('T')) return 'resource';

  // Observations → observation
  if (step.observations && step.observations.length > 0) return 'observation';

  return null;
}

/**
 * Normalize a trace: auto-derive boundaries_moved, geometry_highlight,
 * and invariants_checked where not explicitly set.
 *
 * Explicit values in the trace JSON override auto-derivation.
 */
export function normalize(trace: Trace): Trace {
  const normalizedSteps = trace.steps.map((step, i) => {
    const prevStep = i > 0 ? trace.steps[i - 1] : null;

    // Auto-derive boundaries_moved if empty/missing
    let boundaries_moved = step.boundaries_moved;
    const derivedMoves = prevStep ? deriveBoundaryMoves(prevStep, step) : [];

    if (!boundaries_moved || boundaries_moved.length === 0) {
      boundaries_moved = derivedMoves;
    }

    // Auto-derive geometry_highlight if null/undefined
    let geometry_highlight = step.geometry_highlight;
    if (geometry_highlight === undefined || geometry_highlight === null) {
      geometry_highlight = inferGeometryHighlight(step, prevStep, derivedMoves);
    }

    // Auto-derive invariants_checked
    let invariants_checked = step.invariants_checked;
    if (!invariants_checked) {
      const isDag = trace.historyShape === 'dag';
      invariants_checked = checkInvariants(step, prevStep ?? undefined, isDag);
    }

    return {
      ...step,
      boundaries_moved,
      geometry_highlight,
      invariants_checked,
    };
  });

  return {
    ...trace,
    steps: normalizedSteps,
  };
}

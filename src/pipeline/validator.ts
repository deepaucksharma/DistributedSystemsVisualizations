import type { Step, InvariantCheck } from '../types/trace';

/**
 * Check CRDT-specific invariants for DAG-mode traces.
 * These replace the boundary lattice checks (which are vacuously true for CRDTs).
 */
function checkCrdtInvariants(step: Step, prevStep?: Step): InvariantCheck[] {
  const checks: InvariantCheck[] = [];

  // Monotonicity: CRDT sets only grow (elements are never removed)
  if (prevStep) {
    for (const [replicaId, currState] of Object.entries(step.replicas)) {
      const prevState = prevStep.replicas[replicaId];
      if (!prevState || currState.crashed) continue;

      const currCrdt = currState.crdtState as Record<string, unknown> | undefined;
      const prevCrdt = prevState.crdtState as Record<string, unknown> | undefined;
      if (!currCrdt || !prevCrdt) continue;

      // Check addSet monotonicity (G-Set: elements never removed)
      if (Array.isArray(prevCrdt.addSet) && Array.isArray(currCrdt.addSet)) {
        const prevSet = new Set(prevCrdt.addSet as string[]);
        const currSet = new Set(currCrdt.addSet as string[]);
        const removed = [...prevSet].filter((x) => !currSet.has(x));
        checks.push({
          invariant: `Set monotone (${replicaId})`,
          holds: removed.length === 0,
          detail: removed.length === 0
            ? `{${[...currSet].join(', ')}} ⊇ prev`
            : `VIOLATION: removed elements: {${removed.join(', ')}}`,
        });
      }

      // Check events monotonicity (coordination-cut style)
      if (Array.isArray(prevCrdt.events) && Array.isArray(currCrdt.events)) {
        const prevEvents = new Set(prevCrdt.events as string[]);
        const currEvents = new Set(currCrdt.events as string[]);
        const removed = [...prevEvents].filter((x) => !currEvents.has(x));
        checks.push({
          invariant: `Events monotone (${replicaId})`,
          holds: removed.length === 0,
          detail: removed.length === 0
            ? `${currEvents.size} events ⊇ prev ${prevEvents.size}`
            : `VIOLATION: removed events: {${removed.join(', ')}}`,
        });
      }

      // Vector clock monotonicity
      const currVC = currCrdt.vectorClock as Record<string, number> | undefined;
      const prevVC = prevCrdt.vectorClock as Record<string, number> | undefined;
      if (currVC && prevVC) {
        let vcMonotone = true;
        let detail = '';
        for (const [node, prevVal] of Object.entries(prevVC)) {
          const currVal = currVC[node] ?? 0;
          if (currVal < prevVal) {
            vcMonotone = false;
            detail = `${node}: ${prevVal} → ${currVal} (decreased)`;
            break;
          }
        }
        checks.push({
          invariant: `VC monotone (${replicaId})`,
          holds: vcMonotone,
          detail: vcMonotone
            ? `[${Object.entries(currVC).map(([k, v]) => `${k}:${v}`).join(', ')}]`
            : `VIOLATION: ${detail}`,
        });
      }
    }
  }

  // Convergence check: if no replicas are partitioned, all should have the same state
  const activeReplicas = Object.entries(step.replicas).filter(
    ([, s]) => !s.crashed && !s.partitioned
  );
  if (activeReplicas.length > 1) {
    const states = activeReplicas.map(([id, s]) => {
      const crdt = s.crdtState as Record<string, unknown> | undefined;
      if (!crdt) return { id, key: 'no-crdt' };
      const addSet = Array.isArray(crdt.addSet) ? [...(crdt.addSet as string[])].sort().join(',') : '';
      const events = Array.isArray(crdt.events) ? [...(crdt.events as string[])].sort().join(',') : '';
      return { id, key: addSet || events || JSON.stringify(crdt) };
    });
    const allSame = states.every((s) => s.key === states[0].key);
    const anyPartitioned = Object.values(step.replicas).some((s) => s.partitioned);
    if (!anyPartitioned) {
      checks.push({
        invariant: 'Convergence',
        holds: allSame,
        detail: allSame
          ? `All ${activeReplicas.length} active replicas agree`
          : `Diverged: ${states.map((s) => s.id).join(' vs ')} — may converge later`,
      });
    }
  }

  return checks;
}

/**
 * Check lattice invariants for a single step.
 * Returns an array of InvariantCheck results.
 *
 * Boundary lattice invariants (§2.5):
 * - T ≤ C (per replica: can't trim uncommitted)
 * - D_r ≤ E_r (per replica: can't persist what you haven't received)
 * - A_r ≤ E_r (per replica: can't apply what you haven't received)
 * - A_r ≤ C (per replica: can't apply uncommitted — "apply only committed" rule)
 *
 * Authority invariants (§4.2):
 * - At most one valid leader per (configEpoch, leaderEpoch)
 *
 * Coupling invariants (§4.3):
 * - Trunk monotonicity in (epoch, index) across steps
 */
export function checkInvariants(step: Step, prevStep?: Step, isDag?: boolean): InvariantCheck[] {
  if (isDag) {
    return checkCrdtInvariants(step, prevStep);
  }
  const checks: InvariantCheck[] = [];

  // Per-replica boundary lattice checks
  for (const [replicaId, state] of Object.entries(step.replicas)) {
    // Skip crashed replicas for boundary checks
    if (state.crashed) continue;

    // T ≤ C (can't trim uncommitted)
    checks.push({
      invariant: `T ≤ C (${replicaId})`,
      holds: state.T <= state.C,
      detail: state.T <= state.C
        ? `${state.T} ≤ ${state.C}`
        : `VIOLATION: T=${state.T} > C=${state.C} — trimmed beyond commit frontier`,
    });

    // D_r ≤ E_r (can't durably store what you haven't received)
    checks.push({
      invariant: `D ≤ E (${replicaId})`,
      holds: state.D <= state.E,
      detail: state.D <= state.E
        ? `${state.D} ≤ ${state.E}`
        : `VIOLATION: D=${state.D} > E=${state.E} — durable frontier beyond append frontier`,
    });

    // A_r ≤ E_r (can't apply what you haven't received)
    checks.push({
      invariant: `A ≤ E (${replicaId})`,
      holds: state.A <= state.E,
      detail: state.A <= state.E
        ? `${state.A} ≤ ${state.E}`
        : `VIOLATION: A=${state.A} > E=${state.E} — applied beyond append frontier`,
    });

    // A_r ≤ C (apply only committed entries — prevents exposing phantom state)
    checks.push({
      invariant: `A ≤ C (${replicaId})`,
      holds: state.A <= state.C,
      detail: state.A <= state.C
        ? `${state.A} ≤ ${state.C}`
        : `VIOLATION: A=${state.A} > C=${state.C} — applied uncommitted entries`,
    });

    // D_r ≤ C (committed entries must be durable — the "fsync contract")
    // Note: this checks that C never exceeds D on any individual replica.
    // A commit quorum requires D ≥ C on enough replicas, but per-replica
    // D < C means this replica claims committed data it can't back with durable storage.
    if (state.C > 0 && state.D < state.C && !state.crashed) {
      checks.push({
        invariant: `D ≥ C (${replicaId})`,
        holds: false,
        detail: `WARNING: D=${state.D} < C=${state.C} — committed entries not durable on this replica`,
      });
    }
  }

  // Authority uniqueness: at most one valid leader per (configEpoch, leaderEpoch)
  const leaders: Array<{ replica: string; epoch: number; configEpoch: number }> = [];
  for (const [replicaId, state] of Object.entries(step.replicas)) {
    if (state.leader && !state.crashed) {
      leaders.push({
        replica: replicaId,
        epoch: state.epoch,
        configEpoch: state.configEpoch ?? 0,
      });
    }
  }

  // Group leaders by (configEpoch, leaderEpoch)
  const leadersByEpoch = new Map<string, string[]>();
  for (const l of leaders) {
    const key = `${l.configEpoch}:${l.epoch}`;
    const group = leadersByEpoch.get(key) ?? [];
    group.push(l.replica);
    leadersByEpoch.set(key, group);
  }

  for (const [epochKey, replicas] of leadersByEpoch) {
    const unique = replicas.length <= 1;
    checks.push({
      invariant: `Authority uniqueness (epoch ${epochKey})`,
      holds: unique,
      detail: unique
        ? `Single leader: ${replicas[0]}`
        : `VIOLATION: Multiple leaders in epoch ${epochKey}: [${replicas.join(', ')}] — split brain`,
    });
  }

  // Also check: leaders across different epochs is allowed but flag if both are active (not partitioned)
  // with overlapping authority (same configEpoch, different leaderEpoch, both non-crashed/non-partitioned)
  if (leaders.length > 1) {
    const activeLeaders = leaders.filter((l) => {
      const state = step.replicas[l.replica];
      return !state.partitioned && !state.crashed;
    });
    if (activeLeaders.length > 1) {
      // Different epochs is OK if old leader hasn't been fenced yet — but we flag it as a warning
      const epochSet = new Set(activeLeaders.map((l) => l.epoch));
      if (epochSet.size > 1) {
        checks.push({
          invariant: 'Authority fencing',
          holds: false,
          detail: `WARNING: ${activeLeaders.length} active leaders across epochs [${[...epochSet].join(', ')}]: ${activeLeaders.map((l) => `${l.replica}(e=${l.epoch})`).join(', ')} — old leader not yet fenced`,
        });
      }
    }
  }

  // Trunk monotonicity check across steps (coupling law §4.3)
  if (prevStep) {
    for (const [replicaId, currState] of Object.entries(step.replicas)) {
      const prevState = prevStep.replicas[replicaId];
      if (!prevState || currState.crashed) continue;

      if (currState.C > prevState.C) {
        // Find entries on the committed trunk
        const currCommitted = currState.log.filter((e) => e.idx <= currState.C);
        const prevCommitted = prevState.log.filter((e) => e.idx <= prevState.C);

        // Check that no previously committed entry was overwritten with lower epoch
        // This is the coupling law: commitment must be monotone in (epoch, index)
        let monotoneHolds = true;
        let detail = `C advanced: ${prevState.C} → ${currState.C}`;

        for (const prevEntry of prevCommitted) {
          const currEntry = currCommitted.find((e) => e.idx === prevEntry.idx);
          if (currEntry && currEntry.epoch < prevEntry.epoch) {
            monotoneHolds = false;
            detail = `Coupling law violated: entry at idx=${prevEntry.idx} changed from epoch ${prevEntry.epoch} to ${currEntry.epoch} — committed trunk is not monotone in (epoch, index)`;
            break;
          }
          // Also check: same index, same epoch, but different value (resurrected/phantom)
          if (currEntry && currEntry.epoch === prevEntry.epoch && currEntry.val !== prevEntry.val) {
            monotoneHolds = false;
            detail = `Trunk integrity violated: entry at idx=${prevEntry.idx}, epoch=${prevEntry.epoch} changed value from "${prevEntry.val}" to "${currEntry.val}"`;
            break;
          }
        }

        checks.push({
          invariant: `Trunk monotone (${replicaId})`,
          holds: monotoneHolds,
          detail,
        });
      }

      // Check: C should never decrease (commit frontier is monotonically non-decreasing)
      if (currState.C < prevState.C && !currState.crashed) {
        checks.push({
          invariant: `C monotone (${replicaId})`,
          holds: false,
          detail: `VIOLATION: C decreased from ${prevState.C} to ${currState.C} — commit frontier must be monotonically non-decreasing`,
        });
      }
    }
  }

  return checks;
}

/**
 * Run invariant checks across all steps in a trace.
 */
export function validateTrace(
  steps: Step[],
  isDag?: boolean
): Map<number, InvariantCheck[]> {
  const results = new Map<number, InvariantCheck[]>();
  for (let i = 0; i < steps.length; i++) {
    const prev = i > 0 ? steps[i - 1] : undefined;
    results.set(steps[i].id, checkInvariants(steps[i], prev, isDag));
  }
  return results;
}

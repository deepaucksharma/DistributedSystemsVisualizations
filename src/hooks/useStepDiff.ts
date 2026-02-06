import { useMemo } from 'react';
import type { Step, StepDiff, BoundaryKey, LogEntry } from '../types/trace';

const BOUNDARIES: BoundaryKey[] = ['T', 'D', 'A', 'C', 'E'];
const FLAGS = ['crashed', 'recovered', 'partitioned', 'danger'] as const;

function getRole(replica: { leader?: boolean }): string {
  return replica.leader ? 'leader' : 'follower';
}

function logEntryKey(e: LogEntry): string {
  return `${e.idx}:${e.val}:${e.epoch}`;
}

export function computeStepDiff(prev: Step | null, curr: Step): StepDiff {
  const diff: StepDiff = {
    boundaries_changed: [],
    entries_added: [],
    entries_removed: [],
    epoch_changed: [],
    role_changed: [],
    flags_changed: [],
    certs_issued: [...curr.certificates],
    violation_appeared: !!(curr.violation && (!prev || !prev.violation)),
    violation_resolved: !!(!curr.violation && prev?.violation),
  };

  if (!prev) return diff;

  const allReplicas = new Set([
    ...Object.keys(prev.replicas),
    ...Object.keys(curr.replicas),
  ]);

  for (const replicaId of allReplicas) {
    const prevR = prev.replicas[replicaId];
    const currR = curr.replicas[replicaId];
    if (!prevR || !currR) continue;

    // Boundary changes
    for (const b of BOUNDARIES) {
      if (prevR[b] !== currR[b]) {
        diff.boundaries_changed.push({
          replica: replicaId,
          boundary: b,
          old: prevR[b],
          new: currR[b],
        });
      }
    }

    // Entry changes
    const prevEntries = new Set(prevR.log.map(logEntryKey));
    const currEntries = new Set(currR.log.map(logEntryKey));
    for (const entry of currR.log) {
      if (!prevEntries.has(logEntryKey(entry))) {
        diff.entries_added.push({ replica: replicaId, entry });
      }
    }
    for (const entry of prevR.log) {
      if (!currEntries.has(logEntryKey(entry))) {
        diff.entries_removed.push({ replica: replicaId, entry });
      }
    }

    // Epoch changes
    if (prevR.epoch !== currR.epoch) {
      diff.epoch_changed.push({ replica: replicaId, old: prevR.epoch, new: currR.epoch });
    }

    // Role changes
    if (getRole(prevR) !== getRole(currR)) {
      diff.role_changed.push({ replica: replicaId, old: getRole(prevR), new: getRole(currR) });
    }

    // Flag changes
    for (const flag of FLAGS) {
      const prevVal = !!prevR[flag];
      const currVal = !!currR[flag];
      if (prevVal !== currVal) {
        diff.flags_changed.push({ replica: replicaId, flag, old: prevVal, new: currVal });
      }
    }
  }

  return diff;
}

export function useStepDiff(stepIndex: number, steps: Step[]): StepDiff | null {
  return useMemo(() => {
    if (stepIndex < 0 || stepIndex >= steps.length) return null;
    const prev = stepIndex > 0 ? steps[stepIndex - 1] : null;
    return computeStepDiff(prev, steps[stepIndex]);
  }, [stepIndex, steps]);
}

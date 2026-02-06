import { useState, useMemo, useEffect, useCallback } from 'react';
import { TraceViewer } from './components/TraceViewer';
import { CompareView } from './components/CompareView';
import { ScenarioSelector } from './components/layout/ScenarioSelector';
import { loadTraceFromJson } from './pipeline/loader';
import { getAvailableScenarios, getScenarioById } from './data/catalog';
import type { Trace } from './types/trace';

// Static imports for available traces
import figureEightRaw from './data/traces/figure-8.json';
import happyPathRaw from './data/traces/happy-path.json';
import splitBrainRaw from './data/traces/split-brain.json';
import trimCliffRaw from './data/traces/trim-cliff.json';
import snapshotInstallRaw from './data/traces/snapshot-install.json';
import staleReadRaw from './data/traces/stale-read.json';
import zombieSideEffectRaw from './data/traces/zombie-side-effect.json';
import unsafeReconfigRaw from './data/traces/unsafe-reconfig.json';
import safeReconfigRaw from './data/traces/safe-reconfig.json';
import electionStormRaw from './data/traces/election-storm.json';
import crossShardTxnRaw from './data/traces/cross-shard-txn.json';
import dataLossAfterAckRaw from './data/traces/data-loss-after-ack.json';
import crdtConvergenceRaw from './data/traces/crdt-convergence.json';
import coordinationCutRaw from './data/traces/coordination-cut.json';

const TRACE_MAP: Record<string, unknown> = {
  'figure-8': figureEightRaw,
  'happy-path': happyPathRaw,
  'split-brain': splitBrainRaw,
  'trim-cliff': trimCliffRaw,
  'snapshot-install': snapshotInstallRaw,
  'stale-read': staleReadRaw,
  'zombie-side-effect': zombieSideEffectRaw,
  'unsafe-reconfig': unsafeReconfigRaw,
  'safe-reconfig': safeReconfigRaw,
  'election-storm': electionStormRaw,
  'cross-shard-txn': crossShardTxnRaw,
  'data-loss-after-ack': dataLossAfterAckRaw,
  'crdt-convergence': crdtConvergenceRaw,
  'coordination-cut': coordinationCutRaw,
};

function loadTrace(id: string): Trace {
  const raw = TRACE_MAP[id] || TRACE_MAP['figure-8'];
  return loadTraceFromJson(raw);
}

function parseHash(): { scenario?: string; step?: number; compare?: string } {
  const hash = window.location.hash;
  // Format: #/scenario/<id>/step/<n> OR #/compare/<left>/<right>
  const compareMatch = hash.match(/^#\/compare\/([^/]+)\/([^/]+)$/);
  if (compareMatch) {
    return { scenario: compareMatch[1], compare: compareMatch[2] };
  }
  const match = hash.match(/^#\/scenario\/([^/]+)(?:\/step\/(\d+))?$/);
  if (match) {
    return {
      scenario: match[1],
      step: match[2] ? parseInt(match[2], 10) : undefined,
    };
  }
  return {};
}

function setHash(scenario: string, step?: number) {
  const hash = step !== undefined
    ? `#/scenario/${scenario}/step/${step}`
    : `#/scenario/${scenario}`;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash);
  }
}

function setCompareHash(left: string, right: string) {
  const hash = `#/compare/${left}/${right}`;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash);
  }
}

export default function App() {
  const scenarios = useMemo(() => getAvailableScenarios(), []);

  // Initialize from URL hash
  const initial = useMemo(() => parseHash(), []);
  const defaultScenario = initial.scenario && TRACE_MAP[initial.scenario]
    ? initial.scenario
    : 'figure-8';

  const [activeScenarioId, setActiveScenarioId] = useState(defaultScenario);
  const [initialStep] = useState(initial.step);

  // Compare mode state
  const [compareMode, setCompareMode] = useState(!!initial.compare);
  const [compareLeftId, setCompareLeftId] = useState(initial.scenario || defaultScenario);
  const [compareRightId, setCompareRightId] = useState(
    initial.compare || getScenarioById(defaultScenario)?.compareWith || 'happy-path'
  );

  const trace: Trace = useMemo(() => loadTrace(activeScenarioId), [activeScenarioId]);
  const leftTrace: Trace = useMemo(() => loadTrace(compareLeftId), [compareLeftId]);
  const rightTrace: Trace = useMemo(() => loadTrace(compareRightId), [compareRightId]);

  const handleSelectScenario = useCallback((id: string) => {
    setActiveScenarioId(id);
    setHash(id);
  }, []);

  const handleEnterCompare = useCallback((leftId: string, rightId: string) => {
    setCompareLeftId(leftId);
    setCompareRightId(rightId);
    setCompareMode(true);
    setCompareHash(leftId, rightId);
  }, []);

  const handleExitCompare = useCallback(() => {
    setCompareMode(false);
    setActiveScenarioId(compareLeftId);
    setHash(compareLeftId);
  }, [compareLeftId]);

  // Update hash on scenario change (normal mode only)
  useEffect(() => {
    if (!compareMode) {
      setHash(activeScenarioId);
    }
  }, [activeScenarioId, compareMode]);

  // Update hash on compare ids change
  useEffect(() => {
    if (compareMode) {
      setCompareHash(compareLeftId, compareRightId);
    }
  }, [compareLeftId, compareRightId, compareMode]);

  // Listen for hash changes (back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash();
      if (parsed.compare && parsed.scenario) {
        setCompareMode(true);
        setCompareLeftId(parsed.scenario);
        setCompareRightId(parsed.compare);
      } else if (parsed.scenario && TRACE_MAP[parsed.scenario]) {
        setCompareMode(false);
        setActiveScenarioId(parsed.scenario);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (compareMode) {
    return (
      <CompareView
        leftTrace={leftTrace}
        rightTrace={rightTrace}
        onExit={handleExitCompare}
        leftSelector={
          <ScenarioSelector
            scenarios={scenarios}
            activeId={compareLeftId}
            onSelect={(id) => setCompareLeftId(id)}
            compact
          />
        }
        rightSelector={
          <ScenarioSelector
            scenarios={scenarios}
            activeId={compareRightId}
            onSelect={(id) => setCompareRightId(id)}
            compact
          />
        }
      />
    );
  }

  return (
    <div>
      <TraceViewer
        trace={trace}
        initialStep={initialStep}
        onStepChange={(step) => setHash(activeScenarioId, step)}
        scenarioSelector={
          <ScenarioSelector
            scenarios={scenarios}
            activeId={activeScenarioId}
            onSelect={handleSelectScenario}
            onCompare={handleEnterCompare}
          />
        }
      />
    </div>
  );
}

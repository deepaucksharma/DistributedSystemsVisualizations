import { useMemo, useEffect, type ReactNode } from 'react';
import type { Trace } from '../types/trace';
import { useStepNavigation } from '../hooks/useStepNavigation';
import { useStepDiff } from '../hooks/useStepDiff';
import { TraceContext } from '../hooks/useTrace';
import { Header } from './layout/Header';
import { StepNavigation } from './layout/StepNavigation';
import { GeometryBar } from './shared/GeometryBar';
import { BoundaryLegend } from './shared/BoundaryLegend';
import { BoundaryPipeline } from './panels/BoundaryPipeline';
import { MessageSequence } from './panels/MessageSequence';
import { CertificateLedger } from './panels/CertificateLedger';
import { ViolationBanner } from './panels/ViolationBanner';
import { BoundaryMovements } from './panels/BoundaryMovements';
import { NarrationBox } from './panels/NarrationBox';
import { InvariantChecklist } from './panels/InvariantChecklist';
import { HistoryTree } from './panels/HistoryTree';
import { ObservationPanel } from './panels/ObservationPanel';
import { ControlPlane } from './panels/ControlPlane';
import { DagPipeline } from './panels/DagPipeline';
import { ErrorBoundary } from './shared/ErrorBoundary';

interface TraceViewerProps {
  trace: Trace;
  scenarioSelector?: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

export function TraceViewer({ trace, scenarioSelector, initialStep, onStepChange }: TraceViewerProps) {
  const { stepIndex, setStepIndex, goNext, goPrev, handleKeyDown, currentStep } =
    useStepNavigation(trace);
  const stepDiff = useStepDiff(stepIndex, trace.steps);

  // Set initial step from URL
  useEffect(() => {
    if (initialStep !== undefined && initialStep >= 0 && initialStep < trace.steps.length) {
      setStepIndex(initialStep);
    }
  }, []);  // Only on mount

  // Report step changes to parent for URL sync
  useEffect(() => {
    onStepChange?.(stepIndex);
  }, [stepIndex]);

  // Compute max log index for scaling pipeline bars
  const maxIdx = useMemo(() => {
    let max = 0;
    for (const step of trace.steps) {
      for (const replica of Object.values(step.replicas)) {
        for (const entry of replica.log) {
          if (entry.idx > max) max = entry.idx;
        }
        if (replica.E > max) max = replica.E;
      }
    }
    return Math.max(max, 2);
  }, [trace]);

  const isDag = trace.historyShape === 'dag';

  // Get all replica names for swim-lane participants
  const participants = useMemo(() => {
    const names = new Set<string>();
    for (const step of trace.steps) {
      for (const name of Object.keys(step.replicas)) {
        names.add(name);
      }
    }
    return Array.from(names);
  }, [trace]);

  const ctxValue = useMemo(
    () => ({
      trace,
      currentStep,
      stepIndex,
      stepDiff,
      setStepIndex,
      goNext,
      goPrev,
    }),
    [trace, currentStep, stepIndex, stepDiff, setStepIndex, goNext, goPrev]
  );

  return (
    <TraceContext.Provider value={ctxValue}>
      <div
        className="trace-root"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
          background: '#0f172a',
          color: '#e2e8f0',
          minHeight: '100vh',
          padding: '20px 24px',
          outline: 'none',
        }}
      >
        {scenarioSelector}
        <Header trace={trace} />
        <GeometryBar active={currentStep.geometry_highlight} />
        {!isDag && <BoundaryLegend />}

        <StepNavigation
          steps={trace.steps}
          stepIndex={stepIndex}
          setStepIndex={setStepIndex}
          goNext={goNext}
          goPrev={goPrev}
        />

        <NarrationBox step={currentStep} />

        {currentStep.violation && <ViolationBanner violation={currentStep.violation} />}

        <ErrorBoundary fallbackLabel="Control Plane">
        {/* Control Plane — shows when trace has controlPlane data */}
        {currentStep.controlPlane && (
          <ControlPlane controlPlane={currentStep.controlPlane} />
        )}
        </ErrorBoundary>

        {/* Pipeline view — with multi-shard grouping and DAG mode */}
        <ErrorBoundary fallbackLabel="History / Boundary Lattice">
        <div
          style={{
            background: '#1e293b',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 12,
            border: '1px solid #334155',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {isDag ? 'Replica State (DAG)' : 'History / Boundary Lattice'}
          </div>
          {(() => {
            const entries = Object.entries(currentStep.replicas);
            const hasShard = entries.some(([, data]) => data.shard);

            const renderReplica = ([name, data]: [string, typeof entries[0][1]]) => {
              const hasChanges = stepDiff
                ? stepDiff.boundaries_changed.some((c) => c.replica === name) ||
                  stepDiff.entries_added.some((e) => e.replica === name) ||
                  stepDiff.epoch_changed.some((e) => e.replica === name) ||
                  stepDiff.flags_changed.some((f) => f.replica === name)
                : false;

              if (isDag) {
                return (
                  <DagPipeline
                    key={name}
                    replica={name}
                    data={data}
                    highlight={hasChanges}
                  />
                );
              }
              return (
                <BoundaryPipeline
                  key={name}
                  replica={name}
                  data={data}
                  maxIdx={maxIdx}
                  highlight={hasChanges}
                />
              );
            };

            if (hasShard) {
              const shardGroups = new Map<string, [string, typeof entries[0][1]][]>();
              for (const [name, data] of entries) {
                const shard = data.shard || 'default';
                const group = shardGroups.get(shard) || [];
                group.push([name, data]);
                shardGroups.set(shard, group);
              }

              return Array.from(shardGroups.entries()).map(([shard, replicas]) => (
                <div key={shard} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: '#8b5cf6',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: 4,
                      paddingBottom: 2,
                      borderBottom: '1px solid #334155',
                    }}
                  >
                    Shard: {shard}
                  </div>
                  {replicas.map(renderReplica)}
                </div>
              ));
            }

            return entries.map(renderReplica);
          })()}
        </div>

        </ErrorBoundary>

        {/* Message Sequence Diagram (full width — swim lanes need horizontal space) */}
        <ErrorBoundary fallbackLabel="Message Sequence">
        <MessageSequence
          messages={currentStep.messages}
          participants={participants}
          priorStepMessages={
            stepIndex > 0
              ? trace.steps.slice(0, stepIndex).map((s) => ({
                  stepId: s.id,
                  messages: s.messages,
                }))
              : undefined
          }
        />
        </ErrorBoundary>

        {/* History Tree + Certificates: side-by-side when tree has content, otherwise certs full-width */}
        {(() => {
          const hasLogEntries = Object.values(currentStep.replicas).some((r) => r.log.length > 0);
          if (hasLogEntries) {
            return (
              <div
                className="trace-two-col"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginBottom: 12,
                  alignItems: 'start',
                }}
              >
                <ErrorBoundary fallbackLabel="History Tree">
                  <HistoryTree step={currentStep} />
                </ErrorBoundary>
                <ErrorBoundary fallbackLabel="Certificates">
                  <CertificateLedger
                    certificates={currentStep.certificates}
                    boundaryMoves={currentStep.boundaries_moved}
                  />
                </ErrorBoundary>
              </div>
            );
          }
          return (
            <div style={{ marginBottom: 12 }}>
              <ErrorBoundary fallbackLabel="Certificates">
                <CertificateLedger
                  certificates={currentStep.certificates}
                  boundaryMoves={currentStep.boundaries_moved}
                />
              </ErrorBoundary>
            </div>
          );
        })()}

        <ErrorBoundary fallbackLabel="Boundary Movements">
        <BoundaryMovements moves={currentStep.boundaries_moved} />
        </ErrorBoundary>

        {/* Client Observations */}
        <ErrorBoundary fallbackLabel="Observations">
        {currentStep.observations && (
          <ObservationPanel observations={currentStep.observations} />
        )}
        </ErrorBoundary>

        {/* Invariant Checks */}
        <ErrorBoundary fallbackLabel="Invariant Checks">
        {currentStep.invariants_checked && (
          <InvariantChecklist checks={currentStep.invariants_checked} />
        )}
        </ErrorBoundary>

        {/* Footer hint */}
        <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 8 }}>
          Use &larr; &rarr; arrow keys or click the progress bar to navigate &bull; Click to focus
        </div>
      </div>
    </TraceContext.Provider>
  );
}

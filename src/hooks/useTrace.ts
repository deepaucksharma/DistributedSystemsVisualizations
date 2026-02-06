import { createContext, useContext } from 'react';
import type { Trace, Step, StepDiff } from '../types/trace';

export interface TraceContextValue {
  trace: Trace;
  currentStep: Step;
  stepIndex: number;
  stepDiff: StepDiff | null;
  setStepIndex: (idx: number) => void;
  goNext: () => void;
  goPrev: () => void;
}

export const TraceContext = createContext<TraceContextValue | null>(null);

export function useTrace(): TraceContextValue {
  const ctx = useContext(TraceContext);
  if (!ctx) throw new Error('useTrace must be used within a TraceContext.Provider');
  return ctx;
}

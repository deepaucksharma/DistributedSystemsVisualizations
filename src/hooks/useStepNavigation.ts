import { useState, useCallback, useEffect } from 'react';
import type { Trace } from '../types/trace';

export function useStepNavigation(trace: Trace) {
  const [stepIndex, setStepIndex] = useState(0);

  // Reset to step 0 when trace changes (scenario switch)
  useEffect(() => {
    setStepIndex(0);
  }, [trace]);

  const goNext = useCallback(
    () => setStepIndex((i) => Math.min(i + 1, trace.steps.length - 1)),
    [trace.steps.length]
  );

  const goPrev = useCallback(
    () => setStepIndex((i) => Math.max(i - 1, 0)),
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    },
    [goNext, goPrev]
  );

  // Clamp stepIndex if trace is shorter than current index
  const safeIndex = Math.min(stepIndex, trace.steps.length - 1);

  return {
    stepIndex: safeIndex,
    setStepIndex,
    goNext,
    goPrev,
    handleKeyDown,
    currentStep: trace.steps[safeIndex],
  };
}

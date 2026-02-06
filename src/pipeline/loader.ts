import type { Trace } from '../types/trace';
import { normalize } from './normalizer';

/**
 * Validate structural requirements of a raw trace object.
 * Throws descriptive errors for malformed data.
 */
function validateStructure(raw: unknown): asserts raw is Trace {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Trace must be a non-null object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== 'string') {
    throw new Error('Trace.title is required and must be a string');
  }

  if (!obj.spec || typeof obj.spec !== 'object') {
    throw new Error('Trace.spec is required and must be an object');
  }

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    throw new Error('Trace.steps is required and must be a non-empty array');
  }

  // Validate each step has required fields
  for (let i = 0; i < obj.steps.length; i++) {
    const step = obj.steps[i] as Record<string, unknown>;
    if (typeof step.id !== 'number') {
      throw new Error(`Step ${i}: id is required and must be a number`);
    }
    if (!step.replicas || typeof step.replicas !== 'object') {
      throw new Error(`Step ${i}: replicas is required and must be an object`);
    }

    // Validate each replica has boundary fields
    for (const [replicaId, replica] of Object.entries(step.replicas as Record<string, unknown>)) {
      const r = replica as Record<string, unknown>;
      for (const boundary of ['T', 'D', 'A', 'C', 'E'] as const) {
        if (typeof r[boundary] !== 'number') {
          throw new Error(`Step ${i}, replica ${replicaId}: boundary ${boundary} is required and must be a number`);
        }
      }
      if (typeof r.epoch !== 'number') {
        throw new Error(`Step ${i}, replica ${replicaId}: epoch is required and must be a number`);
      }
      if (!Array.isArray(r.log)) {
        throw new Error(`Step ${i}, replica ${replicaId}: log is required and must be an array`);
      }
    }
  }
}

/**
 * Load a trace from a JSON module (already imported via Vite's JSON support).
 * Validates structure, then normalizes through the pipeline.
 */
export function loadTraceFromJson(raw: unknown): Trace {
  validateStructure(raw);
  return normalize(raw);
}

/**
 * Fetch a trace JSON file by path and normalize it.
 */
export async function loadTrace(path: string): Promise<Trace> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load trace: ${path} (${response.status})`);
  }
  const raw = await response.json();
  validateStructure(raw);
  return normalize(raw);
}

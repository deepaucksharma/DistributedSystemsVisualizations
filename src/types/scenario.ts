import type { GeometryKey } from './trace';

export interface ScenarioMeta {
  id: string;
  title: string;
  description: string;
  traceFile: string;
  frameworkRefs: string[];
  geometries: GeometryKey[];
  tier: 1 | 2 | 3;
  bugClass?: string;
  dependsOn?: string[];
  /** ID of the natural comparison scenario (problem↔fix pair) */
  compareWith?: string;
}

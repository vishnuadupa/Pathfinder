import type { GraphData } from './graph';
import type { RunRecord, ComplexityFlags } from './algorithm';

export interface StaticState {
  graph: GraphData | null;
  loaded: boolean;
  error: string | null;
}

export interface DynamicState {
  flags: ComplexityFlags;
  // edgeId = `${fromId}__${toId}` (always sorted so fromId < toId)
  trafficMultipliers: Record<string, number>;
  // node IDs that are rain-flooded
  floodedNodes: string[];
  // node IDs that are closed
  closedNodes: string[];
}

export interface MetricsState {
  runs: RunRecord[];
}

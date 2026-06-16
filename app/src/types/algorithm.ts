export type AlgorithmId = 'dfs' | 'bellman-ford' | 'bfs' | 'dijkstra' | 'greedy' | 'astar';

export interface RunResult {
  algorithmId: AlgorithmId;
  visitedOrder: string[];   // node IDs in the order they were explored
  parents: Record<string, string | null>; // parent map for reconstructing roads
  path: string[];           // final path node IDs (empty if no path)
  computeTimeMs: number;
  nodesVisited: number;
  totalDistanceMiles: number;
  peakFrontierSize: number;
  found: boolean;
  capped?: boolean;
}

export interface RunRecord extends RunResult {
  id: string;
  timestamp: number;
  complexityFlags: ComplexityFlags;
}

export interface ComplexityFlags {
  traffic: boolean;
  rain: boolean;
  closures: boolean;
}

// SKIP sentinel — evaluateNeighbor returns this when edge is blocked
export const SKIP = Symbol('SKIP');
export type EdgeCost = number | typeof SKIP;

import type { GraphData } from '../types/graph';
import type { DynamicState } from '../types/state';
import type { RunResult } from '../types/algorithm';
import { SKIP } from '../types/algorithm';
import { evaluateNeighbor } from './evaluateNeighbor';
import { reconstructPath, pathDistance } from './pathUtils';



export function dfs(
  graph: GraphData,
  start: string,
  end: string,
  dynamicState: DynamicState,
): RunResult {
  const t0 = performance.now();
  const visitedOrder: string[] = [];
  const visited = new Set<string>();
  const parent: Record<string, string | null> = { [start]: null };
  const stack: string[] = [start];
  let peakFrontierSize = 0;
  let found = false;

  while (stack.length > 0) {
    peakFrontierSize = Math.max(peakFrontierSize, stack.length);
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    visitedOrder.push(current);

    if (current === end) { found = true; break; }

    for (const edge of graph.edges[current] ?? []) {
      if (visited.has(edge.to)) continue;
      const cost = evaluateNeighbor(current, edge.to, edge.distance, dynamicState);
      if (cost === SKIP) continue;
      parent[edge.to] = current;
      stack.push(edge.to);
    }
  }

  const path = found ? reconstructPath(parent, start, end) : [];
  // Validate reconstructed path — if broken, clear it
  const validPath = path.length > 0 && path[0] === start && path[path.length - 1] === end ? path : [];

  return {
    algorithmId: 'dfs',
    visitedOrder,
    parents: parent,
    path: validPath,
    computeTimeMs: performance.now() - t0,
    nodesVisited: visitedOrder.length,
    totalDistanceMiles: pathDistance(validPath, graph),
    peakFrontierSize,
    found: validPath.length > 0,
  };
}


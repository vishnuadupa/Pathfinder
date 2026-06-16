import type { GraphData } from '../types/graph';
import type { DynamicState } from '../types/state';
import type { RunResult } from '../types/algorithm';
import { SKIP } from '../types/algorithm';
import { evaluateNeighbor } from './evaluateNeighbor';
import { reconstructPath, pathDistance } from './pathUtils';

export function bfs(
  graph: GraphData,
  start: string,
  end: string,
  dynamicState: DynamicState,
): RunResult {
  const t0 = performance.now();
  const visitedOrder: string[] = [];
  const visited = new Set<string>([start]);
  const parent: Record<string, string | null> = { [start]: null };
  const queue: string[] = [start];
  let head = 0;
  let peakFrontierSize = 0;
  let found = false;

  while (head < queue.length) {
    peakFrontierSize = Math.max(peakFrontierSize, queue.length - head);
    const current = queue[head++];
    visitedOrder.push(current);

    if (current === end) { found = true; break; }

    for (const edge of graph.edges[current] ?? []) {
      if (visited.has(edge.to)) continue;
      const cost = evaluateNeighbor(current, edge.to, edge.distance, dynamicState);
      if (cost === SKIP) continue;
      visited.add(edge.to);
      parent[edge.to] = current;
      queue.push(edge.to);
    }
  }

  const path = found ? reconstructPath(parent, start, end) : [];

  return {
    algorithmId: 'bfs',
    visitedOrder,
    parents: parent,
    path,
    computeTimeMs: performance.now() - t0,
    nodesVisited: visitedOrder.length,
    totalDistanceMiles: pathDistance(path, graph),
    peakFrontierSize,
    found,
  };
}


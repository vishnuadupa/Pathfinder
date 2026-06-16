import type { GraphData } from '../types/graph';
import type { DynamicState } from '../types/state';
import type { RunResult } from '../types/algorithm';
import { SKIP } from '../types/algorithm';
import { evaluateNeighbor } from './evaluateNeighbor';
import { MinHeap } from './minHeap';
import { reconstructPath, pathDistance } from './pathUtils';

export function dijkstra(
  graph: GraphData,
  start: string,
  end: string,
  dynamicState: DynamicState,
): RunResult {
  const t0 = performance.now();
  const dist: Record<string, number> = { [start]: 0 };
  const parent: Record<string, string | null> = { [start]: null };
  const visited = new Set<string>();
  const visitedOrder: string[] = [];
  const pq = new MinHeap();
  pq.push(0, start);
  let peakFrontierSize = 0;
  let found = false;

  while (pq.size > 0) {
    peakFrontierSize = Math.max(peakFrontierSize, pq.size);
    const [, current] = pq.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    visitedOrder.push(current);

    if (current === end) { found = true; break; }

    for (const edge of graph.edges[current] ?? []) {
      if (visited.has(edge.to)) continue;
      const cost = evaluateNeighbor(current, edge.to, edge.distance, dynamicState);
      if (cost === SKIP) continue;
      const newDist = dist[current] + (cost as number);
      if (newDist < (dist[edge.to] ?? Infinity)) {
        dist[edge.to] = newDist;
        parent[edge.to] = current;
        pq.push(newDist, edge.to);
      }
    }
  }

  const path = found ? reconstructPath(parent, start, end) : [];

  return {
    algorithmId: 'dijkstra',
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


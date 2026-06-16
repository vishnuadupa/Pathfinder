import type { GraphData } from '../types/graph';
import type { DynamicState } from '../types/state';
import type { RunResult } from '../types/algorithm';
import { SKIP } from '../types/algorithm';
import { evaluateNeighbor } from './evaluateNeighbor';
import { MinHeap } from './minHeap';
import { reconstructPath, pathDistance } from './pathUtils';

function heuristic(graph: GraphData, nodeId: string, endId: string): number {
  const a = graph.nodes[nodeId];
  const b = graph.nodes[endId];
  if (!a || !b) return 0;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;

  const aVal = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
               Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return 3958.8 * c;
}

export function greedyBestFirst(
  graph: GraphData,
  start: string,
  end: string,
  dynamicState: DynamicState,
): RunResult {
  const t0 = performance.now();
  const visited = new Set<string>();
  const parent: Record<string, string | null> = { [start]: null };
  const visitedOrder: string[] = [];
  const pq = new MinHeap();
  pq.push(heuristic(graph, start, end), start);
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
      // ISSUE 4: Only set parent the first time a node is encountered.
      // This is correct for greedy best-first: the priority key is the
      // heuristic h(n) which is fixed and does NOT depend on the path taken
      // to reach n. Therefore the first time n is pushed, it is pushed with
      // the same priority as any future push — the first parent is as valid
      // as any later one. Duplicate pushes are harmlessly discarded at
      // pop-time by the `visited` check above.
      if (!(edge.to in parent)) parent[edge.to] = current;
      pq.push(heuristic(graph, edge.to, end), edge.to);
    }
  }

  const path = found ? reconstructPath(parent, start, end) : [];

  return {
    algorithmId: 'greedy',
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


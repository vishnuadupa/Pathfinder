import type { GraphData } from '../types/graph';
import type { DynamicState } from '../types/state';
import type { RunResult } from '../types/algorithm';
import { SKIP } from '../types/algorithm';
import { evaluateNeighbor } from './evaluateNeighbor';
import { reconstructPath, pathDistance } from './pathUtils';

const MAX_NODES = 5000; // Bellman-Ford is O(VE) — cap for performance

export function bellmanFord(
  graph: GraphData,
  start: string,
  end: string,
  dynamicState: DynamicState,
): RunResult {
  const t0 = performance.now();

  // Work on a reachable subgraph from start via BFS first (performance cap)
  const reachable = bfsReachable(graph, start, dynamicState, MAX_NODES);
  const nodes = Array.from(reachable);

  // ISSUE 3 FIX: surface capped-out flag so callers know the subgraph was truncated
  const cappedOut = reachable.size >= MAX_NODES;

  const dist: Record<string, number> = {};
  const parent: Record<string, string | null> = {};
  for (const n of nodes) { dist[n] = Infinity; parent[n] = null; }
  dist[start] = 0;

  // ISSUE 3 FIX: visitedOrder now records every node as it is DEQUEUED
  // (i.e., the node being processed), not just neighbors that were updated.
  // This makes the visualization accurately reflect algorithm progression.
  const visitedOrder: string[] = [];
  let peakFrontierSize = 0;

  // SPFA optimization: only process nodes whose distances were updated
  const queue = [start];
  const inQueue = new Set([start]);

  // Relaxation guard: if we relax more than nodes.length times without
  // reaching `end`, we're likely in a very large/disconnected component.
  // (True negative-cycle detection would require V-1 full passes; this is
  // a practical safeguard for the SPFA variant used here.)
  let relaxationCount = 0;
  const maxRelaxations = nodes.length * 2;

  while (queue.length > 0) {
    peakFrontierSize = Math.max(peakFrontierSize, queue.length);

    const u = queue.shift()!;
    inQueue.delete(u);

    // ISSUE 3 FIX: record the dequeued node (the one being processed),
    // not just its updated neighbors.
    visitedOrder.push(u);

    // Relaxation guard: bail if we're stuck in extremely large components
    relaxationCount++;
    if (relaxationCount > maxRelaxations) break;

    for (const edge of graph.edges[u] ?? []) {
      if (!reachable.has(edge.to)) continue;
      const cost = evaluateNeighbor(u, edge.to, edge.distance, dynamicState);
      if (cost === SKIP) continue;

      const newDist = dist[u] + (cost as number);
      if (newDist < dist[edge.to]) {
        dist[edge.to] = newDist;
        parent[edge.to] = u;

        if (!inQueue.has(edge.to)) {
          queue.push(edge.to);
          inQueue.add(edge.to);
        }
      }
    }
  }

  // ISSUE 3 FIX: if capped out, report not found so the UI can warn the user
  const found = !cappedOut && dist[end] !== Infinity;
  const path = found ? reconstructPath(parent, start, end) : [];

  return {
    algorithmId: 'bellman-ford',
    visitedOrder,
    parents: parent,
    path,
    computeTimeMs: performance.now() - t0,
    nodesVisited: visitedOrder.length,
    totalDistanceMiles: pathDistance(path, graph),
    peakFrontierSize,
    found,
    capped: cappedOut,
  };
}

function bfsReachable(graph: GraphData, start: string, ds: DynamicState, limit: number): Set<string> {
  const visited = new Set<string>([start]);
  const queue = [start];
  let head = 0;
  while (head < queue.length && visited.size < limit) {
    const cur = queue[head++];
    for (const edge of graph.edges[cur] ?? []) {
      if (visited.has(edge.to)) continue;
      const cost = evaluateNeighbor(cur, edge.to, edge.distance, ds);
      if (cost === SKIP) continue;
      visited.add(edge.to);
      queue.push(edge.to);
    }
  }
  return visited;
}

import type { GraphData } from '../types/graph';
import type { DynamicState } from '../types/state';
import type { AlgorithmId, RunResult } from '../types/algorithm';
import { dfs } from './dfs';
import { bfs } from './bfs';
import { bellmanFord } from './bellmanFord';
import { dijkstra } from './dijkstra';
import { greedyBestFirst } from './greedy';
import { aStar } from './aStar';

export type AlgorithmFn = (graph: GraphData, start: string, end: string, dynamicState: DynamicState) => RunResult;

export const ALGORITHMS: Record<AlgorithmId, AlgorithmFn> = {
  'dfs': dfs,
  'bfs': bfs,
  'bellman-ford': bellmanFord,
  'dijkstra': dijkstra,
  'greedy': greedyBestFirst,
  'astar': aStar,
};

export { dfs, bfs, bellmanFord, dijkstra, greedyBestFirst, aStar };

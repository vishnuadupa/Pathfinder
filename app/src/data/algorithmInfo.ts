import type { AlgorithmId } from '../types/algorithm';

export interface AlgorithmInfo {
  id: AlgorithmId;
  label: string;
  tagline: string;
  description: string;
  pseudocode: string[];
  complexity: { time: string; space: string };
}

export const ALGORITHM_INFO: Record<AlgorithmId, AlgorithmInfo> = {
  dfs: {
    id: 'dfs',
    label: 'Depth-First Search',
    tagline: 'Explores as deep as possible before backtracking',
    description:
      'DFS plunges down one path until it hits a dead end, then backtracks and tries the next branch. It finds A path — not necessarily the shortest one. On a city map, it can wander far from the goal before stumbling onto it.',
    pseudocode: [
      'push start onto stack',
      'while stack is not empty:',
      '  current = stack.pop()',
      '  if current is visited: continue',
      '  mark current as visited',
      '  if current == end: return path',
      '  for each neighbor of current:',
      '    if not visited and not blocked:',
      '      push neighbor onto stack',
      'return no path found',
    ],
    complexity: { time: 'O(V + E)', space: 'O(V)' },
  },
  'bellman-ford': {
    id: 'bellman-ford',
    label: 'Bellman-Ford',
    tagline: 'Queue-optimized Bellman-Ford (SPFA)',
    description:
      'Bellman-Ford minimizes path distance and handles negative weights, optimized here using a queue (Shortest Path Faster Algorithm) to avoid redundant calculations. It only relaxes edges from nodes whose distances actually changed.',
    pseudocode: [
      'dist[start] = 0; all others = ∞',
      'enqueue start',
      'while queue not empty:',
      '  u = dequeue()',
      '  for each neighbor v of u with cost w:',
      '    if dist[u] + w < dist[v]:',
      '      dist[v] = dist[u] + w',
      '      parent[v] = u',
      '      if v not in queue:',
      '        enqueue v',
    ],
    complexity: { time: 'O(V × E) worst, O(E) avg', space: 'O(V)' },
  },
  bfs: {
    id: 'bfs',
    label: 'Breadth-First Search',
    tagline: 'Explores all neighbors layer by layer',
    description:
      'BFS fans out in concentric rings from the start, visiting every node at distance 1 before any at distance 2. It guarantees the fewest hops — but ignores edge weights. On a weighted city graph, "fewest turns" ≠ "shortest miles".',
    pseudocode: [
      'enqueue start',
      'while queue is not empty:',
      '  current = queue.dequeue()',
      '  mark current as visited',
      '  if current == end: return path',
      '  for each neighbor of current:',
      '    if not visited and not blocked:',
      '      enqueue neighbor',
      '      record parent',
      'return no path found',
    ],
    complexity: { time: 'O(V + E)', space: 'O(V)' },
  },
  dijkstra: {
    id: 'dijkstra',
    label: "Dijkstra's Algorithm",
    tagline: 'Always expands the cheapest known node',
    description:
      "Dijkstra maintains a priority queue of costs and always picks the cheapest unvisited node next. It's guaranteed to find the true shortest path on non-negative weighted graphs — the gold standard before heuristics existed.",
    pseudocode: [
      'dist[start] = 0; all others = ∞',
      'push (0, start) into priority queue',
      'while queue not empty:',
      '  (cost, current) = queue.pop_min()',
      '  if current is visited: skip',
      '  if current == end: return path',
      '  for each neighbor of current:',
      '    newCost = cost + edgeCost(current, neighbor)',
      '    if newCost < dist[neighbor]:',
      '      dist[neighbor] = newCost',
      '      push (newCost, neighbor) into queue',
    ],
    complexity: { time: 'O((V + E) log V)', space: 'O(V)' },
  },
  greedy: {
    id: 'greedy',
    label: 'Greedy Best-First',
    tagline: 'Always moves toward the goal — ignores past cost',
    description:
      "Greedy Best-First uses a heuristic (straight-line distance to goal) to always pick the node that looks closest. It's fast but reckless — it ignores how expensive the path so far has been. Can find a quick but suboptimal route.",
    pseudocode: [
      'push (h(start), start) into priority queue',
      'while queue not empty:',
      '  (_, current) = queue.pop_min()',
      '  if current is visited: skip',
      '  if current == end: return path',
      '  for each neighbor of current:',
      '    if not visited and not blocked:',
      '      push (h(neighbor), neighbor) into queue',
      '      record parent',
      '',
      'h(n) = straight-line distance to end',
    ],
    complexity: { time: 'O((V + E) log V)', space: 'O(V)' },
  },
  astar: {
    id: 'astar',
    label: 'A* Search',
    tagline: 'Best of Dijkstra + Greedy — optimal and directed',
    description:
      'A* combines Dijkstra\'s accumulated cost (g) with Greedy\'s heuristic estimate (h). By prioritizing f = g + h, it stays optimal like Dijkstra but focuses toward the goal like Greedy. The state of the art for point-to-point shortest paths.',
    pseudocode: [
      'g[start] = 0',
      'push (h(start), start) into priority queue',
      'while queue not empty:',
      '  (f, current) = queue.pop_min()',
      '  if current is visited: skip',
      '  if current == end: return path',
      '  for each neighbor of current:',
      '    tentative_g = g[current] + edgeCost(current, neighbor)',
      '    if tentative_g < g[neighbor]:',
      '      g[neighbor] = tentative_g',
      '      f = g[neighbor] + h(neighbor)',
      '      push (f, neighbor) into queue',
      '',
      'f = g + h  (past cost + future estimate)',
    ],
    complexity: { time: 'O((V + E) log V)', space: 'O(V)' },
  },
};

export const ALGORITHM_ORDER: AlgorithmId[] = [
  'dfs', 'bellman-ford', 'bfs', 'dijkstra', 'greedy', 'astar',
];

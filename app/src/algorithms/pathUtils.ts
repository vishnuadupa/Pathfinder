import type { GraphData } from '../types/graph';

export function reconstructPath(
  parent: Record<string, string | null>,
  start: string,
  end: string,
): string[] {
  const path: string[] = [];
  let cur: string | null = end;
  const seen = new Set<string>(); // guard against cycles in broken parent maps

  while (cur !== null && !seen.has(cur)) {
    seen.add(cur);
    path.unshift(cur);
    if (cur === start) break;
    cur = parent[cur] ?? null;
  }

  // Validate: must start at start and end at end
  return path.length >= 1 && path[0] === start && path[path.length - 1] === end
    ? path
    : [];
}

export function pathDistance(path: string[], graph: GraphData): number {
  let d = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = graph.edges[path[i]]?.find(e => e.to === path[i + 1]);
    if (edge) d += edge.distance; // skip silently if edge missing — no NaN
  }
  return Math.round(d * 1000) / 1000;
}

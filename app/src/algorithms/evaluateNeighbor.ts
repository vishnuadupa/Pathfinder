import type { DynamicState } from '../types/state';
import { SKIP, type EdgeCost } from '../types/algorithm';

// Sorted edge key so A→B and B→A share the same key
const edgeKey = (a: string, b: string) => (a < b ? `${a}__${b}` : `${b}__${a}`);

/**
 * Returns the effective cost of traversing from currentNode to neighborNode,
 * factoring in all active complexity layers from dynamicState.
 * Returns SKIP if the edge/node is impassable.
 */
export function evaluateNeighbor(
  currentNode: string,
  neighborNode: string,
  baseDistance: number,
  dynamicState: DynamicState & { floodedSet?: Set<string>; closedSet?: Set<string> },
): EdgeCost {
  // Hard block: road closure
  const isClosed = dynamicState.closedSet
    ? dynamicState.closedSet.has(neighborNode)
    : dynamicState.closedNodes.includes(neighborNode);
  if (isClosed) return SKIP;

  let cost = baseDistance;

  // Traffic: multiply cost (shifts optimization from distance to time)
  const tKey = edgeKey(currentNode, neighborNode);
  const multiplier = dynamicState.trafficMultipliers[tKey] ?? 1.0;
  cost *= multiplier;

  // Rain/Elevation: flooded nodes incur a massive penalty
  const isFlooded = dynamicState.floodedSet
    ? dynamicState.floodedSet.has(neighborNode)
    : dynamicState.floodedNodes.includes(neighborNode);
  if (isFlooded) {
    cost += 9999;
  }

  return cost;
}

import type { RunRecord } from '../../types/algorithm';
import { ALGORITHM_INFO } from '../../data/algorithmInfo';
import styles from './Dashboard.module.css';

interface Props {
  runs: RunRecord[];
}

// Algorithms that guarantee shortest weighted path
const OPTIMAL_WEIGHTED = new Set(['dijkstra', 'astar', 'bellman-ford']);
// Algorithms that guarantee shortest hop path (unweighted)
const OPTIMAL_HOPS = new Set(['bfs']);

function getDistanceLabel(r: RunRecord): string {
  if (!r.found) return '—';
  const dist = `${r.totalDistanceMiles.toFixed(3)} mi`;
  if (OPTIMAL_HOPS.has(r.algorithmId)) return `${dist} *`;
  return dist;
}

function getAlgoTag(r: RunRecord): string | null {
  if (!r.found) return null;
  if (OPTIMAL_HOPS.has(r.algorithmId)) return 'unweighted';
  if (!OPTIMAL_WEIGHTED.has(r.algorithmId)) return 'suboptimal';
  return null;
}

export function Dashboard({ runs }: Props) {
  if (runs.length === 0) return null;

  const hasBfs = runs.some(r => r.algorithmId === 'bfs');

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Comparison Dashboard</span>
        <span className={styles.hint}>{runs.length} run{runs.length !== 1 ? 's' : ''}</span>
        {hasBfs && (
          <span className={styles.bfsWarning} title="BFS minimizes hops, not distance. * marks BFS distance which is not guaranteed optimal on weighted graphs.">
            * BFS = fewest hops, not shortest distance
          </span>
        )}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Algorithm</th>
              <th>Found</th>
              <th>Compute</th>
              <th>Distance</th>
              <th>Nodes Visited</th>
              <th>Peak Frontier</th>
              <th>Complexity</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => {
              const tag = getAlgoTag(r);
              return (
                <tr key={r.id} className={r.found ? '' : styles.notFound}>
                  <td className={styles.dim}>{i + 1}</td>
                  <td className={styles.algoName}>
                    {ALGORITHM_INFO[r.algorithmId].label}
                    {tag && <span className={`${styles.tag} ${styles[`tag_${tag.replace('-','_')}`]}`}>{tag}</span>}
                  </td>
                  <td>{r.found ? <span className={styles.yes}>✓</span> : <span className={styles.no}>✗</span>}</td>
                  <td className={styles.mono}>{r.computeTimeMs.toFixed(1)} ms</td>
                  <td className={styles.mono}>{getDistanceLabel(r)}</td>
                  <td className={styles.mono}>{r.nodesVisited.toLocaleString()}</td>
                  <td className={styles.mono}>{r.peakFrontierSize.toLocaleString()}</td>
                  <td className={styles.flags}>
                    {r.complexityFlags.traffic && <span className={styles.flag} title="Traffic">🚦</span>}
                    {r.complexityFlags.rain && <span className={styles.flag} title="Rain">🌧</span>}
                    {r.complexityFlags.closures && <span className={styles.flag} title="Closures">🚧</span>}
                    {!r.complexityFlags.traffic && !r.complexityFlags.rain && !r.complexityFlags.closures && <span className={styles.dim}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

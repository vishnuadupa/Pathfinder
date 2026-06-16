import type { AlgorithmId } from '../../types/algorithm';
import { ALGORITHM_INFO } from '../../data/algorithmInfo';
import styles from './Sidebar.module.css';

interface Props {
  algorithmId: AlgorithmId;
  currentStep: number;
  totalSteps: number;
  isRunning: boolean;
}

export function Sidebar({ algorithmId, currentStep, totalSteps, isRunning }: Props) {
  const info = ALGORITHM_INFO[algorithmId];

  // Map algorithm progress (0→1) to which pseudocode line is active.
  // This is progress-proportional: line 0 at 0%, last line at 100%.
  // Empty lines (blank separators) are skipped.
  const nonEmptyLines = info.pseudocode
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => line.trim().length > 0);

  let activeLineIdx = -1;
  if (isRunning && totalSteps > 0) {
    const progress = Math.min(currentStep / totalSteps, 1);
    const activeNonEmptyIdx = Math.min(
      Math.floor(progress * nonEmptyLines.length),
      nonEmptyLines.length - 1
    );
    activeLineIdx = nonEmptyLines[activeNonEmptyIdx]?.i ?? -1;
  }

  const progressPct = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.name}>{info.label}</h2>
        <p className={styles.tagline}>{info.tagline}</p>
      </div>

      <p className={styles.description}>{info.description}</p>

      <div className={styles.complexity}>
        <span className={styles.complexityItem}>
          <span className={styles.dimLabel}>Time</span> {info.complexity.time}
        </span>
        <span className={styles.complexityItem}>
          <span className={styles.dimLabel}>Space</span> {info.complexity.space}
        </span>
      </div>

      <div className={styles.pseudocodeBox}>
        <div className={styles.pseudocodeHeader}>
          Pseudocode
          {isRunning && totalSteps > 0 && (
            <span className={styles.progressBadge}>{progressPct}%</span>
          )}
        </div>
        <pre className={styles.pseudocode}>
          {info.pseudocode.map((line, i) => (
            <div
              key={i}
              className={`${styles.codeLine} ${i === activeLineIdx && isRunning ? styles.activeLine : ''}`}
            >
              <span className={styles.lineNum}>{(i + 1).toString().padStart(2, ' ')}</span>
              {line || ' '}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

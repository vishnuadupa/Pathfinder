import type { AlgorithmId } from '../../types/algorithm';
import type { AnimationMode } from '../../animation/AnimationEngine';
import { ALGORITHM_INFO, ALGORITHM_ORDER } from '../../data/algorithmInfo';
import styles from './Controls.module.css';

interface Props {
  selectedAlgo: AlgorithmId;
  onAlgoChange: (id: AlgorithmId) => void;
  animationMode: AnimationMode;
  onModeChange: (mode: AnimationMode) => void;
  animSpeed: number;
  onSpeedChange: (speed: number) => void;
  onCalculate: () => void;
  onReset: () => void;
  onComplexityOpen: () => void;
  canCalculate: boolean;
  isRunning: boolean;
  complexityActive: boolean;
}

const SPEED_OPTIONS: { label: string; value: number }[] = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '3×', value: 3 },
];

export function Controls({
  selectedAlgo, onAlgoChange, animationMode, onModeChange,
  animSpeed, onSpeedChange,
  onCalculate, onReset, onComplexityOpen, canCalculate, isRunning, complexityActive,
}: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        <label className={styles.label}>Algorithm</label>
        <select
          className={styles.select}
          value={selectedAlgo}
          onChange={e => onAlgoChange(e.target.value as AlgorithmId)}
          disabled={isRunning}
        >
          {ALGORITHM_ORDER.map(id => (
            <option key={id} value={id}>{ALGORITHM_INFO[id].label}</option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>Mode</label>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${animationMode === 'replay' ? styles.active : ''}`}
            onClick={() => onModeChange('replay')}
            disabled={isRunning}
            title="Fast replay — completes in ~2 seconds"
          >Fast</button>
          <button
            className={`${styles.toggleBtn} ${animationMode === 'realtime' ? styles.active : ''}`}
            onClick={() => onModeChange('realtime')}
            disabled={isRunning}
            title="Slow replay — completes in ~4 seconds, smoother for watching"
          >Slow</button>
        </div>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>Speed</label>
        <div className={styles.toggle}>
          {SPEED_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              className={`${styles.toggleBtn} ${animSpeed === value ? styles.active : ''}`}
              onClick={() => onSpeedChange(value)}
              disabled={isRunning}
            >{label}</button>
          ))}
        </div>
      </div>

      <button
        className={`${styles.btn} ${styles.complexity} ${complexityActive ? styles.complexityOn : ''}`}
        onClick={onComplexityOpen}
      >
        ⚡ Complexity {complexityActive ? <span className={styles.glowDot} /> : null}
      </button>

      <button
        className={`${styles.btn} ${styles.calculate}`}
        onClick={onCalculate}
        disabled={!canCalculate || isRunning}
      >
        {isRunning ? 'Running…' : '▶ Calculate'}
      </button>

      <button
        className={`${styles.btn} ${styles.reset}`}
        onClick={onReset}
        disabled={isRunning}
      >
        ↺ Reset
      </button>
    </div>
  );
}

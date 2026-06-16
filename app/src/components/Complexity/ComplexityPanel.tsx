import { useEffect, useRef } from 'react';
import type { GraphData } from '../../types/graph';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setTraffic, setRain, setClosures, clearDynamic } from '../../store/dynamicSlice';
import styles from './ComplexityPanel.module.css';

interface Props {
  graph: GraphData;
  onClose: () => void;
}

function generateTrafficMultipliers(graph: GraphData): Record<string, number> {
  const multipliers: Record<string, number> = {};
  const nodeIds = Object.keys(graph.nodes);
  for (const nodeId of nodeIds) {
    for (const edge of graph.edges[nodeId] ?? []) {
      if (Math.random() < 0.3) {
        // Always use sorted key so evaluateNeighbor can find it
        const key = nodeId < edge.to ? `${nodeId}__${edge.to}` : `${edge.to}__${nodeId}`;
        multipliers[key] = 1.5 + Math.random() * 3.5; // 1.5x to 5x congestion
      }
    }
  }
  return multipliers;
}

function generateFloodedNodes(graph: GraphData): string[] {
  // Flood nodes with elevation < 5m (low-lying areas near water)
  const lowElev = Object.entries(graph.nodes)
    .filter(([, n]) => n.elevation < 5)
    .map(([id]) => id);
  // Also randomly flood ~8% of nodes regardless of elevation
  const random = Object.keys(graph.nodes).filter(() => Math.random() < 0.08);
  return Array.from(new Set([...lowElev, ...random]));
}

function generateClosedNodes(graph: GraphData): string[] {
  const nodeIds = Object.keys(graph.nodes);
  return nodeIds.filter(() => Math.random() < 0.05);
}

export function ComplexityPanel({ graph, onClose }: Props) {
  const dispatch = useAppDispatch();
  const flags = useAppSelector(s => s.dynamic.flags);

  // Store generated data in refs so toggling off/on restores the SAME scenario.
  // This prevents re-randomization every time the user toggles a layer.
  const trafficSnapshot = useRef<Record<string, number> | null>(null);
  const floodSnapshot = useRef<string[] | null>(null);
  const closureSnapshot = useRef<string[] | null>(null);

  const toggle = (type: 'traffic' | 'rain' | 'closures') => {
    const next = !flags[type];
    if (type === 'traffic') {
      if (next && !trafficSnapshot.current) {
        trafficSnapshot.current = generateTrafficMultipliers(graph);
      }
      dispatch(setTraffic({
        multipliers: next ? trafficSnapshot.current! : {},
        enabled: next,
      }));
      if (!next) trafficSnapshot.current = null; // allow fresh generation next time
    } else if (type === 'rain') {
      if (next && !floodSnapshot.current) {
        floodSnapshot.current = generateFloodedNodes(graph);
      }
      dispatch(setRain({
        floodedNodes: next ? floodSnapshot.current! : [],
        enabled: next,
      }));
      if (!next) floodSnapshot.current = null;
    } else {
      if (next && !closureSnapshot.current) {
        closureSnapshot.current = generateClosedNodes(graph);
      }
      dispatch(setClosures({
        closedNodes: next ? closureSnapshot.current! : [],
        enabled: next,
      }));
      if (!next) closureSnapshot.current = null;
    }
  };

  // Close on Escape — use mousedown to prevent overlay-border drag-dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    // Only close if the click target IS the overlay, not children
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onMouseDown={handleOverlayMouseDown}>
      <div className={styles.panel} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Add Complexity</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.items}>
          <ComplexityItem
            icon="🚦"
            label="Traffic Congestion"
            desc="Randomly congested road segments. Algorithm shifts from shortest distance to fastest time."
            active={flags.traffic}
            onToggle={() => toggle('traffic')}
          />
          <ComplexityItem
            icon="🌧"
            label="Rain & Flooding"
            desc="Low-elevation zones flood. Algorithm must climb to higher ground to avoid flooded nodes."
            active={flags.rain}
            onToggle={() => toggle('rain')}
          />
          <ComplexityItem
            icon="🚧"
            label="Road Closures"
            desc="Random road blocks appear. Algorithm reroutes completely around impassable segments."
            active={flags.closures}
            onToggle={() => toggle('closures')}
          />
        </div>

        {(flags.traffic || flags.rain || flags.closures) && (
          <button
            className={styles.clearAll}
            onClick={() => {
              trafficSnapshot.current = null;
              floodSnapshot.current = null;
              closureSnapshot.current = null;
              dispatch(clearDynamic());
            }}
          >
            Clear all complexity
          </button>
        )}
      </div>
    </div>
  );
}

function ComplexityItem({ icon, label, desc, active, onToggle }: {
  icon: string; label: string; desc: string; active: boolean; onToggle: () => void;
}) {
  return (
    <div className={`${styles.item} ${active ? styles.itemActive : ''}`} onClick={onToggle}>
      <span className={styles.icon}>{icon}</span>
      <div className={styles.itemText}>
        <div className={styles.itemLabel}>{label}</div>
        <div className={styles.itemDesc}>{desc}</div>
      </div>
      <div className={`${styles.switch} ${active ? styles.switchOn : ''}`}>
        <div className={styles.switchHandle} />
      </div>
    </div>
  );
}

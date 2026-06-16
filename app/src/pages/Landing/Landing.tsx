import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './Landing.module.css';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a>';

interface GraphNode {
  lat: number;
  lng: number;
}

interface GraphData {
  nodes: Record<string, GraphNode>;
  edges: Record<string, { to: string; weight: number }[]>;
}

const RUNNING_ALGORITHMS = [
  "Dijkstra's Search",
  "A* Search Heuristics",
  "Bellman-Ford Solver (SPFA)",
  "Breadth-First Search (BFS)",
  "Depth-First Search (DFS)",
  "Greedy Best-First Solver"
];

export function Landing() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const rafRef          = useRef<number | null>(null);
  const graphRef        = useRef<GraphData | null>(null);
  const cycleTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live simulation telemetry state
  const [seedsCount, setSeedsCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [activeAlgo, setActiveAlgo] = useState("A* Search Heuristics");
  const [edgesDrawn, setEdgesDrawn] = useState(0);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);

  // ── Init Leaflet map (frozen / decorative) ───────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl:         false,
      attributionControl:  false,
      dragging:            false,
      scrollWheelZoom:     false,
      doubleClickZoom:     false,
      keyboard:            false,
      touchZoom:           false,
      boxZoom:             false,
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    map.setView([40.748, -73.984], 13);

    const overlayPane = map.getPanes().overlayPane;
    const size        = map.getSize();

    const canvas         = document.createElement('canvas');
    canvas.width         = size.x;
    canvas.height        = size.y;
    canvas.setAttribute('class', 'leaflet-zoom-animated');
    canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:400;';
    overlayPane.appendChild(canvas);
    canvasRef.current = canvas;

    const alignCanvas = () => {
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas as unknown as HTMLElement, topLeft);
    };
    alignCanvas();
    map.on('move', alignCanvas);

    mapRef.current = map;

    fetch('/graph.json')
      .then(r => r.json())
      .then((data: GraphData) => {
        graphRef.current = data;
        startMoldCycle();
      })
      .catch(() => {
        // Safe fallback
      });

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (cycleTimerRef.current !== null) clearTimeout(cycleTimerRef.current);
      map.remove();
      mapRef.current    = null;
      canvasRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mold animation helpers ───────────────────────────────────────────────

  function pickSpreadNodes(graph: GraphData, count: number): string[] {
    const nodeIds = Object.keys(graph.nodes);
    if (nodeIds.length === 0) return [];

    const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);

    let minLat =  Infinity, maxLat = -Infinity;
    let minLng =  Infinity, maxLng = -Infinity;
    for (const id of nodeIds) {
      const n = graph.nodes[id];
      if (n.lat < minLat) minLat = n.lat;
      if (n.lat > maxLat) maxLat = n.lat;
      if (n.lng < minLng) minLng = n.lng;
      if (n.lng > maxLng) maxLng = n.lng;
    }

    const latRange = maxLat - minLat || 0.01;
    const lngRange = maxLng - minLng || 0.01;
    const gridSize = Math.ceil(Math.sqrt(count * 3));

    const cellMap = new Map<string, string>();
    for (const id of shuffled) {
      const n   = graph.nodes[id];
      const row = Math.floor(((n.lat - minLat) / latRange) * (gridSize - 1));
      const col = Math.floor(((n.lng - minLng) / lngRange) * (gridSize - 1));
      const key = `${row}-${col}`;
      if (!cellMap.has(key)) cellMap.set(key, id);
      if (cellMap.size >= count * 2) break;
    }

    const candidates = Array.from(cellMap.values());
    return candidates.sort(() => Math.random() - 0.5).slice(0, count);
  }

  function buildBFSEdges(graph: GraphData, seeds: string[]): [string, string][] {
    const visited = new Set<string>(seeds);
    const queues: [string, string][][] = seeds.map(s => {
      const children = (graph.edges[s] ?? []).map(e => [s, e.to] as [string, string]);
      children.forEach(([, c]) => visited.add(c));
      return children;
    });

    const result: [string, string][] = [];
    let anyLeft = true;
    while (anyLeft) {
      anyLeft = false;
      for (const q of queues) {
        if (q.length === 0) continue;
        anyLeft = true;
        const edge = q.shift()!;
        result.push(edge);
        const [, parent] = edge;
        for (const e of graph.edges[parent] ?? []) {
          if (!visited.has(e.to)) {
            visited.add(e.to);
            q.push([parent, e.to]);
          }
        }
      }
    }
    return result;
  }

  function startMoldCycle() {
    const graph  = graphRef.current;
    const map    = mapRef.current;
    const canvas = canvasRef.current;
    if (!graph || !map || !canvas) return;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (cycleTimerRef.current !== null) clearTimeout(cycleTimerRef.current);

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const numSeeds = 3 + Math.floor(Math.random() * 2);
    setSeedsCount(numSeeds);
    
    // Pick background solver name randomly
    const algoName = RUNNING_ALGORITHMS[Math.floor(Math.random() * RUNNING_ALGORITHMS.length)];
    setActiveAlgo(algoName);

    const seeds = pickSpreadNodes(graph, numSeeds);
    if (seeds.length === 0) return;

    const edges          = buildBFSEdges(graph, seeds);
    let   edgeIndex      = 0;
    const EDGES_PER_FRAME = 3;

    setProgress(0);
    setEdgesDrawn(0);

    const initialLogs = [
      `[0.00s] SYSTEM: INITIALIZING HUD SEARCH GRID`,
      `[0.02s] SOLVER: SELECTED SUBPROCESS "${algoName.toUpperCase()}"`,
      `[0.05s] SEEDING: PROJECTED ${numSeeds} SPATIAL ORIGINS ON MANHATTAN GRID`,
    ];
    setTelemetryLogs(initialLogs);

    const project = (lat: number, lng: number) => {
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      const lp      = map.latLngToLayerPoint([lat, lng]);
      return { x: lp.x - topLeft.x, y: lp.y - topLeft.y };
    };

    const drawNextBatch = () => {
      if (!canvasRef.current || !mapRef.current) return;

      const batch = edges.slice(edgeIndex, edgeIndex + EDGES_PER_FRAME);
      edgeIndex  += EDGES_PER_FRAME;

      setEdgesDrawn(edgeIndex);
      const currentProgress = Math.round((edgeIndex / edges.length) * 100);
      setProgress(currentProgress);

      ctx.lineCap  = 'round';
      ctx.lineJoin = 'round';

      for (const [fromId, toId] of batch) {
        const from = graph.nodes[fromId];
        const to   = graph.nodes[toId];
        if (!from || !to) continue;

        const p1 = project(from.lat, from.lng);
        const p2 = project(to.lat,   to.lng);

        // Glow aura
        ctx.strokeStyle = 'rgba(255,85,0,0.12)';
        ctx.lineWidth   = 4.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Vibrant core
        ctx.strokeStyle = '#ff5500';
        ctx.lineWidth   = 1.6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      if (batch.length > 0) {
        const targetNode = batch[0][1];
        const nodeObj = graph.nodes[targetNode];
        const timestamp = (performance.now() / 1000).toFixed(2);
        const logMsg = `[${timestamp}s] RELAX: node_${targetNode.slice(0, 5)}... @ [${nodeObj?.lat.toFixed(4)}, ${nodeObj?.lng.toFixed(4)}]`;
        setTelemetryLogs(prev => [...prev, logMsg].slice(-16));
      }

      if (edgeIndex < edges.length) {
        rafRef.current = requestAnimationFrame(drawNextBatch);
      } else {
        setTelemetryLogs(prev => [...prev, `[CYCLE] COMPLETED Wavefront Sweep. Resetting in 2.0s.`].slice(-16));
        cycleTimerRef.current = setTimeout(() => startMoldCycle(), 2000);
      }
    };

    // Safety: restart after 8 s regardless
    cycleTimerRef.current = setTimeout(() => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startMoldCycle();
    }, 8000);

    rafRef.current = requestAnimationFrame(drawNextBatch);
  }

  return (
    <div className={styles.landingRoot}>
      {/* Decorative background map */}
      <div ref={mapContainerRef} className={styles.mapBackground} />

      {/* Ambient shadow overlay */}
      <div className={styles.mapTint} />

      {/* Floating HUD status bar */}
      <div className={styles.hudHeader}>
        <div className={styles.hudBadge}>
          <span className={styles.hudDot} />
          SYSTEM_STATE: RUNNING_AUTO
        </div>
        <div className={styles.hudStats}>
          <span className={styles.hudStat}>REGION: <strong>NYC_MANHATTAN</strong></span>
          <span className={styles.hudStat}>INDEX: <strong>15.42k SEGMENTS</strong></span>
        </div>
      </div>

      <div className={styles.dashboardContainer}>
        {/* Left Control Center Panel */}
        <div className={styles.controlPanel}>
          <div className={styles.titleBlock}>
            <div className={styles.brandBadge}>CORE TOPOLOGY SOLVER</div>
            <h1 className={styles.titleMain}>
              Pathfinder<span className={styles.plus}>+</span>
            </h1>
            <p className={styles.titleSub}>
              An interactive GIS instrument visualizing graph pathfinding mechanics. Observe wavefront propagation, dynamically adjusted congestion models, and negative cycle relaxation live.
            </p>
          </div>

          <Link to="/app" className={styles.ctaButton}>
            LAUNCH SYSTEM SIMULATOR
          </Link>

          {/* Reference Solver Info */}
          <div className={styles.algoSection}>
            <h3 className={styles.sectionHeader}>SOLVER REGISTER</h3>
            <div className={styles.algoGrid}>
              <div className={styles.algoItem}>
                <span className={styles.algoNum}>01</span>
                <div>
                  <span className={styles.algoName}>A* & Dijkstra Solvers</span>
                  <span className={styles.algoDesc}>Optimal weighted shortest path search</span>
                </div>
              </div>
              <div className={styles.algoItem}>
                <span className={styles.algoNum}>02</span>
                <div>
                  <span className={styles.algoName}>Bellman-Ford SPFA</span>
                  <span className={styles.algoDesc}>Queue-optimized negative edge solver</span>
                </div>
              </div>
              <div className={styles.algoItem}>
                <span className={styles.algoNum}>03</span>
                <div>
                  <span className={styles.algoName}>BFS & DFS Traversals</span>
                  <span className={styles.algoDesc}>Unweighted spatial expansion</span>
                </div>
              </div>
              <div className={styles.algoItem}>
                <span className={styles.algoNum}>04</span>
                <div>
                  <span className={styles.algoName}>Greedy Best-First</span>
                  <span className={styles.algoDesc}>Heuristic-based grid convergence</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Telemetry Terminal Panel */}
        <div className={styles.telemetryPanel}>
          <div className={styles.telemetryHeader}>
            <span className={styles.telemetryTitle}>TELEMETRY STREAM // {activeAlgo.toUpperCase()}</span>
            <span className={styles.telemetryBadge}>LIVE_FEED</span>
          </div>

          <div className={styles.terminalBox}>
            <div className={styles.terminalHeader}>
              <span className={styles.terminalHeaderTitle}>SYS_LOG.stdout</span>
              <span className={styles.terminalHeaderStats}>
                {seedsCount} ORIGINS | {edgesDrawn} EDGES | {progress}% CONVERGENCE
              </span>
            </div>
            <pre className={styles.terminalBody}>
              {telemetryLogs.map((log, index) => (
                <div key={index} className={styles.terminalLine}>
                  <span className={styles.terminalLineNum}>{(index + 1).toString().padStart(2, '0')}</span>
                  <span className={styles.terminalLineText}>{log}</span>
                </div>
              ))}
            </pre>
          </div>

          <div className={styles.chartContainer}>
            <div className={styles.chartBar} style={{ width: `${progress}%` }} />
            <div className={styles.chartText}>FRONT WAVE CONVERGENCE INDEX // {progress}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

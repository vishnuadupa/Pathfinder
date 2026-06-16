import { useEffect, useRef } from 'react';
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

export function Landing() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const rafRef          = useRef<number | null>(null);
  const graphRef        = useRef<GraphData | null>(null);
  const cycleTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Canvas overlay in overlayPane (same technique as MapView)
    const overlayPane = map.getPanes().overlayPane;
    const size        = map.getSize();

    const canvas         = document.createElement('canvas');
    canvas.width         = size.x;
    canvas.height        = size.y;
    canvas.setAttribute('class', 'leaflet-zoom-animated');
    canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:400;';
    overlayPane.appendChild(canvas);
    canvasRef.current = canvas;

    // Keep canvas position synced
    const alignCanvas = () => {
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas as unknown as HTMLElement, topLeft);
    };
    alignCanvas();
    map.on('move', alignCanvas);

    mapRef.current = map;

    // Fetch graph and start ambient animation
    fetch('/graph.json')
      .then(r => r.json())
      .then((data: GraphData) => {
        graphRef.current = data;
        startMoldCycle();
      })
      .catch(() => {
        // No graph — still show page, no animation
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
    const seeds    = pickSpreadNodes(graph, numSeeds);
    if (seeds.length === 0) return;

    const edges          = buildBFSEdges(graph, seeds);
    let   edgeIndex      = 0;
    const EDGES_PER_FRAME = 3;

    const project = (lat: number, lng: number) => {
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      const lp      = map.latLngToLayerPoint([lat, lng]);
      return { x: lp.x - topLeft.x, y: lp.y - topLeft.y };
    };

    const drawNextBatch = () => {
      if (!canvasRef.current || !mapRef.current) return;

      const batch = edges.slice(edgeIndex, edgeIndex + EDGES_PER_FRAME);
      edgeIndex  += EDGES_PER_FRAME;

      ctx.lineCap  = 'round';
      ctx.lineJoin = 'round';

      for (const [fromId, toId] of batch) {
        const from = graph.nodes[fromId];
        const to   = graph.nodes[toId];
        if (!from || !to) continue;

        const p1 = project(from.lat, from.lng);
        const p2 = project(to.lat,   to.lng);

        // Glow aura
        ctx.strokeStyle = 'rgba(244,63,94,0.12)';
        ctx.lineWidth   = 4.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Vibrant core
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth   = 1.6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      if (edgeIndex < edges.length) {
        rafRef.current = requestAnimationFrame(drawNextBatch);
      } else {
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
      {/* Real Leaflet map — frozen, full-screen background */}
      <div ref={mapContainerRef} className={styles.mapBackground} />

      {/* Dark tint so glass panel reads clearly */}
      <div className={styles.mapTint} />

      {/* Frosted-glass hero panel */}
      <div className={styles.heroWrapper}>
        <div className={styles.glassPanel}>

          <div className={styles.titleBlock}>
            <h1 className={styles.titleMain}>
              Pathfinder<span className={styles.plus}>+</span>
            </h1>
            <p className={styles.titleSub}>Navigate the Optimal Route</p>
          </div>

          <div className={styles.pillRow}>
            <span className={styles.pill}>6 Algorithms</span>
            <span className={styles.pill}>Real-time Visualization</span>
            <span className={styles.pill}>Dynamic Hazards</span>
          </div>

          <Link to="/app" className={styles.ctaButton}>
            Start Exploring&nbsp;&rarr;
          </Link>

          <p className={styles.tagline}>Built on real Manhattan road network data</p>
        </div>
      </div>
    </div>
  );
}

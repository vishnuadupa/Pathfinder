import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GraphData } from '../../types/graph';
import type { AnimationFrame } from '../../animation/AnimationEngine';

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

interface Props {
  graph: GraphData | null;
  startNode: string | null;
  endNode: string | null;
  onNodeSelect: (nodeId: string, type?: 'start' | 'end') => void;
  animationFrame: AnimationFrame | null;
  floodedNodes: string[];
  closedNodes: string[];
  trafficEdges: Record<string, number>;
  isRunning: boolean;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a>';

const C_START    = '#10b981'; // Emerald/Green
const C_END      = '#ff5500'; // Neon Orange
const C_PATH     = '#00ffd2'; // Cyber Cyan Path
const C_FLOOD    = '#2563eb'; // Instrument Blueprint Blue
const C_CLOSURE  = '#ef4444';


// Redraw all canvas contents from scratch (background traffic + explored routes)
// FIX ISSUE 3: caller must reset prevExploredLenRef after calling this.
// FIX ISSUE 7: traffic key now sorted so multipliers are found correctly.
function redrawAllCanvas(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  graph: GraphData,
  frame: AnimationFrame | null,
  trafficEdges: Record<string, number>,
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const topLeft = map.containerPointToLayerPoint([0, 0]);
  const project = (lat: number, lng: number) => {
    const lp = map.latLngToLayerPoint([lat, lng]);
    return { x: lp.x - topLeft.x, y: lp.y - topLeft.y };
  };

  // 1. Draw Traffic Congestion in the background
  if (Object.keys(trafficEdges).length > 0) {
    ctx.lineWidth = 2.0;
    for (const [fromId, edges] of Object.entries(graph.edges)) {
      const fromNode = graph.nodes[fromId];
      if (!fromNode) continue;
      const fromPt = project(fromNode.lat, fromNode.lng);

      for (const edge of edges) {
        if (fromId >= edge.to) continue; // Enforce single directional drawing

        // FIX ISSUE 7: sort key so it matches the sorted key used when storing multipliers
        const key = fromId < edge.to ? `${fromId}__${edge.to}` : `${edge.to}__${fromId}`;
        const multiplier = trafficEdges[key];
        if (!multiplier) continue;

        const toNode = graph.nodes[edge.to];
        if (!toNode) continue;
        const toPt = project(toNode.lat, toNode.lng);

        if (multiplier > 3.0) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'; // Heavy traffic - red
        } else {
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)'; // Moderate traffic - amber
        }

        ctx.beginPath();
        ctx.moveTo(fromPt.x, fromPt.y);
        ctx.lineTo(toPt.x, toPt.y);
        ctx.stroke();
      }
    }
  }

  // 2. Draw Creeping Explored Route Branches (Slime mold growth)
  if (frame && frame.exploredEdges.length > 0) {
    for (const [fromId, toId] of frame.exploredEdges) {
      const fromNode = graph.nodes[fromId];
      const toNode = graph.nodes[toId];
      if (!fromNode || !toNode) continue;

      const p1 = project(fromNode.lat, fromNode.lng);
      const p2 = project(toNode.lat, toNode.lng);

      // Glow aura
      ctx.strokeStyle = 'rgba(255, 85, 0, 0.12)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Vibrant core
      ctx.strokeStyle = '#ff5500';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // FIX ISSUE 6: Draw a glow dot at the start node (first edge's from-node)
    // so the origin is visible even though start has no parent edge drawn.
    const startId = frame.exploredEdges[0]?.[0];
    if (startId) {
      const startNode = graph.nodes[startId];
      if (startNode) {
        const sp = project(startNode.lat, startNode.lng);
        // Outer glow
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 85, 0, 0.25)';
        ctx.fill();
        // Bright core dot
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5500';
        ctx.fill();
      }
    }
  }
}

// Render frontier wave and path on SVG overlay (stays project-synced and crisp)
// FIX ISSUE 5: when pathRendered is true (path already drawn), update the `d`
//              attribute on the existing path element instead of wiping and
//              re-creating it, which prevents the draw animation from replaying.
function renderSvgOverlay(
  svg: SVGSVGElement,
  map: L.Map,
  graph: GraphData,
  frame: AnimationFrame,
  pathRendered: boolean,
) {
  const topLeft = map.containerPointToLayerPoint([0, 0]);

  // Capture any existing animated-path element before clearing
  const existingPath = svg.querySelector<SVGPathElement>('.animated-path');

  // Clear all SVG children
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  // 1. Draw active frontier wavefront as pulsing amber points
  if (!frame.done && frame.frontierNodes.length > 0) {
    for (const nid of frame.frontierNodes) {
      const n = graph.nodes[nid];
      if (!n) continue;
      const lp = map.latLngToLayerPoint([n.lat, n.lng]);
      const x = lp.x - topLeft.x;
      const y = lp.y - topLeft.y;

      // Glow circle
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glow.setAttribute('cx', String(x));
      glow.setAttribute('cy', String(y));
      glow.setAttribute('r', '9');
      glow.setAttribute('fill', '#f59e0b');
      glow.setAttribute('opacity', '0.5');
      glow.setAttribute('class', 'pulsing-frontier-glow');
      svg.appendChild(glow);

      // Core white circle
      const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      core.setAttribute('cx', String(x));
      core.setAttribute('cy', String(y));
      core.setAttribute('r', '3.5');
      core.setAttribute('fill', '#ffffff');
      core.setAttribute('stroke', '#f59e0b');
      core.setAttribute('stroke-width', '1.5');
      svg.appendChild(core);
    }
  }

  // 2. Draw final route path
  if (frame.done && frame.pathNodes.length >= 2) {
    const pts = frame.pathNodes.map(nid => {
      const n = graph.nodes[nid];
      if (!n) return null;
      const lp = map.latLngToLayerPoint([n.lat, n.lng]);
      return { x: lp.x - topLeft.x, y: lp.y - topLeft.y };
    }).filter(Boolean) as { x: number; y: number }[];

    if (pts.length >= 2) {
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

      // FIX ISSUE 5: if path was already rendered, reuse the element and only
      //              update its `d` attribute so the animation doesn't replay.
      if (pathRendered && existingPath) {
        existingPath.setAttribute('d', d);
        svg.appendChild(existingPath);
      } else {
        // First-time creation: build element and trigger the draw animation.
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', C_PATH);
        path.setAttribute('stroke-width', '4.5');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('class', 'animated-path');
        svg.appendChild(path);

        // FIX ISSUE 4: measure actual path length dynamically, then animate.
        // Use requestAnimationFrame to let the element render first.
        requestAnimationFrame(() => {
          const len = path.getTotalLength();
          path.style.strokeDasharray = String(len);
          path.style.strokeDashoffset = String(len);
          path.style.transition = 'stroke-dashoffset 2.5s cubic-bezier(0.2,0.8,0.2,1)';
          requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });
        });
      }
    }
  }
}

export function MapView({
  graph, startNode, endNode, onNodeSelect, animationFrame,
  floodedNodes, closedNodes, trafficEdges, isRunning
}: Props) {
  const mapRef        = useRef<L.Map | null>(null);
  const canvasRef     = useRef<HTMLCanvasElement | null>(null);
  const svgPathRef    = useRef<SVGSVGElement | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef   = useRef<L.Marker | null>(null);
  const closureLayerRef = useRef<L.LayerGroup | null>(null);
  const floodLayerRef   = useRef<L.LayerGroup | null>(null);
  const graphRef         = useLatestRef(graph);
  const onNodeSelectRef  = useLatestRef(onNodeSelect);
  const trafficEdgesRef  = useLatestRef(trafficEdges);

  // Keep track of parameters for resizing and redraws
  const lastFrameRef        = useRef<AnimationFrame | null>(null);
  const prevExploredLenRef  = useRef(0);

  // FIX ISSUE 5: track whether the path SVG element has been initially drawn
  //              so re-renders during pan/zoom don't restart the animation.
  const pathRenderedRef = useRef(false);

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    
    // Set preferCanvas to enable blistering fast circle drawing
    const map = L.map('map', { 
      zoomControl: false, 
      attributionControl: false,
      preferCanvas: true 
    });
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    map.setView([40.728, -73.96], 12);

    const size = map.getSize();
    const overlayPane = map.getPanes().overlayPane;

    // Canvas overlay inside overlayPane so it gets hardware-accelerated pan transforms!
    const canvas = document.createElement('canvas');
    canvas.width  = size.x;
    canvas.height = size.y;
    canvas.setAttribute('class', 'leaflet-zoom-animated');
    canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:400;';
    overlayPane.appendChild(canvas);
    canvasRef.current = canvas;

    // SVG overlay inside overlayPane
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'leaflet-zoom-animated');
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:401;';
    overlayPane.appendChild(svg);
    svgPathRef.current = svg;

    const alignLayers = () => {
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas as unknown as HTMLElement, topLeft);
      L.DomUtil.setPosition(svg as unknown as HTMLElement, topLeft);
    };
    alignLayers();

    closureLayerRef.current = L.layerGroup().addTo(map);
    floodLayerRef.current   = L.layerGroup().addTo(map);

    // Clicking map snaps pin to nearest node
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!graphRef.current) return;
      const nid = findNearestNode(graphRef.current, e.latlng.lat, e.latlng.lng);
      if (nid) onNodeSelectRef.current(nid);
    });

    // During pan/zoom, align layers unless actively animating zoom (to let Leaflet's CSS transform scale smoothly).
    map.on('move', () => {
      // @ts-ignore
      if (map._animatingZoom) return;
      alignLayers();
    });

    // Handle window resize — align layers, resize canvas to new viewport, then redraw
    map.on('resize', () => {
      alignLayers();
      const sz = map.getSize();
      canvas.width  = sz.x;
      canvas.height = sz.y;

      const frame = lastFrameRef.current;
      const g     = graphRef.current;
      if (!g) return;

      const ctx = canvas.getContext('2d')!;
      redrawAllCanvas(ctx, map, g, frame, trafficEdgesRef.current);

      prevExploredLenRef.current = frame?.exploredEdges.length ?? 0;

      if (frame) renderSvgOverlay(svg, map, g, frame, pathRenderedRef.current);
    });

    // moveend triggers a full alignment, canvas resize check, and redraw at the final pan/zoom state.
    map.on('moveend', () => {
      alignLayers();

      const sz = map.getSize();
      if (canvas.width !== sz.x || canvas.height !== sz.y) {
        canvas.width  = sz.x;
        canvas.height = sz.y;
      }

      const frame = lastFrameRef.current;
      const g     = graphRef.current;
      if (!g) return;

      const ctx = canvas.getContext('2d')!;
      redrawAllCanvas(ctx, map, g, frame, trafficEdgesRef.current);

      prevExploredLenRef.current = frame?.exploredEdges.length ?? 0;

      if (frame) renderSvgOverlay(svg, map, g, frame, pathRenderedRef.current);
    });

    mapRef.current = map;
  }, []);

  // Snap back to Manhattan has been removed to allow persistent exploration of other boroughs.

  // ── Map Bounds and Bounding Box Highlight ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !graph) return;

    const coords = Object.values(graph.nodes);
    if (coords.length === 0) return;

    const lats = coords.map(n => n.lat);
    const lngs = coords.map(n => n.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const padLat = (maxLat - minLat) * 0.05;
    const padLng = (maxLng - minLng) * 0.05;
    const bounds = L.latLngBounds(
      [minLat - padLat, minLng - padLng],
      [maxLat + padLat, maxLng + padLng]
    );

    map.setMaxBounds(bounds);
    map.setMinZoom(10);
    map.fitBounds(bounds);

    const highlightRect = L.rectangle([ [minLat, minLng], [maxLat, maxLng] ], {
      color: '#00ffd2',
      weight: 1.2,
      dashArray: '5, 5',
      fillColor: 'rgba(0, 255, 210, 0.012)',
      interactive: false
    }).addTo(map);

    return () => {
      highlightRect.remove();
    };
  }, [graph]);


  // ── Redraw canvas when traffic toggles ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || !graph) return;
    
    const ctx = canvas.getContext('2d')!;
    redrawAllCanvas(ctx, map, graph, lastFrameRef.current, trafficEdges);
    // FIX ISSUE 3: sync after traffic-triggered redraw
    prevExploredLenRef.current = lastFrameRef.current?.exploredEdges.length ?? 0;
  }, [trafficEdges, graph]);

  // ── Dynamic Markers (glowing custom pins) ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !graph) return;

    const makeIcon = (color: string) => L.divIcon({
      className: '',
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
          <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:${color};opacity:0.25;animation:pinPulse 1.8s infinite ease-in-out;"></div>
          <div style="position:absolute;width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 8px rgba(0,0,0,0.5);z-index:2;"></div>
        </div>
      `,
      iconSize: [24, 24], iconAnchor: [12, 12],
    });

    if (!startNode && startMarkerRef.current) { startMarkerRef.current.remove(); startMarkerRef.current = null; }
    if (!endNode   && endMarkerRef.current)   { endMarkerRef.current.remove();   endMarkerRef.current   = null; }

    if (startNode && graph.nodes[startNode]) {
      const { lat, lng } = graph.nodes[startNode];
      if (startMarkerRef.current) {
        startMarkerRef.current.setLatLng([lat, lng]);
        if (isRunning) startMarkerRef.current.dragging?.disable();
        else startMarkerRef.current.dragging?.enable();
      } else {
        startMarkerRef.current = L.marker([lat, lng], { icon: makeIcon(C_START), draggable: !isRunning, zIndexOffset: 1000 })
          .addTo(map).bindTooltip('Start');
        startMarkerRef.current.on('dragend', (e) => {
          const nid = findNearestNode(graphRef.current!, e.target.getLatLng().lat, e.target.getLatLng().lng);
          if (nid) onNodeSelectRef.current(nid, 'start');
        });
      }
    }
    if (endNode && graph.nodes[endNode]) {
      const { lat, lng } = graph.nodes[endNode];
      if (endMarkerRef.current) {
        endMarkerRef.current.setLatLng([lat, lng]);
        if (isRunning) endMarkerRef.current.dragging?.disable();
        else endMarkerRef.current.dragging?.enable();
      } else {
        endMarkerRef.current = L.marker([lat, lng], { icon: makeIcon(C_END), draggable: !isRunning, zIndexOffset: 1000 })
          .addTo(map).bindTooltip('End');
        endMarkerRef.current.on('dragend', (e) => {
          const nid = findNearestNode(graphRef.current!, e.target.getLatLng().lat, e.target.getLatLng().lng);
          if (nid) onNodeSelectRef.current(nid, 'end');
        });
      }
    }
  }, [startNode, endNode, graph, isRunning]);

  // ── Complexity overlays (circles rendered via super-smooth Canvas renderer) ─
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !graph) return;

    floodLayerRef.current?.clearLayers();
    for (const nid of floodedNodes) {
      const n = graph.nodes[nid];
      if (n) {
        L.circle([n.lat, n.lng], { 
          radius: 90, 
          color: 'transparent', 
          fillColor: C_FLOOD, 
          fillOpacity: 0.15, 
          weight: 0 
        }).addTo(floodLayerRef.current!);
      }
    }

    closureLayerRef.current?.clearLayers();
    for (const nid of closedNodes) {
      const n = graph.nodes[nid];
      if (n) {
        L.circle([n.lat, n.lng], { 
          radius: 70, 
          color: C_CLOSURE, 
          fillColor: C_CLOSURE, 
          fillOpacity: 0.35, 
          weight: 1.5 
        }).addTo(closureLayerRef.current!);
      }
    }
  }, [floodedNodes, closedNodes, graph]);

  // ── Delta Canvas Spreading & SVG Overlay Frame Render ─────────────────────
  useEffect(() => {
    const map    = mapRef.current;
    const canvas = canvasRef.current;
    const svg    = svgPathRef.current;
    if (!map || !canvas || !svg || !graph || !animationFrame) return;

    lastFrameRef.current = animationFrame;
    const ctx = canvas.getContext('2d')!;

    const topLeft = map.containerPointToLayerPoint([0, 0]);
    const project = (lat: number, lng: number) => {
      const lp = map.latLngToLayerPoint([lat, lng]);
      return { x: lp.x - topLeft.x, y: lp.y - topLeft.y };
    };

    // Creep growth: Draw only routes added since the previous frame
    const newExplored = animationFrame.exploredEdges.slice(prevExploredLenRef.current);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [fromId, toId] of newExplored) {
      const fromNode = graph.nodes[fromId];
      const toNode = graph.nodes[toId];
      if (!fromNode || !toNode) continue;

      const p1 = project(fromNode.lat, fromNode.lng);
      const p2 = project(toNode.lat, toNode.lng);

      // Glow aura
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.12)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Vibrant core
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // FIX ISSUE 6: Draw a start-node glow dot when the very first edges arrive.
    // Start has parent=null so it has no parent edge and would never be drawn.
    if (animationFrame.exploredEdges.length > 0 && prevExploredLenRef.current === 0) {
      const startId = animationFrame.exploredEdges[0]?.[0];
      if (startId) {
        const startNode = graph.nodes[startId];
        if (startNode) {
          const sp = project(startNode.lat, startNode.lng);
          // Outer glow
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
          ctx.fill();
          // Bright core dot
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#f43f5e';
          ctx.fill();
        }
      }
    }

    prevExploredLenRef.current = animationFrame.exploredEdges.length;

    // Render wavefront glowing elements & paths on SVG
    // FIX ISSUE 5: pass pathRenderedRef.current so the SVG path element is
    //              reused on pan/zoom redraws rather than recreated.
    renderSvgOverlay(svg, map, graph, animationFrame, pathRenderedRef.current);

    // FIX ISSUE 5: mark path as rendered once the animation frame is done
    if (animationFrame.done) {
      pathRenderedRef.current = true;
    }
  }, [animationFrame, graph]);

  // ── Reset ────────────────────────────────────────────────────────────────
  // FIX ISSUE 8: use trafficEdgesRef.current (always-fresh ref) instead of the
  //              closure-captured trafficEdges. This makes clearAnimation stable
  //              so the useEffect([animationFrame, clearAnimation]) below doesn't
  //              re-run and briefly wipe the canvas on every traffic state change.
  const clearAnimation = useCallback(() => {
    lastFrameRef.current       = null;
    prevExploredLenRef.current = 0;
    pathRenderedRef.current    = false; // FIX ISSUE 5: reset path-rendered flag on clear
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Redraw static traffic immediately if active
      if (graphRef.current && mapRef.current) {
        redrawAllCanvas(ctx, mapRef.current, graphRef.current, null, trafficEdgesRef.current);
      }
    }
    if (svgPathRef.current) svgPathRef.current.innerHTML = '';
  }, []); // FIX ISSUE 8: empty deps — trafficEdgesRef.current is always fresh

  useEffect(() => {
    if (!animationFrame) clearAnimation();
  }, [animationFrame, clearAnimation]);

  return <div id="map" style={{ width: '100%', height: '100%', background: '#090a0f' }} />;
}

const spatialIndices = new WeakMap<GraphData, {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  latStep: number;
  lngStep: number;
  buckets: string[][][];
}>();

function getSpatialIndex(graph: GraphData) {
  let index = spatialIndices.get(graph);
  if (index) return index;

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  const nodes = Object.entries(graph.nodes);
  
  if (nodes.length === 0) return null;

  for (const [, n] of nodes) {
    if (n.lat < minLat) minLat = n.lat;
    if (n.lat > maxLat) maxLat = n.lat;
    if (n.lng < minLng) minLng = n.lng;
    if (n.lng > maxLng) maxLng = n.lng;
  }

  // Slight padding
  minLat -= 0.001; maxLat += 0.001;
  minLng -= 0.001; maxLng += 0.001;

  const GRID_SIZE = 100;
  const latStep = (maxLat - minLat) / GRID_SIZE;
  const lngStep = (maxLng - minLng) / GRID_SIZE;

  const buckets: string[][][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => [])
  );

  for (const [id, n] of nodes) {
    const latIdx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((n.lat - minLat) / latStep)));
    const lngIdx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((n.lng - minLng) / lngStep)));
    buckets[latIdx][lngIdx].push(id);
  }

  index = { minLat, maxLat, minLng, maxLng, latStep, lngStep, buckets };
  spatialIndices.set(graph, index);
  return index;
}

function findNearestNode(graph: GraphData, lat: number, lng: number): string | null {
  const index = getSpatialIndex(graph);
  if (!index) {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const [id, n] of Object.entries(graph.nodes)) {
      const d = (n.lat - lat) ** 2 + (n.lng - lng) ** 2;
      if (d < bestDist) { bestDist = d; best = id; }
    }
    return best;
  }

  const { minLat, minLng, latStep, lngStep, buckets } = index;
  const GRID_SIZE = 100;
  const latIdx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((lat - minLat) / latStep)));
  const lngIdx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor((lng - minLng) / lngStep)));

  let best: string | null = null;
  let bestDist = Infinity;

  // 1. Get a quick candidate from the target cell, or nearby cells if empty
  let found = false;
  for (let r = 0; r < GRID_SIZE && !found; r++) {
    const minY = Math.max(0, latIdx - r), maxY = Math.min(GRID_SIZE - 1, latIdx + r);
    const minX = Math.max(0, lngIdx - r), maxX = Math.min(GRID_SIZE - 1, lngIdx + r);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        for (const id of buckets[y][x]) {
          const n = graph.nodes[id];
          const d = (n.lat - lat) ** 2 + (n.lng - lng) ** 2;
          if (d < bestDist) {
            bestDist = d;
            best = id;
            found = true;
          }
        }
      }
    }
  }

  if (!best) return null;

  // 2. Now we have a candidate at bestDist. Only scan cells that overlap with bestDist circle.
  const searchRadius = Math.sqrt(bestDist);
  const minY = Math.max(0, Math.floor((lat - searchRadius - minLat) / latStep));
  const maxY = Math.min(GRID_SIZE - 1, Math.floor((lat + searchRadius - minLat) / latStep));
  const minX = Math.max(0, Math.floor((lng - searchRadius - minLng) / lngStep));
  const maxX = Math.min(GRID_SIZE - 1, Math.floor((lng + searchRadius - minLng) / lngStep));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      for (const id of buckets[y][x]) {
        const n = graph.nodes[id];
        const d = (n.lat - lat) ** 2 + (n.lng - lng) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = id;
        }
      }
    }
  }

  return best;
}

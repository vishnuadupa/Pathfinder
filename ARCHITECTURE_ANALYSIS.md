# Pathfinder+ — Architecture & Implementation Specification

**Sources:** `Pathfinding_App_Architecture.docx` + Gemini ideation session + Q&A sessions (2026-05-31)
**Purpose:** Complete handoff document for implementation. Every decision, constraint, and behavior is captured here. Build from this.
**Status:** Specification locked. Implementation roadmap and agent scopes defined below.

---

## 1. Core Vision

An **interactive algorithm education tool** — not a navigation app. Users watch pathfinding algorithms think in real time on a real city map, compare their behavior under identical conditions, and build intuition about why one algorithm outperforms another. The experience should feel like running a controlled experiment, not using a product.

The north star: make the difference between DFS and A* something you can **see and feel**, not just read about.

---

## 2. Intended Audience

Students, developers, and curious learners who want genuine intuition about how pathfinding algorithms work — not commuters seeking directions.

---

## 3. Inspiration: How Google Maps Does It

The user explicitly wanted to understand and draw from how Google Maps achieves near-instantaneous route calculation. Key techniques that inform this project's architecture:

- **Pre-indexed road network**: Google pre-computes the entire road graph before any query. No graph construction happens at search time.
- **Contraction Hierarchies**: Roads are ranked by importance (highways > streets > alleys). Long-distance queries skip low-importance roads entirely, dramatically reducing search space.
- **Real-time + historical traffic**: Dynamic weights on edges based on current and predicted congestion.
- **Elevation + topographic data**: Node-level elevation data affects cost calculation.

**What we borrow:** The pre-computation strategy and elevation-aware node weights.
**What we simplify:** No contraction hierarchies (single city, manageable graph size). No live traffic APIs (randomized simulation instead).

---

## 4. Build Strategy (Development Philosophy)

> "Once the architecture is nailed down, once I have a bare bones working system, I can spend endless amounts of time on the user interface. That's secondary."

Build in this exact order — do not jump ahead:

| Phase | Focus | Goal |
|-------|-------|------|
| 1 | Architecture & data model | Locked-in state structure, precomputed graph |
| 2 | Bare bones computation | Straight-line (Euclidean) distance first, then node weights |
| 3 | Algorithm engine | All 6 algorithms functional, metrics captured |
| 4 | Dynamic complexity | Traffic, rain, road closures wired into cost function |
| 5 | Visualization | Mold/fungi animation, dashboard |
| 6 | UI polish | Layout, styling, UX refinement |

**Never block Phase 2–4 on Phase 5–6.**

---

## 5. Map & Data

### 5.1 City Selection
- **Primary candidate:** San Francisco or New York City (choose one; do not generalize)
- The map is fixed — users cannot switch cities

### 5.2 Data Source
- **OpenStreetMap (OSM)** via **OpenLayers** or **Leaflet**
- OSM street data ensures the node network matches real-world geography — same roads, same distances as Apple Maps / Google Maps
- This is a hard requirement: the data must be **realistic and factual**, not approximated or invented

### 5.3 Precomputed Node Network
- All nodes (intersections, waypoints) and edge weights (distances in miles or kilometers) are **precomputed before the app loads**
- The client CPU never constructs the graph at query time — it only traverses a pre-built structure
- This is what makes pathfinding near-instantaneous in the browser
- Users can only drop pins on **valid precomputed nodes** — no arbitrary coordinate selection

### 5.4 Map Interaction
- Zoom in / zoom out
- Drop exactly 2 pins: **Start** and **End**
- Pins snap to the nearest valid precomputed node
- Pin coordinates are passed directly to the algorithm as node IDs

---

## 6. Computation Environment

| Property | Decision |
|----------|----------|
| Runtime | Client-side browser only |
| Processor | CPU (browser main thread or Web Worker) |
| GPU | Not required, not used |
| Server | None — fully static deployment |
| Why CPU is enough | Precomputed graph + single city = small search space; no GPU parallelism needed |

No backend. No API calls during pathfinding. Everything runs in the browser.

---

## 7. Pathfinding Algorithms

Ordered from **least efficient to most efficient** for shortest-path finding. This ordering is intentional — users work up the ladder and feel the improvement.

| # | Algorithm | Efficiency | Key Characteristic |
|---|-----------|------------|-------------------|
| 1 | **Depth-First Search (DFS)** | Worst | Explores deep branches before backtracking. Terrible for shortest path — kept as baseline to show worst-case behavior. |
| 2 | **Bellman-Ford** | Poor | Handles negative edge weights. Slower — explores the full graph. Useful for demonstrating why negative weights complicate things. |
| 3 | **Breadth-First Search (BFS)** | Moderate | Explores all neighbors equally. Good for unweighted grids but ignores distance weights entirely. |
| 4 | **Dijkstra's Algorithm** | Good | Calculates shortest path by factoring cumulative nodal weights/distances. The reliable workhorse. |
| 5 | **Greedy Best-First Search** | Fast (not optimal) | Uses heuristic to guess the closest path to the goal. Fast but does NOT guarantee the shortest path — important contrast to show users. |
| 6 | **A\* (A-Star)** | Best | Combines Dijkstra's cumulative cost + Greedy's heuristic. Optimal and efficient. The gold standard. |

Each algorithm uses **the same graph, same start, same end** — only the traversal logic differs. This makes comparison direct and honest.

---

## 8. State Architecture (Redux Pattern)

Three strictly separated stores. No cross-contamination between them.

```
┌──────────────────────────────────────────────────────────────┐
│                        Redux Store                           │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  STATIC STATE   │  │  DYNAMIC STATE  │  │   METRICS   │  │
│  │   (immutable)   │  │ (scenario layer)│  │   STATE     │  │
│  │                 │  │                 │  │(append-only)│  │
│  │ - Base map data │  │ - Rain zones    │  │             │  │
│  │ - Node coords   │  │   (intensity    │  │ - Per-run   │  │
│  │ - Node IDs      │  │    arrays)      │  │   records   │  │
│  │ - Baseline edge │  │ - Traffic vals  │  │ - Algorithm │  │
│  │   weights (dist)│  │   (per segment) │  │   name      │  │
│  │                 │  │ - Road closure  │  │ - Compute   │  │
│  │                 │  │   flags         │  │   time      │  │
│  │                 │  │   (bool/inf)    │  │ - Distance  │  │
│  │                 │  │                 │  │ - Nodes     │  │
│  │                 │  │                 │  │   visited   │  │
│  │                 │  │                 │  │ - Space     │  │
│  │                 │  │                 │  │   complexity│  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 8.1 Static State
- Loaded once at app initialization
- Never mutated during a session
- Contains: map layout, all node geographic coordinates, all baseline edge weights (distances in miles/km)

### 8.2 Dynamic State
- Mutated by the "Add Complexity" toggles
- Cleared on Reset
- Contains: rain intensity zones (array/matrix), traffic congestion values per road segment (randomized), road closure boolean flags per node/edge

### 8.3 Metrics State
- Append-only during a session
- One record appended per successful algorithm run
- Cleared on Reset
- Each record contains: Algorithm Name, Compute Time (ms), Total Distance, Fastest Time (traffic-adjusted), Nodes Visited, Space Complexity

---

## 9. Dynamic Complexity System

Accessed via an **"Add Complexity" button** that opens a menu exposing individual toggles. Complexity layers are additive — multiple can be active simultaneously.

### 9.1 Traffic Congestion

**Setup:**
- Randomized or pattern-based traffic intensity values assigned to specific road segments in Dynamic State
- Stored as multipliers (e.g., 1.0 = free flow, 3.0 = heavy congestion)

**Algorithm behavior:**
- Shifts optimization target from **shortest distance** to **shortest time**
- Congested segments receive severe cost multipliers — the algorithm naturally avoids them
- If traffic flows freely from a different direction, the algorithm will route that way even if geometrically longer
- Output metrics include **both** total distance AND estimated travel time

**User sees:** The algorithm visually choosing a longer road because the shorter one is clogged.

---

### 9.2 Road Closures

**Setup:**
- Specific nodes or edges in Dynamic State are flagged as impassable
- Represented as infinite weight (`Infinity`) or a hard boolean block
- Visual roadblock markers appear on the map at closure locations

**Algorithm behavior:**
- When evaluating neighbors, any node/edge with closure flag is skipped entirely
- Algorithm routes completely around blocked segments
- Finds path using only open roads

**User sees:** The algorithm hitting a wall and finding the next available path.

---

### 9.3 Rain + Elevation (Flooding)

**Setup:**
- Elevation data embedded into each node in Static State (topographic data per intersection)
- Rain zones appear dynamically on the map **between** the user-selected start and end coordinates
- Low-elevation nodes in rain zones are marked as "flooded" or heavily penalized in Dynamic State

**Algorithm behavior:**
- Flooded nodes receive extreme cost penalties (near-impassable)
- Algorithm must navigate around low-lying flooded areas
- Selects higher-elevation routes to bypass flood zones
- Path may be significantly longer but avoids dangerous terrain

**User sees:** The algorithm climbing around a flooded valley instead of cutting straight through.

---

## 10. Algorithm Evaluation Loop (Core Logic)

This is the inner loop that runs for every algorithm. All complexity handling lives here:

```
function evaluateNeighbor(currentNode, neighborNode, dynamicState, staticState):

  // 1. Get base cost from static state
  baseCost = staticState.edgeWeight(currentNode, neighborNode)

  // 2. Check road closure — hard block
  if dynamicState.isClosed(neighborNode):
    return SKIP  // do not add to frontier

  // 3. Apply traffic multiplier
  trafficMultiplier = dynamicState.trafficLevel(currentNode, neighborNode)  // default 1.0
  timeCost = baseCost * trafficMultiplier

  // 4. Apply rain/elevation penalty
  elevationPenalty = 0
  if dynamicState.isFlooded(neighborNode):
    elevationPenalty = LARGE_PENALTY  // e.g., 9999

  // 5. Total cost for this edge
  totalCost = timeCost + elevationPenalty

  // 6. Add to frontier with totalCost as the edge weight
  addToFrontier(neighborNode, totalCost)
```

All 6 algorithms use this same evaluateNeighbor function. The difference between algorithms is **which node they pull from the frontier next** (stack vs queue vs priority queue vs heuristic-guided).

---

## 11. Execution Flow (Step-by-Step)

```
1. INITIALIZATION
   └─ Load Static State (map, nodes, baseline edge weights)
   └─ Render map with OpenLayers/Leaflet

2. USER INPUT
   └─ User zooms, pans map
   └─ User drops Start pin → snaps to nearest valid node
   └─ User drops End pin → snaps to nearest valid node

3. CONFIGURATION
   └─ User selects algorithm from dropdown/toggle
   └─ User optionally clicks "Add Complexity"
       ├─ Toggle: Traffic (populates Dynamic State with randomized congestion)
       ├─ Toggle: Rain (generates rain zones; marks low-elevation nodes as flooded)
       └─ Toggle: Road Closures (marks specific nodes/edges as impassable on map)

4. CALCULATE (user clicks button)
   └─ Algorithm initializes with Start node, target = End node
   └─ For each neighbor evaluated → run evaluateNeighbor() (Section 10)
   └─ Frontier expands outward

5. VISUALIZATION (concurrent with step 4)
   └─ Each node added to frontier → animate it on the map
   └─ Animation style: organic spreading, mold/fungi growing outward
   └─ Color/opacity encodes: explored vs frontier vs final path

6. PATH FOUND
   └─ Highlight the final chosen path on the map
   └─ Stop animation

7. DATA LOGGING
   └─ Capture metrics: algorithm name, compute time (ms), total distance,
       nodes visited, path length, space complexity
   └─ Append record to Metrics State

8. DISPLAY
   └─ Show new metrics record in dashboard panel
   └─ Dashboard lists all previous runs side-by-side

9. ITERATION (no reset needed)
   └─ User selects a different algorithm
   └─ Optionally changes complexity toggles
   └─ Clicks Calculate → repeat from step 4
   └─ New metrics appended to dashboard alongside old ones

10. RESET (user clicks Reset button)
    └─ Clear Dynamic State (remove all complexity overlays)
    └─ Clear Metrics State (wipe dashboard)
    └─ Clear pin selections
    └─ Map returns to clean baseline state
    └─ Return to step 2
```

---

## 12. Metrics Captured Per Run

Every successful run appends one record to the Metrics State. The dashboard displays all records side-by-side.

| Metric | Description |
|--------|-------------|
| Algorithm Name | e.g., "A*", "Dijkstra's", "DFS" |
| Compute Time | Wall-clock time to find the path (milliseconds) |
| Nodes Visited | Total nodes added to the frontier during search |
| Total Distance | Length of the found path (miles or km) |
| Estimated Travel Time | Distance adjusted for traffic (only when traffic complexity active) |
| Space Complexity | Peak frontier size (proxy for memory usage) |

---

## 13. UI Components

| Component | Behavior |
|-----------|----------|
| Map View | OpenLayers/Leaflet canvas, OSM data, zoom/pan enabled |
| Pin Drop | Click to place Start/End; snaps to valid precomputed node |
| Algorithm Selector | Dropdown or toggle group; one algorithm active at a time |
| Add Complexity Button | Opens panel with individual toggles |
| — Traffic Toggle | Populates traffic multipliers in Dynamic State |
| — Rain Toggle | Generates rain zones + marks flooded nodes |
| — Road Closure Toggle | Marks random segments as impassable; shows visual blocks |
| Calculate Button | Triggers pathfinding + animation |
| Reset Button | Clears everything — dynamic state, metrics, pins |
| Spreading Animation | Node-by-node frontier expansion rendered in real time |
| Metrics Dashboard | Persistent table; one column per run; stays until Reset |

---

## 14. Tech Stack (All Decisions Finalized)

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Framework | **React + TypeScript** | Type safety essential for graph data structures and state shape |
| State Management | **Redux Toolkit** | Matches the 3-store architecture; great DevTools for debugging algorithm state |
| Map Library | **Leaflet** | Simpler API, lighter weight, sufficient for this use case |
| Animation Layer | **SVG overlay on Leaflet** | Scalable, animatable with CSS, easy to map lat/lng to screen coords |
| Graph Data | **Pre-built static JSON** | One-time build script; no runtime API calls; fully offline-capable |
| Elevation Data | **Baked into static JSON** | Fetched at build time (Open-Elevation or USGS), embedded per node |
| City | **New York City** | Iconic grid; clean algorithm spread patterns |
| Graph Granularity | **Intersections only** | ~5,000–15,000 nodes; fast traversal, realistic, manageable file size |
| Hosting | **Vercel** | Zero-config deploys, free tier, native React support |
| Distance Units | **Miles** | |
| UI Theme | **Dark** | Makes spreading animation visually pop against the map |
| Package Manager | **npm** | |
| Map Coverage | **All 5 NYC Boroughs** | ~15,000+ nodes; most realistic scope |
| Education Sidebar | **Algorithm description + pseudocode** | Shown while animation plays |
| Animation Colors | **TBD** | Decide during UI phase; dark-theme contrast required |

---

## 15. Animation System

### Two Modes — User Toggles Between Them

| Mode | Behavior |
|------|----------|
| **Compute → Replay** | Algorithm runs instantly (no delay). Every visited node is recorded in order. Animation plays back that sequence at a fixed speed. Allows pause/rewind/restart of the same run. |
| **Real-time Step** | Algorithm executes one step at a time with a fixed delay between steps. Simpler, more "live" feeling. No rewind. |

A toggle in the UI lets the user switch between modes **before** clicking Calculate.

**Animation speed:** Fixed (no slider). Same speed for both modes. Can be tuned later if needed.

**What is animated:**
- Each node added to the frontier → rendered as an expanding circle/dot on the SVG overlay
- Color encodes state: frontier (spreading color) → explored (faded) → final path (highlighted)
- The mold/fungi metaphor is achieved by the organic outward spread pattern of the frontier

---

## 16. Graph Precomputation (Build Step)

This runs once, offline, before the app is deployed. Output is a static JSON file bundled with the app.

```
build-graph/
  ├── fetch-osm.py         # Query Overpass API for NYC street network
  ├── fetch-elevation.py   # For each node, fetch elevation from Open-Elevation / USGS
  ├── compute-weights.py   # Calculate edge weights (distances in miles)
  └── export-graph.json    # Final output: nodes + edges + elevation

graph.json structure:
{
  "nodes": {
    "<nodeId>": {
      "lat": 40.7128,
      "lng": -74.0060,
      "elevation": 12.4       // meters above sea level
    }
  },
  "edges": {
    "<nodeId>": [
      { "to": "<neighborId>", "distance": 0.23 }  // miles
    ]
  }
}
```

The app loads `graph.json` at startup and populates Static State. No further network calls for pathfinding.

---

## 17. What This Is NOT

- Not a real-time navigation app (no live traffic APIs)
- Not a backend system (100% client-side)
- Not multi-city (single fixed city map)
- Not GPU-dependent
- Not a production routing tool — accuracy serves education, not real navigation

---

## 18. Open Questions / Future Scope

These were mentioned as possibilities but not finalized — do not implement until confirmed:

- Contraction Hierarchies (Google Maps technique) — aspirational stretch goal
- User-adjustable speed for animation playback (pause, rewind, step-through)
- Negative edge weights (Bellman-Ford demo) — may need synthetic data since real roads don't have negative weights
- Export/share results from a session

---

## 19. Summary

Pathfinder+ is a browser-based algorithm sandbox. A fixed precomputed city graph (OSM data, all 5 NYC boroughs, ~15,000+ nodes) runs entirely client-side. Users drop two pins, pick an algorithm, toggle real-world complexity variables (traffic, rain, road closures), and watch the search frontier expand across the map like spreading mold. A sidebar shows the algorithm's pseudocode while it runs. Each run's metrics are saved to a comparison dashboard. This repeats until Reset.

The six algorithms — DFS, Bellman-Ford, BFS, Dijkstra's, Greedy Best-First, A* — are presented in ascending efficiency order. Running the same route through all six and watching both the animation and the metric differences IS the product. Everything else is in service of that moment.

**Build architecture and computation first. UI is the last thing.**

---

---

# PART II — IMPLEMENTATION ROADMAP

---

## 20. Project Folder Structure

```
Pathfinder+/
├── app/                          # React + TypeScript frontend
│   ├── src/
│   │   ├── algorithms/           # All 6 pathfinding algorithm implementations
│   │   ├── store/                # Redux Toolkit slices (static, dynamic, metrics)
│   │   ├── components/           # UI components (Map, Sidebar, Dashboard, Controls)
│   │   ├── animation/            # SVG overlay + spread animation engine
│   │   ├── hooks/                # Custom React hooks
│   │   └── types/                # TypeScript types for graph, state, metrics
│   ├── public/
│   │   └── graph.json            # Precomputed NYC graph (output of build-graph/)
│   └── package.json
│
├── build-graph/                  # One-time offline data pipeline (Python)
│   ├── fetch_osm.py              # Pull NYC street network from Overpass API
│   ├── fetch_elevation.py        # Fetch elevation per node (Open-Elevation/USGS)
│   ├── compute_weights.py        # Calculate edge distances in miles
│   ├── export_graph.py           # Assemble and write graph.json
│   └── requirements.txt
│
├── graphify-out/                 # Living knowledge graph (auto-updated)
│   ├── graph.html                # Interactive visualization
│   ├── graph.json                # Raw graph data
│   └── GRAPH_REPORT.md           # Audit report
│
└── ARCHITECTURE_ANALYSIS.md      # This file
```

---

## 21. Milestones

### M1 — Project Scaffold (Days 1–2)
**Goal:** Runnable skeleton with nothing broken.
- `create-react-app` or Vite with React + TypeScript
- Redux Toolkit installed and 3 empty slices wired
- Leaflet map renders NYC, centered and zoomed correctly
- Dark tile layer applied
- Vercel project linked to repo, auto-deploy on push
- **Exit criterion:** `npm run dev` shows a dark NYC map. Deploys to Vercel.

### M2 — Graph Data Pipeline (Days 3–5)
**Goal:** `graph.json` exists and is correct.
- Python scripts in `build-graph/` pull NYC OSM data (all 5 boroughs)
- Intersections extracted as nodes with lat/lng
- Edge distances computed in miles
- Elevation fetched and embedded per node
- `graph.json` bundled into `app/public/`
- Static State slice loads and validates graph on app startup
- **Exit criterion:** Console logs `Graph loaded: N nodes, E edges` on startup.

### M3 — Algorithm Engine (Days 6–10)
**Goal:** All 6 algorithms find correct paths, headless (no UI).
- `evaluateNeighbor()` implemented with full complexity hook points (returns base cost; complexity penalties added by caller)
- All 6 algorithms implemented as pure functions: `(graph, start, end, dynamicState) => RunResult`
- `RunResult` contains: visited order array, final path, compute time, nodes visited, space complexity peak
- Unit tests for each algorithm on a small synthetic graph
- **Exit criterion:** All 6 algorithms return correct shortest paths on test graph. Metrics are accurate.

### M4 — Map Interaction + Basic Animation (Days 11–15)
**Goal:** User can drop pins and watch a basic spread animation.
- Pin drop UX: click map → nearest valid node snaps, Start/End placed
- SVG overlay mounted on Leaflet map
- Animation engine: takes `visitedOrder` array, renders nodes frame-by-frame at fixed interval
- Compute-then-Replay mode working
- Final path highlighted on completion
- **Exit criterion:** Drop 2 pins, click Calculate, watch DFS spread across the map.

### M5 — State Wiring + Metrics (Days 16–18)
**Goal:** Full Redux loop connected. Dashboard accumulates results.
- All Redux slices connected to components
- Algorithm runs dispatch to Metrics State on completion
- Dashboard renders all accumulated runs side-by-side
- Reset button clears Dynamic + Metrics state
- Real-time Step animation mode implemented (toggle works)
- **Exit criterion:** Run 3 different algorithms sequentially, see all 3 in dashboard. Reset clears all.

### M6 — Dynamic Complexity System (Days 19–23)
**Goal:** Traffic, Rain, Road Closures all affect pathfinding correctly.
- "Add Complexity" button opens panel with 3 toggles
- Each toggle populates Dynamic State with appropriate data
- `evaluateNeighbor()` reads Dynamic State penalties correctly
- Visual overlays: traffic heatmap, rain zones, road closure markers on map
- Complexity-adjusted metrics (travel time vs distance) flow to dashboard
- **Exit criterion:** Enable traffic → algorithm routes around congestion. Enable rain → algorithm climbs elevation. Enable closures → algorithm reroutes.

### M7 — Education Sidebar (Days 24–26)
**Goal:** Sidebar shows algorithm explanation + pseudocode while animation plays.
- Sidebar component renders algorithm name, plain-language description, pseudocode block
- Active line in pseudocode highlighted as animation plays (synced to step index)
- Sidebar content swaps when user changes algorithm selection
- **Exit criterion:** Run A*. Sidebar shows A* pseudocode with current step highlighted.

### M8 — Polish & Deploy (Days 27–30)
**Goal:** Shippable, demo-ready product.
- Animation colors finalized (dark-theme contrast)
- UI layout tightened: map takes 70% width, sidebar 30%
- Dashboard positioned below map or as collapsible panel
- Error states handled (no path found, graph load failure)
- Performance audit: animation smooth at 15k nodes
- Vercel production deploy
- **Exit criterion:** Full user flow works end-to-end without errors. Live URL works.

---

## 22. Six Implementation Agents — Defined Scopes

Each agent owns one domain. They work from this spec document and the graph.json. No agent touches another's domain without explicit handoff.

---

### Agent 1 — Graph Data Agent
**Domain:** `build-graph/` directory only
**Deliverable:** `app/public/graph.json` — correct, complete, validated

**Responsibilities:**
- Write Python scripts to query Overpass API for all 5 NYC boroughs
- Extract intersection nodes with lat/lng coordinates
- Compute edge distances in miles using Haversine formula
- Fetch elevation per node from Open-Elevation or USGS 3DEP API
- Validate output: no orphan nodes, all edges bidirectional, elevation present on all nodes
- Document the schema of `graph.json` in a `build-graph/README.md`

**Constraints:**
- Output must exactly match the schema in Section 16 of this spec
- Elevation field is required on every node — do not skip it
- Do not touch anything in `app/src/`

**Handoff signal:** `graph.json` exists in `app/public/`, passes validation script, logs node/edge counts correctly when loaded in browser.

---

### Agent 2 — Algorithm Engine Agent
**Domain:** `app/src/algorithms/` directory only
**Deliverable:** 6 algorithm modules + `evaluateNeighbor.ts` + unit tests

**Responsibilities:**
- Implement `evaluateNeighbor(currentNode, neighborNode, staticState, dynamicState): number | SKIP`
- Implement all 6 algorithms as pure TypeScript functions:
  - `dfs(graph, start, end, dynamicState) => RunResult`
  - `bellmanFord(graph, start, end, dynamicState) => RunResult`
  - `bfs(graph, start, end, dynamicState) => RunResult`
  - `dijkstra(graph, start, end, dynamicState) => RunResult`
  - `greedyBestFirst(graph, start, end, dynamicState) => RunResult`
  - `aStar(graph, start, end, dynamicState) => RunResult`
- Define `RunResult` type: `{ visitedOrder: string[], path: string[], computeTimeMs: number, nodesVisited: number, totalDistanceMiles: number, peakFrontierSize: number }`
- Write unit tests for each algorithm against a small synthetic 10-node graph
- Write tests specifically for complexity integration (traffic multiplier changes path, closure blocks path, elevation penalty reroutes)

**Constraints:**
- All algorithms are pure functions — zero side effects, no Redux imports
- `evaluateNeighbor` is the single entry point for all complexity logic
- Do not implement UI, animation, or Redux

**Handoff signal:** All tests pass. `dijkstra()` and `aStar()` return the same optimal path on an unweighted graph.

---

### Agent 3 — State Management Agent
**Domain:** `app/src/store/` directory only
**Deliverable:** 3 Redux Toolkit slices, typed selectors, typed actions

**Responsibilities:**
- Implement `staticSlice`: loads `graph.json` at startup, stores nodes + edges as normalized map, exposes selectors for node lookup and neighbor lookup
- Implement `dynamicSlice`: traffic multipliers (Record<edgeId, number>), rain zones (Set<nodeId>), closure flags (Set<nodeId>); actions: `setTraffic`, `setRainZones`, `setClosures`, `clearDynamic`
- Implement `metricsSlice`: append-only array of `RunRecord`; actions: `appendRun`, `clearMetrics`; selector: `selectAllRuns`
- Wire all slices into Redux store with RTK `configureStore`
- Export typed `RootState` and `AppDispatch`

**Constraints:**
- No UI code, no Leaflet, no algorithm code
- All state shapes must be serializable (no Maps, Sets in Redux — use plain objects/arrays)
- Static state is loaded once via an async thunk; never mutated after load

**Handoff signal:** Redux DevTools shows all 3 slices. `staticSlice` populated with graph data on load. `appendRun` adds a record. `clearMetrics` empties it.

---

### Agent 4 — Map & Animation Agent
**Domain:** `app/src/components/Map/` and `app/src/animation/`
**Deliverable:** Leaflet map component + SVG overlay + animation engine

**Responsibilities:**
- Mount Leaflet map centered on NYC with dark tile layer
- Implement pin drop: click event → find nearest valid node → place Start/End marker
- Mount SVG element as Leaflet overlay, coordinate system synced to map lat/lng
- Animation engine:
  - **Compute→Replay mode:** takes `visitedOrder[]`, renders nodes at fixed interval using `requestAnimationFrame`
  - **Real-time Step mode:** algorithm runs step-by-step with delay between steps
- Node states rendered as SVG circles: frontier color, explored color, path color (colors TBD)
- Final path rendered as SVG polyline
- Complexity visual overlays: traffic heatmap layer, rain zone shading, closure X markers

**Constraints:**
- No Redux dispatch — receives data via props or selectors only
- No algorithm logic — animation engine only renders what it's given
- SVG coordinates must re-project correctly when map is panned or zoomed

**Handoff signal:** Drop 2 pins on NYC map. Animation plays correctly at both zoom levels. Panning the map doesn't break SVG alignment.

---

### Agent 5 — UI & Education Agent
**Domain:** `app/src/components/` (excluding Map), `app/src/components/Sidebar/`, `app/src/components/Dashboard/`, `app/src/components/Controls/`
**Deliverable:** All UI panels — controls, sidebar, dashboard, complexity menu

**Responsibilities:**
- **Controls bar:** Algorithm selector dropdown, Animation Mode toggle, Add Complexity button, Calculate button, Reset button
- **Education sidebar:** Algorithm name, plain-language description, pseudocode block with active-line highlighting synced to animation step index
- **Metrics dashboard:** Table of all `RunRecord` entries, columns: Algorithm, Compute Time, Distance, Nodes Visited, Space Complexity; appends live after each run
- **Add Complexity panel:** Slide-out or modal with 3 toggles (Traffic, Rain, Road Closures); dispatches to `dynamicSlice` on toggle
- **Responsive layout:** Map 70% width, sidebar 30%; dashboard below map; mobile-friendly pin drop

**Constraints:**
- No algorithm logic, no Leaflet code
- All state reads via Redux selectors; all state writes via Redux actions
- Pseudocode content for each algorithm is a static data file, not fetched at runtime

**Handoff signal:** Full UI renders without errors. Algorithm selector changes sidebar content. Dashboard accumulates runs. Reset clears dashboard and complexity toggles.

---

### Agent 6 — Integration & Deploy Agent
**Domain:** Entire project — read access everywhere, write access to wiring + config + CI
**Deliverable:** Working end-to-end app deployed to Vercel

**Responsibilities:**
- Wire all agents' outputs together — ensure props flow correctly between Map, Controls, Algorithms, Redux
- Connect algorithm execution: Controls → Algorithm Engine → Animation Engine → Metrics dispatch
- Connect complexity toggles → Dynamic State → Algorithm Engine penalty inputs
- Performance audit: ensure animation is smooth at 15k nodes (profile, optimize if needed)
- Handle error states: no path found, graph load failure, invalid pin placement
- Set up Vercel project, environment variables if any, auto-deploy on `main` push
- Run full end-to-end test: all 6 algorithms × 3 complexity combinations = 18 test cases

**Constraints:**
- Does not rewrite any agent's core logic — only wires interfaces together
- Must not change the Redux state shapes defined by Agent 3
- Performance budget: animation must not drop below 30fps on mid-range laptop

**Handoff signal:** Live Vercel URL. All 6 algorithms run correctly with all 3 complexity combos. Metrics dashboard accumulates correctly. Reset works.

---

## 23. Graphify Update Strategy

The knowledge graph in `graphify-out/` is a living document — it should grow as the project grows.

### When to run `/graphify D:\Pathfinder+ --update`

| Trigger | Why |
|---------|-----|
| After each milestone completes | Captures new source files added during that phase |
| After `ARCHITECTURE_ANALYSIS.md` is updated | Keeps concept graph in sync with spec changes |
| After `build-graph/` scripts are written | Adds data pipeline nodes to the graph |
| After `app/src/algorithms/` is implemented | Adds all 6 algorithm nodes with call relationships |
| After Redux slices are implemented | Adds state management nodes and their relationships |
| After final deploy | Final snapshot of the complete system |

### What the graph will show over time
- M1: Just spec concepts (current state)
- M2: Data pipeline nodes added — `fetch_osm`, `fetch_elevation`, `export_graph`
- M3: Algorithm nodes with `calls evaluateNeighbor` edges
- M4–5: Component nodes, Redux slice relationships
- M6–8: Full system graph — 100+ nodes, clear community structure

---

## 24. Additional Suggestions

These are not in scope for the initial build but are worth considering after M8:

### High Value
- **Shareable URLs** — encode start node, end node, algorithm, and complexity state in the URL. Anyone can open a link and see the exact same scenario.
- **Algorithm Race Mode** — run all 6 algorithms simultaneously in a grid view. Watch them all spread at once, see which finishes first. Most educational feature possible.
- **Step-through mode** — pause the animation at any frame. Previous/next buttons. Each step shows what decision was just made and why (integrates with the sidebar pseudocode).
- **PWA support** — since the graph is pre-built and there's no backend, the entire app can work offline. One `manifest.json` + service worker away.

### Medium Value
- **Shareable result image** — export the final map state (explored nodes + path) as a PNG. Good for sharing on social media.
- **Keyboard shortcuts** — Space to play/pause, R to reset, 1–6 to select algorithm.
- **Color-blind friendly palette** — offer an alternate animation color scheme. The default TBD colors may not work for everyone.
- **Algorithm info tooltips** — hover over an algorithm name in the selector to see a quick explanation before selecting it.

### Stretch Goals
- **Contraction Hierarchies** — implement a simplified version to show users how Google Maps skips low-importance roads. Would require a separate precomputation step to rank roads by importance.
- **Custom graph upload** — let users upload their own city's OSM extract. The algorithm engine is city-agnostic already.
- **Multiplayer** — two users drop pins simultaneously, race to find the shortest path by choosing algorithms. Novelty feature.

---

## 25. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Overpass API rate limits NYC data fetch | Medium | High | Cache raw OSM data locally; run fetch once and commit JSON |
| graph.json too large for browser load | Medium | High | Compress with gzip; Leaflet lazy-loads tiles anyway; test load time early |
| SVG overlay desyncs from Leaflet on zoom/pan | High | Medium | Use Leaflet's `latLngToLayerPoint` on every zoom/moveend event to reproject |
| Animation janky at 15k nodes | Medium | Medium | Use canvas instead of SVG if needed; batch DOM updates; profile early |
| Open-Elevation API slow/unreliable | Medium | Low | Use USGS 3DEP as fallback; bake elevation at build time so runtime is unaffected |
| All 5 boroughs too slow to traverse for DFS | Low | Medium | Cap DFS node visit limit at 50k; show warning if path not found within cap |

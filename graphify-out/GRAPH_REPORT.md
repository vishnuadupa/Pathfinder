# Graph Report - D:/Pathfinder+  (2026-05-31)

## Corpus Check
- Corpus is ~2,913 words - fits in a single context window. You may not need a graph.

## Summary
- 42 nodes · 63 edges · 10 communities (7 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Vision & Stack|Core Vision & Stack]]
- [[_COMMUNITY_Graph Data Pipeline|Graph Data Pipeline]]
- [[_COMMUNITY_State & Metrics|State & Metrics]]
- [[_COMMUNITY_Animation & Map Rendering|Animation & Map Rendering]]
- [[_COMMUNITY_Basic Search Algorithms|Basic Search Algorithms]]
- [[_COMMUNITY_Dynamic Complexity Layers|Dynamic Complexity Layers]]
- [[_COMMUNITY_Optimal Search Algorithms|Optimal Search Algorithms]]
- [[_COMMUNITY_Project Config|Project Config]]
- [[_COMMUNITY_Google Maps Inspiration|Google Maps Inspiration]]
- [[_COMMUNITY_Source Documents|Source Documents]]

## God Nodes (most connected - your core abstractions)
1. `Pathfinder+ App` - 24 edges
2. `evaluateNeighbor Core Algorithm Loop` - 11 edges
3. `Dynamic State Store` - 5 edges
4. `Redux 3-Store Architecture` - 5 edges
5. `Precomputed Node Network` - 4 edges
6. `Static State Store` - 4 edges
7. `A* (A-Star) Algorithm` - 4 edges
8. `Animation System (Mold/Fungi Spread)` - 4 edges
9. `Google Maps Architecture Inspiration` - 3 edges
10. `OpenStreetMap (OSM) Data Source` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Project Permissions Config` --references--> `Pathfinding_App_Architecture.docx`  [EXTRACTED]
  .claude/settings.local.json → ARCHITECTURE_ANALYSIS.md

## Hyperedges (group relationships)
- **Six Pathfinding Algorithms** — arch_algo_dfs, arch_algo_bellman_ford, arch_algo_bfs, arch_algo_dijkstra, arch_algo_greedy, arch_algo_astar [EXTRACTED 1.00]
- **Three Dynamic Complexity Layers** — arch_traffic_complexity, arch_road_closure_complexity, arch_rain_elevation_complexity [EXTRACTED 1.00]
- **Three Redux State Stores** — arch_static_state, arch_dynamic_state, arch_metrics_state [EXTRACTED 1.00]
- **Two Animation Modes** — arch_compute_replay_mode, arch_realtime_step_mode [EXTRACTED 1.00]

## Communities (10 total, 3 thin omitted)

### Community 0 - "Core Vision & Stack"
Cohesion: 0.29
Nodes (7): Target Audience: Students and Developers, Build Strategy: Architecture First, UI Last, Interactive Algorithm Education Tool, New York City as Fixed Map, Pathfinder+ App, React + TypeScript Framework, Vercel Hosting

### Community 1 - "Graph Data Pipeline"
Cohesion: 0.33
Nodes (7): Graph Precomputation Build Scripts, Pre-built Static Graph JSON, Open-Elevation / USGS Elevation Data, OpenStreetMap (OSM) Data Source, Overpass API (OSM Data Fetch), Precomputed Node Network, Static State Store

### Community 2 - "State & Metrics"
Cohesion: 0.40
Nodes (5): App Execution Flow, Metrics Dashboard, Metrics State Store, Redux 3-Store Architecture, Redux Toolkit State Management

### Community 3 - "Animation & Map Rendering"
Cohesion: 0.40
Nodes (5): Animation System (Mold/Fungi Spread), Compute-then-Replay Animation Mode, Leaflet Map Library, Real-time Step Animation Mode, SVG Overlay Animation Layer

### Community 4 - "Basic Search Algorithms"
Cohesion: 0.50
Nodes (4): Bellman-Ford Algorithm, Breadth-First Search (BFS), Depth-First Search (DFS), evaluateNeighbor Core Algorithm Loop

### Community 5 - "Dynamic Complexity Layers"
Cohesion: 0.50
Nodes (4): Dynamic State Store, Rain and Elevation Flooding Complexity Layer, Road Closure Complexity Layer, Traffic Congestion Complexity Layer

### Community 6 - "Optimal Search Algorithms"
Cohesion: 0.67
Nodes (3): A* (A-Star) Algorithm, Dijkstra's Algorithm, Greedy Best-First Search

## Knowledge Gaps
- **3 isolated node(s):** `allow`, `Project Permissions Config`, `React + TypeScript Framework`
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Pathfinder+ App` connect `Core Vision & Stack` to `Graph Data Pipeline`, `State & Metrics`, `Animation & Map Rendering`, `Basic Search Algorithms`, `Optimal Search Algorithms`, `Google Maps Inspiration`, `Source Documents`?**
  _High betweenness centrality (0.670) - this node is a cross-community bridge._
- **Why does `evaluateNeighbor Core Algorithm Loop` connect `Basic Search Algorithms` to `Graph Data Pipeline`, `Dynamic Complexity Layers`, `Optimal Search Algorithms`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Why does `Animation System (Mold/Fungi Spread)` connect `Animation & Map Rendering` to `Core Vision & Stack`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `allow`, `Project Permissions Config`, `Interactive Algorithm Education Tool` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
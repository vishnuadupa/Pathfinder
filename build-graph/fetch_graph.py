"""
Fetch NYC street graph (all 5 boroughs), compute edge distances in miles,
fetch elevation per node, and write app/public/graph.json.

Run once before starting the dev server:
    pip install -r requirements.txt
    python fetch_graph.py

For faster testing use --manhattan flag:
    python fetch_graph.py --manhattan
"""

import json
import math
import sys
import time
import argparse
import requests
import osmnx as ox
import networkx as nx
from pathlib import Path

OUTPUT_PATH = Path(__file__).parent.parent / "app" / "public" / "graph.json"
OPEN_ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup"
ELEVATION_BATCH = 100   # nodes per API request


def haversine_miles(lat1, lng1, lat2, lng2) -> float:
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch_elevation(node_ids: list, lats: list, lngs: list) -> dict:
    """Fetch elevation in meters for a list of nodes. Returns {node_id: elevation}."""
    elevations = {}
    for i in range(0, len(node_ids), ELEVATION_BATCH):
        batch_ids = node_ids[i:i + ELEVATION_BATCH]
        batch_lats = lats[i:i + ELEVATION_BATCH]
        batch_lngs = lngs[i:i + ELEVATION_BATCH]
        locations = [{"latitude": lat, "longitude": lng} for lat, lng in zip(batch_lats, batch_lngs)]
        try:
            resp = requests.post(OPEN_ELEVATION_URL, json={"locations": locations}, timeout=30)
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                for nid, r in zip(batch_ids, results):
                    elevations[nid] = round(r.get("elevation", 0), 1)
            else:
                for nid in batch_ids:
                    elevations[nid] = 0.0
        except Exception as e:
            print(f"  Elevation API error (batch {i}): {e} — defaulting to 0")
            for nid in batch_ids:
                elevations[nid] = 0.0
        time.sleep(0.5)  # be polite to the API
        if i % 1000 == 0 and i > 0:
            print(f"  Elevation: {i}/{len(node_ids)} nodes fetched")
    return elevations


def build_graph(place: str, label: str):
    print(f"Fetching OSM graph for: {place}")
    G = ox.graph_from_place(place, network_type="drive", simplify=True)
    G = ox.project_graph(G, to_crs="epsg:4326")
    print(f"  Raw graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    # Convert to undirected to avoid duplicate edges
    G_undirected = ox.convert.to_undirected(G)

    node_ids = list(G_undirected.nodes())
    lats = [G_undirected.nodes[n]["y"] for n in node_ids]
    lngs = [G_undirected.nodes[n]["x"] for n in node_ids]

    # Map osmnx node IDs (large ints) to compact string IDs
    id_map = {osm_id: str(idx) for idx, osm_id in enumerate(node_ids)}

    print(f"  Fetching elevation for {len(node_ids)} nodes...")
    elevations = fetch_elevation(node_ids, lats, lngs)

    nodes = {}
    for osm_id, lat, lng in zip(node_ids, lats, lngs):
        nid = id_map[osm_id]
        nodes[nid] = {
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "elevation": elevations.get(osm_id, 0.0),
        }

    edges = {nid: [] for nid in nodes}
    for u, v, _ in G_undirected.edges(data=True):
        if u not in id_map or v not in id_map:
            continue
        uid, vid = id_map[u], id_map[v]
        dist = round(haversine_miles(
            G_undirected.nodes[u]["y"], G_undirected.nodes[u]["x"],
            G_undirected.nodes[v]["y"], G_undirected.nodes[v]["x"]
        ), 5)
        edges[uid].append({"to": vid, "distance": dist})
        edges[vid].append({"to": uid, "distance": dist})

    return nodes, edges, label


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manhattan", action="store_true", help="Only fetch Manhattan (faster for dev)")
    args = parser.parse_args()

    if args.manhattan:
        places = [("Manhattan, New York City, New York, USA", "Manhattan")]
    else:
        places = [
            ("Manhattan, New York City, New York, USA", "Manhattan"),
            ("Brooklyn, New York City, New York, USA", "Brooklyn"),
            ("Queens, New York City, New York, USA", "Queens"),
            ("The Bronx, New York City, New York, USA", "The Bronx"),
            ("Staten Island, New York City, New York, USA", "Staten Island"),
        ]

    all_nodes = {}
    all_edges = {}

    for place, label in places:
        print(f"\n--- {label} ---")
        nodes, edges, lbl = build_graph(place, label)
        # Offset node IDs by current count to avoid collisions
        offset = len(all_nodes)
        remapped_nodes = {str(int(k) + offset): v for k, v in nodes.items()}
        remapped_edges = {}
        for old_id, neighbors in edges.items():
            new_id = str(int(old_id) + offset)
            remapped_edges[new_id] = [
                {"to": str(int(n["to"]) + offset), "distance": n["distance"]}
                for n in neighbors
            ]
        all_nodes.update(remapped_nodes)
        all_edges.update(remapped_edges)
        print(f"  {lbl}: {len(nodes)} nodes added. Total so far: {len(all_nodes)}")

    # Remove nodes with no edges
    connected = {nid for nid, nbrs in all_edges.items() if nbrs}
    all_nodes = {k: v for k, v in all_nodes.items() if k in connected}
    all_edges = {k: v for k, v in all_edges.items() if k in connected}

    graph = {
        "nodes": all_nodes,
        "edges": all_edges,
        "metadata": {
            "nodeCount": len(all_nodes),
            "edgeCount": sum(len(v) for v in all_edges.values()) // 2,
            "boroughs": [p[1] for p in places],
        }
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(graph), encoding="utf-8")
    size_mb = OUTPUT_PATH.stat().st_size / 1024 / 1024
    print(f"\nWrote {OUTPUT_PATH}")
    print(f"  Nodes: {len(all_nodes)}, Edges: {graph['metadata']['edgeCount']}, Size: {size_mb:.1f} MB")


if __name__ == "__main__":
    main()

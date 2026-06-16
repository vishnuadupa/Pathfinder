export interface GraphNode {
  lat: number;
  lng: number;
  elevation: number;
}

export interface GraphEdge {
  to: string;
  distance: number; // miles
}

export interface GraphData {
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge[]>;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    boroughs: string[];
  };
}

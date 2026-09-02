import { DataFrame } from '@grafana/data';
import { runCypher } from './cypherClient';

export interface RawNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface RawRelationship {
  id: string;
  type: string;
  properties: Record<string, any>;
  sourceId: string;
  targetId: string;
}

// Parses the same JSON-stringified PascalCase node/relationship shape as
// TopologyPanel's fromDataFrames (kept in sync by hand since these are two
// separate plugin packages) — see that file for the verified shape notes.
function fromDataFrames(series: DataFrame[]): { nodes: RawNode[]; relationships: RawRelationship[] } {
  const nodesById = new Map<string, RawNode>();
  const relsById = new Map<string, RawRelationship>();

  for (const frame of series) {
    const rowCount = frame.length ?? frame.fields[0]?.values.length ?? 0;
    for (const field of frame.fields) {
      for (let i = 0; i < rowCount; i++) {
        const raw = (field.values as any)[i];
        if (typeof raw !== 'string') continue;
        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!parsed || typeof parsed !== 'object' || !parsed.ElementId) continue;

        if (Array.isArray(parsed.Labels)) {
          nodesById.set(parsed.ElementId, {
            id: parsed.ElementId,
            labels: parsed.Labels,
            properties: parsed.Props || {},
          });
        } else if (typeof parsed.Type === 'string' && parsed.StartElementId && parsed.EndElementId) {
          relsById.set(parsed.ElementId, {
            id: parsed.ElementId,
            type: parsed.Type,
            properties: parsed.Props || {},
            sourceId: parsed.StartElementId,
            targetId: parsed.EndElementId,
          });
        }
      }
    }
  }

  return { nodes: [...nodesById.values()], relationships: [...relsById.values()] };
}

// Always unfiltered — this panel is for editing the whole graph, not a
// filtered view of it. OPTIONAL MATCH keeps isolated nodes (no edges yet)
// pickable in the dropdowns, and every relationship is captured exactly
// once since each has exactly one source node to anchor from.
export async function fetchAll(datasourceName: string): Promise<{ nodes: RawNode[]; relationships: RawRelationship[] }> {
  const frames = await runCypher(datasourceName, 'MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m');
  return fromDataFrames(frames);
}

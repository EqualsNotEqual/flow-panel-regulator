import { from } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { DataFrame, DataQueryRequest, getDefaultTimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

// Identifiers (labels, relationship types) can't be parameterized in Cypher —
// same restriction api/'s db.js worked around, ported here since api/ is no
// longer in this panel's write path.
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertValidIdentifier(value: string, kind: string): void {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Invalid ${kind}: ${value}`);
  }
}

// The kniepdennis-neo4j-datasource query target has no parameters field —
// only a raw cypherQuery string reaches its Go backend (verified by reading
// its compiled module.js: the only per-target field besides Format is
// cypherQuery). So unlike api/'s $props-based Bolt parameters, every value
// here has to be interpolated as a literal — these two functions are the
// injection defense that api/'s parameterized session.run() used to provide.
function cypherStringLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function cypherLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(cypherLiteral).join(', ')}]`;
  return cypherStringLiteral(String(value));
}

export function cypherPropsLiteral(props: Record<string, unknown>): string {
  const entries = Object.entries(props).map(([k, v]) => `${k}: ${cypherLiteral(v)}`);
  return `{${entries.join(', ')}}`;
}

// Runs one Cypher statement through whatever datasource `datasourceName`
// resolves to (by Grafana datasource name, same as typed into Panel
// options) — the same neo4j-datasource connection TopologyPanel reads
// through, just invoked ad hoc at runtime instead of via a dashboard's own
// Queries tab. Format: table matches what TopologyPanel's fromDataFrames
// already expects (JSON-stringified PascalCase node/relationship cells).
export async function runCypher(datasourceName: string, cypherQuery: string): Promise<DataFrame[]> {
  const ds = await getDataSourceSrv().get(datasourceName);
  const request: DataQueryRequest = {
    requestId: `tradeflow-maintenance-${Date.now()}`,
    interval: '1s',
    intervalMs: 1000,
    range: getDefaultTimeRange(),
    scopedVars: {},
    targets: [{ refId: 'A', cypherQuery, Format: 'table' } as any],
    timezone: 'browser',
    app: 'panel',
    startTime: Date.now(),
  };
  const response = await firstValueFrom(from(ds.query(request)));
  if (response.error) throw new Error(response.error.message || 'Query failed');
  if (response.errors && response.errors.length > 0) {
    throw new Error(response.errors.map((e) => e.message).join('; '));
  }
  return response.data as DataFrame[];
}

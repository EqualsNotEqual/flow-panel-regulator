// Builds and runs the same CREATE/DETACH DELETE statements api/'s routes
// used to run with real Bolt parameters — now built as literal Cypher text
// via cypherLiteral/cypherPropsLiteral, since the neo4j-datasource query
// target has no parameters field of its own. See cypherClient.ts for the
// escaping this relies on for injection safety.
import { assertValidIdentifier, cypherPropsLiteral, cypherLiteral, runCypher } from './cypherClient';

export async function createNode(datasourceName: string, label: string, properties: Record<string, any>) {
  assertValidIdentifier(label, 'label');
  await runCypher(datasourceName, `CREATE (n:${label}) SET n = ${cypherPropsLiteral(properties)} RETURN n`);
}

export async function createRelationship(
  datasourceName: string,
  sourceId: string,
  targetId: string,
  type: string,
  properties: Record<string, any>
) {
  assertValidIdentifier(type, 'relationship type');
  await runCypher(
    datasourceName,
    `MATCH (a), (b) WHERE elementId(a) = ${cypherLiteral(sourceId)} AND elementId(b) = ${cypherLiteral(targetId)} ` +
      `CREATE (a)-[r:${type}]->(b) SET r = ${cypherPropsLiteral(properties)} RETURN r`
  );
}

export async function deleteNode(datasourceName: string, label: string, id: string) {
  assertValidIdentifier(label, 'label');
  await runCypher(
    datasourceName,
    `MATCH (n:${label}) WHERE elementId(n) = ${cypherLiteral(id)} DETACH DELETE n RETURN count(n) AS deleted`
  );
}

export async function deleteRelationship(datasourceName: string, id: string) {
  await runCypher(
    datasourceName,
    `MATCH ()-[r]->() WHERE elementId(r) = ${cypherLiteral(id)} DELETE r RETURN count(r) AS deleted`
  );
}

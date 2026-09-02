import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelProps } from '@grafana/data';
import { MaintenancePanelOptions } from '../types';
import { RawNode, RawRelationship, fetchAll } from '../utils/graphData';
import { createNode, createRelationship, deleteNode, deleteRelationship } from '../utils/writeOps';

interface Props extends PanelProps<MaintenancePanelOptions> {}

const cardStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 260,
};
const labelStyle: React.CSSProperties = { fontSize: 13, color: '#94a3b8', fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  fontSize: 15,
  padding: '9px 12px',
  background: '#020617',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 5,
};

// Chrome's autofill (esp. on macOS, triggered by fields like "Name") paints
// its own light background over inputStyle's dark one without touching our
// text color — the box-shadow trick below repaints that background back to
// our own dark color so typed/selected text stays visible instead of
// vanishing against Chrome's default autofill fill.
const AUTOFILL_OVERRIDE_CSS = `
  .tf-input::selection { background: #2563eb; color: #ffffff; }
  .tf-input:-webkit-autofill,
  .tf-input:-webkit-autofill:hover,
  .tf-input:-webkit-autofill:focus {
    -webkit-text-fill-color: #e2e8f0;
    -webkit-box-shadow: 0 0 0 1000px #020617 inset;
    box-shadow: 0 0 0 1000px #020617 inset;
    caret-color: #e2e8f0;
  }
`;
// Chrome (both mobile and desktop) renders <select> shorter than a
// same-styled <input> despite identical padding — it sizes the native
// control off font metrics rather than the box model, so an explicit
// minHeight is needed to actually match the two visually.
const selectStyle: React.CSSProperties = { ...inputStyle, minHeight: 40 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
const buttonStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  background: '#3b82f6',
  color: '#fff',
  fontWeight: 600,
  border: 'none',
};
const deleteButtonStyle: React.CSSProperties = { ...buttonStyle, background: '#7f1d1d' };

function nodeOptionLabel(n: RawNode): string {
  return `${n.properties?.name ?? n.id} (${n.labels[0]})`;
}

function relOptionLabel(r: RawRelationship, nodes: RawNode[]): string {
  const source = nodes.find((n) => n.id === r.sourceId);
  const target = nodes.find((n) => n.id === r.targetId);
  return `${source?.properties?.name ?? r.sourceId} -${r.type}-> ${target?.properties?.name ?? r.targetId}`;
}

export const MaintenancePanel: React.FC<Props> = ({ width, height, options, renderCounter }) => {
  const style = useMemo(() => ({ width, height }), [width, height]);

  const [nodes, setNodes] = useState<RawNode[]>([]);
  const [rels, setRels] = useState<RawRelationship[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAll(options.datasourceName)
      .then(({ nodes: n, relationships: r }) => {
        if (cancelled) return;
        setNodes(n);
        setRels(r);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [options.datasourceName, renderCounter, reloadTick]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  const [nodeLabel, setNodeLabel] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState('');
  const [relProduct, setRelProduct] = useState('');
  const [relProtocol, setRelProtocol] = useState('');
  const [relDesks, setRelDesks] = useState('');
  const [deleteNodeId, setDeleteNodeId] = useState('');
  const [deleteRelId, setDeleteRelId] = useState('');

  async function run(action: () => Promise<any>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const handleAddNode = () => {
    if (!nodeLabel.trim() || !nodeName.trim()) return;
    run(async () => {
      await createNode(options.datasourceName, nodeLabel.trim(), { name: nodeName.trim() });
      setNodeName('');
    });
  };

  const handleAddFlow = () => {
    if (!sourceId || !targetId || !relType.trim()) return;
    run(async () => {
      const properties: Record<string, any> = {};
      if (relProduct.trim()) properties.product = relProduct.trim();
      if (relProtocol.trim()) properties.protocol = relProtocol.trim();
      if (relDesks.trim())
        properties.desks = relDesks
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
      await createRelationship(options.datasourceName, sourceId, targetId, relType.trim(), properties);
      setRelProduct('');
      setRelProtocol('');
      setRelDesks('');
    });
  };

  const handleDeleteNode = () => {
    const n = nodes.find((x) => x.id === deleteNodeId);
    if (!n) return;
    run(async () => {
      await deleteNode(options.datasourceName, n.labels[0], n.id);
      setDeleteNodeId('');
    });
  };

  const handleDeleteRel = () => {
    if (!deleteRelId) return;
    run(async () => {
      await deleteRelationship(options.datasourceName, deleteRelId);
      setDeleteRelId('');
    });
  };

  return (
    <div
      style={{
        ...style,
        background: '#0b1120',
        padding: 16,
        overflow: 'auto',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
      }}
    >
      <style>{AUTOFILL_OVERRIDE_CSS}</style>
      {error && (
        <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12, fontFamily: 'monospace' }}>{error}</div>
      )}
      {busy && <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>Working…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: 14 }}>+ Add node</div>
          <div>
            <div style={labelStyle}>Label</div>
            <input className="tf-input" autoComplete="off" style={{ ...inputStyle, width: '100%' }} placeholder="e.g. Desk" value={nodeLabel} onChange={(e) => setNodeLabel(e.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Name</div>
            <input className="tf-input" autoComplete="off" style={{ ...inputStyle, width: '100%' }} placeholder="e.g. Corp" value={nodeName} onChange={(e) => setNodeName(e.target.value)} />
          </div>
          <button style={buttonStyle} onClick={handleAddNode} disabled={busy}>
            Add node
          </button>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>+ Add flow</div>
          <div>
            <div style={labelStyle}>Source</div>
            <select style={{ ...selectStyle, width: '100%' }} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Select…</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {nodeOptionLabel(n)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Target</div>
            <select style={{ ...selectStyle, width: '100%' }} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select…</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {nodeOptionLabel(n)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Type</div>
            <input className="tf-input" autoComplete="off" style={{ ...inputStyle, width: '100%' }} placeholder="e.g. SENDS_TO" value={relType} onChange={(e) => setRelType(e.target.value)} />
          </div>
          <div style={rowStyle}>
            <input className="tf-input" autoComplete="off" style={{ ...inputStyle, flex: 1 }} placeholder="product (optional)" value={relProduct} onChange={(e) => setRelProduct(e.target.value)} />
            <input className="tf-input" autoComplete="off" style={{ ...inputStyle, flex: 1 }} placeholder="protocol (optional)" value={relProtocol} onChange={(e) => setRelProtocol(e.target.value)} />
          </div>
          <input className="tf-input" autoComplete="off" style={inputStyle} placeholder="desks, comma-separated (optional)" value={relDesks} onChange={(e) => setRelDesks(e.target.value)} />
          <button style={buttonStyle} onClick={handleAddFlow} disabled={busy}>
            Add flow
          </button>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>Delete node</div>
          <select style={{ ...selectStyle, width: '100%' }} value={deleteNodeId} onChange={(e) => setDeleteNodeId(e.target.value)}>
            <option value="">Pick a node…</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {nodeOptionLabel(n)}
              </option>
            ))}
          </select>
          <button style={deleteButtonStyle} onClick={handleDeleteNode} disabled={busy || !deleteNodeId}>
            Delete node
          </button>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 14 }}>Delete flow</div>
          <select style={{ ...selectStyle, width: '100%' }} value={deleteRelId} onChange={(e) => setDeleteRelId(e.target.value)}>
            <option value="">Pick a flow…</option>
            {rels.map((r) => (
              <option key={r.id} value={r.id}>
                {relOptionLabel(r, nodes)}
              </option>
            ))}
          </select>
          <button style={deleteButtonStyle} onClick={handleDeleteRel} disabled={busy || !deleteRelId}>
            Delete flow
          </button>
        </div>
      </div>
    </div>
  );
};

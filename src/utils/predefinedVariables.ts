import { getTemplateSrv } from '@grafana/runtime';
import { ComboboxOption } from '@grafana/ui';

// Reads a dashboard's Custom multi-property variable (e.g. $node, $flow) as
// a list of Combobox options, keyed by each option's `text` rather than its
// `value`. Multiple rows can legitimately share one underlying value --
// e.g. several SEND_TRADES variants, one per (product, tradeType)
// combination -- and `text` is what's guaranteed unique across rows, so
// it's what the Combobox needs to track which row is actually selected.
// Maintained by editing the variable's JSON (Dashboard settings ->
// Variables), not here. Recomputed every render (cheap in-memory lookup)
// so edits show up without this panel needing to reload separately.
export function getVariableOptions(variableName: string): ComboboxOption[] {
  const variable = getTemplateSrv()
    .getVariables()
    .find((v) => v.name === variableName);
  if (!variable || !('options' in variable)) return [];
  return (variable.options as Array<{ text: unknown }>).map((o) => ({
    value: String(o.text),
    label: String(o.text),
  }));
}

// Looks up one option by its (unique) text, returning the real underlying
// value (e.g. the actual Cypher relationship type, "SEND_TRADES") plus
// whatever other properties that row carries (product, tradeType, ...).
// This is how one Type selection carries a whole predefined combination of
// attributes through to what actually gets created -- no separate picker
// needed per attribute.
export function getVariableOptionByText(
  variableName: string,
  text: string
): { value: string; properties: Record<string, any> } | null {
  const variable = getTemplateSrv()
    .getVariables()
    .find((v) => v.name === variableName);
  if (!variable || !('options' in variable)) return null;
  const match = (
    variable.options as Array<{ text: unknown; value: unknown; properties?: Record<string, any> }>
  ).find((o) => String(o.text) === text);
  if (!match) return null;
  // Grafana copies every top-level key (including text/value themselves)
  // into .properties too -- strip those back out so callers spreading this
  // into a real Cypher property map don't pick up redundant text/value
  // fields alongside the attributes that actually matter (product, etc.).
  const { text: _text, value: _value, ...attributes } = match.properties ?? {};
  return { value: String(match.value), properties: attributes };
}

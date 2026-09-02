import { getTemplateSrv } from '@grafana/runtime';
import { ComboboxOption } from '@grafana/ui';

// Reads a dashboard's Custom multi-property variable (e.g. $node, $flow) as
// a list of Combobox options. This is how predefined labels/relationship
// types are maintained: edit the variable's JSON (Dashboard settings ->
// Variables), not a code change or a panel-option editor -- verified live
// that getTemplateSrv().getVariables() exposes the FULL option list (not
// just the current selection) with each option's custom properties intact
// (e.g. .properties.color), and that allowCustomValue is enforced by
// Grafana itself, so there's nothing extra to validate here for that part.
export function getVariableOptions(variableName: string): ComboboxOption[] {
  const variable = getTemplateSrv()
    .getVariables()
    .find((v) => v.name === variableName);
  if (!variable || !('options' in variable)) return [];
  return (variable.options as Array<{ value: unknown; text: unknown }>).map((o) => ({
    value: String(o.value),
    label: String(o.text),
  }));
}

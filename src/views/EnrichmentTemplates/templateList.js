// The templates list: what each template writes in people's words, and moving one up or down.

const POSITION_STEP = 10;

/** "Meta title, Meta description": the template's fields by their catalog names (the key when unknown). */
export function fieldsSummary(template, catalogFields = []) {
  const names = new Map(catalogFields.map((field) => [field.key, field.label]));
  return (template.params?.fields || []).map((key) => names.get(key) || key).join(", ");
}

/** `templates` with the one at `index` moved by `step` (±1), positions renumbered 10, 20, …; `changed` = those whose
 * position differs from before (the PATCHes to send). */
export function reorder(templates, index, step) {
  const target = index + step;
  if (target < 0 || target >= templates.length) return { order: templates, changed: [] };
  const moved = [...templates];
  [moved[index], moved[target]] = [moved[target], moved[index]];
  const order = moved.map((template, i) => ({ ...template, position: (i + 1) * POSITION_STEP }));
  const before = new Map(templates.map((template) => [template.key, template.position]));
  return { order, changed: order.filter((template) => before.get(template.key) !== template.position) };
}

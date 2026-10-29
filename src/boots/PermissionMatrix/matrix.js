// The rules of the permission matrix, kept out of the template: catalogue groups are `[{ module, areas: [{ key,
// label, levels, sensitive, assignable }] }]` (django-access `catalogue/`), a value is `{ "<area>": "read" | "write" }`
// with no entry for "none". Write implies read, so a level an area does not offer clamps down, never up.
export const NONE = "none";
export const LEVELS = [NONE, "read", "write"];

// Non-assignable areas (access.manage) are shown only on a built-in role's read-only matrix.
export function visibleGroups(groups, showReserved = false) {
  return groups
    .map((group) => ({ ...group, areas: group.areas.filter((area) => showReserved || area.assignable) }))
    .filter((group) => group.areas.length);
}

export function clampLevel(area, level) {
  if (level === NONE || area.levels.includes(level)) return level;
  return level === "write" && area.levels.includes("read") ? "read" : NONE;
}

export function setLevel(value, areaKey, level) {
  const next = { ...value };
  if (level === NONE) delete next[areaKey];
  else next[areaKey] = level;
  return next;
}

export function setGroup(value, areas, level) {
  return areas.reduce((next, area) => setLevel(next, area.key, clampLevel(area, level)), value);
}

// The level "set all" would have produced for the group as it stands, or null when the areas differ.
export function groupLevel(value, areas) {
  const matches = (level) => areas.every((area) => (value[area.key] || NONE) === clampLevel(area, level));
  return LEVELS.find(matches) ?? null;
}

// Only the areas a custom role may hold: never access.manage, whatever the value carries.
export function assignableOnly(value, groups) {
  const assignable = new Set(groups.flatMap((group) => group.areas.filter((a) => a.assignable).map((a) => a.key)));
  return Object.fromEntries(Object.entries(value).filter(([area, level]) => assignable.has(area) && level !== NONE));
}

// `{area: level}` → the API's `["<area>:<level>"]`, assignable areas only.
export function toPermissionKeys(value, groups) {
  return Object.entries(assignableOnly(value, groups)).map(([area, level]) => `${area}:${level}`);
}

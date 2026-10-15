import { outputKind } from "@/views/EnrichmentStudio/studioLogic";

// A Studio step's output read outside the Studio (Review Focus): which of the Studio's renderers shows it, and a
// plain field list for a shape none of them knows. Pure functions — never the value's JSON.

/** questions | document | keywords | meta | text | data — the Studio renderer of a step's value. */
export function artifactKind(value) {
  if (Array.isArray(value?.questions)) return "questions";
  if (typeof value?.body_markdown === "string") return "document";
  return outputKind(null, value);
}

const isScalar = (value) => value == null || typeof value !== "object";
const isBlankValue = (value) =>
  value == null || value === "" || (Array.isArray(value) && !value.length) ||
  (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);

/** "serp_notes" → "Serp notes". */
export function keyLabel(key) {
  const words = String(key).replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One line of a nested value: its scalar parts joined ("sofa care · 1200 · informational"). */
function lineOf(value) {
  if (isScalar(value)) return String(value ?? "");
  return Object.values(value).filter((part) => isScalar(part) && part !== "" && part != null).join(" · ");
}

function shapeOf(value) {
  if (isScalar(value)) return { text: String(value) };
  if (Array.isArray(value)) {
    return value.every(isScalar) ? { chips: value.map(String) } : { items: value.map(lineOf).filter(Boolean) };
  }
  return { items: Object.entries(value).map(([key, part]) => `${keyLabel(key)}: ${lineOf(part)}`) };
}

/** [{ key, label, text | chips | items }] of a value (its `data` envelope unwrapped); empty parts left out. */
export function readableFields(value) {
  const data = value?.data && typeof value.data === "object" ? value.data : value;
  if (!data || typeof data !== "object") return [];
  return Object.entries(data)
    .filter(([, part]) => !isBlankValue(part))
    .map(([key, part]) => ({ key, label: keyLabel(key), ...shapeOf(part) }));
}

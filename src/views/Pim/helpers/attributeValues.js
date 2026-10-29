/** A JSON attribute value as editable text: strings stay, objects are pretty-printed, empty is "". */
export function jsonToString(value) {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  return JSON.stringify(value, null, 2)
}

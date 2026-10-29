// Plural form of a count as an i18n key suffix: Polish needs three forms (1 / 2-4 / 5+),
// English collapses "few" and "many" into the same plural string.
export function pluralKey(count) {
  if (count === 1) return "one";
  const tens = count % 100;
  const units = count % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? "few" : "many";
}

// The translated name of an e-mail template type; an unknown type shows its slug.
export function emailTypeLabel(t, type) {
  const key = `emails.types.${type}`;
  const label = t(key);
  return label === key ? type : label;
}

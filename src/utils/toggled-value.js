// The one value a multiple BasicSelect added or removed: `next` is its new model, `current` the old one.
export const toggledValue = (next, current) =>
  next.find((value) => !current.includes(value)) ?? current.find((value) => !next.includes(value));

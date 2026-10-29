// A select in an edit form shows the value the record has, even when the loaded catalogue does not
// offer it (another module's check key, a task type this CMS does not list): the stored value is
// appended as its own option instead of falling back to the placeholder.
export function withStoredOption(options, value, label = value) {
  if (value === "" || value === null || value === undefined) return options;
  if (options.some((option) => option.value === value)) return options;
  return [...options, { label, value }];
}

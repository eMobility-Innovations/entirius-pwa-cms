import { ref, toValue } from "vue";

const TYPEAHEAD_RESET_MS = 500;

// Keyboard model of a listbox whose focus stays on one element (the list, or a filter input above it) and points at
// the active option through `aria-activedescendant` (BasicSelect, EntitySearchPicker, ChannelMultiSelect).
// `options` = ref or getter of [{ label, disabled? }]; `choose(option)` runs on Enter (and Space on the list).
// `onKeydown(event, editable)`: arrows wrap around, Home / End jump, typing jumps to the first option starting with
// the typed text; in an `editable` element (the filter input) Home / End, Space and letters stay text editing.
export function useListbox(options, choose) {
  const active = ref(-1);
  let typed = "";
  let typedAt = 0;

  const list = () => toValue(options);
  const enabled = () => list().flatMap((option, i) => (option.disabled ? [] : [i]));

  function step(delta) {
    const indexes = enabled();
    const at = indexes.indexOf(active.value);
    if (!indexes.length) return;
    if (at === -1) active.value = delta > 0 ? indexes[0] : indexes.at(-1);
    else active.value = indexes[(at + delta + indexes.length) % indexes.length];
  }

  function typeahead(char) {
    const now = Date.now();
    typed = now - typedAt > TYPEAHEAD_RESET_MS ? char : typed + char;
    typedAt = now;
    const prefix = typed.toLowerCase();
    const match = enabled().find((i) => String(list()[i].label).toLowerCase().startsWith(prefix));
    if (match !== undefined) active.value = match;
  }

  const KEYS = {
    ArrowDown: () => step(1),
    ArrowUp: () => step(-1),
    Home: () => (active.value = enabled()[0] ?? -1),
    End: () => (active.value = enabled().at(-1) ?? -1),
    Enter: () => chooseActive(),
  };

  function chooseActive() {
    const option = list()[active.value];
    if (option && !option.disabled) choose(option);
  }

  function onKeydown(event, editable = false) {
    const key = event.key === " " && !editable ? "Enter" : event.key;
    if (editable && (key === "Home" || key === "End")) return;
    if (KEYS[key]) {
      event.preventDefault();
      KEYS[key]();
    } else if (!editable && key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeahead(key);
    }
  }

  // No index (or -1, nothing chosen): the first enabled option, so the keyboard and the visible focus start somewhere.
  const reset = (index = -1) => (active.value = index >= 0 ? index : enabled()[0] ?? -1);

  return { active, onKeydown, reset, chooseActive };
}

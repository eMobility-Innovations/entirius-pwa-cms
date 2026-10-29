import { inject, ref } from "vue";

// Field hints on or off (plan 60): the account-menu switch, saved as the `cms_hints` preference. Module state, so the
// boots read it without Pinia; the user store owns the writes (`setHints`). Off hides every hint mark (`?`) and drops
// the hint from the control's `aria-describedby`; errors and required markers stay.
export const hintsOn = ref(true);

// A subtree can pin its own value (the catalogue's "hints off" cells) by providing a ref under this key.
export const FIELD_HINTS = Symbol("FieldHints");

// Call in setup(): the ref that says whether hints show here.
export const useHintsOn = () => inject(FIELD_HINTS, hintsOn);

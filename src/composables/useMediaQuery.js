import { onBeforeUnmount, ref } from "vue";

// A reactive `matchMedia(query).matches`; `fallback` when the browser has no matchMedia (unit tests).
export function useMediaQuery(query, fallback = false) {
  const media = window.matchMedia?.(query);
  const matches = ref(media ? media.matches : fallback);
  const update = (event) => (matches.value = event.matches);
  media?.addEventListener?.("change", update);
  onBeforeUnmount(() => media?.removeEventListener?.("change", update));
  return matches;
}

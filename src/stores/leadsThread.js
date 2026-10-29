import { defineStore } from "pinia";
import { ref } from "vue";

// The thread the company card is showing (its newest) — the Inbox marks exactly that row as active.
export const useLeadsThreadStore = defineStore("leadsThread", () => {
  const shownId = ref(null);
  return { shownId };
});

import { defineStore } from "pinia";
import { ref } from "vue";

// Review queue change signal: Review bumps it after an action (or a conflict), the Inbox reloads on it.
// The Inbox also publishes how many drafts wait, so the desktop layout knows whether there is anything to pick.
export const useLeadsReviewStore = defineStore("leadsReview", () => {
  const changes = ref(0);
  const count = ref(0);

  function queueChanged() {
    changes.value += 1;
  }

  function setCount(value) {
    count.value = value;
  }

  return { changes, count, queueChanged, setCount };
});

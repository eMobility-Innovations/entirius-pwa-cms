import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { GET_LeadTypes } from "@/api/leads/api";
import { t } from "@/i18n";

// Lead types of the leads channel (UX-004): configuration, not code — one list for the Board chips, the company
// card, the add-lead form and the template audience. `UNKNOWN` is built in and never a row.
export const UNKNOWN_LEAD_TYPE = "UNKNOWN";

export const useLeadTypesStore = defineStore("leadTypes", () => {
  const all = ref([]); // every row, inactive ones too, in display order
  let pending = null;

  const active = computed(() => all.value.filter((type) => type.is_active));

  // Loaded once and shared; `force` after an edit on the settings screen. A failed load leaves the list empty and
  // is not kept — the next caller asks again.
  function load(force = false) {
    if (!pending || force) {
      pending = GET_LeadTypes()
        .then(({ data }) => (all.value = data.results || []))
        .catch(() => {
          pending = null;
          all.value = [];
        });
    }
    return pending;
  }

  // Logout: the next user may work another channel.
  function reset() {
    pending = null;
    all.value = [];
  }

  // The row's label; an inactive type still reads on its companies, an unknown code shows as itself.
  function label(code) {
    if (!code || code === UNKNOWN_LEAD_TYPE) return t("leads.lead_types.unknown");
    return all.value.find((type) => type.code === code)?.label || code;
  }

  return { all, active, load, label, reset };
});

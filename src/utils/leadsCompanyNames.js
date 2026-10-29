import { GET_Company } from "@/api/leads/api";

// One lookup per company for the whole Inbox, however many of its threads are listed. A failed lookup is not kept
// (the next row asks again); logout clears the lot (App.vue) — the next user may not see these companies.
const names = new Map();

export function loadCompanyName(id) {
  if (!names.has(id)) {
    const lookup = GET_Company(id)
      .then(({ data }) => data.name)
      .catch(() => {
        names.delete(id);
        return "";
      });
    names.set(id, lookup);
  }
  return names.get(id);
}

export function clearCompanyNames() {
  names.clear();
}

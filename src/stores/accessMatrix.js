import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { GET_Me, GET_Catalog } from "@/api/access/api";
import { isAccessPanelEnabled } from "@/configs/accessMatrix";

export const useAccessMatrixStore = defineStore("accessMatrix", () => {
  const me = ref(null);
  const catalog = ref(null);
  const loaded = ref(false);
  let _promise = null;

  // The panel is shown to exactly the people the matrix says may read it, and its write
  // controls to exactly those who may write. Anyone else never sees the entry at all.
  const canRead = computed(() => !!me.value?.permissions?.includes("page:access"));
  const canWrite = computed(() => !!me.value?.permissions?.includes("feature:edit_role_mappings"));

  async function fetchAll() {
    try {
      const { data } = await GET_Me();
      me.value = data;
      if (canRead.value) {
        const catalogResponse = await GET_Catalog();
        catalog.value = catalogResponse.data;
      }
      loaded.value = true;
    } catch {
      // A failure here must not break the CMS: it means "no access panel", not "no CMS".
      me.value = null;
      loaded.value = true;
    } finally {
      _promise = null;
    }
  }

  function ensureLoaded() {
    if (!isAccessPanelEnabled()) return Promise.resolve();
    if (loaded.value) return Promise.resolve();
    if (_promise) return _promise;
    _promise = fetchAll();
    return _promise;
  }

  return { me, catalog, loaded, canRead, canWrite, ensureLoaded };
});

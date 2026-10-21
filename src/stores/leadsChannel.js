import { defineStore } from "pinia";
import { ref } from "vue";

// Channel of the Leads panel (leads, communicator, siteintel, notifications): VUE_APP_LEADS_CHANNEL, else the CMS
// channel (VUE_APP_CHANNEL, the contentdb/pim one: a one-channel install has no other), else the seeded one.
const STORAGE_KEY = "leads:lastSelectedChannel";
const DEFAULT_CHANNEL = "default-europe";

function readStoredChannel() {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeStoredChannel(idx) {
  try {
    if (idx) window.localStorage?.setItem(STORAGE_KEY, idx);
  } catch {
    // ignore — storage access denied / quota exceeded
  }
}

export const useLeadsChannelStore = defineStore("leadsChannel", () => {
  const activeChannelIdx = ref(
    readStoredChannel() || process.env.VUE_APP_LEADS_CHANNEL || process.env.VUE_APP_CHANNEL || DEFAULT_CHANNEL
  );

  function setActiveChannel(idx) {
    activeChannelIdx.value = idx;
    writeStoredChannel(idx);
  }

  return { activeChannelIdx, setActiveChannel };
});

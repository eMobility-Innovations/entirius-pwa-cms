import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

async function freshStore() {
  vi.resetModules();
  const { useLeadsChannelStore } = await import("@/stores/leadsChannel");
  setActivePinia(createPinia());
  return useLeadsChannelStore();
}

describe("leadsChannel store", () => {
  const channel = process.env.VUE_APP_CHANNEL;
  beforeEach(() => {
    window.localStorage.clear();
    delete process.env.VUE_APP_CHANNEL;
  });
  afterEach(() => {
    delete process.env.VUE_APP_LEADS_CHANNEL;
    if (channel === undefined) delete process.env.VUE_APP_CHANNEL;
    else process.env.VUE_APP_CHANNEL = channel;
  });

  it("defaults to the seeded channel", async () => {
    expect((await freshStore()).activeChannelIdx).toBe("default-europe");
  });

  it("prefers VUE_APP_LEADS_CHANNEL over the default", async () => {
    process.env.VUE_APP_LEADS_CHANNEL = "b2b-pl";
    expect((await freshStore()).activeChannelIdx).toBe("b2b-pl");
  });

  it("falls back to the CMS channel (a one-channel install), the leads one still wins", async () => {
    process.env.VUE_APP_CHANNEL = "oohlala";
    expect((await freshStore()).activeChannelIdx).toBe("oohlala");
    process.env.VUE_APP_LEADS_CHANNEL = "b2b-pl";
    expect((await freshStore()).activeChannelIdx).toBe("b2b-pl");
  });

  it("persists the picked channel and restores it", async () => {
    (await freshStore()).setActiveChannel("other");
    expect((await freshStore()).activeChannelIdx).toBe("other");
  });
});

/**
 * plan-31 review item — ContentSets/index.vue pickDoc(): a linked doc's tile is a keyboard button
 * (tabindex, aria-disabled, aria-pressed) whose click/Enter/Space handlers all funnel through the same
 * guard, and Space never scrolls the page regardless of the guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const api = vi.hoisted(() => ({ _METHOD_content: vi.fn() }));
vi.mock("@/api/contentDB/api", () => api);

const notify = vi.hoisted(() => ({ spawnNotification: vi.fn() }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => notify }));

const loader = vi.hoisted(() => ({ loaderStart: vi.fn(), loaderFinish: vi.fn() }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => loader }));

vi.mock("@/stores/user", () => ({ useUserStore: () => ({ user: {} }) }));

const contentDBChannel = vi.hoisted(() => ({
  languages: [{ iso2: "pl", iso3: "pol" }],
  availableLanguages: ["pl", "en"],
  fetchChannelsAndLanguages: vi.fn(),
}));
vi.mock("@/stores/contentDBChannel", () => ({ useContentDBChannelStore: () => contentDBChannel }));

import ContentSets from "@/views/ContentSets/index.vue";

const stubs = {
  FontAwesomeIcon: true,
  Pagination: true,
  SegmentedControl: true,
  BasicInput: true,
  StatusBadge: true,
};

function docsResponse() {
  return {
    data: {
      data: [
        { uid: "doc-1", name: "Linked doc", content_set: "set-1" },
        { uid: "doc-2", name: "Free doc", content_set: null },
      ],
      pagination: { page: 1, pages: 1 },
    },
  };
}

async function mountView() {
  api._METHOD_content.mockImplementation(({ url }) =>
    url === "/content-sets/"
      ? Promise.resolve({ data: { data: [], pagination: {} } })
      : Promise.resolve(docsResponse())
  );
  const wrapper = mount(ContentSets, { global: { stubs } });
  await flushPromises();
  return wrapper;
}

function dispatchKeydown(el, key) {
  const event = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

describe("ContentSets pickDoc guard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders a linked tile as a disabled keyboard button, a free tile as pressable", async () => {
    const wrapper = await mountView();
    const [linked, free] = wrapper.findAll(".doc-tile");

    expect(linked.attributes("tabindex")).toBe("-1");
    expect(linked.attributes("aria-disabled")).toBe("true");
    expect(linked.attributes("aria-pressed")).toBe("false");

    expect(free.attributes("tabindex")).toBe("0");
    expect(free.attributes("aria-disabled")).toBeUndefined();
    expect(free.attributes("aria-pressed")).toBe("false");
  });

  it("blocks a linked doc via click, Enter and Space; a free doc still opens on click", async () => {
    const wrapper = await mountView();
    const [linked, free] = wrapper.findAll(".doc-tile");

    await linked.trigger("click");
    expect(wrapper.vm.selected_set_members).toBeNull();

    dispatchKeydown(linked.element, "Enter");
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selected_set_members).toBeNull();

    dispatchKeydown(linked.element, " ");
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selected_set_members).toBeNull();

    await free.trigger("click");
    expect(wrapper.vm.selected_set_members).toEqual({ pl: { 1: "1" } });
  });

  it("Space never scrolls the page, linked or not", async () => {
    const wrapper = await mountView();
    const [linked, free] = wrapper.findAll(".doc-tile");

    const linkedEvent = dispatchKeydown(linked.element, " ");
    expect(linkedEvent.defaultPrevented).toBe(true);

    const freeEvent = dispatchKeydown(free.element, " ");
    expect(freeEvent.defaultPrevented).toBe(true);
  });
});

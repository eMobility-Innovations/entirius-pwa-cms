import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// The content list mounted: the template wiring (chips, FAB) that the method-level spec cannot see.
const CONTENT_TYPES = [
  { slug: "static-page", label: "Static page" },
  { slug: "blog-post", label: "Blog post" },
];
const CONTENT = { "static-page": [{ uid: "s1", name: "About" }], "blog-post": [] };

vi.mock("@/api/contentDB/api", () => ({
  GET_ContentTypes: async () => ({ data: { data: CONTENT_TYPES } }),
  GET_Content: async ({ type }) => ({ data: { data: CONTENT[type], content_type: type } }),
  DELETE_Content: vi.fn(),
}));
vi.mock("@/../__client/configs/__config_options", () => ({
  default: { "static-page": { max_self: 99 }, "blog-post": { max_self: 1 } },
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart: vi.fn(), loaderFinish: vi.fn() }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
// django-access is not under test here: allow-all, as without the module.
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({ can: () => true, canAny: () => true, ensureLoaded: () => Promise.resolve(), available: false, isStaff: true }),
}));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleInstalled: () => false }) }));
vi.mock("@/stores/contentDBChannel", () => ({
  useContentDBChannelStore: () => ({ fetchChannelsAndLanguages: async () => {}, languages: [], availableLanguages: [], defaultLanguage: "en" }),
}));
// Build types in the opposite order of the content types.
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({
    user: {
      buildTypes: [
        { slug: "blog-post", label: "Blog post", _for: "content", actions: ["create"] },
        { slug: "static-page", label: "Static page", _for: "content", actions: ["create"] },
      ],
    },
  }),
}));

import Builds from "@/views/Builder/Builds.vue";
import FilterChip from "@/boots/FilterChip/index.vue";
import FloatingActions from "@/boots/FloatingActions/index.vue";

const mountBuilds = async () => {
  const wrapper = mount(Builds, {
    global: {
      mocks: {
        $route: { query: { lg: "en" }, params: { content_type: "content" } },
        $router: { replace: vi.fn(() => Promise.resolve()), push: vi.fn() },
      },
      components: { FilterChip, FloatingActions },
      stubs: { FilterChip: false, FloatingActions: true, DataTable: true, TranslateDialog: true, ConfirmDialog: true },
    },
  });
  await flushPromises();
  return wrapper;
};

describe("Builds — mounted", () => {
  it("checks each FAB action's max_self against its own type's documents", async () => {
    const wrapper = await mountBuilds();
    const actions = wrapper.findComponent({ name: "FloatingActions" }).props("actions");
    // blog-post: 0 of max 1 → enabled; static-page: 1 of max 99 → enabled.
    expect(actions.map((action) => action.disabled)).toEqual([false, false]);
  });

  it("a chip reports its state through aria-pressed", async () => {
    const wrapper = await mountBuilds();
    const chip = wrapper.find(".content-list__chips .filter-chip");
    expect(chip.attributes("aria-pressed")).toBe("false");
    await chip.trigger("click");
    expect(wrapper.find(".content-list__chips .filter-chip").attributes("aria-pressed")).toBe("true");
  });
});

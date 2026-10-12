import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetDefs = vi.fn();
let qualityAvailable = true;

vi.mock("@/api/pim/api", () => ({
  GET_GapDefinitions: (...a) => mockGetDefs(...a),
}));
vi.mock("@/stores/quality", () => ({
  useQualityStore: () => ({ available: qualityAvailable, probe: () => Promise.resolve() }),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/composables/useSearchDebounce", () => ({
  useSearchDebounce: () => ({ search: "", debouncedFetch: () => {} }),
}));
vi.mock("@/i18n", () => ({ getLang: () => "en", uiLocale: () => "en-GB" }));

import GapDefinitionList from "@/views/Pim/GapDefinitionList.vue";

const rule = (over = {}) => ({
  key: "pl-description",
  check_key: "feature_present",
  params: { feature_idx: "description" },
  severity: "critical",
  label_t9n: { en: "Missing description", pl: "Brak opisu" },
  active: true,
  display_order: 1,
  ...over,
});

const mountList = (routerMock = {}) =>
  mount(GapDefinitionList, {
    global: {
      mocks: {
        $route: { query: {}, path: "/pim/gap-definitions" },
        $router: { push() {}, replace() {}, ...routerMock },
      },
      stubs: {
        DataTable: true,
        Pagination: true,
        FloatingActions: true,
        GapStatusAlert: true,
        QualitySettings: true,
      },
    },
  });

describe("GapDefinitionList", () => {
  beforeEach(() => {
    mockGetDefs.mockReset();
    qualityAvailable = true;
  });

  it("loads rules and exposes a severity column", async () => {
    mockGetDefs.mockResolvedValueOnce({ data: { results: [rule()], count: 1 } });
    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.rules).toHaveLength(1);
    expect(wrapper.vm.columns.some((c) => c.key === "severity")).toBe(true);
    expect(wrapper.vm.severityVariant("critical")).toBe("negative");
    expect(wrapper.vm.resolveLabel(rule())).toBe("Missing description");
  });

  it("only-active toggle adds is_active to the query", async () => {
    mockGetDefs.mockResolvedValue({ data: { results: [], count: 0 } });
    const wrapper = mountList();
    await flushPromises();

    wrapper.vm.toggleOnlyActive();
    await flushPromises();

    expect(mockGetDefs.mock.calls.at(-1)[0].is_active).toBe(true);
  });

  it("soft-compat: unavailable gaps API redirects to products without fetching", async () => {
    qualityAvailable = false;
    const replace = vi.fn();
    const wrapper = mountList({ replace });
    await flushPromises();

    expect(replace).toHaveBeenCalledWith("/pim/products");
    expect(mockGetDefs).not.toHaveBeenCalled();
    expect(wrapper.vm.rules).toHaveLength(0);
  });
});

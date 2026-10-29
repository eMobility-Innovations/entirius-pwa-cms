import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

// django-access is not under test here: allow-all, as without the module.
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({ can: () => true, canAny: () => true, ensureLoaded: () => Promise.resolve(), available: false, isStaff: true }),
}));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isPanelEnabled: (idx) => idx !== "pim" }) }));
vi.mock("@/stores/user", () => ({ useUserStore: () => ({ user: { first_name: "Ada" } }) }));

import Home from "@/views/Home/index.vue";
import PanelCard from "@/boots/PanelCard/index.vue";
import { panels as REGISTRY } from "@/configs/access";
import { t } from "@/i18n";

const PageLayout = { template: "<div><slot name='header' /><slot /></div>" };
const PageHeader = { props: ["overline", "title"], template: "<header>{{ overline }} {{ title }}</header>" };

const mountHome = () => {
  const push = vi.fn();
  const wrapper = mount(Home, {
    global: { components: { PageLayout, PageHeader, PanelCard }, mocks: { $router: { push } } },
  });
  return { wrapper, push, cards: wrapper.findAll(".panel-card") };
};

describe("Home", () => {
  it("greets the user by name in the overline", () => {
    const { wrapper } = mountHome();
    expect(wrapper.getComponent(PageHeader).props("overline")).toBe(t("panels.greeting_name", { name: "Ada" }));
  });

  it("renders one PanelCard per registry panel; only the first carries the landmark", () => {
    const { cards } = mountHome();
    expect(cards).toHaveLength(REGISTRY.length);
    expect(cards.map((card) => card.attributes("data-fid"))).toEqual(["panel-card", ...Array(cards.length - 1).fill(undefined)]);
  });

  it("an enabled card opens the panel root, a locked one does nothing", async () => {
    const { cards, push } = mountHome();
    const pim = REGISTRY.findIndex((panel) => panel.idx === "pim");
    await cards[0].trigger("click");
    await cards[pim].trigger("click");
    expect(push.mock.calls).toEqual([[REGISTRY[0].root]]);
    expect(cards[pim].classes()).toContain("panel-card--locked");
  });
});

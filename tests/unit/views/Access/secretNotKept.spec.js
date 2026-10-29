import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";

// Access plan 22: after a token is created and its SecretReveal closed, the value is nowhere — not in any Pinia store
// (the real notify, loader and channel stores), not in localStorage, sessionStorage or a cookie, not in the page's
// state and not in the DOM. Only the API is mocked. A fake shorter than a real token.
const FAKE = "ent_api_EXAMPLE-not-a-token";
const api = vi.hoisted(() => ({
  GET_AccessApplication: vi.fn(),
  GET_AccessCatalogue: vi.fn(),
  GET_AccessAllTokens: vi.fn(),
  POST_AccessToken: vi.fn(),
}));
vi.mock("@/api/access/api", () => api);
vi.mock("@/api/promo/api", () => ({ GET_Channels: vi.fn().mockResolvedValue({ data: { results: [{ idx: "emporium" }] } }) }));

import ApplicationDetail from "@/views/Access/ApplicationDetail.vue";
import SecretReveal from "@/boots/SecretReveal/index.vue";
import ActionBar from "@/boots/ActionBar/index.vue";

const BasicButton = {
  props: ["variant", "icon", "disabled", "loading", "type", "form"],
  emits: ["click"],
  template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
};
const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

describe("a created token's value is not kept", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("leaves no trace in stores, storage, cookies, page state or DOM after the dialog closes", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    api.GET_AccessApplication.mockResolvedValue({ data: { id: 3, name: "Shop", description: "", is_active: true } });
    api.GET_AccessCatalogue.mockResolvedValue({ data: { scopes: [] } });
    api.GET_AccessAllTokens.mockResolvedValue([]);
    api.POST_AccessToken.mockResolvedValue({ data: { id: 7, name: "Shop", prefix: "ent_api_EXAM", last_four: "oken", raw: FAKE } });

    const wrapper = mount(ApplicationDetail, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        mocks: { $route: { params: { id: "3" }, query: {} }, $router: { push: vi.fn() } },
        components: { SecretReveal, ActionBar },
        stubs: {
          BasicButton, DataTable: true, BasicSwitch: true, BasicTextarea: true, PageHeader: true, BasicCard: true, Tag: true,
          IconButton: true, BasicMenu: true, ConfirmDialog: true,
        },
      },
    });
    await flushPromises();
    await wrapper.vm.createToken({ name: "Shop", scopes: ["checkout.storefront"], channel_idx: null, expires_at: null });
    await nextTick();
    expect(byTestId("secret-reveal-value").value).toBe(FAKE);
    expect(JSON.stringify(wrapper.vm.$data)).not.toContain(FAKE);

    byTestId("secret-reveal-stored").querySelector("input").click();
    await nextTick();
    byTestId("secret-reveal-close").click();
    await flushPromises();

    // Stores, storage and cookies hold nothing token-shaped at all; the page and the DOM not the value.
    [pinia.state.value, { ...localStorage }, { ...sessionStorage }].forEach((place) =>
      expect(JSON.stringify(place)).not.toContain("ent_api_")
    );
    expect(document.cookie).not.toContain("ent_api_");
    expect(JSON.stringify(wrapper.vm.$data)).not.toContain(FAKE);
    expect(document.body.innerHTML).not.toContain(FAKE);
    expect(Object.keys(pinia.state.value)).toEqual(expect.arrayContaining(["notify", "checkoutChannel"]));
    wrapper.unmount();
  });
});

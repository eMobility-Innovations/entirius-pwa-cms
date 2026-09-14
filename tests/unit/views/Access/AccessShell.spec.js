/**
 * The shell is what someone holding nothing actually meets.
 *
 * `GET /me/` answers for a person with no grant at all (`role: null`) rather than
 * refusing, precisely so this page can be rendered. A blank frame with five empty tabs
 * would leave them nothing to act on, so they are told they hold no grant.
 *
 * This file also pins that the shell LOADS the matrix, because it is the only place on
 * the deep-link path that does: someone who bookmarks /access/grants never passes the
 * header.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const state = { canRead: ref(false), loaded: ref(false) };
const ensureLoaded = vi.fn();

vi.mock("@/stores/accessMatrix", () => ({
  useAccessMatrixStore: () => ({
    canRead: state.canRead,
    loaded: state.loaded,
    ensureLoaded,
  }),
}));

import AccessShell from "@/views/Access/index.vue";

const mountShell = () =>
  mount(AccessShell, {
    global: {
      mocks: { $t: (k) => k },
      stubs: { RouterLink: true, RouterView: true },
    },
  });

beforeEach(() => {
  ensureLoaded.mockClear();
  state.canRead.value = false;
  state.loaded.value = false;
});

describe("the access panel shell", () => {
  it("asks the matrix who this is as soon as it is opened", () => {
    mountShell();
    expect(ensureLoaded).toHaveBeenCalled();
  });

  it("tells somebody holding no grant that they hold none", async () => {
    state.loaded.value = true;
    const wrapper = mountShell();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-test="no-grant"]').exists()).toBe(true);
    expect(wrapper.find("nav").exists()).toBe(false);
  });

  it("says nothing at all until the answer is in, rather than flashing a refusal", async () => {
    const wrapper = mountShell();
    await wrapper.vm.$nextTick();

    // loaded is false: the request is still in flight. Showing "you hold no grant" here
    // would accuse the rightful holder of having no access on every page load.
    expect(wrapper.find('[data-test="no-grant"]').exists()).toBe(false);
    expect(wrapper.find("nav").exists()).toBe(false);
  });

  it("gives the tabs and the view to somebody who holds page:access", async () => {
    state.canRead.value = true;
    state.loaded.value = true;
    const wrapper = mountShell();
    await wrapper.vm.$nextTick();

    expect(wrapper.find("nav").exists()).toBe(true);
    expect(wrapper.find('[data-test="no-grant"]').exists()).toBe(false);
  });
});

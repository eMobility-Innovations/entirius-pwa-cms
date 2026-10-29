import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));
vi.mock("@/api/contentDB/api", () => ({ POST_Login: vi.fn(), POST_PasswordReset: vi.fn() }));
vi.mock("@/composables/useLoginSession", () => ({
  useLoginSession: () => ({ completeLogin: vi.fn() }),
  consumeReturnRoute: () => null,
}));

import LoginWall from "@/functionals/Login-wall/Login-wall.vue";
import registerBootComponents from "@/boots/register-elems";

// The real wall with the real boot registration. The global test setup stubs BasicButton, BasicInput and FormField,
// so they are switched off here. Nothing is awaited: an async-registered boot is still a placeholder comment.
const mountWall = () =>
  mount(LoginWall, {
    global: {
      plugins: [registerBootComponents],
      stubs: { BasicButton: false, BasicInput: false, FormField: false },
    },
  });

describe("boot component registration", () => {
  it("paints the login wall's fields and buttons on the first render, before any async chunk resolves", () => {
    const wrapper = mountWall();

    expect(wrapper.find(".basic-logo").exists()).toBe(true);
    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
    expect(wrapper.find('button[aria-pressed]').exists()).toBe(true);

    wrapper.unmount();
  });
});

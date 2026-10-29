import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";

const mockResetConfirm = vi.fn();
vi.mock("@/api/contentDB/api", () => ({ POST_PasswordResetConfirm: (...a) => mockResetConfirm(...a) }));

import PasswordReset from "@/views/PasswordReset/PasswordReset.vue";

const mountReset = (query = { key: "k-1" }) =>
  mount(PasswordReset, { global: { mocks: { $route: { params: {}, query } } } });
const summary = (wrapper) => wrapper.get('[aria-live="polite"]').text();

describe("PasswordReset", () => {
  beforeEach(() => {
    mockResetConfirm.mockClear();
  });

  // Plan 32: the fields sit in a <form>, so Enter in a field submits it.
  it("submitting the form confirms the reset with the link's key", async () => {
    mockResetConfirm.mockResolvedValue({});
    const wrapper = mount(PasswordReset, {
      global: { mocks: { $route: { params: {}, query: { key: "k-1" } } } },
    });
    await wrapper.setData({ newPassword: "new", confirmPassword: "new" });

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mockResetConfirm).toHaveBeenCalledWith({
      key: "k-1",
      new_password: "new",
      new_password_check: "new",
    });
    expect(wrapper.vm.success).toBe(true);
  });

  // Plan 59: errors under the field and once in the live summary, never as a toast.
  it("a mismatched confirmation is marked on its field, without a request", async () => {
    const wrapper = mountReset();
    await wrapper.setData({ newPassword: "new", confirmPassword: "other" });

    await wrapper.get("form").trigger("submit");

    expect(mockResetConfirm).not.toHaveBeenCalled();
    expect(wrapper.vm.errors).toEqual({ confirmPassword: "user.passwords_dont_match" });
    expect(summary(wrapper)).toBe("user.passwords_dont_match");
  });

  it("a rejected password keeps the form and states the reason", async () => {
    mockResetConfirm.mockImplementation(() => Promise.reject({ meta: { status: "too_short", message: "Too short." } }));
    const wrapper = mountReset();
    await wrapper.setData({ newPassword: "a", confirmPassword: "a" });

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.find("form").exists()).toBe(true);
    expect(summary(wrapper)).toBe("Too short.");
  });

  it("an invalid key ends on the error state with a way back", async () => {
    mockResetConfirm.mockImplementation(() => Promise.reject({ meta: { status: "invalid_key", message: "" } }));
    const wrapper = mountReset();
    await wrapper.setData({ newPassword: "a", confirmPassword: "a" });

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.get("h1").text()).toBe("reset.error_title");
    expect(summary(wrapper)).toBe("reset.error_message");
  });

  it("a link without a key opens on the error state", async () => {
    const wrapper = mountReset({});
    await nextTick();

    expect(wrapper.get("h1").text()).toBe("reset.error_title");
    expect(summary(wrapper)).toBe("reset.invalid_link");
  });
});

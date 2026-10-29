import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockPasswordChange = vi.fn();
vi.mock("@/api/contentDB/api", () => ({ POST_PasswordChange: (...a) => mockPasswordChange(...a) }));

import ChangePassword from "@/views/ChangePassword/ChangePassword.vue";

describe("ChangePassword", () => {
  // Plan 32: the fields sit in a <form>, so Enter in a field submits it.
  it("submitting the form changes the password", async () => {
    mockPasswordChange.mockResolvedValue({});
    const wrapper = mount(ChangePassword);
    await wrapper.setData({ oldPassword: "old", newPassword: "new", confirmPassword: "new" });

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mockPasswordChange).toHaveBeenCalledWith({
      old_password: "old",
      new_password: "new",
      new_password_check: "new",
    });
    expect(wrapper.vm.success).toBe(true);
  });

  // Plan 59: the change is tested on a mocked request only — the shared admin password never changes.
  it("empty fields are marked, stated once, and nothing is sent", async () => {
    mockPasswordChange.mockClear();
    const wrapper = mount(ChangePassword);

    await wrapper.get("form").trigger("submit");

    expect(mockPasswordChange).not.toHaveBeenCalled();
    expect(Object.keys(wrapper.vm.errors)).toEqual(["oldPassword", "newPassword", "confirmPassword"]);
    expect(wrapper.get('[aria-live="polite"]').text()).toBe("user.fill_all_fields");
  });

  it("a refused change keeps the form and states the reason", async () => {
    mockPasswordChange.mockImplementation(() => Promise.reject({ meta: { status: "wrong_password", message: "Wrong password." } }));
    const wrapper = mount(ChangePassword);
    await wrapper.setData({ oldPassword: "old", newPassword: "new", confirmPassword: "new" });

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.vm.success).toBe(false);
    expect(wrapper.get('[aria-live="polite"]').text()).toBe("Wrong password.");
  });

  it("the password fields ask for the current and the new password", () => {
    const FormField = { template: "<div><slot /></div>" };
    const wrapper = mount(ChangePassword, { global: { stubs: { FormField } } });

    const purposes = wrapper.findAll("[autocomplete]").map((el) => el.attributes("autocomplete"));
    expect(purposes).toEqual(["current-password", "new-password", "new-password"]);
  });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

import SecretReveal from "@/boots/SecretReveal/index.vue";

// Access plan 22: the shown-once secret. A fake shorter than a real token (never the gitleaks shape).
const FAKE = "ent_api_EXAMPLE-not-a-token";
// ActionBar's buttons (as in ActionBar.spec): a native button that keeps `disabled` and the test id.
const BasicButton = {
  props: ["variant", "icon", "disabled", "loading", "type", "form"],
  emits: ["click"],
  template: "<button :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
};
const global = { stubs: { BasicButton } };
const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const field = () => byTestId("secret-reveal-value");

describe("SecretReveal", () => {
  const wrappers = [];
  const mountReveal = async (props = {}) => {
    const wrapper = mount(SecretReveal, {
      props: { open: true, secret: FAKE, title: "Nowy token", ...props },
      attachTo: document.body,
      global,
    });
    wrappers.push(wrapper);
    await nextTick();
    await nextTick();
    return wrapper;
  };
  const tickStored = async () => {
    byTestId("secret-reveal-stored").querySelector("input").click();
    await nextTick();
  };

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("shows the value read-only, never autocompleted or spell-checked, and hands the caller an empty copy back", async () => {
    const wrapper = await mountReveal();
    expect(field().value).toBe(FAKE);
    expect(field().readOnly).toBe(true);
    expect(field().getAttribute("autocomplete")).toBe("off");
    expect(field().getAttribute("spellcheck")).toBe("false");
    expect(document.body.textContent).toContain("secret_reveal.warning");
    expect(wrapper.emitted("update:secret")).toEqual([[""]]);
  });

  it("takes the value from show() before it opens, with no secret prop and nothing handed back", async () => {
    const wrapper = await mountReveal({ open: false, secret: "" });
    wrapper.vm.show(FAKE);
    await wrapper.setProps({ open: true });
    await nextTick();
    expect(field().value).toBe(FAKE);
    expect(wrapper.emitted("update:secret")).toBeUndefined();
    await tickStored();
    byTestId("secret-reveal-close").click();
    await nextTick();
    expect(field()?.value ?? "").toBe("");
  });

  it("copies to the clipboard; without one it selects the text for a manual copy", async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await mountReveal();
    byTestId("secret-reveal-copy").click();
    await vi.waitFor(() => expect(byTestId("secret-reveal-status").textContent).toBe("Copied to the clipboard"));
    expect(writeText).toHaveBeenCalledWith(FAKE);

    vi.stubGlobal("navigator", {});
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    byTestId("secret-reveal-copy").click();
    await vi.waitFor(() => expect(select).toHaveBeenCalled());
    expect(byTestId("secret-reveal-status").textContent).toContain("Ctrl+C");
    select.mockRestore();
  });

  it("closes only after 'I have stored it': Close is disabled, Esc and the close button do nothing", async () => {
    const wrapper = await mountReveal();
    expect(byTestId("secret-reveal-close").disabled).toBe(true);
    expect(byTestId("basic-modal-close").disabled).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(wrapper.emitted("update:open")).toBeUndefined();

    await tickStored();
    byTestId("secret-reveal-close").click();
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("drops the value on close: a reopen without a new secret shows nothing, and the confirmation starts unticked", async () => {
    const wrapper = await mountReveal();
    await tickStored();
    byTestId("secret-reveal-close").click();
    await wrapper.setProps({ open: false, secret: "" });
    await wrapper.setProps({ open: true });
    await nextTick();
    expect(field().value).toBe("");
    expect(byTestId("secret-reveal-close").disabled).toBe(true);
    expect(document.body.innerHTML).not.toContain("ent_api_");
  });

  it("drops the value on unmount", async () => {
    const wrapper = await mountReveal();
    const state = wrapper.vm.$.setupState;
    expect(state.value).toBe(FAKE);
    wrapper.unmount();
    wrappers.splice(0);
    expect(state.value).toBe("");
    expect(document.body.innerHTML).not.toContain("ent_api_");
  });
});

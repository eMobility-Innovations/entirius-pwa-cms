import { describe, it, expect, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

import BasicModal from "@/boots/BasicModal/index.vue";

const settle = async () => {
  await nextTick();
  await nextTick();
};

describe("BasicModal", () => {
  const wrappers = [];
  const mountModal = (props = {}, slots = {}) => {
    const wrapper = mount(BasicModal, {
      props: { open: true, title: "Edytuj baner", ...props },
      slots: { default: "<p>Treść</p>", ...slots },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    return wrapper;
  };
  const dialog = () => document.querySelector('[role="dialog"]');
  const backdropClick = () => {
    const backdrop = document.querySelector(".basic-modal");
    backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    backdrop.click();
  };
  const escape = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("teleports a modal dialog named by its <h2> title", async () => {
    mountModal();
    await settle();
    expect(dialog().getAttribute("aria-modal")).toBe("true");
    const title = document.getElementById(dialog().getAttribute("aria-labelledby"));
    expect(title.querySelector("h2").textContent).toBe("Edytuj baner");
    expect(dialog().parentElement.parentElement).toBe(document.body);
  });

  it("traps focus: the close button takes it first", async () => {
    mountModal();
    await settle();
    expect(document.activeElement.getAttribute("aria-label")).toBe("common.close");
  });

  it("closes on Esc, the backdrop and the close button (update:open false + close)", async () => {
    const wrapper = mountModal();
    await settle();
    escape();
    backdropClick();
    document.querySelector('[data-testid="basic-modal-close"]').click();
    expect(wrapper.emitted("update:open")).toEqual([[false], [false], [false]]);
    expect(wrapper.emitted("close")).toHaveLength(3);
  });

  it("persistent: Esc, the backdrop and the disabled close button keep it open", async () => {
    const wrapper = mountModal({ persistent: true });
    await settle();
    escape();
    backdropClick();
    const closeButton = document.querySelector('[data-testid="basic-modal-close"]');
    closeButton.click();
    expect(closeButton.disabled).toBe(true);
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("renders `actions` as an ActionBar footer, or the footer slot", async () => {
    mountModal({ actions: [{ key: "save", label: "Zapisz", role: "primary", onClick: () => {} }] });
    await settle();
    expect(document.querySelector(".basic-modal__footer .action-bar")).not.toBeNull();
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    mountModal({}, { footer: "<span class='own-footer'>x</span>" });
    await settle();
    expect(document.querySelector(".basic-modal__footer .own-footer")).not.toBeNull();
  });

  it("the title slot replaces the <h2> and still names the dialog", async () => {
    mountModal({ title: "" }, { title: "<h2 class='t-warning'>Uwaga</h2>" });
    await settle();
    expect(document.getElementById(dialog().getAttribute("aria-labelledby")).textContent.trim()).toBe("Uwaga");
  });

  it("without a title the `ariaLabel` prop names the dialog, never both names", async () => {
    mountModal({ title: "", ariaLabel: "Kopiuj stronę" });
    await settle();
    expect(dialog().getAttribute("aria-label")).toBe("Kopiuj stronę");
    expect(dialog().hasAttribute("aria-labelledby")).toBe(false);
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    mountModal({ ariaLabel: "Kopiuj stronę" });
    await settle();
    expect(dialog().hasAttribute("aria-label")).toBe(false);
    expect(dialog().hasAttribute("aria-labelledby")).toBe(true);
  });

  it("inline: renders in place, no aria-modal, no trap, no backdrop close", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    const wrapper = mountModal({ inline: true });
    await settle();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(dialog().hasAttribute("aria-modal")).toBe(false);
    expect(document.activeElement).toBe(outside);
    backdropClick();
    escape();
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("a click that started inside the panel (a text selection dragged out) does not close it", async () => {
    const wrapper = mountModal();
    await settle();
    document.querySelector(".basic-modal").click();
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("caller attributes land on the dialog; its own role, aria-modal and tabindex win", async () => {
    const wrapper = mount(BasicModal, {
      props: { open: true, title: "Edytuj baner" },
      attrs: { "data-testid": "banner-dialog", class: "own-class", role: "region", "aria-modal": "false", tabindex: "0" },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    await settle();
    expect(dialog().getAttribute("data-testid")).toBe("banner-dialog");
    expect(dialog().classList).toContain("own-class");
    expect(dialog().classList).toContain("basic-modal__panel");
    expect(dialog().getAttribute("aria-modal")).toBe("true");
    expect(dialog().getAttribute("tabindex")).toBe("-1");
    expect(document.querySelector(".basic-modal").hasAttribute("data-testid")).toBe(false);
  });

  it("renders nothing while closed", () => {
    mountModal({ open: false });
    expect(dialog()).toBeNull();
  });
});

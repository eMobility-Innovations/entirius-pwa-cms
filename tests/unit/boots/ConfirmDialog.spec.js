import { describe, it, expect, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

import ConfirmDialog from "@/boots/ConfirmDialog/index.vue";
import BasicButton from "@/boots/BasicButton/index.vue";

const global = { stubs: { BasicButton: false }, components: { BasicButton } };
const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

describe("ConfirmDialog", () => {
  const wrappers = [];
  const mountDialog = (props = {}) => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: "Usunąć stronę?", message: "Tego nie da się cofnąć.", ...props },
      attachTo: document.body,
      global,
    });
    wrappers.push(wrapper);
    return wrapper;
  };

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("shows title and message; the confirm is primary by default, danger-solid for tone danger", async () => {
    mountDialog();
    await nextTick();
    expect(document.querySelector('[role="dialog"] h2').textContent).toBe("Usunąć stronę?");
    expect(document.querySelector(".confirm-dialog__message").textContent).toBe("Tego nie da się cofnąć.");
    expect(byTestId("confirm-dialog-confirm").classList).toContain("button-basic--primary");
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    mountDialog({ tone: "danger" });
    await nextTick();
    expect(byTestId("confirm-dialog-confirm").classList).toContain("button-basic--danger-solid");
  });

  it("emits confirm from the confirm button; cancel from Cancel and Esc (with update:open false)", async () => {
    const wrapper = mountDialog();
    await nextTick();
    await nextTick();
    byTestId("confirm-dialog-confirm").click();
    expect(wrapper.emitted("confirm")).toHaveLength(1);
    byTestId("confirm-dialog-cancel").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(wrapper.emitted("cancel")).toHaveLength(2);
    expect(wrapper.emitted("update:open")).toEqual([[false], [false]]);
  });

  it("custom labels, and a third `discard` action only with discardLabel", async () => {
    const wrapper = mountDialog({ confirmLabel: "Zapisz i opuść", cancelLabel: "Zostań", discardLabel: "Odrzuć" });
    await nextTick();
    expect(byTestId("confirm-dialog-confirm").textContent.trim()).toBe("Zapisz i opuść");
    expect(byTestId("confirm-dialog-cancel").textContent.trim()).toBe("Zostań");
    byTestId("confirm-dialog-discard").click();
    expect(wrapper.emitted("discard")).toHaveLength(1);
    wrappers.splice(0).forEach((w) => w.unmount());
    mountDialog();
    await nextTick();
    expect(byTestId("confirm-dialog-discard")).toBeNull();
  });

  it("loading: spinner on confirm, cancel disabled, Esc and the close button ignored", async () => {
    const wrapper = mountDialog({ loading: true });
    await nextTick();
    await nextTick();
    expect(byTestId("confirm-dialog-confirm").getAttribute("aria-busy")).toBe("true");
    expect(byTestId("confirm-dialog-cancel").disabled).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    byTestId("basic-modal-close").click();
    expect(wrapper.emitted("cancel")).toBeUndefined();
  });

  it("without a title the dialog is named by `ariaLabel`, else by the message", async () => {
    mountDialog({ title: "" });
    await nextTick();
    const dialog = () => document.querySelector('[role="dialog"]');
    expect(dialog().getAttribute("aria-label")).toBe("Tego nie da się cofnąć.");
    wrappers.splice(0).forEach((w) => w.unmount());
    mountDialog({ title: "", ariaLabel: "Usuwanie strony" });
    await nextTick();
    expect(dialog().getAttribute("aria-label")).toBe("Usuwanie strony");
  });

  it("a caller's test id lands on the dialog, and `confirmTestid` renames the confirm button", async () => {
    mountDialog({ "data-testid": "confirm-sheet", confirmTestid: "confirm-ok" });
    await nextTick();
    const dialog = byTestId("confirm-sheet");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.querySelector('[data-testid="confirm-ok"]')).not.toBeNull();
    expect(byTestId("confirm-dialog-confirm")).toBeNull();
  });
});

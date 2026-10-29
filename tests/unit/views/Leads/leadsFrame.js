import ActionBar from "@/boots/ActionBar/index.vue";
import DataTable from "@/boots/DataTable/index.vue";

// Plan 53: the Leads screens on the page frame and the boots. ActionBar and DataTable are real (their buttons and cells
// carry the test ids); PageHeader, BasicCard and FormField render their slots; the controls are stubs that keep their
// props, and a spec drives them the way the boot does: `update:modelValue` from a field, a click on a button.
const stub = (name, props, template = "<div />") => ({ name, props, template });

export const leadsFrame = {
  components: { ActionBar, DataTable },
  stubs: {
    PageHeader: stub(
      "PageHeader",
      ["title", "back", "crumbs"],
      '<header><h1>{{ title }}</h1><slot name="meta" /><slot name="actions" /></header>'
    ),
    BasicCard: stub("BasicCard", ["title", "gap"], "<section><slot /></section>"),
    FormField: stub("FormField", ["label", "error", "description", "required", "disabled"], "<div><slot /></div>"),
    BasicSelect: stub("BasicSelect", ["modelValue", "options", "floatingLabel", "multiple"], '<div class="basic-select" />'),
    BasicTabs: stub("BasicTabs", ["options", "modelValue", "idPrefix"]),
    BasicSwitch: stub("BasicSwitch", ["modelValue", "label"]),
    BasicCheckbox: stub("BasicCheckbox", ["modelValue"], "<label><slot /></label>"),
    IconButton: stub("IconButton", ["icon", "label", "pressed", "disabled", "variant", "size"], "<button :aria-pressed='pressed' :disabled='disabled' />"),
    // Open, it shows its title and message and the two actions (the confirm under the caller's `confirmTestid`).
    ConfirmDialog: {
      name: "ConfirmDialog",
      props: ["open", "title", "message", "confirmLabel", "cancelLabel", "tone", "confirmTestid"],
      emits: ["confirm", "cancel"],
      template: `<div v-if="open">{{ title }} {{ message }}
        <button data-testid="confirm-dialog-cancel" @click="$emit('cancel')" />
        <button :data-testid="confirmTestid || 'confirm-dialog-confirm'" @click="$emit('confirm')" />
      </div>`,
    },
    CountBadge: stub("CountBadge", ["count"]),
  },
};

// A control by its test id (on the component's root), and the value a user would pick or type into it.
export const control = (wrapper, testid) => wrapper.findComponent(`[data-testid="${testid}"]`);
export const setControl = (wrapper, testid, value) => control(wrapper, testid).vm.$emit("update:modelValue", value);

// The error a FormField shows, found by its label (the i18n key in tests).
export const fieldError = (wrapper, label) =>
  wrapper.findAllComponents({ name: "FormField" }).find((field) => field.props("label") === label)?.props("error");

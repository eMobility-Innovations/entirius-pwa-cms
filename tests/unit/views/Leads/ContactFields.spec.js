import { describe, it, expect, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

import ContactFields from "@/views/Leads/ContactFields.vue";
import { getLang, setLang } from "@/i18n";
import { control, leadsFrame } from "./leadsFrame";

const mountFields = () =>
  mount(ContactFields, {
    props: { form: { legal_basis: "" }, errorOf: () => "", testid: "contact", full: true },
    global: { stubs: leadsFrame.stubs },
  });

// Plan 56b: the browser never offers the operator's own name, email or phone in a lead's contact.
describe("Leads contact fields", () => {
  const lang = getLang();
  afterEach(() => setLang(lang));

  it("every text field has autocomplete off; email, phone and language keep their native hints", () => {
    const wrapper = mountFields();
    const attr = (id, name) => wrapper.get(`[data-testid="contact-${id}"]`).attributes(name);
    const fields = ["email", "first-name", "last-name", "job-title", "phone", "language"];
    fields.forEach((id) => expect(attr(id, "autocomplete")).toBe("off"));
    expect(attr("email", "inputmode")).toBe("email");
    expect(attr("phone", "inputmode")).toBe("tel");
    expect(attr("language", "maxlength")).toBe("2");
  });

  it("the legal-basis options follow a UI language switch", async () => {
    setLang("EN");
    const wrapper = mountFields();
    const first = () => control(wrapper, "contact-basis").props("options")[0].label;
    const english = first();
    setLang("PL");
    await nextTick();
    expect(first()).not.toBe(english);
  });
});

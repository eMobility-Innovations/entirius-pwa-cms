import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_SubjectPictures: vi.fn() }));
vi.mock("@/api/enrichment/api", () => ({ GET_SubjectPictures: api.GET_SubjectPictures }));

import PicturePicker from "@/views/Pim/components/enrichment/PicturePicker.vue";
import BasicRadioGroup from "@/boots/BasicRadioGroup/index.vue";

const PICTURES = [
  { ref: "3", label: "", url: "/media/image/side.jpg", is_main: false },
  { ref: "7", label: "Front", url: "/media/image/front.jpg", is_main: true },
];

const stubs = { FormField: { template: "<div><slot /></div>" }, Loader: { template: "<div data-testid='picture-picker-loading' />" } };

async function mountPicker(props = {}) {
  const w = mount(PicturePicker, {
    props: { channel: "eu", subjectRef: "A", label: "Picture to animate", ...props },
    global: { stubs, components: { BasicRadioGroup } },
  });
  await flushPromises();
  return w;
}

const lastPick = (w) => w.emitted("update:modelValue").at(-1)[0];

describe("PicturePicker", () => {
  beforeEach(() => {
    api.GET_SubjectPictures.mockReset();
  });

  it("lists the item's pictures as tiles and picks the main one", async () => {
    api.GET_SubjectPictures.mockResolvedValue({ data: PICTURES });
    const w = await mountPicker();
    expect(api.GET_SubjectPictures).toHaveBeenCalledWith({ module: "pim", channel: "eu", ref: "A" });
    expect(lastPick(w)).toBe("7");
    const images = w.findAll("img");
    expect(images.map((img) => img.attributes("alt"))).toEqual(["enrichment.picture_picker.untitled::{\"n\":1}", "Front"]);
    expect(images[1].attributes("src")).toMatch(/\/media\/image\/front\.jpg$/);
    expect(w.findAll(".picture-picker__badge")).toHaveLength(1);
  });

  it("emits the picture the operator picks", async () => {
    api.GET_SubjectPictures.mockResolvedValue({ data: PICTURES });
    const w = await mountPicker();
    await w.setProps({ modelValue: "7" });
    await w.find("[data-testid='picture-picker-item-3']").setValue(true);
    expect(lastPick(w)).toBe("3");
  });

  it("picks the preferred picture over the main one, the main one when it is gone", async () => {
    api.GET_SubjectPictures.mockResolvedValue({ data: PICTURES });
    expect(lastPick(await mountPicker({ preferred: "3" }))).toBe("3");
    expect(lastPick(await mountPicker({ preferred: "99" }))).toBe("7");
  });

  it("without a main picture the first one is picked", async () => {
    api.GET_SubjectPictures.mockResolvedValue({ data: [PICTURES[0]] });
    expect(lastPick(await mountPicker())).toBe("3");
  });

  it("an item without pictures says so and picks nothing", async () => {
    api.GET_SubjectPictures.mockResolvedValue({ data: [] });
    const w = await mountPicker();
    expect(w.find("[data-testid='picture-picker-empty']").exists()).toBe(true);
    expect(lastPick(w)).toBe("");
  });

  it("a failed list says so and picks nothing", async () => {
    api.GET_SubjectPictures.mockRejectedValue(new Error("boom"));
    const w = await mountPicker();
    expect(w.find("[data-testid='picture-picker-failed']").exists()).toBe(true);
    expect(lastPick(w)).toBe("");
  });

  it("another item reloads; a late answer for the old one is ignored", async () => {
    let answerOld;
    api.GET_SubjectPictures.mockReturnValueOnce(new Promise((resolve) => (answerOld = resolve)));
    api.GET_SubjectPictures.mockResolvedValueOnce({ data: [PICTURES[0]] });
    const w = await mountPicker();
    await w.setProps({ subjectRef: "B" });
    await flushPromises();
    answerOld({ data: PICTURES });
    await flushPromises();
    expect(api.GET_SubjectPictures).toHaveBeenLastCalledWith({ module: "pim", channel: "eu", ref: "B" });
    expect(lastPick(w)).toBe("3");
    expect(w.findAll("img")).toHaveLength(1);
  });
});

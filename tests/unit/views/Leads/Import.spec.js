import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ POST_Import: vi.fn(), GET_Import: vi.fn() }));
vi.mock("@/api/leads/api", () => api);
const push = vi.hoisted(() => vi.fn());
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import Import from "@/views/Leads/Import.vue";
import { leadsFrame } from "./leadsFrame";
import { t } from "@/i18n";

function mountWithFile() {
  const wrapper = mount(Import, { global: { components: leadsFrame.components, stubs: { ...leadsFrame.stubs, RouterLink: true } } });
  const input = wrapper.find('[data-testid="import-file"]');
  Object.defineProperty(input.element, "files", { value: [new File(["domain\n"], "leads.csv", { type: "text/csv" })] });
  return input.trigger("change").then(() => wrapper);
}

describe("Leads Import", () => {
  afterEach(() => vi.useRealTimers());

  it("a failing later poll shows the error, re-enables Upload and stops polling", async () => {
    vi.useFakeTimers();
    api.POST_Import.mockResolvedValue({ data: { id: 5, status: "pending" } });
    api.GET_Import.mockReset();
    api.GET_Import.mockResolvedValueOnce({ data: { id: 5, status: "running" } }).mockRejectedValue({ response: { data: { detail: "gone" } } });
    const wrapper = await mountWithFile();
    await wrapper.find('[data-testid="import-upload"]').trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2000);
    await flushPromises();
    expect(wrapper.find('[data-testid="import-error"]').text()).toBe("gone");
    expect(wrapper.find('[data-testid="import-upload"]').attributes("disabled")).toBe("false");
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.GET_Import).toHaveBeenCalledTimes(2);
  });

  it("uploads the picked file and reports created / matched / skipped", async () => {
    const batch = { id: 4, status: "done", created_count: 2, matched_count: 1, skipped_count: 0, report: [] };
    api.POST_Import.mockResolvedValue({ data: { ...batch, status: "pending" } });
    api.GET_Import.mockResolvedValue({ data: batch });
    const wrapper = mount(Import, { global: { components: leadsFrame.components, stubs: { ...leadsFrame.stubs, RouterLink: true } } });
    const file = new File(["domain\n"], "leads.csv", { type: "text/csv" });
    const input = wrapper.find('[data-testid="import-file"]');
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    await wrapper.find('[data-testid="import-upload"]').trigger("click");
    await flushPromises();
    expect(api.POST_Import).toHaveBeenCalledWith(file);
    expect(wrapper.find('[data-testid="import-status"]').text()).toBe("done");
    expect(wrapper.find('[data-testid="import-counts"]').text()).toContain('"created":2');
  });

  // FIX-17 item 13: the screen says which columns, which legal bases and what happens next, and offers a sample.
  it("explains the columns, the legal bases and what happens after the upload", () => {
    const wrapper = mount(Import, { global: { components: leadsFrame.components, stubs: { ...leadsFrame.stubs, RouterLink: true } } });
    expect(wrapper.findAll('[data-testid="import-columns"] li')).toHaveLength(4);
    expect(t("leads.import.column_company")).toContain("company_name");
    expect(t("leads.import.column_legal_basis")).toContain("consent, legitimate_interest, contract");
    expect(t("leads.import.after")).toContain("first stage");
    expect(wrapper.find('[data-testid="import-sample"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="import-file-name"]').text()).toBe("leads.import.no_file");
  });

  it("naming the picked file replaces the bare browser control", async () => {
    const wrapper = await mountWithFile();
    expect(wrapper.get('[data-testid="import-file-name"]').text()).toBe("leads.csv");
  });
});

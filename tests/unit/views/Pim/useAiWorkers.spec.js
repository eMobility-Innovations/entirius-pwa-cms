import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";

const mockWorkers = vi.fn();
const mockTemplates = vi.fn();
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Workers: (...a) => mockWorkers(...a),
  GET_Templates: (...a) => mockTemplates(...a),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: () => true }) }));
vi.mock("@/stores/configHealth", () => ({ useConfigHealthStore: () => ({ aiUsable: true }) }));

import { runnableTemplates, useAiWorkers } from "@/views/Pim/components/enrichment/useAiWorkers";

describe("useAiWorkers", () => {
  beforeEach(() => {
    mockWorkers.mockReset();
    mockTemplates.mockReset();
    mockTemplates.mockResolvedValue({ data: [] });
    notify.mockReset();
  });

  it("loads the PIM workers once the module is on", async () => {
    mockWorkers.mockResolvedValue({ data: [{ key: "pim.translate" }] });
    const { workers } = useAiWorkers();
    await flushPromises();
    expect(mockWorkers).toHaveBeenCalledWith({ target_module: "pim" });
    expect(workers.value).toEqual([{ key: "pim.translate" }]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("a failed load is toasted, not silently shown as no workers", async () => {
    mockWorkers.mockRejectedValue({ response: { status: 403, data: { detail: "Forbidden" } } });
    const { workers } = useAiWorkers();
    await flushPromises();
    expect(workers.value).toEqual([]);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
  });

  it("loads the templates a run can start from, in their order", async () => {
    mockWorkers.mockResolvedValue({ data: [{ key: "pim.writer" }] });
    mockTemplates.mockResolvedValue({
      data: [
        { key: "b", worker_key: "pim.writer", position: 20, active: true },
        { key: "a", worker_key: "pim.writer", position: 10, active: true },
      ],
    });
    const { templates, reloadTemplates } = useAiWorkers();
    await flushPromises();
    expect(mockTemplates).toHaveBeenCalledWith({ target_module: "pim" });
    expect(templates.value.map((t) => t.key)).toEqual(["a", "b"]);
    mockTemplates.mockResolvedValue({ data: [] });
    await reloadTemplates();
    expect(templates.value).toEqual([]);
  });

  it("templates are optional: a failed load leaves none and says nothing", async () => {
    mockWorkers.mockResolvedValue({ data: [{ key: "pim.writer" }] });
    mockTemplates.mockRejectedValue({ response: { status: 404 } });
    const { templates } = useAiWorkers();
    await flushPromises();
    expect(templates.value).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("runnableTemplates", () => {
  it("drops hidden templates and those whose worker is not active", () => {
    const templates = [
      { key: "off", worker_key: "pim.writer", position: 1, active: false },
      { key: "gone", worker_key: "pim.old", position: 2, active: true },
      { key: "on", worker_key: "pim.writer", position: 3, active: true },
    ];
    expect(runnableTemplates(templates, [{ key: "pim.writer" }]).map((t) => t.key)).toEqual(["on"]);
  });
});

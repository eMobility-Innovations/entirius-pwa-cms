import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";

const mockWorkers = vi.fn();
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({ GET_Workers: (...a) => mockWorkers(...a) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: () => true }) }));
vi.mock("@/stores/configHealth", () => ({ useConfigHealthStore: () => ({ aiUsable: true }) }));

import { useAiWorkers } from "@/views/Pim/components/enrichment/useAiWorkers";

describe("useAiWorkers", () => {
  beforeEach(() => {
    mockWorkers.mockReset();
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
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";

const mockRetry = vi.fn();
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({ POST_RetryTask: (...a) => mockRetry(...a) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import { useTaskRetry } from "@/views/EnrichmentReview/useTaskRetry";

const failed = { id: 7, status: "failed" };
const created = { id: 12, status: "open", lane: "queue", queued_ahead: 0, params: { retry_of: 7 } };

describe("useTaskRetry", () => {
  beforeEach(() => {
    mockRetry.mockReset();
    notify.mockReset();
  });

  it("retries the task once and answers the new task, toasting where it stands", async () => {
    mockRetry.mockResolvedValue({ data: created });
    const { retry, retrying } = useTaskRetry();

    const pending = retry(failed);
    expect(retrying.value).toEqual([7]); // the row shows its loading state at once
    expect(await pending).toEqual(created);

    expect(mockRetry).toHaveBeenCalledTimes(1);
    expect(mockRetry).toHaveBeenCalledWith(7);
    expect(notify).toHaveBeenCalledWith({ type: "positive", msg: "Queued — starts next." });
    expect(retrying.value).toEqual([]);
  });

  it("a second click while the first is out sends nothing", async () => {
    let answer;
    mockRetry.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { retry } = useTaskRetry();

    const first = retry(failed);
    const second = await retry(failed);
    expect(second).toBeNull();
    expect(mockRetry).toHaveBeenCalledTimes(1);

    answer({ data: created });
    expect(await first).toEqual(created);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("tasks retry independently of each other", async () => {
    mockRetry.mockResolvedValue({ data: created });
    const { retry, retrying } = useTaskRetry();

    const one = retry(failed);
    const other = retry({ id: 8, status: "failed" });
    expect(retrying.value).toEqual([7, 8]);
    await Promise.all([one, other]);
    expect(mockRetry.mock.calls.map(([id]) => id)).toEqual([7, 8]);
  });

  it("a refusal toasts the API's message, answers nothing and frees the task for another try", async () => {
    mockRetry.mockRejectedValueOnce({ response: { status: 409, data: { error: "CONFLICT", message: "Nothing failed in this task." } } });
    const { retry, retrying } = useTaskRetry();

    expect(await retry(failed)).toBeNull();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({ type: "negative", msg: "Nothing failed in this task." });
    expect(retrying.value).toEqual([]);

    mockRetry.mockResolvedValueOnce({ data: created });
    await flushPromises();
    expect(await retry(failed)).toEqual(created);
    expect(mockRetry).toHaveBeenCalledTimes(2);
  });

  it("an error without a message falls back to the generic one", async () => {
    mockRetry.mockRejectedValueOnce(new Error("network"));
    const { retry } = useTaskRetry();

    await retry(failed);
    expect(notify).toHaveBeenCalledWith({ type: "negative", msg: "Something went wrong" });
  });
});

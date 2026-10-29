import { describe, it, expect } from "vitest";

import { createLimiter } from "@/utils/limit";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setTimeout(resolve));

describe("createLimiter", () => {
  it("runs at most `max` tasks at once and starts the next in order when one settles", async () => {
    const limit = createLimiter(2);
    const jobs = [deferred(), deferred(), deferred()];
    const started = [];
    const results = jobs.map((job, i) => limit(() => (started.push(i), job.promise)));
    await tick();
    expect(started).toEqual([0, 1]);

    const failed = expect(results[1]).rejects.toThrow("boom");
    jobs[1].reject(new Error("boom"));
    await failed;
    await tick();
    expect(started).toEqual([0, 1, 2]);

    jobs[0].resolve("a");
    jobs[2].resolve("c");
    await expect(results[0]).resolves.toBe("a");
    await expect(results[2]).resolves.toBe("c");
  });
});

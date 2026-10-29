import { describe, it, expect, vi } from "vitest";

// Access plan 22: an application's tokens and the application list are read page after page until `next` is null —
// a token beyond the first 100 stays reachable (to revoke it, or to set its expiry). Roles (the key lookup, the role
// pickers) and staff (the audit actor filter) the same way: the 101st is never silently missing.
const client = vi.hoisted(() => ({ accessApi: { get: vi.fn() } }));
vi.mock("@/api/access/client", () => client);

import { GET_AccessAllTokens, GET_AccessAllApplications, GET_AccessAllRoles, GET_AccessAllStaff } from "@/api/access/api";

const page = (results, next) => ({ data: { count: 3, next, results } });

describe("access list pages", () => {
  it("follows next until the last page", async () => {
    client.accessApi.get.mockResolvedValueOnce(page([{ id: 1 }, { id: 2 }], "p2")).mockResolvedValueOnce(page([{ id: 3 }], null));
    expect((await GET_AccessAllTokens(5)).map((token) => token.id)).toEqual([1, 2, 3]);
    expect(client.accessApi.get.mock.calls.map(([url, config]) => [url, config.params])).toEqual([
      ["/api/access/v2/admin/applications/5/tokens/", { page: 1, page_size: 100 }],
      ["/api/access/v2/admin/applications/5/tokens/", { page: 2, page_size: 100 }],
    ]);
    expect(client.accessApi.get.mock.calls[0][1].sensitive).toBe(true);
  });

  it("reads one page when there is no next", async () => {
    client.accessApi.get.mockReset().mockResolvedValueOnce(page([{ id: 3 }], null));
    expect(await GET_AccessAllApplications()).toEqual([{ id: 3 }]);
    expect(client.accessApi.get).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["roles", GET_AccessAllRoles],
    ["staff", GET_AccessAllStaff],
  ])("reads every page of %s", async (path, getAll) => {
    client.accessApi.get.mockReset().mockResolvedValueOnce(page([{ id: 1 }], "p2")).mockResolvedValueOnce(page([{ id: 101 }], null));
    expect((await getAll()).map((row) => row.id)).toEqual([1, 101]);
    expect(client.accessApi.get.mock.calls.map(([url, config]) => [url, config.params])).toEqual([
      [`/api/access/v2/admin/${path}/`, { page: 1, page_size: 100 }],
      [`/api/access/v2/admin/${path}/`, { page: 2, page_size: 100 }],
    ]);
  });
});

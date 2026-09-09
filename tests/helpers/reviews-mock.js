/**
 * Reviews panel mock helper.
 *
 * Intercepts `/api/reviews/v2/admin/...` and `/api/munin/v2/...` with in-memory state so the
 * Reviews panel can be exercised without a backend. Reuses `fakeLogin` / `waitForRequest` from
 * the suppliers mock. Returned state exposes mutable `reviews` and a `requests` log.
 */

const { fakeLogin, waitForRequest } = require("./suppliers-mock");

const ADMIN = "/api/reviews/v2/admin";

function ok(json, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(json),
  };
}

function paged(rows) {
  return { count: rows.length, next: null, previous: null, results: rows };
}

function review(id, overrides = {}) {
  return {
    id,
    uuid: `00000000-0000-4000-8000-00000000000${id}`,
    status: "pending",
    name: `Customer ${id}`,
    title: `Review ${id}`,
    detail: `Detail of review ${id}`,
    average_rate: 4,
    source: "self/volkanos",
    channel_idx: "channel-a",
    sku: `SKU-00${id}`,
    product_name: `Product ${id}`,
    customer_id: null,
    customer_email: null,
    ratings: [{ rating_name: "rating", rate: 4 }],
    is_sent_to_magento: false,
    created_at: "2026-09-01T10:00:00Z",
    modified_at: "2026-09-01T10:00:00Z",
    reviewed_by: null,
    reviewed_at: null,
    reject_reason: "",
    language: "pl",
    consents: [],
    translations: [],
    reply: null,
    images: [],
    ...overrides,
  };
}

function defaultSeed() {
  return {
    reviews: [
      review(1),
      review(2),
      review(3, { status: "accepted", reviewed_by: "admin" }),
    ],
    products: [
      {
        id: 1,
        sku: "SKU-001",
        name: "Product 1",
        average_rate: 4,
        number_of_reviews: 1,
        magento_id: null,
        parent_sku: null,
      },
    ],
  };
}

async function installReviewsMock(page, { seed } = {}) {
  const state = { ...defaultSeed(), ...(seed || {}), requests: [] };
  const log = (route) => {
    const req = route.request();
    state.requests.push({
      method: req.method(),
      url: req.url(),
      body: req.postData(),
    });
  };

  await page.route("**/api/munin/v2/**", async (route) => {
    log(route);
    await route.fulfill(
      ok({
        platform: { name: "Volkanos", version: "test" },
        modules: {
          reviews: {
            key: "reviews",
            label: "Reviews",
            enabled_in_cms: true,
            has_admin_api: true,
          },
          reviews_translator: {
            key: "reviews_translator",
            label: "Reviews AI Translator",
            enabled_in_cms: true,
            has_admin_api: true,
          },
        },
      })
    );
  });

  await page.route("**/api/regional/**", async (route) => {
    log(route);
    await route.fulfill(ok(paged([])));
  });

  await page.route(`**${ADMIN}/**`, async (route) => {
    log(route);
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname.replace(ADMIN, "");
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const find = (id) => state.reviews.find((r) => r.id === Number(id));

    if (method === "GET" && path === "/reviews/") {
      const status = url.searchParams.get("status");
      const rows = status
        ? state.reviews.filter((r) => r.status === status)
        : state.reviews;
      return route.fulfill(ok(paged(rows)));
    }
    if (method === "GET" && path === "/products/")
      return route.fulfill(ok(paged(state.products)));

    let m = path.match(
      /^\/reviews\/(\d+)\/(approve|reject|archive|requeue)\/$/
    );
    if (m && method === "POST") {
      const target = {
        approve: "accepted",
        reject: "not_accepted",
        archive: "archived",
        requeue: "pending",
      }[m[2]];
      const row = find(m[1]);
      if (!row)
        return route.fulfill(
          ok(
            {
              error: "NOT_FOUND",
              message: "not found",
              debug_id: "x",
              details: [],
            },
            404
          )
        );
      Object.assign(row, {
        status: target,
        reviewed_by: "admin",
        reviewed_at: "2026-09-01T11:00:00Z",
        reject_reason: body.reason || "",
      });
      return route.fulfill(ok(row));
    }
    m = path.match(/^\/reviews\/bulk-(approve|reject|archive)\/$/);
    if (m && method === "POST") {
      const target = {
        approve: "accepted",
        reject: "not_accepted",
        archive: "archived",
      }[m[1]];
      let success = 0;
      for (const id of body.ids || []) {
        const row = find(id);
        if (row) {
          row.status = target;
          success += 1;
        }
      }
      return route.fulfill(
        ok({
          success,
          invalid_transition: 0,
          not_found: (body.ids || []).length - success,
          ids_failed: [],
        })
      );
    }
    m = path.match(/^\/reviews\/(\d+)\/$/);
    if (m) {
      const row = find(m[1]);
      if (!row)
        return route.fulfill(
          ok(
            {
              error: "NOT_FOUND",
              message: "not found",
              debug_id: "x",
              details: [],
            },
            404
          )
        );
      if (method === "PATCH") Object.assign(row, body);
      if (method === "DELETE") {
        state.reviews = state.reviews.filter((r) => r.id !== row.id);
        return route.fulfill({ status: 204, body: "" });
      }
      return route.fulfill(ok(row));
    }
    m = path.match(/^\/reviews\/(\d+)\/reply\/$/);
    if (m) {
      const row = find(m[1]);
      if (method === "PUT") {
        row.reply = {
          body: body.body,
          is_published: body.is_published ?? true,
          author: "admin",
          created_at: "2026-09-01T11:00:00Z",
          modified_at: "2026-09-01T11:00:00Z",
        };
        return route.fulfill(ok(row.reply));
      }
      if (method === "DELETE") {
        row.reply = null;
        return route.fulfill({ status: 204, body: "" });
      }
    }
    return route.fulfill(
      ok(
        {
          error: "NOT_FOUND",
          message: `unmocked ${method} ${path}`,
          debug_id: "x",
          details: [],
        },
        404
      )
    );
  });

  return state;
}

module.exports = { installReviewsMock, fakeLogin, waitForRequest };

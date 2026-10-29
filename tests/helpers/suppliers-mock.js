/**
 * Suppliers panel mock helper.
 *
 * Intercepts all `/api/atlas/v2/admin/...` and `/api/munin/v2/...`
 * endpoints with deterministic in-memory state so the CMS Suppliers
 * and SupplierReview panels can be exercised end-to-end without a
 * live backend.
 *
 * Each spec calls `installSuppliersMock(page)` in `beforeEach`. The
 * returned `state` object holds mutable arrays (suppliers, feeds,
 * products, etc.) plus a `requests` log of every URL hit so tests
 * can assert exact API calls were made.
 */

const ADMIN = '/api/atlas/v2/admin';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function urlMatches(url, pattern) {
  // pattern uses :param placeholders.
  // Returns null if no match, or { params } if matched.
  const u = new URL(url);
  const path = u.pathname;
  const patternSegs = pattern.split('/');
  const pathSegs = path.split('/');
  if (patternSegs.length !== pathSegs.length) return null;
  const params = {};
  for (let i = 0; i < patternSegs.length; i += 1) {
    const ps = patternSegs[i];
    const xs = pathSegs[i];
    if (ps.startsWith(':')) {
      params[ps.slice(1)] = decodeURIComponent(xs);
    } else if (ps !== xs) {
      return null;
    }
  }
  return { params, query: Object.fromEntries(u.searchParams.entries()) };
}

function paged(arr) {
  return { count: arr.length, next: null, previous: null, results: arr };
}

function ok(json, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(json),
  };
}

function notFound(detail = 'Not found.') {
  return ok({ detail }, 404);
}

function defaultSeed() {
  return {
    suppliers: [
      {
        idx: 'acme',
        name: 'Acme Corp',
        kind: 'procurement',
        source_type: 'feed',
        review_mode: 'manual',
        is_active: true,
        default_language_code: 'EN',
        default_currency_code: 'EUR',
        country_code: 'PL',
        sku_prefix: 'ACM',
        target_warehouse_code: 'WH-MAIN',
        default_feature_set_idx: 'standard',
        qty_subtract: 0,
        qty_minimum: 0,
        lead_time_days: 7,
        contact_email: 'ops@acme.test',
        contact_phone: '',
        contact_person: '',
        company_name: '',
        notes: '',
      },
      {
        idx: 'globex',
        name: 'Globex Industries',
        kind: 'procurement',
        source_type: 'feed',
        review_mode: 'auto',
        is_active: false,
        default_language_code: 'EN',
        default_currency_code: 'USD',
        country_code: 'US',
        sku_prefix: 'GBX',
        target_warehouse_code: '',
        default_feature_set_idx: '',
        qty_subtract: 0,
        qty_minimum: 0,
        lead_time_days: 14,
        contact_email: '',
        contact_phone: '',
        contact_person: '',
        company_name: '',
        notes: '',
      },
    ],
    feeds: {
      acme: [
        {
          idx: 'xml-1',
          connector_kind: 'xml_feed',
          schedule_cron: '0 */6 * * *',
          sync_mode: 'full',
          language_code: 'EN',
          currency_code: 'EUR',
          is_active: true,
          last_sync_at: '2026-05-01T08:00:00Z',
          last_sync_status: 'success',
          feed_config: {
            feed_url: 'https://acme.test/feed.xml',
            product_xpath: '//product',
          },
        },
      ],
      globex: [],
    },
    profiles: {
      acme: [
        {
          id: 11,
          idx: 'default',
          name: 'Default profile',
          target_channel_idxs: ['default-europe'],
          import_language_id: 2,
          feature_set_idx: 'standard',
          is_active: true,
        },
      ],
      globex: [],
    },
    attributeMappings: {
      11: [
        {
          id: 101,
          source_field: '__cost__',
          target_type: 'real_product',
          target_identifier: 'cost',
          is_required: true,
        },
      ],
    },
    categoryMappings: {
      11: [],
    },
    products: [
      {
        id: 501,
        supplier_idx: 'acme',
        external_id: 'ACME-001',
        name: 'Acme Widget',
        cost: '12.50',
        currency: 'EUR',
        stock: 25,
        ean: '5901234567890',
        status: 'queued',
        url: 'https://acme.test/products/001',
        image_urls: [],
        last_synced_at: '2026-05-01T08:00:00Z',
        pushed_to_channel_idxs: [],
      },
      {
        id: 502,
        supplier_idx: 'acme',
        external_id: 'ACME-002',
        name: 'Acme Gadget',
        cost: '49.00',
        currency: 'EUR',
        stock: 10,
        ean: '5907777777777',
        status: 'approved',
        url: 'https://acme.test/products/002',
        image_urls: [],
        last_synced_at: '2026-05-01T08:00:00Z',
        pushed_to_channel_idxs: [],
      },
      {
        id: 503,
        supplier_idx: 'acme',
        external_id: 'ACME-003',
        name: 'Acme Sprocket',
        cost: '7.20',
        currency: 'EUR',
        stock: 0,
        ean: '',
        status: 'rejected',
        url: '',
        image_urls: [],
        last_synced_at: '2026-05-01T08:00:00Z',
        pushed_to_channel_idxs: [],
      },
      {
        id: 504,
        supplier_idx: 'acme',
        external_id: 'ACME-004',
        name: 'Acme Pushed',
        cost: '99.00',
        currency: 'EUR',
        stock: 5,
        ean: '5908888888888',
        status: 'pushed',
        url: '',
        image_urls: [],
        last_synced_at: '2026-05-01T08:00:00Z',
        pushed_to_channel_idxs: ['default-europe'],
      },
    ],
    productLinks: [
      {
        id: 901,
        real_product_sku: 'PIM-SKU-1',
        supplier_idx: 'acme',
        external_id: 'ACME-001',
        priority: 0,
        is_primary: false,
        is_active: true,
        notes: '',
      },
      {
        id: 902,
        real_product_sku: 'PIM-SKU-2',
        supplier_idx: 'acme',
        external_id: 'ACME-002',
        priority: 0,
        is_primary: false,
        is_active: true,
        notes: '',
      },
    ],
    importLogs: [
      {
        id: 701,
        run_id: '11111111-1111-1111-1111-111111111111',
        feed: 1,
        mode: 'full',
        status: 'success',
        started_at: '2026-05-01T08:00:00Z',
        finished_at: '2026-05-01T08:05:00Z',
        total_count: 25,
        new_count: 5,
        updated_count: 18,
        unchanged_count: 2,
        delisted_count: 0,
        error_count: 0,
      },
    ],
    events: [
      {
        id: 801,
        event_type: 'cost_updated',
        severity: 'info',
        supplier_idx: 'acme',
        feed: 1,
        supplier_product: 501,
        message: 'Cost updated for ACME-001 (12.00 → 12.50).',
        details: { sku: 'PIM-SKU-1' },
        acknowledged_at: null,
        acknowledged_by: null,
        created_at: '2026-05-01T08:05:00Z',
      },
      {
        id: 802,
        event_type: 'multi_supplier_overlap',
        severity: 'warning',
        supplier_idx: 'acme',
        feed: null,
        supplier_product: 502,
        message: 'Existing supplier link detected for SKU PIM-SKU-2.',
        details: { existing_supplier_idxs: ['globex'] },
        acknowledged_at: null,
        acknowledged_by: null,
        created_at: '2026-05-02T09:00:00Z',
      },
    ],
    settings: {
      auto_push_enabled: true,
      scraper_dispatch_enabled: true,
      delta_sync_enabled: true,
      integration_event_retention_days: 90,
    },
    connectors: [
      { kind: 'xml_feed', name: 'XML Feed', is_async: false },
      { kind: 'scraper', name: 'Scraper', is_async: true },
    ],
  };
}

/**
 * Install all supplier API mocks on the page.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} [options]
 * @param {Object} [options.seed] - Override default seed state.
 * @param {boolean} [options.muninEnabled=true] - Whether munin reports the panel as enabled.
 * @returns {Object} state - mutable mock state + requests log.
 */
async function installSuppliersMock(page, { seed, muninEnabled = true } = {}) {
  const state = seed ? clone(seed) : defaultSeed();
  state.requests = [];
  state.nextId = 1000;

  function logRequest(route) {
    const req = route.request();
    let postData = null;
    try {
      postData = req.postDataJSON();
    } catch {
      postData = req.postData();
    }
    state.requests.push({
      method: req.method(),
      url: req.url(),
      postData,
    });
  }

  // --- PIM (LinkedTab SKU picker: channel list + product search) ---
  await page.route('**/api/pim/v2/admin/**', async (route) => {
    logRequest(route);
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/channels/')) {
      await route.fulfill(
        ok(paged([{ idx: 'default', name: 'Default', is_default: true }]))
      );
      return;
    }
    if (path.endsWith('/products/')) {
      await route.fulfill(
        ok(paged([{ sku: 'PIM-SKU-3', name: 'Third PIM product' }]))
      );
      return;
    }
    await route.fulfill(notFound(`Unmocked PIM endpoint: ${path}`));
  });

  // --- Regional reference data (source forms: country, currency, language selects). Unmocked, the fake token gets
  // a 401 from the live service, the refresh fails and the app ends the session on the login wall. ---
  await page.route('**/api/regional/v2/admin/**', async (route) => {
    logRequest(route);
    await route.fulfill(ok(paged([])));
  });

  // --- Munin (gates panel visibility) ---
  await page.route('**/api/munin/v2/**', async (route) => {
    logRequest(route);
    await route.fulfill(
      ok({
        platform: { name: 'Volkanos', version: 'test' },
        modules: {
          atlas: {
            key: 'atlas',
            label: 'Atlas',
            enabled_in_cms: muninEnabled,
            has_admin_api: true,
          },
        },
      })
    );
  });

  await page.route(`**${ADMIN}/**`, async (route) => {
    logRequest(route);
    const req = route.request();
    const method = req.method();
    const url = req.url();
    let body = {};
    try {
      body = req.postDataJSON() || {};
    } catch {
      body = {};
    }

    // --- Connectors ---
    if (method === 'GET' && new URL(url).pathname.endsWith('/connectors/')) {
      await route.fulfill(ok({ results: state.connectors }));
      return;
    }

    // --- Settings ---
    if (new URL(url).pathname.endsWith('/settings/')) {
      if (method === 'GET') {
        await route.fulfill(ok(state.settings));
        return;
      }
      if (method === 'PATCH') {
        Object.assign(state.settings, body);
        await route.fulfill(ok(state.settings));
        return;
      }
    }

    // --- Suppliers list / create ---
    let m = urlMatches(url, `${ADMIN}/sources/`);
    if (m) {
      if (method === 'GET') {
        let rows = state.suppliers.slice();
        if (m.query.role) {
          rows = rows.filter((r) => r.kind === m.query.kind);
        }
        if (m.query.is_active !== undefined) {
          const flag = m.query.is_active === 'true';
          rows = rows.filter((r) => r.is_active === flag);
        }
        if (m.query.search) {
          const q = m.query.search.toLowerCase();
          rows = rows.filter(
            (r) =>
              r.idx.toLowerCase().includes(q) ||
              (r.name || '').toLowerCase().includes(q)
          );
        }
        await route.fulfill(ok(paged(rows)));
        return;
      }
      if (method === 'POST') {
        const created = {
          ...defaultSeed().suppliers[0],
          ...body,
          is_active: true,
        };
        state.suppliers.push(created);
        await route.fulfill(ok(created, 201));
        return;
      }
    }

    // --- Supplier delete-impact ---
    m = urlMatches(url, `${ADMIN}/sources/:idx/delete-impact/`);
    if (m && method === 'GET') {
      const supplier = state.suppliers.find((s) => s.idx === m.params.idx);
      if (!supplier) return route.fulfill(notFound());
      const links = state.productLinks.filter(
        (l) => l.supplier_idx === supplier.idx
      );
      const pushed = state.products.filter(
        (p) =>
          p.supplier_idx === supplier.idx &&
          (p.status === 'pushed' || p.status === 'pushed_pending_images')
      );
      await route.fulfill(
        ok({
          supplier_idx: supplier.idx,
          affected_links_count: links.length,
          affected_pushed_skus_count: pushed.length,
        })
      );
      return;
    }

    // --- Supplier detail / patch / delete ---
    m = urlMatches(url, `${ADMIN}/sources/:idx/`);
    if (m) {
      const i = state.suppliers.findIndex((s) => s.idx === m.params.idx);
      if (i < 0) return route.fulfill(notFound());
      if (method === 'GET') {
        await route.fulfill(ok(state.suppliers[i]));
        return;
      }
      if (method === 'PATCH') {
        Object.assign(state.suppliers[i], body);
        await route.fulfill(ok(state.suppliers[i]));
        return;
      }
      if (method === 'DELETE') {
        const force = m.query.force === 'true';
        if (force) {
          state.suppliers.splice(i, 1);
        } else {
          state.suppliers[i].is_active = false;
        }
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

    // --- Feeds list / create ---
    m = urlMatches(url, `${ADMIN}/sources/:supplierIdx/feeds/`);
    if (m) {
      const supplierIdx = m.params.supplierIdx;
      state.feeds[supplierIdx] = state.feeds[supplierIdx] || [];
      if (method === 'GET') {
        await route.fulfill(ok(paged(state.feeds[supplierIdx])));
        return;
      }
      if (method === 'POST') {
        const feed = {
          idx: body.idx || `feed-${state.nextId++}`,
          connector_kind: 'xml_feed',
          schedule_cron: '',
          sync_mode: 'full',
          language_code: 'EN',
          currency_code: 'EUR',
          is_active: true,
          last_sync_at: null,
          last_sync_status: '',
          feed_config: {},
          ...body,
        };
        state.feeds[supplierIdx].push(feed);
        await route.fulfill(ok(feed, 201));
        return;
      }
    }

    // --- Feeds detail / patch / delete ---
    m = urlMatches(url, `${ADMIN}/sources/:supplierIdx/feeds/:feedIdx/`);
    if (m) {
      const list = state.feeds[m.params.supplierIdx] || [];
      const i = list.findIndex((f) => f.idx === m.params.feedIdx);
      if (i < 0) return route.fulfill(notFound());
      if (method === 'GET') {
        await route.fulfill(ok(list[i]));
        return;
      }
      if (method === 'PATCH') {
        Object.assign(list[i], body);
        await route.fulfill(ok(list[i]));
        return;
      }
      if (method === 'DELETE') {
        list.splice(i, 1);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

    // --- Feed test ---
    m = urlMatches(url, `${ADMIN}/sources/:supplierIdx/feeds/:feedIdx/test/`);
    if (m && method === 'POST') {
      await route.fulfill(
        ok({
          is_async: false,
          is_suppressed: false,
          raw_products: [
            {
              external_id: 'ACME-001',
              name: 'Acme Widget',
              cost: '12.50',
              currency: 'EUR',
              stock: 25,
              ean: '5901234567890',
            },
          ],
          status: 'success',
        })
      );
      return;
    }

    // --- Feed trigger ---
    m = urlMatches(url, `${ADMIN}/sources/:supplierIdx/feeds/:feedIdx/trigger/`);
    if (m && method === 'POST') {
      await route.fulfill(
        ok({
          run_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          status: 'running',
        })
      );
      return;
    }

    // --- Mapping profile validate ---
    m = urlMatches(
      url,
      `${ADMIN}/sources/:supplierIdx/mapping-profiles/:profileIdx/validate/`
    );
    if (m && method === 'POST') {
      await route.fulfill(ok({ ok: true, errors: [], warnings: [] }));
      return;
    }

    // --- Mapping profiles list / create ---
    m = urlMatches(url, `${ADMIN}/sources/:supplierIdx/mapping-profiles/`);
    if (m) {
      const supplierIdx = m.params.supplierIdx;
      state.profiles[supplierIdx] = state.profiles[supplierIdx] || [];
      if (method === 'GET') {
        await route.fulfill(ok(paged(state.profiles[supplierIdx])));
        return;
      }
      if (method === 'POST') {
        const profile = {
          id: state.nextId++,
          idx: body.idx || `profile-${state.nextId}`,
          name: body.name || '',
          target_channel_idxs: body.target_channel_idxs || [],
          import_language_id: body.import_language_id ?? null,
          feature_set_idx: body.feature_set_idx || '',
          is_active: body.is_active ?? true,
        };
        state.profiles[supplierIdx].push(profile);
        await route.fulfill(ok(profile, 201));
        return;
      }
    }

    // --- Mapping profile detail/patch/delete ---
    m = urlMatches(
      url,
      `${ADMIN}/sources/:supplierIdx/mapping-profiles/:profileIdx/`
    );
    if (m) {
      const list = state.profiles[m.params.supplierIdx] || [];
      const i = list.findIndex((p) => p.idx === m.params.profileIdx);
      if (i < 0) return route.fulfill(notFound());
      if (method === 'PATCH') {
        Object.assign(list[i], body);
        await route.fulfill(ok(list[i]));
        return;
      }
      if (method === 'DELETE') {
        list.splice(i, 1);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'GET') {
        await route.fulfill(ok(list[i]));
        return;
      }
    }

    // --- Attribute mappings list / create ---
    m = urlMatches(url, `${ADMIN}/mapping-profiles/:profilePk/attribute-mappings/`);
    if (m) {
      const pk = m.params.profilePk;
      state.attributeMappings[pk] = state.attributeMappings[pk] || [];
      if (method === 'GET') {
        await route.fulfill(ok(paged(state.attributeMappings[pk])));
        return;
      }
      if (method === 'POST') {
        const created = { id: state.nextId++, ...body };
        state.attributeMappings[pk].push(created);
        await route.fulfill(ok(created, 201));
        return;
      }
    }

    // --- Attribute mapping detail (patch/delete) ---
    m = urlMatches(
      url,
      `${ADMIN}/mapping-profiles/:profilePk/attribute-mappings/:pk/`
    );
    if (m) {
      const list = state.attributeMappings[m.params.profilePk] || [];
      const i = list.findIndex((r) => String(r.id) === m.params.pk);
      if (i < 0) return route.fulfill(notFound());
      if (method === 'PATCH') {
        Object.assign(list[i], body);
        await route.fulfill(ok(list[i]));
        return;
      }
      if (method === 'DELETE') {
        list.splice(i, 1);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

    // --- Category mappings list/create ---
    m = urlMatches(url, `${ADMIN}/mapping-profiles/:profilePk/category-mappings/`);
    if (m) {
      const pk = m.params.profilePk;
      state.categoryMappings[pk] = state.categoryMappings[pk] || [];
      if (method === 'GET') {
        await route.fulfill(ok(paged(state.categoryMappings[pk])));
        return;
      }
      if (method === 'POST') {
        const created = { id: state.nextId++, ...body };
        state.categoryMappings[pk].push(created);
        await route.fulfill(ok(created, 201));
        return;
      }
    }
    m = urlMatches(
      url,
      `${ADMIN}/mapping-profiles/:profilePk/category-mappings/:pk/`
    );
    if (m) {
      const list = state.categoryMappings[m.params.profilePk] || [];
      const i = list.findIndex((r) => String(r.id) === m.params.pk);
      if (i < 0) return route.fulfill(notFound());
      if (method === 'PATCH') {
        Object.assign(list[i], body);
        await route.fulfill(ok(list[i]));
        return;
      }
      if (method === 'DELETE') {
        list.splice(i, 1);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

    // --- Bulk product actions ---
    m = urlMatches(url, `${ADMIN}/products/bulk-approve/`);
    if (m && method === 'POST') {
      const ids = body.ids || [];
      ids.forEach((id) => {
        const p = state.products.find((x) => x.id === id);
        if (p) p.status = 'approved';
      });
      await route.fulfill(ok({ affected_count: ids.length, invalid_transition: 0 }));
      return;
    }
    m = urlMatches(url, `${ADMIN}/products/bulk-reject/`);
    if (m && method === 'POST') {
      const ids = body.ids || [];
      ids.forEach((id) => {
        const p = state.products.find((x) => x.id === id);
        if (p) p.status = 'rejected';
      });
      await route.fulfill(ok({ affected_count: ids.length, invalid_transition: 0 }));
      return;
    }
    m = urlMatches(url, `${ADMIN}/products/bulk-requeue/`);
    if (m && method === 'POST') {
      const ids = body.ids || [];
      ids.forEach((id) => {
        const p = state.products.find((x) => x.id === id);
        if (p && p.status === 'rejected') p.status = 'queued';
      });
      await route.fulfill(ok({ affected_count: ids.length, invalid_transition: 0 }));
      return;
    }

    // --- Bulk push ---
    m = urlMatches(url, `${ADMIN}/push/`);
    if (m && method === 'POST') {
      await route.fulfill(ok({ dispatched: (body.ids || []).length }));
      return;
    }

    // --- Single product action: approve/reject/skip/queue/push/force-repush ---
    m = urlMatches(url, `${ADMIN}/products/:pk/:action/`);
    if (m && method === 'POST') {
      const p = state.products.find((x) => String(x.id) === m.params.pk);
      if (!p) return route.fulfill(notFound());
      const map = {
        approve: 'approved',
        reject: 'rejected',
        skip: 'queued',
        queue: 'queued',
        push: 'pushed_pending_images',
        'force-repush': 'pushed_pending_images',
      };
      const next = map[m.params.action];
      if (next) p.status = next;
      await route.fulfill(ok(p));
      return;
    }

    // --- Products list / detail / patch ---
    m = urlMatches(url, `${ADMIN}/products/`);
    if (m && method === 'GET') {
      let rows = state.products.slice();
      if (m.query.source) {
        rows = rows.filter((r) => r.supplier_idx === m.query.source);
      }
      if (m.query.status) rows = rows.filter((r) => r.status === m.query.status);
      if (m.query.search) {
        const q = m.query.search.toLowerCase();
        rows = rows.filter(
          (r) =>
            (r.name || '').toLowerCase().includes(q) ||
            (r.external_id || '').toLowerCase().includes(q)
        );
      }
      await route.fulfill(ok(paged(rows)));
      return;
    }
    m = urlMatches(url, `${ADMIN}/products/:pk/`);
    if (m) {
      const p = state.products.find((x) => String(x.id) === m.params.pk);
      if (!p) return route.fulfill(notFound());
      if (method === 'GET') return route.fulfill(ok(p));
      if (method === 'PATCH') {
        Object.assign(p, body);
        return route.fulfill(ok(p));
      }
    }

    // --- Set preferred ---
    m = urlMatches(url, `${ADMIN}/product-links/:pk/set-primary/`);
    if (m && method === 'POST') {
      const target = state.productLinks.find(
        (l) => String(l.id) === m.params.pk
      );
      if (!target) return route.fulfill(notFound());
      // Mirror backend: unset others for the same SKU; set this one.
      state.productLinks.forEach((l) => {
        if (l.real_product_sku === target.real_product_sku) {
          l.is_primary = l.id === target.id;
        }
      });
      await route.fulfill(ok(target));
      return;
    }

    // --- Product links list/create ---
    m = urlMatches(url, `${ADMIN}/product-links/`);
    if (m) {
      if (method === 'GET') {
        let rows = state.productLinks.slice();
        if (m.query.source) {
          rows = rows.filter((r) => r.supplier_idx === m.query.source);
        }
        await route.fulfill(ok(paged(rows)));
        return;
      }
      if (method === 'POST') {
        const created = {
          id: state.nextId++,
          priority: 0,
          is_primary: false,
          is_active: true,
          notes: '',
          external_id: '',
          ...body,
        };
        state.productLinks.push(created);
        await route.fulfill(ok(created, 201));
        return;
      }
    }
    m = urlMatches(url, `${ADMIN}/product-links/:pk/`);
    if (m) {
      const i = state.productLinks.findIndex(
        (l) => String(l.id) === m.params.pk
      );
      if (i < 0) return route.fulfill(notFound());
      if (method === 'GET') return route.fulfill(ok(state.productLinks[i]));
      if (method === 'PATCH') {
        Object.assign(state.productLinks[i], body);
        return route.fulfill(ok(state.productLinks[i]));
      }
      if (method === 'DELETE') {
        state.productLinks.splice(i, 1);
        return route.fulfill({ status: 204, body: '' });
      }
    }

    // --- Import logs ---
    m = urlMatches(url, `${ADMIN}/import-logs/`);
    if (m && method === 'GET') {
      await route.fulfill(ok(paged(state.importLogs)));
      return;
    }

    // --- Events: acknowledge specific ---
    m = urlMatches(url, `${ADMIN}/events/:pk/acknowledge/`);
    if (m && method === 'POST') {
      const ev = state.events.find((e) => String(e.id) === m.params.pk);
      if (!ev) return route.fulfill(notFound());
      ev.acknowledged_at = '2026-05-09T10:00:00Z';
      await route.fulfill(ok(ev));
      return;
    }

    // --- Events list ---
    m = urlMatches(url, `${ADMIN}/events/`);
    if (m && method === 'GET') {
      let rows = state.events.slice();
      if (m.query.source) {
        rows = rows.filter((r) => r.supplier_idx === m.query.source);
      }
      if (m.query.severity) rows = rows.filter((r) => r.severity === m.query.severity);
      if (m.query.acknowledged === 'false') {
        rows = rows.filter((r) => !r.acknowledged_at);
      } else if (m.query.acknowledged === 'true') {
        rows = rows.filter((r) => !!r.acknowledged_at);
      }
      await route.fulfill(ok(paged(rows)));
      return;
    }

    // Anything we missed -> 404 with explicit hint to surface gaps in CI
    await route.fulfill(
      ok(
        {
          detail: `Mock has no handler for ${method} ${new URL(url).pathname}`,
        },
        404
      )
    );
  });

  return state;
}

/**
 * Stub the login flow by setting cookies that the CMS axios layer reads.
 * Skips the visual login form and lands directly on the requested route.
 *
 * Combined with installSuppliersMock this means specs do not depend on a
 * live backend at all — they only need `npm run serve` to host the SPA.
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} [token]
 */
async function fakeLogin(context, token = 'test-jwt-token') {
  // The user store reads these via universal-cookie on app boot
  // (App.vue → useUserStore.appInit() → readCookies()). isAuth is the
  // gate flipping App.vue from <LoginWall/> to <router-view/>.
  const userPayload = JSON.stringify({
    username: 'admin',
    first_name: 'Test',
    last_name: 'Admin',
    email: 'admin@test.local',
    buildTypes: [],
  });
  const cookies = [
    { name: 'token', value: token },
    { name: 'refresh', value: 'test-refresh-token' },
    {
      name: 'expiryDate',
      value: new Date(Date.now() + 3600 * 1000).toISOString(),
    },
    { name: 'isAuth', value: 'true' },
    // universal-cookie url-encodes objects when calling cookies.set,
    // and url-decodes them on read. Encoding the JSON here mimics
    // what setUser() would have stored, so readCookies() rebuilds the
    // User instance correctly.
    { name: 'user', value: encodeURIComponent(userPayload) },
  ];
  await context.addCookies(
    cookies.map((c) => ({ ...c, url: 'http://localhost:8080' }))
  );
}

/**
 * Wait for at least one request matching predicate within `timeout` ms.
 *
 * @param {Object} state - mock state from installSuppliersMock
 * @param {function({method, url, postData}): boolean} predicate
 * @param {number} [timeout=2000]
 */
async function waitForRequest(state, predicate, timeout = 2000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hit = state.requests.find(predicate);
    if (hit) return hit;
    if (Date.now() - start > timeout) {
      throw new Error(
        `waitForRequest timed out. Recent: ${state.requests
          .slice(-10)
          .map((r) => `${r.method} ${new URL(r.url).pathname}`)
          .join(', ')}`
      );
    }
    await new Promise((res) => setTimeout(res, 50));
  }
}

/**
 * Fill an input that lives inside a custom wrapper component (BasicInput,
 * NumberInput) where `data-testid` is attached to the outer div by Vue's
 * default attr inheritance. Drills into the inner <input> so Playwright's
 * `.fill()` doesn't error on a non-input target.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} testid
 * @param {string|number} value
 */
async function fillField(page, testid, value) {
  // Match either: data-testid on a wrapper containing an input,
  // or data-testid on the input itself.
  await page
    .locator(`[data-testid="${testid}"] input, input[data-testid="${testid}"]`)
    .first()
    .fill(String(value));
}

module.exports = {
  installSuppliersMock,
  fakeLogin,
  waitForRequest,
  fillField,
};

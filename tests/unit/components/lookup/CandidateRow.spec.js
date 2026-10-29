import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import CandidateRow from "@/components/lookup/CandidateRow.vue";

const globalStubs = {
  StatusBadge: {
    name: "StatusBadge",
    props: ["label", "tone"],
    template:
      "<span class='stub-badge' :data-tone='tone'>{{ label }}</span>",
  },
  FontAwesomeIcon: true,
};

function makeHit(overrides = {}) {
  return {
    kind: "pim_product",
    ref: "SKU-123",
    similarity: 82,
    reasons: [
      { code: "gtin_exact", label: "GTIN identical", score: 60 },
      { code: "brand_equal", label: "brand equal", score: 10 },
      { code: "color_mismatch", label: "color ≠", score: -40 },
    ],
    basic: {
      sku: "SKU-123",
      name: "Bosch GSR 12V-15",
      brand: "Bosch",
      ean: "5901234123457",
      main_image_url: "",
      detail_url: "/api/pim/v2/admin/default/products/SKU-123/",
    },
    ...overrides,
  };
}

describe("CandidateRow.vue", () => {
  function mountRow(hit, routerPush = vi.fn()) {
    return mount(CandidateRow, {
      props: { hit },
      global: {
        stubs: globalStubs,
        mocks: { $router: { push: routerPush } },
      },
    });
  }

  it("shows similarity as a percentage for a plain /search hit (relevance to the query)", () => {
    const wrapper = mountRow(makeHit());
    expect(wrapper.find("[data-testid='candidate-row-score']").text()).toBe(
      "82 %"
    );
  });

  it("shows the bare dedup score, no percent, when a decision is present (/check hit)", () => {
    const wrapper = mountRow(makeHit({ score: 61, decision: "review" }));
    expect(wrapper.find("[data-testid='candidate-row-score']").text()).toBe(
      "61"
    );
  });

  it("flags an exact match with a badge and leaves a similar one plain", () => {
    const exact = mountRow(makeHit({ similarity: 100, match: "exact" }));
    const badge = exact.find("[data-testid='candidate-row-exact']");
    expect(badge.exists()).toBe(true);
    expect(badge.attributes("data-tone")).toBe("positive");
    expect(badge.text()).toBe("lookup.match.exact_badge");

    const similar = mountRow(makeHit({ similarity: 95, match: "similar" }));
    expect(similar.find("[data-testid='candidate-row-exact']").exists()).toBe(
      false
    );
  });

  it("treats a 100 % hit from a backend without `match` as exact", () => {
    const wrapper = mountRow(makeHit({ similarity: 100 }));
    expect(wrapper.find("[data-testid='candidate-row-exact']").exists()).toBe(
      true
    );
  });

  it("renders a reason chip per reason, signed score included", () => {
    const wrapper = mountRow(makeHit());
    const chips = wrapper.findAll(".candidate-row__reason-chip");
    expect(chips).toHaveLength(3);
    expect(chips[0].text()).toBe("GTIN identical (+60)");
    expect(chips[2].text()).toBe("color ≠ (-40)");
  });

  it("shows no decision badge for a plain search hit (no decision field)", () => {
    const wrapper = mountRow(makeHit());
    expect(
      wrapper.find("[data-testid='candidate-row-decision']").exists()
    ).toBe(false);
  });

  it.each([
    ["match", "positive"],
    ["review", "warning"],
    ["no_match", "neutral"],
  ])("maps decision %s to StatusBadge tone %s", (decision, tone) => {
    const wrapper = mountRow(makeHit({ score: 82, decision }));
    const badge = wrapper.find("[data-testid='candidate-row-decision']");
    expect(badge.attributes("data-tone")).toBe(tone);
  });

  it("opens PimProductDetail by sku for a pim_product hit", async () => {
    const push = vi.fn();
    const wrapper = mountRow(makeHit(), push);
    await wrapper.find("[data-testid='candidate-row-open']").trigger("click");
    expect(push).toHaveBeenCalledWith({
      name: "PimProductDetail",
      params: { sku: "SKU-123" },
    });
  });

  it("opens SourceDetail's products tab by source idx for an atlas_source_product hit", async () => {
    const push = vi.fn();
    const hit = makeHit({
      kind: "atlas_source_product",
      ref: "tme:88123",
      basic: { ...makeHit().basic, sku: "tme:88123" },
    });
    const wrapper = mountRow(hit, push);
    await wrapper.find("[data-testid='candidate-row-open']").trigger("click");
    expect(push).toHaveBeenCalledWith({
      name: "SourceDetail",
      params: { idx: "tme" },
      query: { tab: "products" },
    });
  });

  it("resolves a relative main_image_url against VUE_APP_API_URL", () => {
    const originalApiUrl = process.env.VUE_APP_API_URL;
    process.env.VUE_APP_API_URL = "http://localhost:8100";
    const hit = makeHit({
      basic: { ...makeHit().basic, main_image_url: "/media/products/x.jpg" },
    });
    const wrapper = mountRow(hit);
    expect(wrapper.find("img").attributes("src")).toBe(
      "http://localhost:8100/media/products/x.jpg"
    );
    process.env.VUE_APP_API_URL = originalApiUrl;
  });

  it("does not rewrite an absolute main_image_url (e.g. an atlas source photo)", () => {
    const hit = makeHit({
      basic: {
        ...makeHit().basic,
        main_image_url: "https://cdn.example.com/x.jpg",
      },
    });
    const wrapper = mountRow(hit);
    expect(wrapper.find("img").attributes("src")).toBe(
      "https://cdn.example.com/x.jpg"
    );
  });

  it("falls back to a literal label for an unknown kind/decision instead of an i18n key lookup", () => {
    const hit = makeHit({ kind: "__proto__", decision: "constructor" });
    const wrapper = mountRow(hit);
    expect(wrapper.find(".stub-badge").text()).toBe("__proto__");
    const badge = wrapper.find("[data-testid='candidate-row-decision']");
    expect(badge.text()).toBe("constructor");
    expect(badge.attributes("data-tone")).toBe("neutral");
  });

  it("does not push a route when basic.sku is missing on a pim_product hit", async () => {
    const push = vi.fn();
    const hit = makeHit({ basic: { ...makeHit().basic, sku: undefined } });
    const wrapper = mountRow(hit, push);
    await wrapper.find("[data-testid='candidate-row-open']").trigger("click");
    expect(push).toHaveBeenCalledWith({
      name: "PimProductDetail",
      params: { sku: undefined },
    });
  });
});

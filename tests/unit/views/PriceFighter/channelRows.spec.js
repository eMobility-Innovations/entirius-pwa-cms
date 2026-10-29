// Plan 54b: rows that differ only by channel stay apart in the apply report and the apply preview (the report reads
// `channel`, the preview `channel_idx`), and an invalid observation is a muted row, not only a neutral badge.
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@/api/pricefighter/api", () => ({ POST_PfApply: vi.fn() }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification() {} }) }));

import DataTable from "@/boots/DataTable/index.vue";
import ApplyReport from "@/views/PriceFighter/components/ApplyReport.vue";
import ApplyPreviewModal from "@/views/PriceFighter/components/ApplyPreviewModal.vue";
import ObservationsTable from "@/views/PriceFighter/components/ObservationsTable.vue";

const global = {
  components: { DataTable },
  stubs: { BasicModal: { template: "<div><slot /></div>" }, BasicButton: true, StatusBadge: true },
};
const market = { sku: "SKU-1", country: "PL", currency: "PLN" };
const channels = (wrapper) => wrapper.findAll(".market-cell__channel").map((cell) => cell.text());

describe("PriceFighter — rows that differ only by channel", () => {
  it("the apply report names each row's channel", () => {
    const applied = [{ ...market, channel: "b2c" }, { ...market, channel: "b2b" }];
    const wrapper = mount(ApplyReport, { props: { report: { applied } }, global });
    expect(channels(wrapper)).toEqual(["b2c", "b2b"]);
  });

  it("the apply preview names each row's channel", () => {
    const items = [{ ...market, channel_idx: "b2c", _rowKey: 1 }, { ...market, channel_idx: "b2b", _rowKey: 2 }];
    const wrapper = mount(ApplyPreviewModal, { props: { items }, global });
    expect(channels(wrapper)).toEqual(["b2c", "b2b"]);
  });
});

describe("ObservationsTable", () => {
  it("mutes an invalid observation's values and shows a dash for an unknown stock", () => {
    const observations = [
      { uid: 1, source_idx: "shop-a", price: 10, stock: 3, flag: "valid" },
      { uid: 2, source_idx: "shop-b", price: 9, stock: null, flag: "outlier" },
    ];
    const wrapper = mount(ObservationsTable, { props: { observations }, global });
    const rows = wrapper.findAll(".data-table__row");
    expect(rows[0].findAll(".t-muted")).toHaveLength(0);
    expect(rows[1].findAll(".t-muted").map((cell) => cell.text())).toEqual(["shop-b", "9", "—", expect.any(String)]);
  });
});

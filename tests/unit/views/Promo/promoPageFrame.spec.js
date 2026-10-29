// Plan 44: Promo on the page frame. The teleported toolbar buttons and the drawers' raw footers became ActionBar
// actions and the channel selector a panel-local control; the handlers stay. Badge labels come from i18n.
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mockStore = { channels: [], activeChannelIdx: "default-europe", setActiveChannel: vi.fn() };
vi.mock("@/stores/checkoutChannel", () => ({ useCheckoutChannelStore: () => mockStore }));
vi.mock("@/api/promo/api", () => ({}));
vi.mock("@/api/voucher/api", () => ({}));
vi.mock("@/api/regional/api", () => ({}));
vi.mock("@/api/pim/api", () => ({}));

import { enumLabel } from "@/views/Promo/promo-enum-hints";
import PromoEdit from "@/views/Promo/PromoEdit.vue";
import CampaignsList from "@/views/Promo/CampaignsList.vue";
import ProductVouchersList from "@/views/Promo/ProductVouchersList.vue";
import VoucherDetail from "@/views/Promo/VoucherDetail.vue";
import PromoChannelSelect from "@/views/Promo/PromoChannelSelect.vue";
import VouchersListView from "@/views/Promo/VouchersList.vue";

const $t = (key) => key;
const roles = (actions) => actions.map((action) => [action.key, action.role]);

describe("enumLabel", () => {
  it("reads the badge label from i18n, the backend label only for an unknown value", () => {
    expect(enumLabel("voucher_status", "pending_approval", "Pending approval — waits")).toBe("Pending approval");
    expect(enumLabel("campaign_type", "sale")).toBe("Sale");
    expect(enumLabel("tax_type", "new_kind", "New kind")).toBe("New kind");
    expect(enumLabel("tax_type", "new_kind")).toBe("new_kind");
  });
});

describe("PromoEdit header", () => {
  const ctx = (over) => ({ $t, isEdit: false, form: { name: "" }, saveRule: vi.fn(), ...over });

  it("offers Save on a new rule and Delete before Save on an existing one", () => {
    const create = ctx();
    expect(roles(PromoEdit.computed.headerActions.call(create))).toEqual([["save", "primary"]]);
    expect(PromoEdit.computed.headerActions.call(create)[0].onClick).toBe(create.saveRule);

    const edit = ctx({ isEdit: true, showDeleteConfirm: false });
    const actions = PromoEdit.computed.headerActions.call(edit);
    expect(roles(actions)).toEqual([["delete", "utility"], ["save", "primary"]]);
    expect(actions[0]).toMatchObject({ icon: "delete", variant: "danger" });
    actions[0].onClick();
    expect(edit.showDeleteConfirm).toBe(true);
  });

  it("titles the page by the rule name, falling back to the action", () => {
    expect(PromoEdit.computed.pageTitle.call(ctx())).toBe("promo.create_rule");
    expect(PromoEdit.computed.pageTitle.call(ctx({ isEdit: true }))).toBe("promo.edit_rule");
    expect(PromoEdit.computed.pageTitle.call(ctx({ isEdit: true, form: { name: "Summer" } }))).toBe("Summer");
  });

  it("wires the code dialog and the inline code form to their handlers", () => {
    const code = { $t, closeEditCodeModal: vi.fn(), saveEditCode: vi.fn(), saveNewCode: vi.fn(), showAddCode: true };
    const dialog = PromoEdit.computed.editCodeActions.call(code);
    expect(roles(dialog)).toEqual([["cancel", "secondary"], ["save", "primary"]]);
    expect(dialog.map((action) => action.onClick)).toEqual([code.closeEditCodeModal, code.saveEditCode]);

    const inline = PromoEdit.computed.newCodeActions.call(code);
    expect(inline[1].onClick).toBe(code.saveNewCode);
    inline[0].onClick();
    expect(code.showAddCode).toBe(false);
  });
});

describe.each([
  ["CampaignsList", CampaignsList],
  ["ProductVouchersList", ProductVouchersList],
])("%s drawer actions", (_, view) => {
  it("offers Delete only on an existing record and disables Save while saving", () => {
    const ctx = { $t, isEdit: false, saving: false, save: vi.fn(), showDelete: false };
    expect(roles(view.computed.drawerActions.call(ctx))).toEqual([["save", "primary"]]);

    const edit = { ...ctx, isEdit: true, saving: true };
    const actions = view.computed.drawerActions.call(edit);
    expect(roles(actions)).toEqual([["delete", "utility"], ["save", "primary"]]);
    expect(actions[1]).toMatchObject({ disabled: true, onClick: ctx.save });
    actions[0].onClick();
    expect(edit.showDelete).toBe(true);
  });
});

describe("VoucherDetail", () => {
  it("reveals the code from the header and links an order by its pretty id", () => {
    const ctx = { $t, reveal: vi.fn(), channel: "shop" };
    expect(VoucherDetail.computed.headerActions.call(ctx)[0]).toMatchObject({ role: "secondary", onClick: ctx.reveal });
    expect(VoucherDetail.methods.orderRoute.call(ctx, { order_pretty_id: "A-1" })).toEqual({
      name: "OrderDetail",
      params: { uid: "A-1" },
      query: { channel: "shop" },
    });
  });
});

describe("PromoChannelSelect", () => {
  const mountSelect = () =>
    mount(PromoChannelSelect, {
      global: {
        stubs: {
          FormField: { template: "<div><slot /></div>" },
          BasicSelect: { name: "BasicSelect", props: ["options", "modelValue"], template: "<div />" },
        },
      },
    });

  it("shows the active channel before the channels load, then every channel, and sets the pick", async () => {
    mockStore.channels = [];
    expect(mountSelect().findComponent({ name: "BasicSelect" }).props("options")).toEqual([
      { label: "default-europe", value: "default-europe" },
    ]);

    mockStore.channels = [{ idx: "default-europe", name: "Default Europe" }, { idx: "b2b" }];
    const select = mountSelect().findComponent({ name: "BasicSelect" });
    expect(select.props("options")).toEqual([
      { label: "Default Europe", value: "default-europe" },
      { label: "b2b", value: "b2b" },
    ]);
    await select.vm.$emit("update:model-value", "b2b");
    expect(mockStore.setActiveChannel).toHaveBeenCalledWith("b2b");
  });
});

// Plan 54b: Tag and CountBadge always get their typed values — a missing campaign name, enum value or code count
// falls back instead of passing null/undefined.
describe("Promo labels for missing values", () => {
  it("names a nameless or unknown campaign by its id", () => {
    const ctx = { campaigns: [{ id: 3, name: null }, { id: 4, name: "Spring" }] };
    expect(VouchersListView.methods.campaignName.call(ctx, 3)).toBe("#3");
    expect(VouchersListView.methods.campaignName.call(ctx, 4)).toBe("Spring");
    expect(VouchersListView.methods.campaignName.call(ctx, 9)).toBe("#9");
  });

  it("shows a dash for a missing enum value", () => {
    expect(enumLabel("tax_type", null)).toBe("—");
    expect(enumLabel("campaign_type", undefined)).toBe("—");
  });
});

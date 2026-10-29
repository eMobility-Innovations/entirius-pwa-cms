import { describe, it, expect } from "vitest";
import PromoEdit from "@/views/Promo/PromoEdit.vue";

// The currencies, channels and free-shipping pickers are BasicSelect `multiple` (plan 18); their options carry what
// the old custom lists showed, and the active channel stays applied (the backend auto-adds it).
const { currencySelectOptions, channelSelectOptions, shippingSelectOptions } = PromoEdit.computed;
const $t = (key) => key;

describe("PromoEdit — multi select options", () => {
  it("labels currencies as iso3 — name", () => {
    const vm = { currencyOptions: [{ iso3: "PLN", name: "Złoty" }] };
    expect(currencySelectOptions.call(vm)).toEqual([{ label: "PLN — Złoty", value: "PLN" }]);
  });

  it("keeps the active channel out of reach and names it", () => {
    const vm = { $t, channel: "pl", checkoutChannel: { channels: [{ idx: "pl", name: "Polska" }, { idx: "de" }] } };
    expect(channelSelectOptions.call(vm)).toEqual([
      { label: "Polska", value: "pl", description: "promo.channel_active", disabled: true },
      { label: "de", value: "de", description: "", disabled: false },
    ]);
  });

  it("labels shipping methods with their channel", () => {
    const vm = { shippingMethodOptions: [{ channel_idx: "pl", code: "dpd", name: "DPD" }, { channel_idx: "de", code: "ups" }] };
    expect(shippingSelectOptions.call(vm)).toEqual([
      { label: "[pl] dpd — DPD", value: "dpd" },
      { label: "[de] ups", value: "ups" },
    ]);
  });
});

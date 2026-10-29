import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// order_body.payment_method became a LIST with the multi-method (voucher) refactor —
// a voucher settles alongside the gateway. This view read it as a single object, so
// the payment card rendered blank for every order placed since django-checkout 8.1.0.
// Orders written before it still hold a bare dict, so both shapes must render.

const mockGetOrder = vi.fn();

vi.mock("@/api/orders/api", () => ({
  GET_Order: (...a) => mockGetOrder(...a),
  GET_Orders: vi.fn(),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/composables/useFormErrors", () => ({ extractApiMessage: (e, f) => f }));

import OrderDetail from "@/views/CheckoutOrders/OrderDetail.vue";

function mountWith(paymentMethod) {
  mockGetOrder.mockResolvedValue({
    data: {
      order_id: "uuid-1",
      pretty_id: "0200000003",
      status: "unpaid",
      order_body: { payment_method: paymentMethod, currency_code: "EUR" },
    },
  });
  return mount(OrderDetail, {
    global: {
      mocks: { $route: { params: { uid: "0200000003" }, query: {} }, $router: { push: vi.fn() } },
      stubs: { DataTable: true },
    },
  });
}

describe("OrderDetail payment methods", () => {
  it("lists every method of a multi-method order", async () => {
    const wrapper = mountWith([
      { code: "voucher", name: "Voucher" },
      { code: "banktransfer", name: "Bank Transfer" },
    ]);
    await flushPromises();

    expect(wrapper.vm.paymentMethods.map((m) => m.code)).toEqual(["voucher", "banktransfer"]);
  });

  it("still renders a legacy single-object order", async () => {
    const wrapper = mountWith({ code: "payu", name: "PayU" });
    await flushPromises();

    expect(wrapper.vm.paymentMethods).toEqual([{ code: "payu", name: "PayU" }]);
  });

  it("tolerates a missing or malformed payment_method", async () => {
    for (const shape of [null, undefined, [], {}, [null, "junk"]]) {
      const wrapper = mountWith(shape);
      await flushPromises();

      expect(wrapper.vm.paymentMethods).toEqual([]);
    }
  });
});

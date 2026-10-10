const { test, expect, guide, goto } = require("../support/capture");
const { idle } = require("../../visual/support/state");
const { ROWS } = require("./helpers");

// Guide "Orders": the order list, one order and its delivery. The seed places no order, so the spec places one as a
// guest on the storefront (`STOREFRONT_URL`, default http://localhost:3100) and shows that order only. Orders cannot
// be deleted: every run leaves one order behind and takes one unit of the product's stock. Out of stock, the spec
// fails with `INFRA: orders needs a fresh make seed`.
//
// The list sends its search text as an email filter, once per page load: an order ID typed there finds nothing. So
// every run orders with an email address of its own (plus-addressed) and searches for that.
const { shot } = guide("orders");

const STOREFRONT = process.env.STOREFRONT_URL || "http://localhost:3100";
const PRODUCT = "Zero-G Recliner";
const newEmail = () => `alex.reader+${Date.now().toString(36)}@example.com`;
const SHOP_TIMEOUT_MS = 15000;
const BILLING = {
  "First name": "Alex",
  "Last name": "Reader",
  "Street and number": "Harbour Street 12",
  "Postal code": "00-100",
  City: "Station City",
  "Phone number": "500100200",
};
const SEARCH = ".order-list__search";
const DETAIL = ".order-detail";

async function addToCart(shop) {
  await shop.goto("/catalog/office-chairs").catch(() => {
    throw new Error(`INFRA: orders needs the storefront on ${STOREFRONT}`);
  });
  await shop.getByRole("link", { name: PRODUCT }).first().click();
  const add = shop.getByRole("button", { name: "Add to cart" });
  await add.waitFor().catch(async (error) => {
    if (await shop.getByRole("button", { name: "Out of stock" }).count()) {
      throw new Error("INFRA: orders needs a fresh make seed");
    }
    throw error;
  });
  await add.click();
}

async function checkOut(shop, email) {
  await shop.goto("/checkout");
  for (const [label, value] of Object.entries({ Email: email, ...BILLING })) await shop.getByLabel(label).fill(value);
  await shop.getByRole("button", { name: "Continue to shipping" }).click();
  await shop.getByRole("radio", { name: "Europe Standard" }).check();
  await shop.getByRole("button", { name: "Continue to payment" }).click();
  await shop.getByRole("radio", { name: "Bank Transfer" }).check();
  await shop.getByRole("button", { name: "Continue to review" }).click();
  await shop.getByRole("button", { name: "Place order" }).click();
  await shop.waitForURL(/\/checkout\/success\?ref=\d+/);
}

// A guest order through the storefront's own pages, in a browser context of its own.
async function placeOrder(browser, email) {
  const context = await browser.newContext({ baseURL: STOREFRONT });
  context.setDefaultTimeout(SHOP_TIMEOUT_MS);
  try {
    const shop = await context.newPage();
    await addToCart(shop);
    await checkOut(shop, email);
  } finally {
    await context.close();
  }
}

const isEmailSearch = (response) => /\/orders\/\?.*email=/.test(response.url());

async function searchOrders(page, text) {
  const listed = page.waitForResponse(isEmailSearch);
  await page.locator(`${SEARCH} input`).fill(text);
  await listed;
  await idle(page);
}

test("orders", async ({ page, browser }) => {
  const email = newEmail();

  await test.step("A guest order placed on the storefront", async () => {
    await placeOrder(browser, email);
  });

  await test.step("Order list, that order only", async () => {
    await goto(page, "/checkout-orders/orders", { ready: ROWS });
    await searchOrders(page, email);
    await expect(page.locator(ROWS)).toHaveCount(1);
    await shot(page, "01-orders", { callouts: [{ target: SEARCH, label: "1" }] });
  });

  await test.step("Order detail", async () => {
    await page.locator(ROWS).click();
    await page.locator(`${DETAIL}__header-left`).waitFor();
    await shot(page, "02-order-detail", {
      callouts: [
        { target: `${DETAIL}__header-left`, label: "1" },
        { target: `${DETAIL} .data-table`, label: "2" },
      ],
    });
  });

  await test.step("Shipping and payment of the order", async () => {
    await shot(page, "03-order-delivery", { element: `${DETAIL}__delivery` });
  });
});

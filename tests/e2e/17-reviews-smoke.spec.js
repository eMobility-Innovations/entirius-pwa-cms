/**
 * Reviews panel — moderation queue + detail smoke.
 *
 * Mock-driven (no backend): every test asserts the outgoing API call AND the UI transition.
 */

const { test, expect } = require("@playwright/test");
const {
  installReviewsMock,
  fakeLogin,
  waitForRequest,
} = require("../helpers/reviews-mock");

let mockState;

test.describe("Reviews panel", () => {
  test.beforeEach(async ({ page, context }) => {
    await fakeLogin(context);
    mockState = await installReviewsMock(page);
  });

  test.describe("queue", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/reviews/queue");
      await page.waitForLoadState("networkidle");
    });

    test("loads the pending queue by default", async ({ page }) => {
      const req = await waitForRequest(
        mockState,
        (r) =>
          r.method === "GET" &&
          r.url.includes("/reviews/?") &&
          r.url.includes("status=pending")
      );
      expect(req).toBeTruthy();
      await expect(page.getByTestId("reviews-count")).toContainText("2");
      await expect(page.getByTestId("reviews-approve-1")).toBeVisible();
    });

    test("status chip narrows the query", async ({ page }) => {
      await page.getByTestId("reviews-status-accepted").click();
      const req = await waitForRequest(
        mockState,
        (r) =>
          r.method === "GET" &&
          r.url.includes("/reviews/?") &&
          r.url.includes("status=accepted")
      );
      expect(req).toBeTruthy();
      await expect(page.getByTestId("reviews-count")).toContainText("1");
    });

    test("approve posts and removes the row from the pending queue", async ({
      page,
    }) => {
      await page.getByTestId("reviews-approve-1").click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === "POST" && r.url.includes("/reviews/1/approve/")
      );
      expect(req).toBeTruthy();
      await expect(page.getByTestId("reviews-approve-1")).toHaveCount(0);
      await expect(page.getByTestId("reviews-count")).toContainText("1");
    });
  });

  test.describe("detail", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/reviews/2");
      await page.waitForLoadState("networkidle");
    });

    test("shows the review and rejects with a reason", async ({ page }) => {
      await expect(page.getByTestId("review-status")).toContainText(
        /pending|Oczekuje/i
      );
      await page
        .locator('[data-testid="review-reject-reason"] input')
        .fill("Spam");
      await page.getByTestId("review-reject").click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === "POST" && r.url.includes("/reviews/2/reject/")
      );
      expect(JSON.parse(req.body).reason).toBe("Spam");
      await expect(page.getByTestId("review-status")).toContainText(
        /not_accepted|Rejected|Odrzucona/i
      );
    });

    test("saves a merchant reply", async ({ page }) => {
      await page
        .locator('[data-testid="review-reply-body"] textarea')
        .fill("Thank you!");
      await page.getByTestId("review-reply-save").click();
      const req = await waitForRequest(
        mockState,
        (r) => r.method === "PUT" && r.url.includes("/reviews/2/reply/")
      );
      expect(JSON.parse(req.body).body).toBe("Thank you!");
      await expect(page.getByTestId("review-reply-delete")).toBeVisible();
    });
  });
});

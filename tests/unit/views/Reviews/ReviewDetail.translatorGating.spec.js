import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockIsModuleEnabled = vi.fn();
// vi.mock factories are hoisted above the module scope, so the fixture lives here.
const { review } = vi.hoisted(() => ({
  review: {
    id: 1,
    status: "pending",
    name: "Jane",
    title: "Great chair",
    detail: "Comfortable.",
    sku: "SKU-001",
    ratings: [],
    consents: [],
    translations: [],
    images: [],
    reply: null,
  },
}));

vi.mock("@/api/reviews/api", () => ({
  GET_Review: vi.fn().mockResolvedValue({ data: review }),
  PATCH_Review: vi.fn(),
  DELETE_Review: vi.fn(),
  POST_ApproveReview: vi.fn(),
  POST_RejectReview: vi.fn(),
  POST_ArchiveReview: vi.fn(),
  POST_RequeueReview: vi.fn(),
  POST_ReviewTranslation: vi.fn(),
  PATCH_ReviewTranslation: vi.fn(),
  PUT_ReviewReply: vi.fn(),
  DELETE_ReviewReply: vi.fn(),
  POST_ReviewReplyTranslation: vi.fn(),
  PATCH_ReviewReplyTranslation: vi.fn(),
  POST_ApproveReviewImage: vi.fn(),
  POST_RejectReviewImage: vi.fn(),
  DELETE_ReviewImage: vi.fn(),
  POST_TranslateReview: vi.fn(),
}));

vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));

vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart: vi.fn(), loaderFinish: vi.fn() }),
}));

vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ isModuleEnabled: mockIsModuleEnabled }),
}));

vi.mock("@/stores/regional", () => ({
  useRegionalStore: () => ({ languages: [{ iso2: "de" }], ensureLoaded: vi.fn() }),
}));

import ReviewDetail from "@/views/Reviews/ReviewDetail.vue";

function mountWith({ translator }) {
  mockIsModuleEnabled.mockImplementation(
    (key) => key === "reviews_translator" && translator
  );
  return mount(ReviewDetail, {
    shallow: true,
    global: {
      mocks: {
        $route: { params: { id: "1" }, query: {} },
        $router: { push: vi.fn() },
      },
    },
  });
}

describe("ReviewDetail — AI translator gating", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hides the AI translation controls when reviews_translator is absent", async () => {
    // Optional backend modules degrade to dormant UI: the button must not be
    // offered at all rather than failing once the user clicks it.
    const wrapper = mountWith({ translator: false });
    await flushPromises();
    expect(wrapper.vm.translatorAvailable).toBe(false);
    expect(wrapper.find('[data-testid="review-ai-translate"]').exists()).toBe(
      false
    );
  });

  it("shows them when the module is enabled", async () => {
    const wrapper = mountWith({ translator: true });
    await flushPromises();
    expect(wrapper.vm.translatorAvailable).toBe(true);
    expect(wrapper.find('[data-testid="review-ai-translate"]').exists()).toBe(
      true
    );
  });

  it("never opens the post-approval translate prompt without the module", async () => {
    const wrapper = mountWith({ translator: false });
    await flushPromises();
    wrapper.vm.review = { ...review, language: "pl" };
    await wrapper.vm.transition(
      () => Promise.resolve({ data: { ...review, status: "accepted" } }),
      "approved"
    );
    expect(wrapper.vm.showTranslatePrompt).toBe(false);
  });
});

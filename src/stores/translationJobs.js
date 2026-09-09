import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  GET_PimTranslationJobs,
  GET_ContentTranslationJobs,
  GET_ReviewsTranslationJobs,
} from "@/api/translationJobs";

export const useTranslationJobsStore = defineStore("translationJobs", () => {
  const jobs = ref([]);
  const loading = ref(false);
  const statusFilter = ref("all");
  const pollTimer = ref(null);

  const activeJobs = computed(() =>
    jobs.value.filter((j) => j.status === "pending" || j.status === "running")
  );
  const hasActiveJobs = computed(() => activeJobs.value.length > 0);

  const filteredJobs = computed(() => {
    if (statusFilter.value === "all") return jobs.value;
    return jobs.value.filter((j) => j.status === statusFilter.value);
  });

  const stats = computed(() => ({
    total: jobs.value.length,
    pending: jobs.value.filter((j) => j.status === "pending").length,
    running: jobs.value.filter((j) => j.status === "running").length,
    completed: jobs.value.filter((j) => j.status === "completed").length,
    failed: jobs.value.filter((j) => j.status === "failed").length,
  }));

  async function fetchJobs(channelIdx) {
    loading.value = true;
    try {
      const [pimRes, contentRes, reviewsRes] = await Promise.allSettled([
        GET_PimTranslationJobs(channelIdx, { page_size: 50 }),
        GET_ContentTranslationJobs(channelIdx, { page_size: 50 }),
        GET_ReviewsTranslationJobs(channelIdx, { page_size: 50 }),
      ]);

      const pimJobs =
        pimRes.status === "fulfilled"
          ? (pimRes.value.data?.results || pimRes.value.data || []).map(
              (j) => ({ ...j, _source: "pim" })
            )
          : [];
      const contentJobs =
        contentRes.status === "fulfilled"
          ? (contentRes.value.data?.results || contentRes.value.data || []).map(
              (j) => ({ ...j, _source: "content" })
            )
          : [];

      const reviewJobs =
        reviewsRes.status === "fulfilled"
          ? (reviewsRes.value.data?.results || reviewsRes.value.data || []).map(
              (j) => ({ ...j, _source: "reviews" })
            )
          : [];

      jobs.value = [...pimJobs, ...contentJobs, ...reviewJobs].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    } finally {
      loading.value = false;
    }
  }

  function startPolling(channelIdx, intervalMs = 5000) {
    stopPolling();
    fetchJobs(channelIdx);
    pollTimer.value = setInterval(() => {
      if (hasActiveJobs.value) {
        fetchJobs(channelIdx);
      } else {
        stopPolling();
      }
    }, intervalMs);
  }

  function stopPolling() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value);
      pollTimer.value = null;
    }
  }

  function setStatusFilter(status) {
    statusFilter.value = status;
  }

  return {
    jobs,
    loading,
    statusFilter,
    activeJobs,
    hasActiveJobs,
    filteredJobs,
    stats,
    fetchJobs,
    startPolling,
    stopPolling,
    setStatusFilter,
  };
});

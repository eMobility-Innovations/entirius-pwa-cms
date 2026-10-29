// The Pages side of the shared TranslateDialog: the content translator call of the content scope (every page).
import { POST_ContentTranslateEstimate, POST_ContentTranslateExecute } from "@/api/contentDB/translator";

export function contentTranslateFns(channelIdx) {
  const payload = (request) => ({ entity_type: "page", ...request });
  return {
    estimateFn: async (request) => (await POST_ContentTranslateEstimate(channelIdx, payload(request))).data,
    submitFn: async (request) => {
      const { data } = await POST_ContentTranslateExecute(channelIdx, payload(request));
      return data.job_ids?.length || 0;
    },
  };
}

import { GET_FaqItems } from "@/api/faq/api";
import { GET_Content, GET_ContentTypes } from "@/api/contentDB/api";
import { faqItemQuestions, documentQuestions } from "@/utils/faqDuplicates";

// The questions the duplicates report compares, each with where it is shown and a link to edit it. Both APIs scope
// by channel the way the storefront does: FAQ items of the channel's groups and of global or no groups, documents of
// the channel and those without channels.

const PAGE_SIZE = 100;

// Pages of a list sorted by `position` alone are unstable: an item can come back on two pages, so items are kept by id.
async function fetchFaqItems(channel) {
  const items = [];
  for (let page = 1; ; page++) {
    const { data } = await GET_FaqItems(channel, { page, page_size: PAGE_SIZE });
    items.push(...(data.results || []).filter((item) => !items.some((seen) => seen.id === item.id)));
    if (!data.next) return items;
  }
}

async function fetchDrafts(type, channel) {
  const drafts = [];
  for (let page = 1; ; page++) {
    const { data } = await GET_Content({ type, page, limit: PAGE_SIZE, channel });
    drafts.push(...(data.data || []));
    if (page >= (data.pagination?.pages || 1)) return drafts;
  }
}

export async function loadFaqOccurrences(channel) {
  const items = await fetchFaqItems(channel);
  return items.flatMap((item) =>
    faqItemQuestions(item).map(({ question, language }) => ({
      question,
      language,
      source: "faq",
      itemId: item.id,
      name: item.question,
      routes: [],
      isPublished: true,
      to: `/faq/items/${item.id}`,
    }))
  );
}

// Drafts, not published versions: a repeat shows before it goes live; `isPublished` tells the two apart.
function draftOccurrences(draft, type) {
  return documentQuestions(draft.content).map((question) => ({
    question,
    language: draft.language,
    source: type.label || type.slug,
    name: draft.name,
    routes: draft.routes || [],
    isPublished: Boolean(draft.is_published),
    to: {
      name: "Builder",
      params: { content_type: "content", type: type.slug, uid: draft.uid },
      query: draft.language ? { lg: draft.language } : {},
    },
  }));
}

async function fetchContentTypes() {
  const types = [];
  for (let page = 1; ; page++) {
    const { data } = await GET_ContentTypes({ CDB_TYPE: "content", page, limit: PAGE_SIZE });
    types.push(...(data.data || []));
    if (page >= (data.pagination?.pages || 1)) return types;
  }
}

export async function loadContentOccurrences(channel) {
  const types = await fetchContentTypes();
  const perType = await Promise.all(
    types.map(async (type) => {
      const drafts = await fetchDrafts(type.slug, channel);
      return drafts.flatMap((draft) => draftOccurrences(draft, type));
    })
  );
  return perType.flat();
}

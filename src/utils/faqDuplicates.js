// A question shown in two places of one store (an FAQ item, a page's FAQ section, a blog post's) is duplicate
// content, and search engines expect its FAQPage markup once. These helpers collect the questions and group the
// repeats; the FAQ panel's duplicates report renders the groups.

// "Jak dobrać klocki?!" and "jak dobrac klocki" are one question: no case, tags, punctuation or diacritics.
// NFD splits ą into a + accent but leaves ł whole, so ł is mapped by hand.
export function normalizeQuestion(text) {
  return String(text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// The question of an FAQ item and its translations; an inactive item is not on the storefront.
export function faqItemQuestions(item) {
  if (!item?.is_active) return [];
  const translations = (item.translations || []).map(({ language, question }) => ({ question, language }));
  return [{ question: item.question, language: null }, ...translations];
}

// The questions of every FAQ section of a document. A section counts by its data (a `faq_items` list of
// `{ question, answer }`), not by its type name, which each deployment configures. Reads the saved shape
// (`sections{}`) and the old one (an array of sections).
export function documentQuestions(content) {
  const sections = Array.isArray(content) ? content : Object.values(content?.sections || {});
  return sections
    .flatMap((section) => (Array.isArray(section?.faq_items) ? section.faq_items : []))
    .map((pair) => pair?.question)
    .filter((question) => normalizeQuestion(question));
}

// Groups occurrences (`{ question, ... }`) by normalised question and keeps those seen more than once, most
// repeated first. A group is labelled with its first occurrence's wording. An item (`source` + `itemId`) counts once
// per question: a translation that repeats the base text is not a second place.
export function findDuplicates(occurrences) {
  const groups = new Map();
  for (const occurrence of occurrences) {
    const key = normalizeQuestion(occurrence.question);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    const group = groups.get(key);
    const sameItem = (other) => occurrence.itemId != null && other.itemId === occurrence.itemId && other.source === occurrence.source;
    if (!group.some(sameItem)) group.push(occurrence);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .sort((a, b) => b.length - a.length)
    .map((group) => ({ question: group[0].question, occurrences: group }));
}

/** The rows of an enrichment list answer: a bare array, or a page's `results`. */
export const listOf = (data) => (Array.isArray(data) ? data : data?.results || []);

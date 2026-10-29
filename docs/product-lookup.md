# Product Lookup ("Find product")

`/atlas/find` (nav: Atlas → Find product) is a single-box search — type an
EAN/name/MPN or drop/paste/pick a product photo — that calls the
`django-lookup` module's admin `search`/`check` API and shows ranked PIM +
atlas candidates with match reasons, grouped by the hit's `match` kind —
*Exact matches* / *Similar*, `none` neighbours folded behind a disclosure
(`src/utils/lookupMatch.js`, with a `similarity` fallback for a backend
without `match`). Route + nav entry are gated on the
optional `lookup` backend module (`meta.module` / `requiresModule`, munin key
`lookup`). Client code: `src/api/lookup/`, `src/components/lookup/`
(`DedupSearchBox`, `CandidateRow`), `src/utils/imageDownscale.js` (client-side
JPEG downscale, image never leaves the browser un-downscaled),
`src/utils/resolveMediaUrl.js` (relative `/media/...` thumbnails need the API
origin prefixed), `src/views/Atlas/Find.vue` (the last search — results,
query, photo blob — survives back-navigation via `src/stores/lookupFind.js`:
opening a hit leaves the atlas subtree and unmounts the view). The same box
is reused inline
per SourceProduct in `ProductsTab.vue`'s detail drawer ("Find in PIM" →
`src/views/Atlas/components/FindInPimPanel.vue`, seeded from that row's
name/ean/image). Its "Link" action posts to atlas
`products/<pk>/link-to-realproduct/`, which attaches the SourceProduct itself
(`real_product` + `SourceProductLink` in one transaction) — a bare
product-links create would leave the row unmatched and re-proposed.

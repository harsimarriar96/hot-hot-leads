# add-global-lead-search

A workspace-wide leads view: cross-product list at `/leads` with type-ahead search, filter chips (status, score bucket, signal type), saved views in `localStorage`, and "open in product" navigation. Backed by `GET /api/leads/search` using the existing `pg_trgm` extension for fuzzy company/domain/contact matching.

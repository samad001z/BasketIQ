# collectors/ — OPTIONAL experimental scrapers (Phase 8 ONLY)

**Do not build anything here in Phases 1–7.**

BasketIQ is deliberately decoupled from its data source: the app and AI read
exclusively from the `platform_prices` table. How that table gets populated is
an implementation detail.

- Phases 1–7: data comes from `seed/seed_catalog.py` (realistic mock data).
- Phase 8 (optional, best-effort): experimental Playwright collectors that may
  populate `platform_prices` for real. Run manually, location-gated, never on a
  schedule, never assumed to work. `playwright` is intentionally absent from
  `requirements.txt` until then.

# ADR 001 — D1 làm source of truth, Supabase chỉ Auth + Realtime mirror

Ngày: 2026-08-29
Trạng thái: Accepted

## Context
SoNovel có 2 DB: Supabase Postgres (gốc, 10 bảng + RLS) và D1 SQLite (mirror cho Worker). Mobile trước đây dual-write Worker+Supabase, Web proxy Worker fallback Supabase → drift.

## Decision
- **D1 là source of truth** cho catalog (series/chapters) và user-data (progress/favorites/bookmarks/history/settings) khi request đi qua Worker.
- Supabase giữ **Auth (auth.users, JWT) + Realtime (postgres_changes) + Storage fallback**.
- Worker `getAuth` đảm bảo `profiles` row trong D1 (INSERT OR IGNORE) rồi sync role từ Supabase REST nếu vừa tạo.
- Không dual-write đồng bộ 2-phase; Supabase user-data là best-effort mirror (khi Worker down, Mobile fallback Supabase trực tiếp).
- Backfill: `scripts/verify-drift.ts` (todo) so sánh COUNT(*) giữa 2 DB, cron nightly retry.

## Consequences
- Catalog search dùng FTS5 trên D1 (workers/migrations/0002_fts5.sql) — nhanh, prefix wildcard.
- Rate-limit in-memory tại Worker (workers/src/rate-limit.ts) + khuyến nghị Cloudflare Rules dashboard.
- Trade-off: user-data trên Supabase có thể stale vài phút khi Worker isolate cache `userCache 5m`.

## Alternatives considered
- Supabase single source: bỏ D1 → mất edge cache + R2.
- 2-phase commit: phức tạp, fail mid-write.

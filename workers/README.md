# SoNovel Worker — Phase 1 (hạ tầng)

**Worker URL:** `https://sonovel-api.vanhoi04082006.workers.dev` (Version `3401fe58…`)
**D1:** `sonovel` (`00fd3513-159a-4bbd-b4a7-884980cc54e6`, APAC) — 13 bảng theo `d1/schema.sql`
**Subdomain:** `vanhoi04082006` (tạo 2026-08-21)

## Deploy
```powershell
cd workers
npx wrangler d1 migrations apply sonovel --remote
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SERVICE_TOKEN   # sinh mới (vd: openssl rand -hex 32) — KHÔNG commit token thật
npx wrangler deploy
```

## Dev local
```powershell
Copy-Item .dev.vars.example .dev.vars
npx wrangler dev --port 8787 --remote
# health: http://127.0.0.1:8787/health  (proxy remote D1)
```

## Verify Phase 1
```powershell
npx wrangler d1 execute sonovel --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
npx wrangler deployments list
# D1 hiện trống (Phase 3 sẽ migrate data Supabase → D1)
```

## R2 (Phase 2 — code xong, chờ enable)
- Worker: `POST /api/upload` (admin, `x-service-token`, multipart `file`, ≤5MB, `image/*`) → `COVERS.put(covers/<uuid>.<ext>)` → `{url:"/covers/<key>", key}`, `GET /covers/:key` public với `Cache-Control: immutable`.
- Web: `src/app/api/upload/route.ts` → `uploadToWorker()` qua `WORKER_URL`/`SERVICE_TOKEN`, fallback Supabase Storage nếu Worker trả 503 (R2 chưa enable).
- Deploy hiện tại `12324a2e…` chưa gắn R2 binding (để tránh lỗi bucket not found) → upload sẽ fallback Supabase, không lỗi.
- Để kích hoạt R2: bật tại https://dash.cloudflare.com/3bc7982e8a2f3c210b766b046fd3557c/r2/overview → `npx wrangler r2 bucket create sonovel-covers` → uncomment `[[r2_buckets]]` trong `wrangler.toml:11` → `npx wrangler deploy`.

## Endpoints (Phase 1)
Public: `GET /health`, `GET /api/tags`, `GET /api/series`, `GET /api/series/:id`, `GET /api/series/:id/chapters`, `GET /api/chapters/:id`
Auth: `Authorization: Bearer <supabase access_token>` → verify qua `SUPABASE_URL/auth/v1/user`
Service: `x-service-token: <SERVICE_TOKEN>` → admin

## Lưu ý mạng
`workers.dev` bị chặn SSL ở mạng công ty → test từ 4G/phone hoặc `wrangler dev --remote` nếu `curl https://.../health` fail.

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
npx wrangler secret put SERVICE_TOKEN   # 78c9f90e... (lưu trong .env server-only)
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

## R2 (Phase 2)
Cần bật R2 trong Dashboard: https://dash.cloudflare.com/3bc7982e8a2f3c210b766b046fd3557c/r2/overview
Sau đó: `npx wrangler r2 bucket create sonovel-covers` + uncomment `[[r2_buckets]]` trong `wrangler.toml`

## Endpoints (Phase 1)
Public: `GET /health`, `GET /api/tags`, `GET /api/series`, `GET /api/series/:id`, `GET /api/series/:id/chapters`, `GET /api/chapters/:id`
Auth: `Authorization: Bearer <supabase access_token>` → verify qua `SUPABASE_URL/auth/v1/user`
Service: `x-service-token: <SERVICE_TOKEN>` → admin

## Lưu ý mạng
`workers.dev` bị chặn SSL ở mạng công ty → test từ 4G/phone hoặc `wrangler dev --remote` nếu `curl https://.../health` fail.

# fullstack-fire

## Data peta → geoplatform

Peta, umpan, dan CMS tetap di sini; **data** petanya dilayani aplikasi terpisah `geoplatform` (`/srv/geoplatform`, termasuk cron warm-asap). `/api/{hotspot,sebaran-asap,udara,cuaca-lokal,forecasting}` dan `/api/citra/**` diteruskan `next.config.ts` lewat rewrite ke `GEO_INTERNAL_URL` (dibaca saat build; bawaan produksi `http://geo:3000`, dev `http://localhost:3100`). Pengembangan lokal: jalankan `npm run dev` di geoplatform dulu.

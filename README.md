# fullstack-fire

## Data peta → geoplatform

Peta, umpan, dan CMS tetap di sini; **data** petanya dilayani aplikasi terpisah `geoplatform` (`/srv/geoplatform`, termasuk cron warm-asap). Fire tidak punya maupun meneruskan `/api/{hotspot,sebaran-asap,udara,cuaca-lokal,forecasting}` dan `/api/citra/**`: peramban memanggilnya langsung di `GEO_URL` (`lib/situs.ts`, dari `NEXT_PUBLIC_GEO_URL` saat build; bawaan produksi `https://geoplatform.nusantara.earth`, dev `http://localhost:3100`). Pengembangan lokal: jalankan `npm run dev` di geoplatform dulu.

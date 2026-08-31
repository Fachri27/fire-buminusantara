# MinIO Setup untuk Fullstack-Fire

## 1. Jalankan MinIO via Docker

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -p 9000-9100:9000-9100 \
  --name minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minio123 \
  -v /path/to/data:/data \
  minio/minio server /data --console-address ":9001"
```

## 2. Buka Web Console

http://localhost:9001
- Username: minioadmin
- Password: minio123

## 3. Buat Bucket

Di web console, klik "Buckets" → "Create Bucket"
- Name: `fire`
- Object Locking: OFF
- Policy: **biarkan privat**

Bucketnya sengaja tidak dibuka untuk umum. Browser tidak pernah menghubungi
MinIO langsung: `urlMedia()` mengeluarkan URL `/media/…` dan route
`app/media/[...path]/route.ts` yang mengambil objeknya dengan kredensial server
lalu men-stream-nya, lengkap dengan dukungan Range supaya video bisa dilompati.

## 4. CORS

Tidak perlu: media dilayani route `/media` yang seasal dengan halaman, jadi
tidak ada permintaan lintas asal ke MinIO dari browser.

## 5. Environment Variables

Di `.env.local`:
```bash
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minio123"
MINIO_BUCKET="fire"
NEXT_PUBLIC_MEDIA_URL="http://localhost:9000/fire"
```

## 6. Test Upload Manual

```bash
# Test basic connectivity
curl -i http://localhost:9000/fire

# Test PUT object
curl -X PUT \
  -H "Content-Type: image/png" \
  -H "Authorization: AWS4-HMAC-SHA256 Credential=minioadmin/$(date +%Y%m%d)/us-east-1/s3/aws4_request" \
  --data-binary "@test.png" \
  http://localhost:9000/fire/test/test-file.png
```

## Common Issues

### Error: "The request signature we calculated does not match the signature you provided"

**Solusi:**
1. Pastikan MinIO CORS sudah dikonfigurasi
2. Pastikan system time sinkron: `date -u`
3. Coba restart MinIO: `docker restart minio`
4. Clear browser cache & cookies

### Bypass: Pakai Hardcoded Test Credentials

Jika masih error, buat test dulu dengan credentials default:
- Access Key: `minioadmin`
- Secret Key: `minio123` (nilai `MINIO_ROOT_PASSWORD` container, bukan `minioadmin`)

### Test Script

```bash
# Install mc cli
brew install minio-mc

# Setup alias
mc alias set local http://localhost:9000 minioadmin minio123

# List buckets
mc lb local

# Create test bucket
mc mb local/fire
```

Jangan jalankan `mc anonymous set download local/fire`: bucketnya memang privat,
dan yang melayani browser adalah route `/media`.

## Cadangan lokal

Kalau MinIO menolak tulisan, `simpanBerkas()` menyimpan berkasnya ke folder
`media/` dan tetap mencatat path `fire/…` di basis data. Route `/media` mencoba
MinIO lebih dulu lalu jatuh ke folder itu, jadi medianya tetap tampil — tapi
periksa log `[Upload ERROR]`, karena artinya unggahan TIDAK masuk ke MinIO.
Setelah MinIO benar, berkas di `media/` bisa disalin ke bucket dengan key yang
sama (`gambar/…`, `video/…`) supaya sumbernya satu lagi.

# AI Generator Modul Ajar Deep Learning — Online

Versi production-ready untuk deployment **Vercel + OpenAI Responses API**.

## Arsitektur

Browser → `/api/generate-module` → Vercel Serverless Function → OpenAI API

API key **tidak pernah dikirim ke browser**. Browser hanya memanggil endpoint milik aplikasi.

OpenAI menyarankan API key disimpan sebagai environment variable dan tidak ditanam di client-side code.

## Deploy paling mudah: Vercel

### 1. Buat repository GitHub

Upload seluruh isi folder project ini ke repository baru.

**Jangan upload `.env`.** Gunakan `.env.example` sebagai template.

### 2. Import ke Vercel

Di Vercel:
- New Project
- Import repository GitHub
- Framework: Other
- Deploy

### 3. Tambahkan Environment Variables

Project → Settings → Environment Variables:

`OPENAI_API_KEY`
= API key OpenAI Anda

`OPENAI_MODEL`
= `gpt-5.6-luna`

`APP_ORIGIN`
= URL website production Anda, contoh `https://modul.hanayura.id`

`RATE_LIMIT_PER_MINUTE`
= `8`

Set environment untuk Production, lalu Redeploy.

### 4. Custom domain

Vercel → Project → Settings → Domains → Add domain.

Contoh:
`modul.hanayura.id`

Setelah DNS diarahkan sesuai instruksi Vercel, ubah:

`APP_ORIGIN=https://modul.hanayura.id`

lalu redeploy.

## Pengamanan

- API key hanya ada di environment variable server.
- HTML tidak memiliki API key.
- Validasi input dilakukan di backend.
- Topik dibatasi 180 karakter.
- Jenjang dan durasi menggunakan allowlist.
- Ada rate limit sederhana per IP/per serverless instance.
- Ada timeout 50 detik.
- Security headers dasar aktif.

### Untuk trafik besar

Rate limiter bawaan menggunakan memory instance sehingga bukan rate limiter global. Untuk aplikasi publik dengan banyak pengguna, gunakan shared Redis/Upstash atau WAF/rate limiting dari hosting.

## Test lokal

Install Vercel CLI:

`npm i -g vercel`

Login:

`vercel login`

Jalankan:

`vercel dev`

Tambahkan environment lokal melalui `.env`:

`OPENAI_API_KEY=...`
`OPENAI_MODEL=gpt-5.6-luna`
`APP_ORIGIN=http://localhost:3000`

Lalu buka:

`http://localhost:3000`

## Catatan biaya

Setiap klik Generate menggunakan API OpenAI. Atur budget/spend limits di OpenAI Platform dan pantau penggunaan.

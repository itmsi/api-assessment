# API Assessment

REST API untuk sistem **Assessment**, dibangun dengan Express.js + PostgreSQL (Knex). Aplikasi bisa dijalankan **tanpa Docker** (langsung dengan Node.js) maupun **dengan Docker**.

- Port default: **`9705`**
- Base URL: `http://localhost:9705`
- Swagger: `http://localhost:9705/documentation`
- Health check: `http://localhost:9705/health`

---

## 📋 Prasyarat

| Kebutuhan | Tanpa Docker | Dengan Docker |
|-----------|:------------:|:-------------:|
| Node.js v22 | ✅ | – |
| PostgreSQL v12+ | ✅ | ✅ (di host / container lain) |
| Docker & Docker Compose v2 | – | ✅ |
| RabbitMQ, MinIO/S3, SMTP | opsional | opsional |

---

## ⚙️ Konfigurasi Environment

Semua konfigurasi dibaca dari file `.env` di root project.

```bash
cp environment.example .env
```

Minimal yang wajib diisi:

```env
APP_NAME=API Assessment
APP_PORT=9705
NODE_ENV=development          # development | staging | production
SWAGGER_ENABLED=true          # true | false | development
TZ=Asia/Jakarta

# Database dipilih berdasarkan NODE_ENV:
#   development -> DB_*_DEV
#   staging     -> DB_*_TEST
#   production  -> DB_*_PROD
DB_CLIENT_DEV=pg
DB_HOST_DEV=localhost
DB_PORT_DEV=5432
DB_USER_DEV=postgres
DB_PASS_DEV=yourpassword
DB_NAME_DEV=api_assessment

DB_CLIENT_PROD=pg
DB_HOST_PROD=host.docker.internal   # host DB saat dijalankan via Docker
DB_PORT_PROD=5432
DB_USER_PROD=postgres
DB_PASS_PROD=yourpassword
DB_NAME_PROD=api_assessment

RABBITMQ_ENABLED=false
```

> ⚠️ Jangan commit file `.env`. File ini sudah ada di `.gitignore` dan `.dockerignore`.

---

## 🖥️ Menjalankan Tanpa Docker

```bash
# 1. Install dependencies
npm install

# 2. Siapkan .env (lihat bagian Konfigurasi), pastikan APP_PORT=9705
cp environment.example .env

# 3. Buat database lalu jalankan migration & seeder
createdb api_assessment
npm run migrate
npm run seed        # opsional

# 4. Jalankan server
npm run dev         # development (auto-reload dengan nodemon)
# atau
npm start           # mode biasa
```

Cek aplikasi:

```bash
curl http://localhost:9705/health
```

---

## 🐳 Menjalankan Dengan Docker

`docker-compose.yml` membangun image dari `Dockerfile` dan menjalankan container **`api-assessment`** di port **9705**.

Di dalam container, `NODE_ENV` dipaksa menjadi `production`, sehingga koneksi database memakai variabel **`DB_*_PROD`** dari `.env`.

### 1. Siapkan `.env`

Isi `DB_*_PROD`. Jangan pakai `localhost` sebagai host database, karena di dalam container `localhost` menunjuk ke container itu sendiri:

- PostgreSQL di mesin host → `DB_HOST_PROD=host.docker.internal` (Docker Desktop Mac/Windows) atau IP host (Linux)
- PostgreSQL di container lain dalam network `infra_net` → `DB_HOST_PROD=<nama-service-postgres>`

### 2. Buat network `infra_net` (sekali saja)

Compose memakai network eksternal `infra_net` (dipakai bersama nginx/cloudflare tunnel). Buat jika belum ada:

```bash
docker network create infra_net
```

### 3. Build & jalankan

```bash
docker compose up -d --build
```

### 4. Jalankan migration di dalam container

```bash
docker compose exec api npx knex --knexfile src/knexfile.js migrate:latest
docker compose exec api npx knex --knexfile src/knexfile.js seed:run   # opsional
```

### Perintah berguna

```bash
docker compose ps                 # status & health container
docker compose logs -f api        # lihat log
docker compose restart api        # restart
docker compose down               # stop & hapus container
```

### Mode development dengan Docker (opsional)

`docker/Dockerfile.dev` menjalankan aplikasi dengan nodemon:

```bash
docker build -f docker/Dockerfile.dev -t api-assessment:dev .
docker run --rm -p 9705:9705 --env-file .env -v "$(pwd)/src:/app/src" api-assessment:dev
```

### Catatan Docker

- Healthcheck container memanggil `GET /health` setiap 30 detik.
- Folder `logs/`, `public/`, dan `storages/` di-mount sebagai volume.
- Tracing OpenTelemetry (`src/instrumentation.js`) aktif jika `OTEL_EXPORTER_OTLP_ENDPOINT` di-set (default compose: `http://tempo:4318`). Jika endpoint tidak tersedia, aplikasi tetap berjalan.
- Elastic APM dinonaktifkan secara default di compose.

---

## 🔗 Endpoint Bawaan

| Method | Path | Keterangan |
|--------|------|------------|
| GET | `/` | Info aplikasi & uptime |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| GET | `/documentation` | Swagger UI (jika `SWAGGER_ENABLED` aktif) |
| GET | `/api/examples` | Contoh module CRUD (template) |

---

## 🏗️ Struktur Proyek

```
├── src/
│   ├── app.js                 # Konfigurasi Express
│   ├── server.js              # Entry point (listen di APP_PORT)
│   ├── instrumentation.js     # OpenTelemetry (di-load oleh Docker)
│   ├── knexfile.js            # Konfigurasi DB per NODE_ENV
│   ├── config/                # database, minio, aws, email, rabbitmq, prometheus
│   ├── modules/               # Business logic per module
│   │   └── example/           # 📌 Template module (handler, repository, validation, routes)
│   ├── middlewares/           # token (JWT), validation, rate-limiter, upload, dll
│   ├── routes/
│   │   ├── index.js           # /, /health, /metrics, /documentation
│   │   └── V1/index.js        # Registrasi route /api/*
│   ├── repository/postgres/   # migrations & seeders
│   ├── static/                # Definisi Swagger (path & schema)
│   ├── listeners/             # RabbitMQ consumer
│   └── utils/                 # response, logger, pagination, dll
├── docker/Dockerfile.dev      # Image development (nodemon)
├── Dockerfile                 # Image production
├── docker-compose.yml         # Service api-assessment (port 9705)
└── environment.example        # Template .env
```

---

## 📝 Membuat Module Baru

Gunakan module `example` sebagai template:

```bash
cp -r src/modules/example src/modules/assessments
```

1. Ganti nama `example`/`examples` di dalam file module baru, sesuaikan field.
2. Daftarkan route di `src/routes/V1/index.js`:
   ```javascript
   const assessmentModule = require('../../modules/assessments')
   routing.use(`${API_TAG}/assessments`, assessmentModule)
   ```
3. Buat migration lalu jalankan:
   ```bash
   npm run migrate:make create_assessments_table
   npm run migrate
   ```
4. Tambahkan dokumentasi Swagger di `src/static/path/` dan `src/static/schema/`.

Lihat [src/modules/README.md](src/modules/README.md) dan [src/modules/example/README.md](src/modules/example/README.md) untuk detail.

### Autentikasi

Middleware JWT tersedia di `src/middlewares/token.js`. Pasang `verifyToken` di route yang perlu proteksi, lalu kirim header:

```
Authorization: Bearer <jwt-token>
```

---

## 🛠️ NPM Scripts

| Script | Fungsi |
|--------|--------|
| `npm start` | Jalankan server |
| `npm run dev` | Jalankan server dengan nodemon |
| `npm run migrate` | Jalankan migration |
| `npm run migrate:rollback` | Rollback migration terakhir |
| `npm run migrate:make <name>` | Buat file migration baru |
| `npm run seed` | Jalankan seeder |
| `npm run seed:make <name>` | Buat file seeder baru |
| `npm run consumer` | Jalankan RabbitMQ consumer |

---

## 📊 Monitoring & Logs

- Prometheus metrics: `http://localhost:9705/metrics`
- Log aplikasi: `logs/application/`
- Log listener RabbitMQ: `logs/listener/`

---

## 🧯 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `network infra_net declared as external, but could not be found` | Jalankan `docker network create infra_net` |
| Container tidak bisa konek ke database | Ganti `DB_HOST_PROD` dari `localhost` ke `host.docker.internal` / nama service DB |
| Port 9705 sudah dipakai | `lsof -i :9705` lalu hentikan prosesnya |
| `/documentation` 404 | Set `SWAGGER_ENABLED=true` (nilai `development` hanya aktif saat `NODE_ENV=development`) |

---

## 📄 License

MIT — lihat [LICENSE](LICENSE).

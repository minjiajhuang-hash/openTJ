# Deploying the prepared Director package

GitHub Actions builds and tests the application on Linux with Node 22.9.0.
After both test jobs pass, the **Prepare Director download** job creates the
`opentj-director-linux-x64` artifact. It contains a tar.gz archive and SHA-256
checksum. Director does not need to run npm install, npm ci, Prisma generation,
or next build when using this package.

The archive contains `web/` (Next.js standalone runtime), `tasks/` (only database
and PDF-worker dependencies), and launch scripts. The preparation job tests the
exported files against PostgreSQL, starts the worker once and checks production
web health, a page, static assets and development-login rejection. Other CI jobs
test the complete application with MinIO and ClamAV.

## 1. Get the package

Open the latest successful main-branch run on the repository's **Actions** tab.
Download **opentj-director-linux-x64** from its Artifacts section while signed in
to GitHub. Unzip the download on your computer; it contains
`opentj-director-linux-x64.tar.gz` and `SHA256SUMS`.

Upload those two files to `/site/private/` using your Director file-transfer
access. Keep the archive private, outside the public document directory.
GitHub Actions artifact downloads require GitHub authentication; their web page
URLs cannot simply be passed to unauthenticated wget on Director.

## 2. Extract a fresh release

Use Director's **Node.js 22.9 (Debian)** image with OpenSSL and CA certificates.
This archive is for Linux x86-64 (`uname -m` must print `x86_64`), not Alpine.

In the Web Terminal:

```sh
cd /site/private
sha256sum -c SHA256SUMS
```

Stop if verification fails. Otherwise:

```sh
release_dir="/site/private/opentj-$(date +%Y%m%d-%H%M%S)"
mkdir "$release_dir"
tar -xzf /site/private/opentj-director-linux-x64.tar.gz -C "$release_dir"
cat "$release_dir/build-info.json"
```

Keep the printed release directory path for the steps below. Each update uses a
new directory; avoid extracting over a running release.

## 3. Set configuration and migrate

Store production environment settings in `/site/private/opentj.env` using the
dotenv format from `.env.example`, with permissions `chmod 600`. Keep this file
outside Git and the release directories. Director's injected DATABASE_URL takes
precedence over the file; DIRECTOR_DATABASE_URL is also accepted as a fallback.

Required configuration includes:

- APP_URL=https://opentj.sites.tjhsst.edu
- ION_REDIRECT_URI=https://opentj.sites.tjhsst.edu/api/v1/auth/ion/callback
- ION_CLIENT_ID and ION_CLIENT_SECRET from the confidential authorization-code app
- A random SESSION_SECRET of at least 32 characters
- STORAGE_DRIVER=s3 and private S3 bucket, region, endpoint and credentials
- CLAMAV_HOST/CLAMAV_PORT for a reachable scanner used by the worker
- BOOTSTRAP_ADMIN_ION_IDS for the intended initial administrator

Launch scripts enforce production mode and disable demo login. Web and worker
startup check required configuration before serving. Set OPENTJ_ENV_FILE if the
configuration file lives elsewhere. Never paste credentials into logs or chat.

Migrations and the idempotent production seed only require the database:

```sh
sh "$release_dir/migrate.sh"
```

No npm install or Prisma generation is needed here. The seed creates the course
structure without development personas. Take a database backup before future
schema upgrades; changing release directories does not roll back migrations.

## 4. Start the web process

Set the applicable Director run.sh to execute this release, using its actual
absolute path. For example:

```sh
#!/bin/sh
exec sh /site/private/opentj-YYYYMMDD-HHMMSS/run.sh
```

Director checks `/site/run.sh`, `/site/private/run.sh`, then `/site/public/run.sh`
in that order. Update the first existing file or create `/site/private/run.sh`
if none exists. Keep a copy of an existing script before replacing it, mark the
script executable and click **Restart process**. The package uses Director's
PORT and HOST, falling back to 8080 and 0.0.0.0.

## 5. Run the PDF worker separately

The worker requires the same database, private S3 bucket and scanner access:

```sh
sh /site/private/opentj-YYYYMMDD-HHMMSS/worker.sh
```

Use a supervised worker service with enough memory; a Web Terminal is useful for
diagnostics but is not a persistent worker service. The web startup script does
not launch another worker into Director's constrained web allocation. Uploaded
PDFs remain quarantined until a configured worker scans them successfully.

## Memory limits

The package removes installation and compilation from Director. It does not
guarantee the web process fits in 100 MB. The package smoke test prints its Linux
process RSS after a few requests; this is a small baseline, not a load test or
the total container memory. PDF parsing/scanning needs separate capacity. Request
more memory if Director still kills the prepared web process.

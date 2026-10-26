# Deployment and Certificate Lifecycle

Production is one AWS Lightsail instance with **512MB of memory**.
This number controls each decision in this document:

- two containers,
- a strict memory limit for each container,
- one uvicorn worker,
- no build on the host.

---

## 1. Runtime topology

[`build/docker-compose.yml`](../../build/docker-compose.yml) defines two containers.

| Container | Image base | Ports | Memory limit |
| --- | --- | --- | --- |
| `string_lights_nginx` | `nginx:alpine` | `80:80`, `443:443` | 50M |
| `string_lights_backend` | `python:3.12-slim` | `expose 8000` only | 350M |

- **The backend is not open to the host.** It uses `expose`, not `ports`. Thus, port 8000 exists only on the compose network. Each request gets to the backend through the `/api/` proxy of nginx.
- **nginx serves the frontend from its own image.** Stage 1 of `build/frontend.Dockerfile` builds the React bundle. The image build then copies the bundle to `/usr/share/nginx/html`. There is no volume for static files, and there is no build on the host.
- **Both containers use `restart: always`.** This setting restarts a container after a crash or an OOM stop. It does not correct a bad image or an expired certificate.
- **Host mounts:** Only nginx has host mounts. Both mounts are read-only.
  - `/etc/letsencrypt`: the certificate store. The certbot of the host owns it.
  - `/var/www/certbot`: the webroot for the ACME challenge. See section 3.

nginx applies two limits. The backend also applies its own limits.

- `client_max_body_size 55M`. This value is the same as the request limit of the backend. It is more than the upload limit of 50MB, because the multipart format adds data around the file.
- `proxy_read_timeout 120s`. The surgery timeout of the backend (90 seconds) is shorter. Thus, a slow surgery gives the `504` of the backend, with a useful message.

nginx also sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` on the static route.
[ADR 0002](../decisions/0002-coep-require-corp.md) requires these headers for `SharedArrayBuffer` and for WASM with threads.

---

## 2. Pipeline

[`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) defines the pipeline.
It runs on each push to `main` and to `develop`. It also runs on each pull request to one of these branches.

```
test-and-lint  ──▶  build-and-push  ──▶  deploy
 (all triggers)     (push to main)      (push to main)
```

**`test-and-lint`** — This job does these steps:

1. It installs the frontend dependencies with `npm ci`. Then it runs ESLint.
2. It type-checks the frontend with `tsc -b --force`.
3. It runs the frontend tests (Vitest) with `npm test`.
4. It builds `build/test.Dockerfile` and runs the backend tests in that image.
   The tests run with the memory limit of production.

This job is the only job that runs on `develop` and on pull requests.
The other jobs start only if this job passes.

**`build-and-push`** — This job builds the two images. It pushes each image with two tags:

- `:latest`: a tag that moves to each new build. It is only for convenience.
- `:sha-<short>`: a tag that does not change. It identifies this release.

**`deploy`** — This job does these steps:

1. It copies `build/docker-compose.yml` to `~/string_lights/` with SCP.
2. With SSH, it sets `DOCKER_TAG` to the `sha-<short>` tag of this run.
3. It runs `docker compose pull` and `docker compose up -d --no-build`.

The fixed tag is necessary. If the host used `:latest`, two deploys could start different images.
Each deploy would then report that it started its own build.
The `--no-build` flag is also necessary. A build on the host would use all of its 512MB.

Then the job sends requests to `/api/health` for a maximum of 60 seconds.
If the site does not answer, the job fails.
Thus, a successful `deploy` job means that the application answered. It does not mean only that the containers started.

The health check goes through the real TLS virtual host, with `curl --resolve string-lights.dev:443:127.0.0.1`.
Do not change the check to `http://localhost`:

- Port 80 answers `301` for all paths except the ACME path (section 3).
- `curl -f` accepts a redirect as a success.
- Thus, a check on port 80 passes also when the backend does not run.

A `concurrency` group lets only one deploy run at a time on each branch.

The repository needs these secrets: `HOST`, `USERNAME`, and `SSH_PRIVATE_KEY`.
The GHCR packages must be **public**. The deploy script does not log in to the registry before it pulls.

The deploy copies `build/docker-compose.yml` with SCP.
The frontend image contains `build/nginx/nginx.conf`.
Thus, a normal deploy from `main` sends a change in these files to production. Do not edit these files on the host.

---

## 3. Certificate lifecycle

The certificate for `string-lights.dev` comes from Let's Encrypt.
Certbot renews it with the **HTTP-01 challenge and the webroot authenticator**.
The repository and the host have different responsibilities.

**The repository provides this:** nginx serves `/.well-known/acme-challenge/` from `/var/www/certbot` over plain HTTP.
This rule comes before the HTTPS redirect for the other paths on port 80.
The container mounts this directory read-only.

**The host provides this:** certbot, the renewal timer, and the webroot directory.
nginx does not write to `/var/www/certbot`. Certbot does not read the container.

The host must meet two requirements. You cannot see them in the repository.
The deploy pipeline does not set them up. Thus, a new host needs both of them again.

Do not think that an existing `/var/www/certbot` shows a correct setup. Docker creates a missing source directory for a bind mount.

1. **The renewal authenticator must be `webroot`, not `standalone`.** The nginx container uses port 80. Thus, a standalone challenge cannot use that port.
   The file `/etc/letsencrypt/renewal/string-lights.dev.conf` records the authenticator for the domain.

2. **A deploy hook must reload nginx.** nginx reads the certificate into memory only when it starts.
   If nobody reloads nginx after a renewal, the container serves the old certificate until somebody makes the container again.

   ```sh
   # /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
   #!/bin/sh
   docker exec string_lights_nginx nginx -s reload
   ```

**Verification.** All three commands must pass:

```sh
sudo certbot renew --dry-run
curl -I http://string-lights.dev/.well-known/acme-challenge/probe   # 404, never 301
sudo /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh          # "signal process started"
```

Run the hook directly. Certbot does not run deploy hooks with `--dry-run`.
Thus, a dry run passes also when the hook is missing. Then the site serves the old certificate until it expires.

If the second command gives `301`, nginx redirects the challenge path. Then each renewal fails.
No error shows for a maximum of 90 days. Then the certificate expires, and the full site stops at one time.

---

## 4. Releases and tags

A deploy and a release are different events.
Each push to `main` makes a deploy. A release is a deploy that you must be able to name and go back to.

Tags are annotated, in the format `vMAJOR.MINOR.PATCH`, on `main`.
The existing tags are `v1.0-legacy`, `v2.0.0` to `v2.0.3`, `v2.1.0`, and `v2.2.0`.

**Three locations contain the version. Change all three together.**
The three versions did not agree one time: the tags were at `v2.1.0`, `main.py` had `2.0.0`, and `package.json` had `0.0.0`.
FastAPI shows its version to users in `/docs` and in the OpenAPI schema.

| Location | Item |
| --- | --- |
| `apps/backend/app/main.py` | `FastAPI(..., version=...)` |
| `apps/web-app/package.json` | `"version"` |
| git | the annotated tag on `main` |

Procedure:

1. On `develop`, change the two version strings. Commit them with the release.
2. Push `develop`, and wait until CI passes. The deploy needs this job. If it fails here, the release would fail in production.
3. Fast-forward `main` to `develop`, and push `main`. This push starts the deploy.
4. Put an annotated tag on the commit on `main`. Then push the tag:
   ```bash
   git tag -a v2.2.0 -m "<what this release contains>"
   git push origin v2.2.0
   ```
5. Make sure that the health check of the deploy passed. Make sure that the site serves the new build.

Apply the tag **after** the deploy succeeds, not before.
A tag on a commit that did not deploy names a release that did not exist.

Two deploys, on 2026-09-14 and 2026-09-19, have no tag. Nobody wrote the procedure down at that time.
The project does not add tags to them now. A tag records a decision to mark a release.
A tag added later would record a decision that nobody made.
GHCR keeps their images under their `sha-` tags. A rollback uses these tags.

## 5. Rollback

GHCR keeps each release under its `sha-<short>` tag.
To roll back, change one variable:

```sh
cd ~/string_lights/build
export DOCKER_REGISTRY=ghcr.io/utaewook
export DOCKER_TAG=sha-<short sha of the last good commit>

docker compose pull
docker compose up -d --no-build
```

To find the candidate commits, run `git log --oneline` on `main`. The tag is the first seven characters of the SHA.

**GHCR keeps the release images, not the host.**
The deploy runs `docker image prune -f`. This command deletes the dangling layers, but it keeps the tagged images.
The host keeps only what it needs to run. A rollback pulls the old image from GHCR again.
The project accepts this trade-off. The memory and the disk of the host are more limited than the storage of the registry.

A person decides on a rollback.
If the health check fails, the pipeline fails and tells you that the site is down. The pipeline does not roll back on its own.
See [issue 016](../issues/016-deploys-cannot-be-rolled-back.md) for the reason that the project does not use an automatic rollback yet.

---

## 6. Next documents

- [CLAUDE.md (session rules and trigger routing)](../../CLAUDE.md)
- [Project overview (01_project_overview.md)](./01_project_overview.md)
- [Terminology (02_terminology.md)](./02_terminology.md)
- [Architecture and data flow (03_architecture.md)](./03_architecture.md)
- [Coding rules (04_convention.md)](./04_convention.md)
- [Writing standard (06_writing_standard.md)](./06_writing_standard.md)

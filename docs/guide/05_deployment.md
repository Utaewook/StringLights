# Deployment & Certificate Lifecycle

Production is a single AWS Lightsail instance with **512MB of RAM**. Every decision
below follows from that number: two containers, hard memory ceilings, one uvicorn
worker, and no build step on the host.

---

## 1. Runtime Topology

Two containers, defined in [`build/docker-compose.yml`](../../build/docker-compose.yml).

| Container | Image base | Ports | Memory limit |
| --- | --- | --- | --- |
| `string_lights_nginx` | `nginx:alpine` | `80:80`, `443:443` | 50M |
| `string_lights_backend` | `python:3.12-slim` | `expose 8000` only | 350M |

*   **The backend is never published to the host.** It uses `expose`, not `ports`, so
    port 8000 exists only on the compose network. Every request reaches it through
    nginx's `/api/` proxy.
*   **nginx serves the frontend from its own image.** The React bundle is built during
    the image build (`build/frontend.Dockerfile`, stage 1) and copied to
    `/usr/share/nginx/html`. There is no static-file volume and no build on the host.
*   **Both containers use `restart: always`.** This recovers from a crash or an OOM
    kill; it does not recover from a bad image or an expired certificate.
*   **Host mounts** (nginx only, both read-only):
    *   `/etc/letsencrypt` — the certificate store, owned by the host's certbot.
    *   `/var/www/certbot` — the ACME challenge webroot. See §3.

nginx applies two constraints that the backend also enforces independently:
`client_max_body_size 55M` (a buffer above the backend's own 50MB cap) and
`proxy_read_timeout 120s`. It also sets `Cross-Origin-Opener-Policy` and
`Cross-Origin-Embedder-Policy` on the static route, which
[ADR 0002](../decisions/0002-coep-require-corp.md) requires for
`SharedArrayBuffer` and WASM multithreading.

---

## 2. Pipeline

Defined in [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml).
It runs on pushes to `main` and `develop`, and on pull requests targeting either.

```
test-and-lint  ──▶  build-and-push  ──▶  deploy
 (all triggers)     (push to main)      (push to main)
```

**`test-and-lint`** — installs the frontend with `npm ci` and runs `npm run lint`.
This is the only job that runs on `develop` and on pull requests.

**`build-and-push`** — builds both images and pushes each under two tags:
`:latest`, a moving convenience pointer, and `:sha-<short>`, an immutable handle
on this exact release. The frontend image build runs `npm run build`, which is
`copy-wasm && tsc -b && vite build`; a TypeScript error therefore fails *this*
job, not the lint gate.

**`deploy`** — copies `build/docker-compose.yml` to `~/string_lights/` over SCP,
then over SSH pins `DOCKER_TAG` to the `sha-<short>` tag this run produced and
runs `docker compose pull` and `docker compose up -d --no-build`. Pinning matters:
resolving `:latest` on the host would let two deploys land on different images
while both believed they had shipped their own build. `--no-build` is deliberate
too — building on a 512MB host would exhaust it.

The job then polls `/api/health` for up to 60 seconds and fails if the site never
answers, so a green `deploy` means the application responded, not merely that the
containers were created. The probe goes through the real TLS vhost with
`curl --resolve string-lights.dev:443:127.0.0.1`. Probing `http://localhost`
instead would be worthless: port 80 answers `301` for everything but the ACME
path (§3), and `curl -f` treats a redirect as success, so that check would pass
with the backend dead.

A `concurrency` group serializes deploys per branch.

Required repository secrets: `HOST`, `USERNAME`, `SSH_PRIVATE_KEY`. The GHCR
packages must be **public** — the deploy script does not authenticate to the
registry before pulling.

Because `build/docker-compose.yml` ships over SCP and `build/nginx/nginx.conf` is
baked into the frontend image, a change to either reaches production through a
normal `main` deploy. Neither needs to be edited on the host.

---

## 3. Certificate Lifecycle

The certificate for `string-lights.dev` is a Let's Encrypt certificate renewed with
the **HTTP-01 challenge over the webroot authenticator**. Responsibility is split:

**The repository provides** — nginx serves `/.well-known/acme-challenge/` from
`/var/www/certbot` over plain HTTP, ahead of the HTTPS redirect that catches every
other path on port 80. That directory is bind-mounted read-only into the container.

**The host provides** — certbot itself, the renewal timer, and the webroot
directory. nginx never writes to `/var/www/certbot`; certbot never reads the
container.

Two host-side requirements are load-bearing, and neither is visible from the
repository:

1.  **The renewal authenticator must be `webroot`, not `standalone`.** The nginx
    container holds port 80, so a standalone challenge cannot bind it. The
    authenticator is recorded per-domain in
    `/etc/letsencrypt/renewal/string-lights.dev.conf`.

2.  **A deploy hook must reload nginx.** nginx reads the certificate into memory
    once at start-up. A renewal that no one reloads leaves the container serving
    the old certificate until it is recreated:

    ```sh
    # /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
    #!/bin/sh
    docker exec string_lights_nginx nginx -s reload
    ```

**Verification.** These two commands are the whole test, and both must pass:

```sh
sudo certbot renew --dry-run
curl -I http://string-lights.dev/.well-known/acme-challenge/probe   # 404, never 301
```

A `301` on the second command means the challenge path is being redirected and
every future renewal will fail. The failure is silent for up to 90 days, then takes
the entire site down at once.

> Host-side verification is tracked in
> [issue 015](../issues/015-tls-renewal-has-no-working-path.md) and is not yet
> confirmed.

---

## 4. Rollback

Every release stays addressable in GHCR under its `sha-<short>` tag. Rolling back
is one variable:

```sh
cd ~/string_lights/build
export DOCKER_REGISTRY=ghcr.io/utaewook
export DOCKER_TAG=sha-<short sha of the last good commit>

docker compose pull
docker compose up -d --no-build
```

`git log --oneline` on `main` gives the candidate commits; the tag is the first
seven characters of the SHA.

**The artefact lives in GHCR, not on the host.** The deploy runs
`docker image prune -f`, which reclaims dangling layers but leaves tagged images
alone; the instance still keeps only what it needs to run, and a rollback pulls
the old image back down. This is a deliberate trade — 512MB of RAM and a small
disk are scarcer than remote registry storage.

Rolling back is a human decision. A failed health check fails the pipeline and
tells you the site is down; it does not revert anything on its own. See
[issue 016](../issues/016-deploys-cannot-be-rolled-back.md) for why automatic
rollback was deferred.

---

## 5. Next Documents
*   [CLAUDE.md (Required Session Rules & Trigger Routing)](../../CLAUDE.md)
*   [Project Overview (01_project_overview.md)](./01_project_overview.md)
*   [Terminology & Concepts (02_terminology.md)](./02_terminology.md)
*   [Architecture & Data Flow (03_architecture.md)](./03_architecture.md)
*   [AI Coding Rules (04_convention.md)](./04_convention.md)

# TLS certificate renewal has no working path

- **Status:** Open
- **Severity:** Critical
- **Track:** Bug
- **Found:** 2026-08-30

## Symptom

No symptom has been observed yet. This is a dated failure: the Let's Encrypt
certificate for `string-lights.dev` cannot be renewed, so HTTPS stops working for
the entire site at most 90 days after the certificate was last issued. Every
visitor gets a browser interstitial; there is no partial degradation.

## Evidence

Three independent blockers, any one of which is sufficient:

1. **The ACME challenge path was redirected away.** `build/nginx/nginx.conf`
   answered *every* request on port 80 with `return 301 https://...`, including
   `/.well-known/acme-challenge/`. An HTTP-01 challenge can never be served.

2. **Port 80 is held by a container.** `build/docker-compose.yml` binds the
   `frontend` service to `80:80` and `443:443`, so `certbot --standalone` cannot
   take the port either. Both HTTP-01 authenticators were therefore unavailable.

3. **Nothing reloads nginx after a renewal.** `/etc/letsencrypt` is bind-mounted
   read-only, but nginx reads the certificate into memory once at start-up. Even
   a successful host-side renewal would leave the container serving the expired
   certificate until it is reloaded or recreated.

The repository carries no record of how the certificate was obtained. Commit
`8a32157` ("chore(infra): configure SSL/HTTPS and expose port 443") added the
`ssl_certificate` directives and the `/etc/letsencrypt` mount, and nothing else.
A search across `docs/`, `.github/`, and `build/` returns no mention of
`certbot`, `renew`, or `acme` — only the three path strings above.

## Suspected cause

The certificate was almost certainly issued once by hand — likely with
`certbot certonly --standalone` while the containers were stopped — and the
renewal path was never exercised, because a fresh certificate is valid for 90
days and the failure is silent until then. The absence of any documentation is
part of the defect, not a side note: there was no artefact for a later reader to
notice was missing.

## Impact

Total outage of the public site on certificate expiry, with no warning and no
automated recovery. `restart: always` does not help — the container is healthy,
the certificate is not. Recovery requires a human who knows the issuance
procedure, which is not written down anywhere.

## Resolution criteria

**Done (repository):**

- [x] `build/nginx/nginx.conf` serves `/.well-known/acme-challenge/` from
      `/var/www/certbot` over plain HTTP; everything else on port 80 still
      redirects to HTTPS.
- [x] `build/docker-compose.yml` bind-mounts `/var/www/certbot` read-only into
      the `frontend` container.

**Remaining (Lightsail host, one-off):**

- [ ] `sudo mkdir -p /var/www/certbot && sudo chmod 755 /var/www/certbot`
- [ ] Switch the renewal authenticator from `standalone` to `webroot` in
      `/etc/letsencrypt/renewal/string-lights.dev.conf`:
      ```ini
      authenticator = webroot
      webroot_path = /var/www/certbot,
      [[webroot_map]]
      string-lights.dev = /var/www/certbot
      ```
- [ ] Register a deploy hook so nginx picks up the new certificate:
      ```
      /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
        #!/bin/sh
        docker exec string_lights_nginx nginx -s reload
      ```
      (`chmod +x`)
- [ ] Verify end to end: `sudo certbot renew --dry-run` succeeds, and the
      challenge path is reachable — `curl -I http://string-lights.dev/.well-known/acme-challenge/probe`
      returns `404`, **not** `301`.
- [ ] Confirm the renewal timer is active: `systemctl list-timers | grep certbot`

The issue closes only when `certbot renew --dry-run` passes on the host. Until
then the repository change is necessary but not sufficient.

## Follow-up

The host procedure above is an operational norm, not a one-off note, and it
belongs in `docs/guide/` rather than in an issue file that will eventually move
to `docs/history/`. A `docs/guide/05_deployment.md` covering the deploy
pipeline, the certificate lifecycle, and the rollback procedure would prevent
the next undocumented-infrastructure failure. Deferred pending a decision on
whether to add a fifth guide document.

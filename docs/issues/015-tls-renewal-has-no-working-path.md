# TLS certificate renewal has no working path

- **Status:** Closed
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

- [x] `sudo mkdir -p /var/www/certbot && sudo chmod 755 /var/www/certbot`
- [x] Switch the renewal authenticator from `standalone` to `webroot` in
      `/etc/letsencrypt/renewal/string-lights.dev.conf`:
      ```ini
      authenticator = webroot
      webroot_path = /var/www/certbot,
      [[webroot_map]]
      string-lights.dev = /var/www/certbot
      ```
- [x] Register a deploy hook so nginx picks up the new certificate:
      ```
      /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
        #!/bin/sh
        docker exec string_lights_nginx nginx -s reload
      ```
      (`chmod +x`)
- [x] Verify end to end: `sudo certbot renew --dry-run` succeeds, and the
      challenge path is reachable — `curl -I http://string-lights.dev/.well-known/acme-challenge/probe`
      returns `404`, **not** `301`.
- [x] Confirm the renewal timer is active: `systemctl list-timers | grep certbot`

The issue closes only when `certbot renew --dry-run` passes on the host. Until
then the repository change is necessary but not sufficient.

## Follow-up

Done. The host procedure lives in
[`../guide/05_deployment.md`](../guide/05_deployment.md) §3, where an operational
norm belongs, rather than in this file.

## Resolution (2026-09-15)

The certificate now renews over HTTP-01 through the running nginx container.
Verified on the Lightsail host and from outside it:

```
certbot renew --dry-run                   : all simulated renewals succeeded
renewal authenticator                     : webroot
renewal-hooks/deploy/reload-nginx.sh      : present, executable, reload succeeded
certbot.timer                             : active
https://string-lights.dev/api/health      : 200
http://.../.well-known/acme-challenge/... : 404
served certificate notAfter               : 2026-11-01
```

Three things should stay on record.

**The repository fix was not in production until 2026-09-14.** The nginx and
compose change landed on `develop` on 2026-08-30, but production deploys only from
`main`, which was 19 commits behind. Until `main` was fast-forwarded to `7e20363`
the live nginx still redirected the challenge path, so no host-side change could
have passed.

**The host steps had not been done, and nothing reported it.** The first dry run
after that deploy still failed with `Could not bind TCP port 80`. The renewal
config was untouched and read `authenticator = standalone`, and the deploy hook
did not exist. `/var/www/certbot` did exist, but only because Docker creates a
missing bind-mount source, which says nothing about whether the setup was run.
The deploy pipeline performs none of these steps, so a rebuilt host needs all of
them again.

**A dry run does not exercise the hook.** certbot skips deploy hooks under
`--dry-run`, so the hook was invoked by hand. The first real renewal falls due
around 2026-10-02, 30 days before expiry. If the served certificate still reads
2026-11-01 after that, the renewal or the reload failed, and
`/var/log/letsencrypt/letsencrypt.log` on the host says which.

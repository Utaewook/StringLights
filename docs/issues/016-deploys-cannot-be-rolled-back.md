# Deploys cannot be rolled back

- **Status:** Open
- **Severity:** High
- **Track:** Bug
- **Found:** 2026-08-30
- **Related:** [014](./014-toolchain-versions-drift.md)

## Symptom

No symptom has been observed. A bad push to `main` reaches production and stays
there: there is no artefact to return to, and nothing reports that the site went
down.

## Evidence

Four properties of the pipeline compound into a single unrecoverable state.

1. **Only `:latest` was published.** Both `docker/build-push-action` steps tagged
   `${IMAGE_NAME}:latest` and nothing else, so each build overwrote the pointer to
   its predecessor in GHCR. No previous release remained addressable.

2. **`docker image prune -af` ran on every deploy.** The `-a` flag removes every
   unused image, not just dangling layers. The image that had just been replaced
   was unused by definition, so the last copy of the previous release was deleted
   from the host seconds after the new one started. `-a` also removes unrelated
   images belonging to anything else on the instance.

3. **Nothing verified the deploy.** `/api/health` exists and no step called it.
   The `deploy` job went green when `docker compose up -d` returned, which
   reports that the containers were *created*, not that the application answers.

4. **Deploys were not serialized.** The workflow declared no `concurrency` group,
   so two pushes to `main` in quick succession could run two `deploy` jobs against
   the same host, both resolving the mutable `:latest` tag independently.

## Suspected cause

The pipeline was written to get a first deploy working and never revisited for the
failure case. Each individual choice is defensible in isolation — `:latest` is the
obvious tag, `prune -a` is the obvious disk-hygiene command on a small host — and
the interaction between them is only visible when all four are read together.

## Impact

An outage caused by a bad build has no bounded recovery time. Restoring service
requires identifying the last good commit, rebuilding both images from it, and
pushing again through the full pipeline — several minutes at best, and it depends
on the previous commit still building reproducibly, which
[014](./014-toolchain-versions-drift.md) says it may not.

## Resolution criteria

**Done (repository):**

- [x] Both images are published under an immutable `sha-<short>` tag alongside
      `:latest`, so every release stays addressable in GHCR.
- [x] The deploy pins `DOCKER_TAG` to the tag this run built rather than
      resolving `:latest` on the host.
- [x] `docker image prune -af` is now `docker image prune -f` — dangling layers
      only.
- [x] The deploy polls `/api/health` through the real TLS vhost for up to 60s and
      fails the job if the site never answers.
- [x] A `concurrency` group serializes deploys per branch.

**Remaining:**

- [ ] The first push to `main` exercises the health gate and passes.

Note that the rollback artefact lives in GHCR, not on the host. The 512MB
instance keeps only the running release; a rollback pulls the old tag back down.
This is deliberate — retaining old images locally would trade a scarce resource
for a copy of something already stored remotely.

## Not addressed

Rolling back is still a human decision and a human command. Automatic rollback on
a failed health check was considered and deferred: it adds a state file on the
host recording the last good tag, and a failure mode where the rollback itself
fails and leaves the operator debugging two deploys instead of one.

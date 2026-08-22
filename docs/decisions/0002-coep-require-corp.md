# 0002. Enable cross-origin isolation via COEP `require-corp`

- **Status:** Accepted
- **Date:** 2026-08-22 (documents behaviour introduced in commit `b2c2ffa`)

## Context

`onnxruntime-web` runs multithreaded WASM, which needs `SharedArrayBuffer`. Browsers only
expose `SharedArrayBuffer` to a cross-origin isolated document. Without it, inference
falls back to single-threaded WASM and gets substantially slower.

## Decision

Nginx serves the frontend with both isolation headers
(`build/nginx/nginx.conf`):

```nginx
add_header Cross-Origin-Opener-Policy  "same-origin"  always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

## Consequences

### What this buys

- `SharedArrayBuffer` is available, so WASM multithreading works and the WASM fallback
  path stays usable rather than being unbearably slow.

### What this costs

Under `require-corp`, **every cross-origin subresource must opt in** with a
`Cross-Origin-Resource-Policy` header or a successful CORS fetch. Anything that does not
is blocked by the browser. Concretely:

- **Third-party embedded widgets do not work.** Anything iframe-based — donation
  widgets, embedded forms — is blocked unless it also sends the isolation headers, which
  such services generally do not.
- **Externally hosted analytics scripts are not safe to assume.** They load only if the
  provider serves CORP or CORS correctly; this must be verified per provider rather than
  taken for granted.
- Remote images, fonts, and CDN scripts are subject to the same rule.

### Working within it

- Link out with a plain `<a href>` instead of embedding a widget. Navigation is not a
  subresource, so it is unaffected.
- Serve analytics same-origin — self-host, or proxy the script through Nginx.
- Keep assets local. The build already copies ORT's `.wasm` and `.mjs` files into the
  app's own origin.

## Alternatives considered

- **Drop cross-origin isolation.** Restores third-party embeds, but forces
  single-threaded WASM for every user without WebGPU. Rejected: the fallback path is the
  one that most needs the performance.
- **`COEP: credentialless`.** Relaxes the requirement for no-cors subresources, but
  browser support is uneven and it does not fix iframes. Worth revisiting if a specific
  embed becomes necessary.

## Open questions

- Does cross-origin isolation survive putting a CDN in front of the origin? Any
  script-injecting optimisation feature is a candidate for breaking it, and this should
  be verified before launch rather than after.

# 0002. Enable cross-origin isolation with COEP `require-corp`

- **Status:** Accepted
- **Date:** 2026-08-22. This ADR records the behavior that commit `b2c2ffa` added.

## Context

`onnxruntime-web` runs WASM with multiple threads. WASM with threads needs `SharedArrayBuffer`.
Browsers give `SharedArrayBuffer` only to a document that is cross-origin isolated.
Without `SharedArrayBuffer`, inference uses WASM with one thread, and it becomes much slower.

## Decision

Nginx serves the frontend with the two isolation headers (`build/nginx/nginx.conf`):

```nginx
add_header Cross-Origin-Opener-Policy  "same-origin"  always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

## Consequences

### Advantages

- `SharedArrayBuffer` is available. Thus, WASM with threads works.
  The WASM fallback stays usable. Without threads, it would be too slow to use.

### Disadvantages

With `require-corp`, **each cross-origin subresource must permit the load**.
A subresource permits the load with a `Cross-Origin-Resource-Policy` header or with a successful CORS fetch.
The browser blocks each subresource that does not permit the load.
These are the specific results:

- **Embedded widgets from third parties do not work.** The browser blocks each widget in an iframe, for example a donation widget or an embedded form.
  The only exception is a widget that also sends the isolation headers. These services usually do not send them.
- **You cannot assume that an analytics script from an external host loads.**
  It loads only if the provider serves CORP or CORS correctly.
  Verify this for each provider. Do not assume that it is correct.
- The same rule applies to remote images, fonts, and CDN scripts.

### How to prevent these blocks

- Use a plain `<a href>` link instead of an embedded widget.
  A navigation is not a subresource, so the rule does not apply to it.
- Serve analytics from the same origin. Host the script yourself, or proxy it through Nginx.
- Keep the assets local. The build already copies the `.wasm` and `.mjs` files of `onnxruntime-web` to the origin of the app.

## Other options

- **Remove cross-origin isolation.** Embeds from third parties then work again.
  But each user without WebGPU must use WASM with one thread.
  The project rejected this option. The WASM fallback is the path that needs the performance most.
- **`COEP: credentialless`.** This option makes the rule less strict for no-cors subresources.
  But browser support for it is not consistent, and it does not correct the problem with iframes.
  Examine this option again if a specific embed becomes necessary.

## Open questions

- Does cross-origin isolation continue to work if the project puts a CDN in front of the origin?
  Each optimization feature that adds scripts to the page can possibly cause it to fail.
  Verify this before the launch, not after the launch.

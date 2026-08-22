# Design system components

Ported from the vendored design system (see `../../styles/ds/README.md`). The source
ships them as `.jsx` + `.d.ts`; `tsconfig.app.json` sets no `allowJs` and the build runs
`tsc -b`, so each one is hand-ported to `.tsx` **as it is first used** rather than copied
in bulk — `noUnusedLocals` would reject 35 unused files.

Ports stay faithful to the source. Where one deviates, the file says so and why.

Read the component's `*.prompt.md` in the design system project before composing with it.

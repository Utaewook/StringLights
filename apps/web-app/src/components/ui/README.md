# Design system components

The components in this directory come from the vendored design system. See [its README](../../styles/ds/README.md).

The source gives each component as a `.jsx` file and a `.d.ts` file. This app cannot use these files directly:

- `tsconfig.app.json` does not set `allowJs`.
- The build runs `tsc -b`.

Thus, port each component to `.tsx` by hand when the app first uses it. Do not copy all components at one time. `noUnusedLocals` would refuse the 35 files that the app does not use.

- Keep each port the same as the source. If a port is different from the source, write the difference and the reason in the file.
- Before you use a component, read its `*.prompt.md` file in the design system project.

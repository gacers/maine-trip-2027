<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Component folder structure

A component with sub-components nests each one in its own sibling
folder, not in a shared `components/` subfolder — a sub-component gets
the exact same self-contained shape (own `.tsx`, own `.module.css`, own
`index.ts` barrel) as a top-level one:

```
MainComponent/
  MainComponent.tsx
  MainComponent.module.css
  index.ts
  SubComponent/
    SubComponent.tsx
    SubComponent.module.css
    index.ts
  SubComponent2/
    SubComponent2.tsx
    SubComponent2.module.css
    index.ts
```

`MainComponent.tsx` imports its own sub-components by folder
(`import SubComponent from "./SubComponent"`), same as any top-level
component is imported elsewhere (`@/components/SubComponent`) — never
`./components/SubComponent`. A sub-component's own `index.ts` follows
the same re-export shape every top-level component's already does (see
`components/Badge/index.ts`, `components/NavigationMenu/index.ts`):

```ts
export { default } from "./SubComponent";
export type { SubComponentProps } from "./SubComponent";
```

Applied site-wide across every existing `*/components/` subfolder in
2026; anything new should follow this shape from the start rather than
reintroducing a shared `components/` folder.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Next.js AI Skills & Workflows

This project is configured with Next.js official agent skills located in `.agents/skills/`:

- **`next-dev-loop`**: After making edits, verify that routes compile and behave correctly at runtime against the dev server using the Next.js MCP server (`/_next/mcp`) and browser verification.
- **`next-cache-components-optimizer`**: Use when optimizing routes to make page transitions and static shells instant (instant navigation).
- **`next-cache-components-adoption`**: Use when adopting or resolving Cache Components prerendering issues.
- **`next-partial-prefetching-adoption`**: Use when tuning and auditing Partial Prefetching across App Shell links.

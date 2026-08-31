# Contributing to pbctl

Thanks for contributing. Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

Requirements: Bun 1.4 or later (the pinned version is in `.tool-versions`). Bun runs the
TypeScript source directly, so there is no build step while developing. `bun run dev` starts the
app from source, and `bun run format` applies Biome's formatting.

To manage your local version of bun take a look at [mise](https://mise.jdx.dev) (see its
[getting started guide](https://mise.jdx.dev/getting-started.html)), run
`mise install` in the repo root to install the pinned Bun version in the `.tool-versions` file.

```sh
bun install
bun run verify
```

`verify` runs the whole gate:

| Step                | Tool                  | Checks                                     |
|---------------------|-----------------------|--------------------------------------------|
| `bun run lint`      | Biome (`biome.json`)  | Formatting, lint rules, complexity limits  |
| `bun run arch`      | dependency-cruiser    | Layer boundaries, cycles                   |
| `bun run knip`      | knip                  | Dead code, unused exports and dependencies |
| `bun run typecheck` | tsc (`--noEmit`)      | Type errors                                |
| `bun run test`      | bun test              | Unit tests                                 |
| `bun run build`     | `bun build --compile` | The binary compiles                        |

## Git hooks

`bun install` installs the hooks (husky):

- **pre-commit**: Biome on the staged files.
- **commit-msg**: commitlint. The commit type sets the release bump.
- **pre-push**: the full `bun run verify`.

## Commits

Conventional Commits, enforced locally and in CI. semantic-release cuts releases from the commit
history and attaches the compiled binaries to the GitHub release, so the type you choose is the
version bump you cause:

- `fix:` patch, `feat:` minor, `feat!:` or `BREAKING CHANGE:` major.
- `docs:`, `chore:`, `test:`, `refactor:` produce no release.

Write the subject line for the changelog reader, not the diff reader.

## Changing behavior

The [pillarbox-demo-backend](https://github.com/SRGSSR/pillarbox-demo-backend) documentation
describes the API surface commands target: the protected Management API and the public Player
API. When the first commands land, document them
in `docs/design/commands.md` in the same change as the code. Documentation reflects current
behavior, never planned behavior. The design choices:

- pbctl is interactive only. There is no non-interactive command mode.
- Commands follow the noun-verb form (`/media ls`, `/folder show`).
- The npm package runs on Node, so `src/` uses no Bun-only APIs. Bun APIs are allowed in
  `scripts/` and in tests.
- The architecture is a two-layer split: a headless engine under `src/engine/` and an Ink
  frontend under `src/frontend/`. dependency-cruiser enforces the boundaries
  (`.dependency-cruiser.cjs`).

## Backend for manual testing

pbctl talks to a running
[pillarbox-demo-backend](https://github.com/SRGSSR/pillarbox-demo-backend). That repository
ships a Docker Compose setup with the API on `:8080` and Keycloak on `:8081`; see its README
for the seeded test users.

## Style

- Biome owns formatting and lint.
- Documentation and user-visible strings use plain, direct language.

If `bun run verify` passes, the style is right.

## Pull requests

Keep them scoped to one change. CI runs the same `verify` chain plus commit linting.

/**
 * Architecture boundaries. The directories are the layers:
 *   src/engine/config     - saved profiles and the configuration file. Bottom layer.
 *   src/engine/connection - the pillarbox-demo-backend HTTP client handle.
 *   src/engine/queries    - CQRS read side.
 *   src/engine/commands   - CQRS write side (plan and execute).
 *   src/engine/engine.ts  - the facade, the only engine module the frontend imports.
 *   src/frontend          - presentation: components, screens, and the REPL shell.
 *   src/utils             - helpers any layer may use. They import nothing.
 *   src/index.tsx         - the entry. Wires the engine and the shell.
 * Types live with the module that owns them.
 * Run with `bun run arch`.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make the graph hard to reason about.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-test-deps-in-src',
      severity: 'error',
      comment: 'Production code must not import test files.',
      from: { pathNot: '\\.test\\.(ts|tsx)$' },
      to: { path: '\\.test\\.(ts|tsx)$' },
    },
    {
      name: 'engine-is-headless',
      severity: 'error',
      comment:
        'The engine renders nothing. Ink, React, and prompt libraries are frontend-only.',
      from: { path: '^src/engine/' },
      to: { path: '^node_modules/(ink|react)' },
    },
    {
      name: 'engine-imports-no-frontend',
      severity: 'error',
      comment: 'The engine is the bottom layer of the two-layer split.',
      from: { path: '^src/engine/' },
      to: { path: '^src/frontend/' },
    },
    {
      name: 'frontend-uses-the-facade',
      severity: 'error',
      comment:
        'The frontend drives the engine only through src/engine/engine.ts.',
      from: { path: '^src/frontend/', pathNot: '\\.test\\.(ts|tsx)$' },
      to: { path: '^src/engine/', pathNot: '^src/engine/engine\\.ts$' },
    },
    {
      name: 'components-are-dumb',
      severity: 'error',
      comment: 'Reusable widgets receive data as props. They know no engine.',
      from: { path: '^src/frontend/components/' },
      to: { path: '^src/engine/' },
    },
    {
      name: 'config-is-isolated',
      severity: 'error',
      comment:
        'The config is the bottom of the engine. It imports no other src module.',
      from: { path: '^src/engine/config/', pathNot: '\\.test\\.(ts|tsx)$' },
      to: { path: '^src/', pathNot: '^src/(engine/config/|utils/)' },
    },
    {
      name: 'connection-knows-only-the-config',
      severity: 'error',
      comment:
        'The connection wraps the client. It knows no queries or commands.',
      from: { path: '^src/engine/connection/', pathNot: '\\.test\\.(ts|tsx)$' },
      to: {
        path: '^src/',
        pathNot: '^src/(engine/(connection|config)/|utils/)',
      },
    },
    {
      name: 'queries-do-not-write',
      severity: 'error',
      comment:
        'The read side imports the config and the connection, never the write side.',
      from: { path: '^src/engine/queries/', pathNot: '\\.test\\.(ts|tsx)$' },
      to: {
        path: '^src/',
        pathNot: '^src/(engine/(queries|connection|config)/|utils/)',
      },
    },
    {
      name: 'commands-stay-in-the-engine',
      severity: 'error',
      comment:
        'The write side may reuse queries for its plan phase, nothing above that.',
      from: { path: '^src/engine/commands/', pathNot: '\\.test\\.(ts|tsx)$' },
      to: {
        path: '^src/',
        pathNot: '^src/(engine/(commands|queries|connection|config)/|utils/)',
      },
    },
    {
      name: 'utils-import-nothing',
      severity: 'error',
      comment:
        'The utils are the shared bottom. They import no other src module.',
      from: { path: '^src/utils/', pathNot: '\\.test\\.(ts|tsx)$' },
      to: { path: '^src/', pathNot: '^src/utils/' },
    },
    {
      name: 'only-the-entry-imports-the-shell',
      severity: 'error',
      comment: 'The shell is the composition root of the frontend.',
      from: { pathNot: '^src/(index\\.tsx$|frontend/shell/)' },
      to: { path: '^src/frontend/shell/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    exclude: {
      path: 'node_modules|^dist/|^coverage/',
    },
  },
};

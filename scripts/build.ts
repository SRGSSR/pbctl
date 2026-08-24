import { $ } from 'bun';

const entry = 'src/index.tsx';

const targets = [
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-darwin-x64',
  'bun-darwin-arm64',
] as const;

for (const target of targets) {
  const suffix = target.replace('bun-', '');
  await $`bun build ${entry} --compile --target=${target} --outfile dist/pbctl-${suffix}`;
}

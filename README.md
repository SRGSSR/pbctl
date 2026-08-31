# pbctl

[![Pillarbox logo](docs/README-images/logo.jpg)](https://github.com/srgssr/pbctl)

[![Quality](https://github.com/srgssr/pbctl/actions/workflows/quality.yml/badge.svg)](https://github.com/srgssr/pbctl/actions/workflows/quality.yml)
[![npm version](https://img.shields.io/npm/v/%40srgssr%2Fpbctl)](https://www.npmjs.com/package/@srgssr/pbctl)
[![node](https://img.shields.io/node/v/%40srgssr%2Fpbctl)](https://nodejs.org)
[![license: MIT](https://img.shields.io/npm/l/%40srgssr%2Fpbctl)](./LICENSE)

pbctl is an interactive terminal interface, built with [Ink](https://github.com/vadimdemedes/ink)
and [inkstand](https://github.com/jboix/inkstand), for the
[pillarbox-demo-backend](https://github.com/SRGSSR/pillarbox-demo-backend) REST API. It targets
the protected Management API (media, folders, teams, users) and the public Player API.

## Quick start

Install with npm (Node 20 or later):

```bash
npm install -g @srgssr/pbctl
```

Or run it once without installing:

```bash
npx @srgssr/pbctl
```

Standalone binaries are also available. The installation script keeps versions side by side and
points a `current` symlink at the active one; run it again to update, or with `-v <version>` to pin
or roll back:

```bash
mkdir -p ~/.pbctl && cd ~/.pbctl
wget https://raw.githubusercontent.com/srgssr/pbctl/main/install-pbctl.sh
chmod +x install-pbctl.sh
./install-pbctl.sh
export PATH="$HOME/.pbctl/current:$PATH"
```

Then start with:

```bash
pbctl
```

On first start, create a profile pointing at your backend and identity provider. See the
[authentication guide](docs/authentication.md) for troubleshooting this step.

## Contributing

See the [contributing guide](docs/CONTRIBUTING.md). Participation is governed by the
[Code of Conduct](docs/CODE_OF_CONDUCT.md). To report a vulnerability, see the
[security policy](docs/SECURITY.md).

## License

MIT, see [LICENSE](LICENSE).

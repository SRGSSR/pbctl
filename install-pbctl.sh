#!/usr/bin/env bash
set -euo pipefail

REPO="srgssr/pbctl"
BINARY="pbctl"

usage() {
  echo ""
  echo "Installs the ${BINARY} binary from GitHub releases."
  echo ""
  echo "The binary is installed in a versioned folder next to this script."
  echo "The 'current' symlink is updated to point to the installed version."
  echo ""
  echo "Options:"
  echo "  -v <version>   The version to install (e.g., 1.2.3). Defaults to the latest release."
  echo ""
  echo "Example:"
  echo "  $0 -v 1.2.3"
  echo ""
  exit 1
}

VERSION=""
while getopts "v:h" opt; do
  case ${opt} in
    v ) VERSION=$OPTARG ;;
    * ) usage ;;
  esac
done

# Resolve the latest version from the GitHub release redirect when -v is not given.
if [ -z "$VERSION" ]; then
  LATEST_URL=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/${REPO}/releases/latest")
  VERSION="${LATEST_URL##*/v}"
  if [ -z "$VERSION" ] || [ "$VERSION" = "$LATEST_URL" ]; then
    echo "Could not resolve the latest version. Pass one explicitly with -v."
    exit 1
  fi
  echo "Latest version: ${VERSION}"
fi

# Map the platform to a release asset name.
case "$(uname -s)" in
  Linux  ) OS="linux" ;;
  Darwin ) OS="darwin" ;;
  *      ) echo "Unsupported OS: $(uname -s). On Windows, use: npm install -g @srgssr/pbctl"; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64          ) ARCH="x64" ;;
  aarch64 | arm64 ) ARCH="arm64" ;;
  *               ) echo "Unsupported architecture: $(uname -m)"; exit 1 ;;
esac

ASSET="${BINARY}-${OS}-${ARCH}"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${ASSET}"

INSTALL_BASE="$(cd "$(dirname "$0")" && pwd)"
VERSION_DIR="${INSTALL_BASE}/${VERSION}"
CURRENT_SYMLINK="${INSTALL_BASE}/current"

echo "Installing ${BINARY} ${VERSION} (${OS}-${ARCH}) into ${VERSION_DIR}"

if [ -f "${VERSION_DIR}/${BINARY}" ]; then
  echo "Version ${VERSION} is already installed."
else
  TMP_FILE="$(mktemp)"
  trap 'rm -f "$TMP_FILE"' EXIT
  echo "Downloading ${DOWNLOAD_URL}"
  if ! curl -fSL -o "$TMP_FILE" "$DOWNLOAD_URL"; then
    echo "Download failed. Does v${VERSION} exist and does it ship ${ASSET}?"
    exit 1
  fi
  chmod +x "$TMP_FILE"
  mkdir -p "$VERSION_DIR"
  mv "$TMP_FILE" "${VERSION_DIR}/${BINARY}"
  trap - EXIT
fi

ln -sfn "$VERSION_DIR" "$CURRENT_SYMLINK"
echo "Symlink updated: ${CURRENT_SYMLINK} -> ${VERSION_DIR}"
echo "Install complete. ${BINARY} ${VERSION} is now active."
echo ""
echo "Add it to your PATH if you have not already:"
echo "  export PATH=\"${INSTALL_BASE}/current:\$PATH\""

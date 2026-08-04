#!/bin/bash
#
# Pika Mini-Game Build Script
#
# Builds the mini-game for Module Federation compatibility.
# Uses pika-minigame-sdk if installed, otherwise falls back to host repo.
#
# Usage:
#   ./scripts/pika-build.sh ios
#   ./scripts/pika-build.sh android
#

set -e

PLATFORM=${1:-ios}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME=$(node -e "console.log(require('./package.json').name || require('./app.json').name)" 2>/dev/null || basename "$PROJECT_DIR" | sed 's/-/_/g')
SCOPE=$(echo "$PROJECT_NAME" | sed 's/-/_/g' | tr '[:upper:]' '[:lower:]')

echo "🎮 Pika Mini-Game Builder"
echo "========================="
echo "Project: ${PROJECT_NAME} (scope: ${SCOPE})"
echo "Platform: ${PLATFORM}"
echo ""

# Method 1: Check for pika-minigame-sdk (preferred)
SDK_PATH="${PROJECT_DIR}/node_modules/pika-minigame-sdk"
if [ -d "$SDK_PATH" ]; then
    echo "📦 Using pika-minigame-sdk"

    # Set public path if MF_PUBLIC_PATH is set
    PUBLIC_PATH_ARG=""
    if [ -n "$MF_PUBLIC_PATH" ]; then
        PUBLIC_PATH_ARG="--public-path $MF_PUBLIC_PATH"
    fi

    npx pika-build ${PLATFORM} ${PUBLIC_PATH_ARG}

    # Copy assets to serve folder
    echo "📁 Copying assets..."
    if [ -d "${PROJECT_DIR}/src/assets" ]; then
        mkdir -p "${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes"
        cp -r "${PROJECT_DIR}/src/assets" "${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes/"
    fi

    # Merge remote-assets/assets/* into assets/*. Re.Pack's remote asset
    # loader (rspack.config.mjs: getAssetTransformRules({remote:{...}}))
    # EMITS image files under remote-assets/assets/<path>, but the runtime
    # URL it generates for <Image source={require(...)}/> omits the
    # "remote-assets/" prefix (that prefix is only understood by Re.Pack's
    # own dev server, not a plain static file server like `npx serve`).
    # Copying the files here makes the plain-static-server URL resolve.
    REMOTE_ASSETS_DIR="${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes/remote-assets/assets"
    if [ -d "$REMOTE_ASSETS_DIR" ]; then
        cp -r "$REMOTE_ASSETS_DIR/." "${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes/assets/"
    fi

    exit 0
fi

# Method 2: Fall back to Pika host repo
PIKA_HOST_DIR="${PIKA_HOST_DIR:-$HOME/robotapp}"

echo "📁 Using host repo: ${PIKA_HOST_DIR}"

# Verify host directory exists
if [ ! -d "${PIKA_HOST_DIR}/node_modules/@callstack/repack" ]; then
    echo ""
    echo "❌ Error: Build environment not found"
    echo ""
    echo "Please install pika-minigame-sdk:"
    echo "  npm install pika-minigame-sdk --save-dev"
    echo ""
    echo "Or set PIKA_HOST_DIR to your robotapp location:"
    echo "  export PIKA_HOST_DIR=/path/to/robotapp"
    echo "  ./scripts/pika-build.sh ios"
    exit 1
fi

# Create workspace in host's mini-games folder (temporarily)
WORKSPACE_DIR="${PIKA_HOST_DIR}/mini-games/_build_${PROJECT_NAME}"

echo "📁 Setting up build workspace..."
rm -rf "${WORKSPACE_DIR}"
mkdir -p "${WORKSPACE_DIR}"

# Copy source files
cp -r "${PROJECT_DIR}/src" "${WORKSPACE_DIR}/"
cp "${PROJECT_DIR}/index.js" "${WORKSPACE_DIR}/"
cp "${PROJECT_DIR}/app.json" "${WORKSPACE_DIR}/"
cp "${PROJECT_DIR}/babel.config.js" "${WORKSPACE_DIR}/"
cp "${PROJECT_DIR}/rspack.config.mjs" "${WORKSPACE_DIR}/"
cp "${PROJECT_DIR}/tsconfig.json" "${WORKSPACE_DIR}/" 2>/dev/null || true

# Create react-native.config.js
cat > "${WORKSPACE_DIR}/react-native.config.js" << 'EOF'
module.exports = {
  commands: require('@callstack/repack/commands/rspack'),
};
EOF

# Create package.json with peerDependencies
cat > "${WORKSPACE_DIR}/package.json" << EOF
{
  "name": "${PROJECT_NAME}",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build:ios": "npx react-native webpack-bundle --platform ios --entry-file index.js --dev false",
    "build:android": "npx react-native webpack-bundle --platform android --entry-file index.js --dev false"
  },
  "peerDependencies": {
    "react": "18.3.1",
    "react-native": "0.77.0"
  }
}
EOF

echo "🔨 Building for ${PLATFORM}..."

cd "${WORKSPACE_DIR}"

# Set public path if MF_PUBLIC_PATH is set
if [ -n "$MF_PUBLIC_PATH" ]; then
    export MF_PUBLIC_PATH
fi

npm run build:${PLATFORM}

echo "📁 Copying build output..."
mkdir -p "${PROJECT_DIR}/build/outputs/${PLATFORM}"
cp -r "${WORKSPACE_DIR}/build/outputs/${PLATFORM}/remotes" "${PROJECT_DIR}/build/outputs/${PLATFORM}/"

# Copy assets (sounds, images) to serve folder
echo "📁 Copying assets..."
if [ -d "${PROJECT_DIR}/src/assets" ]; then
    cp -r "${PROJECT_DIR}/src/assets" "${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes/"
fi

# Merge remote-assets/assets/* into assets/*. Re.Pack's remote asset loader
# (rspack.config.mjs: getAssetTransformRules({remote:{...}})) EMITS image
# files under remote-assets/assets/<path>, but the runtime URL it generates
# for <Image source={require(...)}/> omits the "remote-assets/" prefix
# (that prefix is only understood by Re.Pack's own dev server, not a plain
# static file server like `npx serve`). Copying the files here makes the
# plain-static-server URL resolve.
REMOTE_ASSETS_DIR="${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes/remote-assets/assets"
if [ -d "$REMOTE_ASSETS_DIR" ]; then
    cp -r "$REMOTE_ASSETS_DIR/." "${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes/assets/"
fi

# Cleanup workspace
rm -rf "${WORKSPACE_DIR}"

echo ""
echo "✅ Build successful!"
echo ""
echo "Output: ${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes/"
echo ""
echo "Container size:"
ls -lh "${PROJECT_DIR}/build/outputs/${PLATFORM}/remotes/"*container*.bundle 2>/dev/null || echo "  (no container found)"
echo ""
echo "To test locally:"
echo "  npx serve build/outputs/${PLATFORM}/remotes -l 9000 --cors"

#!/bin/bash
set -e

# =============================================================================
# Deploy Pika Mini-Game to Vercel
# =============================================================================
#
# Usage:
#   ./scripts/deploy-vercel.sh [--prod]
#
# First deploy creates a new Vercel project and saves the production URL.
# Subsequent deploys use the saved URL automatically.
#
# To reset and create a new Vercel project:
#   rm -rf .vercel .vercel-prod-url && ./scripts/deploy-vercel.sh --prod
#
# Prerequisites:
#   - Vercel CLI: npm i -g vercel
#   - Logged in: vercel login
#
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    log_error "Vercel CLI not found. Install with: npm i -g vercel"
    exit 1
fi

# Parse arguments
PROD_FLAG=""
PROD_URL_FILE=".vercel-prod-url"

if [[ "$1" == "--prod" ]]; then
    PROD_FLAG="--prod"
    log_info "Deploying to PRODUCTION"

    # Check for saved production URL (project-local)
    if [[ -f "$PROD_URL_FILE" ]]; then
        SAVED_PROD_URL=$(cat "$PROD_URL_FILE" | tr -d '[:space:]')
        if [[ -n "$SAVED_PROD_URL" ]]; then
            log_info "Using saved production URL: $SAVED_PROD_URL"
            VERCEL_PROD_URL="$SAVED_PROD_URL"
        fi
    fi

    if [[ -z "$VERCEL_PROD_URL" ]]; then
        log_info "No saved production URL found. Will detect after first deploy."
    fi
else
    log_info "Deploying to PREVIEW (add --prod for production)"
fi

# Get project info from package.json
PROJECT_NAME=$(node -p "require('./package.json').name")
PROJECT_VERSION=$(node -p "require('./package.json').version")

# Determine Vercel project name:
# 1. If saved prod URL exists, extract project name from it (e.g., test-game-3.vercel.app -> test-game-3)
# 2. Otherwise, normalize package.json name for Vercel
if [[ -n "$VERCEL_PROD_URL" ]]; then
    VERCEL_PROJECT_NAME=$(echo "$VERCEL_PROD_URL" | sed -E 's|https://([^.]+)\.vercel\.app.*|\1|')
    log_info "Using existing Vercel project: $VERCEL_PROJECT_NAME"
else
    # Normalize project name for Vercel (lowercase, valid chars only)
    VERCEL_PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-' | sed 's/^-//;s/-$//')
fi

log_info "Project: $PROJECT_NAME v$PROJECT_VERSION"
log_info "Vercel project: $VERCEL_PROJECT_NAME"

# =============================================================================
# Step 1: Build for all platforms using pika-build.sh
# =============================================================================
log_info "Building mini-game bundles..."

# Create build output directory
BUILD_DIR="build/deploy"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/ios" "$BUILD_DIR/android"

# Use pika-build.sh which builds in host's workspace for MF compatibility
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Determine production URL for publicPath
# IMPORTANT: publicPath must be baked into the container at build time
PROD_URL_BASE="${VERCEL_PROD_URL:-https://${VERCEL_PROJECT_NAME}.vercel.app}"
log_info "Production URL base: $PROD_URL_BASE"

log_info "Building iOS bundle..."
log_info "  publicPath: ${PROD_URL_BASE}/ios/"
MF_PUBLIC_PATH="${PROD_URL_BASE}/ios/" "$SCRIPT_DIR/pika-build.sh" ios 2>&1 | tail -10

log_info "Building Android bundle..."
log_info "  publicPath: ${PROD_URL_BASE}/android/"
MF_PUBLIC_PATH="${PROD_URL_BASE}/android/" "$SCRIPT_DIR/pika-build.sh" android 2>&1 | tail -10

# Copy to deploy directory with platform subdirs
cp -r build/outputs/ios/remotes/* "$BUILD_DIR/ios/"
cp -r build/outputs/android/remotes/* "$BUILD_DIR/android/"

# Create index.html for Vercel (shows deployment info)
cat > "$BUILD_DIR/index.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>${PROJECT_NAME} - Pika Mini-Game</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        h1 { color: #0B0B0B; }
        code { background: #f4f4f4; padding: 2px 8px; border-radius: 4px; }
        .platform { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
        .platform h3 { margin-top: 0; }
        a { color: #46C4D7; }
    </style>
</head>
<body>
    <h1>🎮 ${PROJECT_NAME}</h1>
    <p>Version: <code>${PROJECT_VERSION}</code></p>
    <p>Deployed: <code>$(date -u +"%Y-%m-%d %H:%M:%S UTC")</code></p>

    <div class="platform">
        <h3>📱 iOS</h3>
        <p>Container: <a href="./ios/${PROJECT_NAME//-/_}.container.js.bundle">ios/${PROJECT_NAME//-/_}.container.js.bundle</a></p>
        <p>Manifest: <a href="./ios/mf-manifest.json">ios/mf-manifest.json</a></p>
    </div>

    <div class="platform">
        <h3>🤖 Android</h3>
        <p>Container: <a href="./android/${PROJECT_NAME//-/_}.container.js.bundle">android/${PROJECT_NAME//-/_}.container.js.bundle</a></p>
        <p>Manifest: <a href="./android/mf-manifest.json">android/mf-manifest.json</a></p>
    </div>

    <h2>Integration</h2>
    <p>Register this game with your backend:</p>
    <pre><code>{
  "scope": "${PROJECT_NAME//-/_}",
  "module": "./App",
  "container_url": "[VERCEL_URL]/ios/mf-manifest.json",
  "version": "${PROJECT_VERSION}"
}</code></pre>
</body>
</html>
EOF

# Create vercel.json with project name and proper headers
# Using project name ensures each game gets its own Vercel project
# Content-Type headers ensure ScriptManager can load bundles correctly
cat > "$BUILD_DIR/vercel.json" << EOF
{
  "name": "${PROJECT_NAME}",
  "headers": [
    {
      "source": "/(.*).bundle",
      "headers": [
        { "key": "Content-Type", "value": "application/javascript" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, OPTIONS" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*).json",
      "headers": [
        { "key": "Content-Type", "value": "application/json" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, OPTIONS" }
      ]
    }
  ]
}
EOF

log_success "Build complete: $BUILD_DIR"

# =============================================================================
# Step 2: Deploy to Vercel
# =============================================================================
log_info "Deploying to Vercel..."

# Get Vercel scope from environment or try to detect
VERCEL_SCOPE="${VERCEL_SCOPE:-}"
if [[ -z "$VERCEL_SCOPE" ]]; then
    # Try to get scope from existing .vercel/project.json
    if [[ -f ".vercel/project.json" ]]; then
        VERCEL_SCOPE=$(node -e "console.log(require('./.vercel/project.json').orgId || '')" 2>/dev/null || echo "")
    fi
    # If still no scope, search in parent directories
    if [[ -z "$VERCEL_SCOPE" ]]; then
        SEARCH_DIR=$(dirname "$PWD")
        while [[ "$SEARCH_DIR" != "/" && -z "$VERCEL_SCOPE" ]]; do
            for proj in "$SEARCH_DIR"/*/.vercel/project.json; do
                if [[ -f "$proj" ]]; then
                    VERCEL_SCOPE=$(node -e "console.log(require('$proj').orgId || '')" 2>/dev/null || echo "")
                    if [[ -n "$VERCEL_SCOPE" ]]; then
                        log_info "Found Vercel orgId from: $proj"
                        break
                    fi
                fi
            done
            SEARCH_DIR=$(dirname "$SEARCH_DIR")
        done
    fi
fi

SCOPE_FLAG=""
if [[ -n "$VERCEL_SCOPE" ]]; then
    SCOPE_FLAG="--scope $VERCEL_SCOPE"
    log_info "Using Vercel scope: $VERCEL_SCOPE"
fi

# First deploy to get the project linked and get a URL
log_info "Initial deployment..."
DEPLOY_OUTPUT=$(vercel "$BUILD_DIR" $PROD_FLAG $SCOPE_FLAG --name "$VERCEL_PROJECT_NAME" --yes 2>&1)

# Extract URL more carefully - look for vercel.app deployment URLs
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9._-]+\.vercel\.app' | head -1)

if [[ -z "$DEPLOY_URL" ]]; then
    log_error "Failed to get deployment URL"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

# For production, use VERCEL_PROD_URL if set, otherwise try to auto-detect
if [[ "$PROD_FLAG" == "--prod" ]]; then
    if [[ -n "$VERCEL_PROD_URL" ]]; then
        # Use the saved/provided production URL
        DEPLOY_URL="$VERCEL_PROD_URL"
        log_info "Using production URL: $DEPLOY_URL"
    else
        log_info "Detecting production alias from Vercel..."

        # Try to get alias from the deployed URL
        PROD_DOMAIN=$(vercel inspect "$DEPLOY_URL" --json 2>/dev/null | node -e "
            const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
            const alias = data.alias || data.aliases || [];
            const prod = Array.isArray(alias) ? alias[0] : alias;
            if (prod) console.log(prod);
        " 2>/dev/null || echo "")

        if [[ -n "$PROD_DOMAIN" ]]; then
            PROD_DOMAIN=$(echo "$PROD_DOMAIN" | sed 's|^https://||')
            DEPLOY_URL="https://$PROD_DOMAIN"
            log_info "Detected production alias: $DEPLOY_URL"
        else
            # Use the deployment URL as-is (first deploy)
            log_info "Using deployment URL as production URL: $DEPLOY_URL"
        fi

        # Save for future deploys
        echo "$DEPLOY_URL" > "$PROD_URL_FILE"
        log_success "Saved production URL to $PROD_URL_FILE"
    fi
fi

log_info "Deployment URL: $DEPLOY_URL"

# =============================================================================
# Step 3: Update mf-manifest.json with correct publicPath and redeploy
# =============================================================================
log_info "Updating publicPath in manifests..."

# Update iOS manifest
if [[ -f "$BUILD_DIR/ios/mf-manifest.json" ]]; then
    node -e "
    const fs = require('fs');
    const manifest = JSON.parse(fs.readFileSync('$BUILD_DIR/ios/mf-manifest.json', 'utf8'));
    manifest.metaData.publicPath = '$DEPLOY_URL/ios/';
    fs.writeFileSync('$BUILD_DIR/ios/mf-manifest.json', JSON.stringify(manifest, null, 2));
    console.log('Updated iOS publicPath to: $DEPLOY_URL/ios/');
    "
fi

# Update Android manifest
if [[ -f "$BUILD_DIR/android/mf-manifest.json" ]]; then
    node -e "
    const fs = require('fs');
    const manifest = JSON.parse(fs.readFileSync('$BUILD_DIR/android/mf-manifest.json', 'utf8'));
    manifest.metaData.publicPath = '$DEPLOY_URL/android/';
    fs.writeFileSync('$BUILD_DIR/android/mf-manifest.json', JSON.stringify(manifest, null, 2));
    console.log('Updated Android publicPath to: $DEPLOY_URL/android/');
    "
fi

# Redeploy with updated manifests
log_info "Redeploying with updated manifests..."
FINAL_OUTPUT=$(vercel "$BUILD_DIR" $PROD_FLAG $SCOPE_FLAG --name "$VERCEL_PROJECT_NAME" --yes 2>&1)
FINAL_URL=$(echo "$FINAL_OUTPUT" | grep -oE 'https://[a-zA-Z0-9._-]+\.vercel\.app' | head -1)

if [[ -n "$FINAL_URL" ]]; then
    DEPLOY_URL="$FINAL_URL"
fi

log_success "Deployed to: $DEPLOY_URL"

# =============================================================================
# Step 4: Show integration info
# =============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=============================================="
echo ""
echo -e "URL: ${CYAN}$DEPLOY_URL${NC}"
echo ""
echo "iOS manifest:     $DEPLOY_URL/ios/mf-manifest.json"
echo "Android manifest: $DEPLOY_URL/android/mf-manifest.json"
echo ""
echo "Register with backend API:"
echo ""
cat << EOF
{
  "id": "${PROJECT_NAME}",
  "name": "${PROJECT_NAME}",
  "scope": "${PROJECT_NAME//-/_}",
  "module": "./App",
  "container_url": "$DEPLOY_URL/ios/mf-manifest.json",
  "version": "${PROJECT_VERSION}",
  "min_host_version": "1.0.0"
}
EOF
echo ""

# Save deployment info
cat > "deploy-info.json" << EOF
{
  "url": "$DEPLOY_URL",
  "project": "$PROJECT_NAME",
  "version": "$PROJECT_VERSION",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "ios_manifest": "$DEPLOY_URL/ios/mf-manifest.json",
  "android_manifest": "$DEPLOY_URL/android/mf-manifest.json"
}
EOF

log_success "Deployment info saved to deploy-info.json"

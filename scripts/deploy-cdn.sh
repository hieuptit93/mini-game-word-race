#!/bin/bash
set -e

# =============================================================================
# Deploy Pika Mini-Game to Custom CDN
# =============================================================================
#
# Game name is AUTO-APPENDED to CDN URL and target path.
# Example: game "word-blaster" → cdn.example.com/games/word-blaster/
#
# Quick Start:
#   1. Create .env.cdn with your CDN config (one-time setup)
#   2. Run: ./scripts/deploy-cdn.sh
#
# Usage:
#   ./scripts/deploy-cdn.sh [options]
#
# Options:
#   --cdn-base <url>      CDN base URL (game name auto-appended)
#   --target-base <path>  Target base path (game name auto-appended)
#   --upload <method>     Upload method: rsync, scp, s3 (default: rsync)
#   --dry-run             Show what would be uploaded
#   --skip-build          Use existing build output
#
# Config file (.env.cdn):
#   CDN_BASE_URL=https://cdn.pikarobot.com/games
#   CDN_TARGET_BASE=user@cdn.pikarobot.com:/var/www/cdn/games
#   CDN_UPLOAD=rsync
#
# Examples:
#   # With config file (recommended)
#   ./scripts/deploy-cdn.sh
#
#   # Override with CLI args
#   ./scripts/deploy-cdn.sh --cdn-base https://cdn.example.com/games
#
#   # S3
#   ./scripts/deploy-cdn.sh \
#     --cdn-base https://d123.cloudfront.net/games \
#     --target-base s3://my-bucket/games \
#     --upload s3
#
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Load .env.cdn if exists
if [[ -f ".env.cdn" ]]; then
    log_info "Loading config from .env.cdn"
    set -a
    source .env.cdn
    set +a
fi

# Default values from environment
CDN_BASE="${CDN_BASE_URL:-}"
TARGET_BASE="${CDN_TARGET_BASE:-}"
UPLOAD_METHOD="${CDN_UPLOAD:-rsync}"
DRY_RUN=false
SKIP_BUILD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --cdn-base)
            CDN_BASE="$2"
            shift 2
            ;;
        --target-base)
            TARGET_BASE="$2"
            shift 2
            ;;
        --upload)
            UPLOAD_METHOD="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -h|--help)
            head -45 "$0" | tail -40
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Get project info
PROJECT_NAME=$(node -p "require('./package.json').name")
PROJECT_VERSION=$(node -p "require('./package.json').version")
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Normalize project name for URL (lowercase, replace _ with -)
GAME_SLUG=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr '_' '-')

# Validate required config
if [[ -z "$CDN_BASE" ]]; then
    log_error "CDN base URL not configured"
    echo ""
    echo "Create .env.cdn file with:"
    echo "  CDN_BASE_URL=https://cdn.pikarobot.com/games"
    echo "  CDN_TARGET_BASE=user@server:/var/www/cdn/games"
    echo "  CDN_UPLOAD=rsync"
    echo ""
    echo "Or use --cdn-base option"
    exit 1
fi

if [[ -z "$TARGET_BASE" ]]; then
    log_error "Target base path not configured"
    echo ""
    echo "Add to .env.cdn:"
    echo "  CDN_TARGET_BASE=user@server:/var/www/cdn/games"
    echo ""
    echo "Or use --target-base option"
    exit 1
fi

# Remove trailing slashes
CDN_BASE="${CDN_BASE%/}"
TARGET_BASE="${TARGET_BASE%/}"

# Auto-generate full URLs with game name
CDN_URL="${CDN_BASE}/${GAME_SLUG}"
TARGET="${TARGET_BASE}/${GAME_SLUG}"

echo ""
echo -e "${BOLD}🚀 Pika Mini-Game CDN Deploy${NC}"
echo "=============================================="
echo "Project:       $PROJECT_NAME v$PROJECT_VERSION"
echo "Game Slug:     $GAME_SLUG"
echo "CDN URL:       $CDN_URL"
echo "Upload Method: $UPLOAD_METHOD"
echo "Target:        $TARGET"
echo "=============================================="
echo ""

# =============================================================================
# Step 1: Build bundles
# =============================================================================
BUILD_DIR="build/deploy"

if [[ "$SKIP_BUILD" == true ]]; then
    log_info "Skipping build (--skip-build)"

    if [[ ! -d "$BUILD_DIR/ios" ]] || [[ ! -d "$BUILD_DIR/android" ]]; then
        log_error "No existing build found. Remove --skip-build to build first."
        exit 1
    fi
else
    log_info "Building mini-game bundles..."

    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR/ios" "$BUILD_DIR/android"

    # Build iOS with CDN publicPath
    log_info "Building iOS bundle..."
    log_info "  publicPath: ${CDN_URL}/ios/"
    MF_PUBLIC_PATH="${CDN_URL}/ios/" "$SCRIPT_DIR/pika-build.sh" ios 2>&1 | tail -10

    # Build Android with CDN publicPath
    log_info "Building Android bundle..."
    log_info "  publicPath: ${CDN_URL}/android/"
    MF_PUBLIC_PATH="${CDN_URL}/android/" "$SCRIPT_DIR/pika-build.sh" android 2>&1 | tail -10

    # Copy to deploy directory
    cp -r build/outputs/ios/remotes/* "$BUILD_DIR/ios/"
    cp -r build/outputs/android/remotes/* "$BUILD_DIR/android/"

    log_success "Build complete"
fi

# =============================================================================
# Step 2: Verify mf-manifest.json publicPath
# =============================================================================
log_info "Verifying manifest publicPath..."

for platform in ios android; do
    manifest="$BUILD_DIR/$platform/mf-manifest.json"
    if [[ -f "$manifest" ]]; then
        current_path=$(node -e "console.log(require('$manifest').metaData.publicPath)")
        expected_path="${CDN_URL}/${platform}/"

        if [[ "$current_path" != "$expected_path" ]]; then
            log_warn "Updating $platform publicPath: $current_path -> $expected_path"
            node -e "
            const fs = require('fs');
            const m = JSON.parse(fs.readFileSync('$manifest', 'utf8'));
            m.metaData.publicPath = '$expected_path';
            fs.writeFileSync('$manifest', JSON.stringify(m, null, 2));
            "
        else
            log_info "$platform publicPath OK: $expected_path"
        fi
    fi
done

# =============================================================================
# Step 3: Create deployment info files
# =============================================================================
log_info "Creating deployment metadata..."

# Create index.html
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
        pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>🎮 ${PROJECT_NAME}</h1>
    <p>Version: <code>${PROJECT_VERSION}</code></p>
    <p>Deployed: <code>$(date -u +"%Y-%m-%d %H:%M:%S UTC")</code></p>
    <p>CDN: <code>${CDN_URL}</code></p>

    <div class="platform">
        <h3>📱 iOS</h3>
        <p>Manifest: <a href="./ios/mf-manifest.json">ios/mf-manifest.json</a></p>
    </div>

    <div class="platform">
        <h3>🤖 Android</h3>
        <p>Manifest: <a href="./android/mf-manifest.json">android/mf-manifest.json</a></p>
    </div>

    <h2>Integration</h2>
    <pre>{
  "id": "${GAME_SLUG}",
  "scope": "${PROJECT_NAME//-/_}",
  "module": "./App",
  "container_url": "${CDN_URL}/{platform}/mf-manifest.json",
  "version": "${PROJECT_VERSION}"
}</pre>
</body>
</html>
EOF

# Create deploy-info.json
cat > "$BUILD_DIR/deploy-info.json" << EOF
{
  "project": "$PROJECT_NAME",
  "slug": "$GAME_SLUG",
  "version": "$PROJECT_VERSION",
  "cdn_url": "$CDN_URL",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "ios_manifest": "$CDN_URL/ios/mf-manifest.json",
  "android_manifest": "$CDN_URL/android/mf-manifest.json"
}
EOF

# =============================================================================
# Step 4: Upload to CDN
# =============================================================================
echo ""
log_info "Uploading to CDN..."

# Show what will be uploaded
TOTAL_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
FILE_COUNT=$(find "$BUILD_DIR" -type f | wc -l | tr -d ' ')
log_info "Total size: $TOTAL_SIZE ($FILE_COUNT files)"

if [[ "$DRY_RUN" == true ]]; then
    log_warn "DRY RUN - showing what would be uploaded:"
    find "$BUILD_DIR" -type f | while read f; do
        echo "  ${f#$BUILD_DIR/}"
    done
    echo ""
    log_info "Target: $TARGET"
    log_info "Use without --dry-run to actually upload"
    exit 0
fi

case "$UPLOAD_METHOD" in
    rsync)
        log_info "Using rsync..."

        # Extract host and path for rsync
        if [[ "$TARGET" == *":"* ]]; then
            # Remote target (user@host:/path)
            RSYNC_HOST=$(echo "$TARGET" | cut -d: -f1)
            RSYNC_PATH=$(echo "$TARGET" | cut -d: -f2)

            # Create remote directory first
            ssh "$RSYNC_HOST" "mkdir -p $RSYNC_PATH"
        fi

        rsync -avz --delete \
            --exclude '.DS_Store' \
            --exclude '*.map' \
            "$BUILD_DIR/" "$TARGET/"
        ;;

    scp)
        log_info "Using scp..."
        SCP_HOST=$(echo "$TARGET" | cut -d: -f1)
        SCP_PATH=$(echo "$TARGET" | cut -d: -f2)

        # Create remote directory
        ssh "$SCP_HOST" "mkdir -p $SCP_PATH"

        # Upload recursively
        scp -r "$BUILD_DIR/"* "$TARGET/"
        ;;

    s3)
        log_info "Using AWS S3..."

        if ! command -v aws &> /dev/null; then
            log_error "AWS CLI not found. Install with: pip install awscli"
            exit 1
        fi

        # Upload bundles with JS content type
        aws s3 sync "$BUILD_DIR/" "$TARGET/" \
            --delete \
            --exclude "*.map" \
            --exclude "*.json" \
            --exclude "*.html" \
            --cache-control "public, max-age=31536000, immutable" \
            --content-type "application/javascript"

        # Upload JSON with no-cache
        aws s3 sync "$BUILD_DIR/" "$TARGET/" \
            --exclude "*" --include "*.json" \
            --cache-control "no-cache" \
            --content-type "application/json"

        # Upload HTML
        aws s3 sync "$BUILD_DIR/" "$TARGET/" \
            --exclude "*" --include "*.html" \
            --content-type "text/html"
        ;;

    custom)
        log_info "Using custom upload command..."

        if [[ -z "$UPLOAD_COMMAND" ]]; then
            log_error "UPLOAD_COMMAND environment variable not set"
            log_info "Example: UPLOAD_COMMAND='rclone copy \$SRC \$DEST'"
            exit 1
        fi

        CMD="${UPLOAD_COMMAND//\$SRC/$BUILD_DIR}"
        CMD="${CMD//\$DEST/$TARGET}"

        log_info "Running: $CMD"
        eval "$CMD"
        ;;

    *)
        log_error "Unknown upload method: $UPLOAD_METHOD"
        log_info "Supported methods: rsync, scp, s3, custom"
        exit 1
        ;;
esac

log_success "Upload complete!"

# =============================================================================
# Step 5: Show results
# =============================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=============================================="
echo ""
echo -e "Game:   ${BOLD}${PROJECT_NAME}${NC}"
echo -e "Slug:   ${CYAN}${GAME_SLUG}${NC}"
echo -e "URL:    ${CYAN}${CDN_URL}${NC}"
echo ""
echo "iOS manifest:     $CDN_URL/ios/mf-manifest.json"
echo "Android manifest: $CDN_URL/android/mf-manifest.json"
echo ""
echo "Register with games.json:"
echo ""
cat << EOF
{
  "id": "${GAME_SLUG}",
  "name": "${PROJECT_NAME}",
  "scope": "${PROJECT_NAME//-/_}",
  "module": "./App",
  "container_url": "$CDN_URL/{platform}/mf-manifest.json",
  "version": "${PROJECT_VERSION}",
  "min_host_version": "1.0.0",
  "enabled": true
}
EOF
echo ""

# Save deployment info locally
cp "$BUILD_DIR/deploy-info.json" ./deploy-info.json
log_success "Deployment info saved to deploy-info.json"

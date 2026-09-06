#!/usr/bin/env bash
# Regenerates aRSS.xcodeproj from project.yml and pins SwiftPM dependencies to the checked-in
# ios/Package.resolved (the xcodeproj is gitignored, so the resolved file inside it isn't).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f Local.xcconfig ] || touch Local.xcconfig
xcodegen generate
SWIFTPM_DIR="aRSS.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
mkdir -p "$SWIFTPM_DIR"
if [ -f Package.resolved ]; then
  cp Package.resolved "$SWIFTPM_DIR/Package.resolved"
fi
xcodebuild -resolvePackageDependencies -project aRSS.xcodeproj -scheme aRSS -quiet
if [ ! -f Package.resolved ]; then
  cp "$SWIFTPM_DIR/Package.resolved" Package.resolved
  echo "Created ios/Package.resolved — commit it."
fi

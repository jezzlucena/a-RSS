#!/usr/bin/env bash
# After intentionally bumping a package in project.yml, copy the newly resolved versions back
# into the checked-in ios/Package.resolved.
set -euo pipefail
cd "$(dirname "$0")/.."
cp aRSS.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved Package.resolved
echo "Updated ios/Package.resolved"

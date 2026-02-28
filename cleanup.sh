#!/bin/bash

# Cleanup script for Mieweb Auth App after package refactoring
# This script helps identify and optionally remove duplicate files

echo "🧹 Mieweb Auth App Cleanup Script"
echo "=================================="

echo ""
echo "📁 Current structure analysis:"
echo "Original app files are preserved in their locations:"
echo "  - client/ (original client files)"
echo "  - server/ (original server files)" 
echo "  - utils/ (original utility files)"
echo ""
echo "Package files are organized in:"
echo "  - packages/mieweb-auth/ (packaged version)"
echo ""

# Check if package structure exists
if [ -d "packages/mieweb-auth" ]; then
    echo "✅ Package structure exists"
else
    echo "❌ Package structure not found"
    exit 1
fi

echo ""
echo "🔍 File comparison:"

# Check for potential duplicates
echo "Files that exist in both locations:"

# Check utils
if [ -f "utils/constants.js" ] && [ -f "packages/mieweb-auth/lib/constants.js" ]; then
    echo "  - utils/constants.js ↔ packages/mieweb-auth/lib/constants.js"
fi

if [ -f "utils/utils.js" ] && [ -f "packages/mieweb-auth/lib/utils.js" ]; then
    echo "  - utils/utils.js ↔ packages/mieweb-auth/lib/utils.js"
fi

# Check client styles
if [ -f "client/main.css" ] && [ -f "packages/mieweb-auth/client/styles.css" ]; then
    echo "  - client/main.css ↔ packages/mieweb-auth/client/styles.css"
fi

echo ""
echo "📊 Package status:"
if grep -q "mieweb:auth" .meteor/packages; then
    echo "✅ Package is added to .meteor/packages"
else
    echo "❌ Package is not added to .meteor/packages"
    echo "   Run: meteor add mieweb:auth"
fi

echo ""
echo "⚙️  Recommended actions:"
echo "1. Keep original files if you want to maintain the standalone app"
echo "2. Use the package (mieweb:auth) for new applications"
echo "3. See example-usage/ directory for integration examples"

echo ""
echo "🚀 To use the package in a new app:"
echo "1. meteor add mieweb:auth"
echo "2. Configure server: MiewebAuthServer.configure({...})"
echo "3. Initialize client: initializeMiewebAuth('react-target')"

echo ""
echo "📚 See packages/mieweb-auth/README.md for complete documentation"
echo ""
echo "Cleanup complete! Both original and packaged versions are available."

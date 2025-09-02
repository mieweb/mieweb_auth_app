#!/bin/bash

# Mobile App Asset Generator
# Requires: ImageMagick installed
# Input: icon.png (your provided icon)

echo "🎨 Starting asset generation..."

# Check if app-icon-1024.png exists
if [ ! -f "app-icon-1024.png" ]; then
    echo "❌ Error: app-icon-1024.png not found!"
    echo "Please place your PNG icon file as 'app-icon-1024.png' in this directory"
    exit 1
fi

# Create required directories
mkdir -p resources

# Detect ImageMagick command
if command -v magick >/dev/null 2>&1; then
  IM="magick"
else
  IM="convert"
fi

echo "📱 Generating all required assets..."

# Generate all the assets you need based on your existing files
$IM icon.png -resize 72x72 resources/android_hdpi.icon.png
$IM icon.png -resize 48x48 resources/android_mdpi.icon.png
$IM icon.png -resize 96x96 resources/android_xhdpi.icon.png
$IM icon.png -resize 144x144 resources/android_xxhdpi.icon.png
$IM icon.png -resize 192x192 resources/android_xxxhdpi.icon.png

$IM icon.png -resize 152x152 resources/ipad_2x.icon.png
$IM icon.png -resize 144x144 resources/ipad_app_legacy_2x.icon.png
$IM icon.png -resize 72x72 resources/ipad_app_legacy.icon.png
$IM icon.png -resize 76x76 resources/ipad.icon.png
$IM icon.png -resize 167x167 resources/ipad_pro.icon.png

$IM icon.png -resize 120x120 resources/iphone_2x.icon.png
$IM icon.png -resize 180x180 resources/iphone_3x.icon.png

$IM icon.png -resize 40x40 resources/ios_notification_2x.icon.png
$IM icon.png -resize 60x60 resources/ios_notification_3x.icon.png
$IM icon.png -resize 20x20 resources/ios_notification.icon.png

$IM icon.png -resize 58x58 resources/ios_settings_2x.icon.png
$IM icon.png -resize 87x87 resources/ios_settings_3x.icon.png
$IM icon.png -resize 29x29 resources/ios_settings.icon.png

$IM icon.png -resize 80x80 resources/ios_spotlight_2x.icon.png
$IM icon.png -resize 120x120 resources/ios_spotlight_3x.icon.png
$IM icon.png -resize 40x40 resources/ios_spotlight.icon.png

echo "🖼️ Creating splash screens..."

# Brand colors - modify these for your app
BG_COLOR="#27AAE1"  # Your brand color

# Create splash screens with your icon centered
# iOS Universal splash screens
$IM -size 2208x2208 xc:"$BG_COLOR" \
  \( icon.png -resize 600x600 \) \
  -gravity center -composite \
  resources/Default@2x~universal~anyany.png

$IM -size 2732x2732 xc:"$BG_COLOR" \
  \( icon.png -resize 800x800 \) \
  -gravity center -composite \
  resources/android_universal.splash.png

echo "✅ Asset generation complete!"
echo ""
echo "📊 Generated files summary:"
echo "Icons: $(ls -1 resources/*.icon.png 2>/dev/null | wc -l) files"
echo "Splash: $(ls -1 resources/*.splash.png resources/Default*.png 2>/dev/null | wc -l) files"
echo ""
echo "📁 All assets are in the 'resources/' folder"
echo ""
echo "🔧 Next steps:"
echo "1. Update your mobile-config.js with the correct file paths"
echo "2. Change the brand color (#27AAE1) in this script if needed"
echo "3. Run your Meteor build process"
#!/usr/bin/env python3
"""
Generate all required app icons and splash screens from a single source PNG image.
This script creates all the sizes needed for Android and iOS platforms.

Usage:
    python generate_app_resources.py <source_image.png>
    
Example:
    python generate_app_resources.py icon.png
"""

import os
import sys
from PIL import Image, ImageDraw

# Icon sizes for different platforms (matching Cordova/Meteor conventions)
ICON_SIZES = {
    # iOS Main App Icons
    'app_store': (1024, 1024),
    'iphone_2x': (120, 120),
    'iphone_3x': (180, 180),
    'ipad': (76, 76),
    'ipad_2x': (152, 152),
    'ipad_pro': (167, 167),
    
    # iOS Settings Icons
    'ios_settings': (29, 29),
    'ios_settings_2x': (58, 58),
    'ios_settings_3x': (87, 87),
    
    # iOS Spotlight Icons
    'ios_spotlight': (40, 40),
    'ios_spotlight_2x': (80, 80),
    'ios_spotlight_3x': (120, 120),
    
    # iOS Notification Icons
    'ios_notification': (20, 20),
    'ios_notification_2x': (40, 40),
    'ios_notification_3x': (60, 60),
    
    # Legacy iOS Icons
    'iphone_legacy': (57, 57),
    'iphone_legacy_2x': (114, 114),
    'ipad_spotlight_legacy': (50, 50),
    'ipad_spotlight_legacy_2x': (100, 100),
    'ipad_app_legacy': (72, 72),
    'ipad_app_legacy_2x': (144, 144),
    
    # Android Icons
    'android_mdpi': (48, 48),
    'android_hdpi': (72, 72),
    'android_xhdpi': (96, 96),
    'android_xxhdpi': (144, 144),
    'android_xxxhdpi': (192, 192),
}

# Splash screen sizes (matching Cordova/Meteor conventions)
SPLASH_SIZES = {
    # iOS Splash Screens
    'Default@2x~universal~anyany': (2732, 2732),
    'Default@3x~universal~anyany': (2208, 2208),
    
    # Android Splash (using universal for adaptive icon)
    'android_universal': (2732, 2732),
}


def create_icon(source_image, output_path, size):
    """
    Create an icon from the source image at the specified size.
    Maintains aspect ratio and centers the image.
    """
    img = Image.open(source_image)
    
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Resize maintaining aspect ratio
    img.thumbnail(size, Image.Resampling.LANCZOS)
    
    # Create a new image with the exact size (with transparency)
    new_img = Image.new('RGBA', size, (0, 0, 0, 0))
    
    # Calculate position to center the image
    x = (size[0] - img.width) // 2
    y = (size[1] - img.height) // 2
    
    # Paste the resized image onto the new image
    new_img.paste(img, (x, y), img)
    
    # Save with optimization
    new_img.save(output_path, 'PNG', optimize=True)
    print(f"✓ Created: {os.path.basename(output_path)} ({size[0]}x{size[1]})")


def create_splash_screen(source_image, output_path, size):
    """
    Create a splash screen from the source image.
    Centers the icon on a white or transparent background.
    """
    img = Image.open(source_image)
    
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Create splash screen with white background
    splash = Image.new('RGBA', size, (255, 255, 255, 255))
    
    # Calculate icon size (about 40% of splash screen)
    icon_size = int(min(size) * 0.4)
    
    # Resize icon maintaining aspect ratio
    img.thumbnail((icon_size, icon_size), Image.Resampling.LANCZOS)
    
    # Calculate position to center the icon
    x = (size[0] - img.width) // 2
    y = (size[1] - img.height) // 2
    
    # Paste the icon onto the splash screen
    splash.paste(img, (x, y), img)
    
    # Save with optimization
    splash.save(output_path, 'PNG', optimize=True)
    print(f"✓ Created: {os.path.basename(output_path)} ({size[0]}x{size[1]})")


def generate_all_resources(source_image, output_dir='resources'):
    """
    Generate all required icons and splash screens from the source image.
    """
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")
    
    # Verify source image exists
    if not os.path.exists(source_image):
        print(f"Error: Source image '{source_image}' not found!")
        sys.exit(1)
    
    # Verify source image is a valid image
    try:
        img = Image.open(source_image)
        img.verify()
    except Exception as e:
        print(f"Error: Invalid image file - {e}")
        sys.exit(1)
    
    print(f"\nGenerating resources from: {source_image}")
    print(f"Output directory: {output_dir}\n")
    
    # Generate icons
    print("Generating Icons:")
    print("-" * 50)
    for name, size in ICON_SIZES.items():
        output_path = os.path.join(output_dir, f"{name}.icon.png")
        create_icon(source_image, output_path, size)
    
    # Generate splash screens
    print("\nGenerating Splash Screens:")
    print("-" * 50)
    for name, size in SPLASH_SIZES.items():
        # iOS splash screens don't have .splash suffix, Android does
        if name.startswith('Default@'):
            output_path = os.path.join(output_dir, f"{name}.png")
        else:
            output_path = os.path.join(output_dir, f"{name}.splash.png")
        create_splash_screen(source_image, output_path, size)
    
    print("\n" + "=" * 50)
    print(f"✓ Successfully generated {len(ICON_SIZES) + len(SPLASH_SIZES)} resource files!")
    print("=" * 50)
    
    # Copy source image to resources directory as well
    source_basename = os.path.basename(source_image)
    if source_basename != 'icon.png':
        import shutil
        icon_path = os.path.join(output_dir, 'icon.png')
        shutil.copy2(source_image, icon_path)
        print(f"\n✓ Copied source image to: {icon_path}")


def main():
    """Main function to run the script."""
    if len(sys.argv) < 2:
        print("Usage: python generate_app_resources.py <source_image.png>")
        print("\nExample:")
        print("  python generate_app_resources.py my_icon.png")
        print("  python generate_app_resources.py path/to/icon.png")
        sys.exit(1)
    
    source_image = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else 'resources'
    
    generate_all_resources(source_image, output_dir)


if __name__ == "__main__":
    main()

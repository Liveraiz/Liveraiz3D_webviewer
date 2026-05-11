#!/usr/bin/env python3
"""Convert SVG to ICO using PIL"""

from PIL import Image
import os
from pathlib import Path

try:
    # Check for wand (ImageMagick wrapper)
    from wand.image import Image as WandImage
    has_wand = True
except ImportError:
    has_wand = False

def svg_to_ico():
    project_dir = Path(__file__).parent
    svg_path = project_dir / "public" / "icon.svg"
    icon_dir = project_dir / "public" / "icon"
    ico_path = icon_dir / "app.ico"
    
    icon_dir.mkdir(parents=True, exist_ok=True)
    
    if not svg_path.exists():
        print(f"SVG file not found: {svg_path}")
        return False
    
    print("Converting SVG to ICO...")
    
    # If we have wand (ImageMagick), use it for best quality
    if has_wand:
        try:
            with WandImage(filename=str(svg_path), resolution=(300, 300)) as img:
                img.format = 'ico'
                img.resize(256, 256)
                img.save(filename=str(ico_path))
            print(f"✓ ICO file created at: {ico_path}")
            return True
        except Exception as e:
            print(f"Warning: Wand conversion failed: {e}")
            print("Trying alternative method...")
    
    # Fallback: Try using PIL with PNG intermediate
    try:
        # First convert SVG to PNG using a simple approach
        # For a better solution, we'd need cairosvg or similar
        print("Note: PIL alone cannot read SVG directly.")
        print("Using pre-generated PNG...")
        
        png_path = icon_dir / "app.png"
        if not png_path.exists():
            print(f"PNG file not found: {png_path}")
            print("Please run: node convert-icon.js")
            return False
        
        # Open PNG and create ICO
        img = Image.open(png_path)
        
        # Create multiple sizes for better quality
        sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
        
        img.save(ico_path, format='ICO', sizes=sizes)
        print(f"✓ ICO file created at: {ico_path}")
        return True
        
    except Exception as e:
        print(f"Error converting to ICO: {e}")
        return False

if __name__ == "__main__":
    success = svg_to_ico()
    exit(0 if success else 1)

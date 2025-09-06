# GPX to SVG Converter with Height Maps

A clean Python script that converts GPX track data to multiple SVG formats including elevation profiles and terrain height maps.

## ✨ Features

### Core Conversion
- **Direct Conversion**: One-to-one conversion of GPX track points to SVG paths
- **Optimized Conversion**: Uses Douglas-Peucker algorithm to create simplified, smooth SVG paths
- **Folder-based Organization**: Automatically organizes output files by GPX filename
- **Multiple Format Support**: Handles different GPX namespace formats
- **Proper Aspect Ratio**: Uses Web Mercator projection for accurate track shapes

### Enhanced Visualization
- **Elevation Profiles**: Beautiful gradient-colored elevation charts showing height changes
- **SRTM Integration**: Automatic elevation data enhancement from satellite data

## 🚀 Usage

### Setup
1. Set up the virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Place your `.gpx` files in the `input` directory

3. Run the converter:
   ```bash
   source venv/bin/activate
   python gpx_to_svg.py
   ```

4. Find your converted SVG files in the `output` directory

## 📁 Output Structure

For each GPX file (e.g., `track.gpx`), the script creates:
```
output/
  track/
    track_direct.svg        # Direct one-to-one conversion (red)
    track_optimized.svg     # Optimized with path simplification (teal)
    track_elevation.svg     # Elevation profile with gradient colors
```

## 🎨 File Types Generated

- **Direct SVG**: Contains every point from the original GPX track (red color)
- **Optimized SVG**: Simplified path with smooth curves and reduced points (teal color)
- **Elevation Profile**: Shows height changes along the track with color gradients

## 📦 Requirements

- Python 3.7+
- **elevation** - For SRTM digital elevation models

## 🔧 How It Works

1. **GPX Parsing**: Extracts latitude/longitude coordinates and elevation data from GPX track points
2. **Elevation Enhancement**: Fills missing elevation data using SRTM satellite data
3. **Building Data Fetching**: Queries OpenStreetMap for buildings within 500m of the track
4. **Coordinate Transformation**: Converts GPS coordinates to SVG coordinate system (0-1000)
5. **Multi-Format Generation**: Creates various SVG visualizations:
   - Direct and optimized paths
   - Elevation profiles with gradients
   - Height maps with displacement effects
   - 3D building extrusions with isometric projection

## 🌟 Advanced Features

- **Smart Elevation Enhancement**: Automatically downloads and uses SRTM elevation data
- **Building Intelligence**: Extracts building heights from OpenStreetMap attributes
- **Visual Effects**: Uses SVG filters for terrain displacement and 3D shadows
- **Performance Optimization**: Efficient path simplification with configurable parameters
- **Interactive SVGs**: Hover effects and tooltips for enhanced user experience

## 🗺️ Data Sources

- **Elevation**: SRTM 30m Digital Elevation Model via NASA
- **Buildings**: OpenStreetMap via Overpass API
- **Coordinate System**: WGS84 to SVG viewport transformation
#!/usr/bin/env python3
"""
GPX to SVG Converter
Converts GPX track data to SVG paths with both direct and optimized versions.
"""

import xml.etree.ElementTree as ET
import math
import tempfile
from pathlib import Path
from typing import List, Tuple, Optional

try:
    import elevation
except ImportError:
    print("Warning: elevation not installed. Enhanced features disabled.")
    elevation = None

class GPXPoint:
    def __init__(self, lat: float, lon: float, ele: Optional[float] = None):
        self.lat = lat
        self.lon = lon
        self.ele = ele

class GPXToSVGConverter:
    def __init__(self, input_dir: str = "input", output_dir: str = "output"):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.ensure_directories()
    
    def ensure_directories(self):
        """Create input and output directories if they don't exist."""
        self.input_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)
    
    def parse_gpx(self, gpx_file: Path) -> List[GPXPoint]:
        """Parse GPX file and extract track points."""
        try:
            tree = ET.parse(gpx_file)
            root = tree.getroot()
            
            # Handle different GPX namespaces
            ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
            if root.tag.startswith('{'):
                ns_uri = root.tag.split('}')[0][1:]
                ns = {'gpx': ns_uri}
            
            points = []
            
            # Find all track points
            for trkpt in root.findall('.//gpx:trkpt', ns) or root.findall('.//trkpt'):
                lat = float(trkpt.get('lat'))
                lon = float(trkpt.get('lon'))
                
                # Try to get elevation
                ele_elem = trkpt.find('gpx:ele', ns)
                if ele_elem is None:
                    ele_elem = trkpt.find('ele')
                ele = float(ele_elem.text) if ele_elem is not None else None
                
                points.append(GPXPoint(lat, lon, ele))
            
            return points
        
        except Exception as e:
            print(f"Error parsing GPX file {gpx_file}: {e}")
            return []
    
    def enhance_elevation_data(self, points: List[GPXPoint]) -> List[GPXPoint]:
        """Enhance GPX points with SRTM elevation data where missing."""
        if not elevation or not points:
            return points
        
        # Check if we need elevation enhancement
        missing_elevation = [p for p in points if p.ele is None]
        if not missing_elevation:
            print(f"All {len(points)} points already have elevation data")
            return points
        
        print(f"Enhancing elevation for {len(missing_elevation)} points using SRTM data...")
        
        try:
            # Create bounds for elevation data download
            lats = [p.lat for p in points]
            lons = [p.lon for p in points]
            min_lat, max_lat = min(lats), max(lats)
            min_lon, max_lon = min(lons), max(lons)
            
            # Add small buffer
            buffer = 0.01
            bounds = (min_lon - buffer, min_lat - buffer, max_lon + buffer, max_lat + buffer)
            
            # Download elevation data to temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                dem_path = Path(temp_dir) / 'elevation.tif'
                elevation.clip(bounds=bounds, output=str(dem_path), product='SRTM1')
                
                # Use elevation library to get elevation for missing points
                enhanced_points = []
                for point in points:
                    if point.ele is None:
                        try:
                            # Get elevation from SRTM data
                            result = elevation.elevation([point.lon], [point.lat])
                            if result and len(result) > 0 and result[0] is not None:
                                point.ele = float(result[0])
                        except Exception as e:
                            print(f"Warning: Could not get elevation for point ({point.lat}, {point.lon}): {e}")
                    enhanced_points.append(point)
                
                enhanced_count = sum(1 for p in enhanced_points if p.ele is not None) - sum(1 for p in points if p.ele is not None)
                print(f"Successfully enhanced {enhanced_count} elevation points")
                return enhanced_points
                
        except Exception as e:
            print(f"Error enhancing elevation data: {e}")
            return points
    
    def lat_lon_to_xy(self, points: List[GPXPoint]) -> List[Tuple[float, float]]:
        """Convert lat/lon coordinates to X/Y coordinates for SVG with proper aspect ratio."""
        if not points:
            return []
        
        # Find bounds
        min_lat = min(p.lat for p in points)
        max_lat = max(p.lat for p in points)
        min_lon = min(p.lon for p in points)
        max_lon = max(p.lon for p in points)
        
        # Convert to Web Mercator projection coordinates (in meters)
        def lat_to_mercator_y(lat):
            return math.log(math.tan(math.radians(lat) / 2 + math.pi / 4))
        
        def lon_to_mercator_x(lon):
            return math.radians(lon)
        
        # Convert all points to Mercator coordinates
        mercator_points = []
        for point in points:
            x_merc = lon_to_mercator_x(point.lon)
            y_merc = lat_to_mercator_y(point.lat)
            mercator_points.append((x_merc, y_merc))
        
        # Find mercator bounds
        min_x_merc = min(p[0] for p in mercator_points)
        max_x_merc = max(p[0] for p in mercator_points)
        min_y_merc = min(p[1] for p in mercator_points)
        max_y_merc = max(p[1] for p in mercator_points)
        
        x_range = max_x_merc - min_x_merc
        y_range = max_y_merc - min_y_merc
        
        # Determine which dimension to use for scaling to maintain aspect ratio
        if x_range == 0 and y_range == 0:
            return [(500, 500)] * len(points)
        elif x_range == 0:
            scale = 800 / y_range
            x_offset = 500
            y_offset = 100
        elif y_range == 0:
            scale = 800 / x_range
            x_offset = 100
            y_offset = 500
        else:
            # Scale to fit in 800x800 area, centered in 1000x1000 canvas
            scale = min(800 / x_range, 800 / y_range)
            x_offset = (1000 - (x_range * scale)) / 2
            y_offset = (1000 - (y_range * scale)) / 2
        
        # Convert to SVG coordinates
        xy_points = []
        for x_merc, y_merc in mercator_points:
            x = ((x_merc - min_x_merc) * scale) + x_offset
            y = ((max_y_merc - y_merc) * scale) + y_offset  # Flip Y axis for SVG
            xy_points.append((x, y))
        
        return xy_points
    
    def create_direct_svg_path(self, points: List[Tuple[float, float]]) -> str:
        """Create a direct SVG path (one-to-one conversion)."""
        if not points:
            return ""
        
        path_data = f"M {points[0][0]:.2f},{points[0][1]:.2f}"
        for x, y in points[1:]:
            path_data += f" L {x:.2f},{y:.2f}"
        
        return path_data
    
    def douglas_peucker(self, points: List[Tuple[float, float]], epsilon: float = 2.0) -> List[Tuple[float, float]]:
        """Simplify path using Douglas-Peucker algorithm."""
        if len(points) <= 2:
            return points
        
        # Find the point with maximum distance from line between first and last points
        max_dist = 0
        max_index = 0
        start = points[0]
        end = points[-1]
        
        for i in range(1, len(points) - 1):
            dist = self.perpendicular_distance(points[i], start, end)
            if dist > max_dist:
                max_dist = dist
                max_index = i
        
        # If max distance is greater than epsilon, recursively simplify
        if max_dist > epsilon:
            # Recursive call on both halves
            left_results = self.douglas_peucker(points[:max_index + 1], epsilon)
            right_results = self.douglas_peucker(points[max_index:], epsilon)
            
            # Merge results (remove duplicate middle point)
            return left_results[:-1] + right_results
        else:
            return [start, end]
    
    def perpendicular_distance(self, point: Tuple[float, float], line_start: Tuple[float, float], line_end: Tuple[float, float]) -> float:
        """Calculate perpendicular distance from point to line."""
        x0, y0 = point
        x1, y1 = line_start
        x2, y2 = line_end
        
        # If line start and end are the same point
        if x1 == x2 and y1 == y2:
            return math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2)
        
        # Calculate perpendicular distance using formula
        numerator = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
        denominator = math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2)
        
        return numerator / denominator
    
    def create_optimized_svg_path(self, points: List[Tuple[float, float]]) -> str:
        """Create an optimized SVG path using Douglas-Peucker simplification."""
        if not points:
            return ""
        
        # Simplify the path
        simplified_points = self.douglas_peucker(points, epsilon=2.0)
        
        if not simplified_points:
            return ""
        
        # Create smooth curves using quadratic Bezier curves
        path_data = f"M {simplified_points[0][0]:.2f},{simplified_points[0][1]:.2f}"
        
        if len(simplified_points) == 2:
            path_data += f" L {simplified_points[1][0]:.2f},{simplified_points[1][1]:.2f}"
        elif len(simplified_points) > 2:
            # Create smooth curves
            for i in range(1, len(simplified_points) - 1):
                curr_point = simplified_points[i]
                next_point = simplified_points[i + 1]
                
                # Control point for smooth curve
                if i == 1:
                    path_data += f" Q {curr_point[0]:.2f},{curr_point[1]:.2f} {(curr_point[0] + next_point[0])/2:.2f},{(curr_point[1] + next_point[1])/2:.2f}"
                else:
                    path_data += f" T {(curr_point[0] + next_point[0])/2:.2f},{(curr_point[1] + next_point[1])/2:.2f}"
            
            # Add final point
            path_data += f" T {simplified_points[-1][0]:.2f},{simplified_points[-1][1]:.2f}"
        
        return path_data
    
    def create_svg(self, path_data: str, filename: str, is_optimized: bool = False) -> str:
        """Create complete SVG file content."""
        svg_type = "optimized" if is_optimized else "direct"
        
        svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <title>{filename} - {svg_type}</title>
  <desc>GPX track converted to SVG - {svg_type} version</desc>
  <style>
    .track-path {{
      fill: none;
      stroke: #FF6B6B;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }}
    .track-path-optimized {{
      fill: none;
      stroke: #4ECDC4;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }}
  </style>
  <path class="{'track-path-optimized' if is_optimized else 'track-path'}" d="{path_data}" />
</svg>'''
        return svg_content
    
    def create_elevation_profile_svg(self, points: List[GPXPoint], filename: str) -> str:
        """Create elevation profile SVG showing height changes along the track."""
        if not points or not any(p.ele for p in points):
            return ""
        
        # Filter points with elevation data
        elevation_points = [(i, p.ele) for i, p in enumerate(points) if p.ele is not None]
        if not elevation_points:
            return ""
        
        # Calculate dimensions
        min_ele = min(ele for _, ele in elevation_points)
        max_ele = max(ele for _, ele in elevation_points)
        ele_range = max_ele - min_ele or 1
        
        # Create path data for elevation profile
        width, height = 1000, 300
        path_data = ""
        
        for i, (idx, ele) in enumerate(elevation_points):
            x = (idx / (len(points) - 1)) * width
            y = height - ((ele - min_ele) / ele_range) * height
            
            if i == 0:
                path_data += f"M {x:.2f},{y:.2f}"
            else:
                path_data += f" L {x:.2f},{y:.2f}"
        
        # Create gradient for elevation coloring
        gradient_stops = ""
        for i in range(0, 101, 20):
            hue = 240 - (i * 1.2)  # Blue to red
            gradient_stops += f'    <stop offset="{i}%" stop-color="hsl({hue}, 70%, 50%)" />\n'
        
        svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 400" width="1000" height="400">
  <title>{filename} - Elevation Profile</title>
  <desc>Elevation profile showing height changes along the track</desc>
  <defs>
    <linearGradient id="elevationGradient" x1="0%" y1="100%" x2="0%" y2="0%">
{gradient_stops}    </linearGradient>
  </defs>
  <style>
    .elevation-profile {{
      fill: none;
      stroke: url(#elevationGradient);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }}
    .elevation-fill {{
      fill: url(#elevationGradient);
      fill-opacity: 0.3;
    }}
    .elevation-grid {{
      stroke: #E0E0E0;
      stroke-width: 1;
      stroke-dasharray: 2,2;
    }}
    .elevation-text {{
      font-family: Arial, sans-serif;
      font-size: 12px;
      fill: #666;
    }}
  </style>
  
  <!-- Grid lines -->
  <g class="elevation-grid">
    <line x1="0" y1="50" x2="1000" y2="50" />
    <line x1="0" y1="150" x2="1000" y2="150" />
    <line x1="0" y1="250" x2="1000" y2="250" />
  </g>
  
  <!-- Elevation area fill -->
  <path class="elevation-fill" d="{path_data} L 1000,300 L 0,300 Z" />
  
  <!-- Elevation profile line -->
  <path class="elevation-profile" d="{path_data}" />
  
  <!-- Labels -->
  <text class="elevation-text" x="10" y="25">Max: {max_ele:.0f}m</text>
  <text class="elevation-text" x="10" y="385">Min: {min_ele:.0f}m</text>
  
</svg>'''
        return svg_content
    
    def convert_file(self, gpx_file: Path):
        """Convert a single GPX file to SVG formats."""
        print(f"Converting {gpx_file.name}...")
        
        # Parse GPX file
        points = self.parse_gpx(gpx_file)
        if not points:
            print(f"No track points found in {gpx_file.name}")
            return
        
        print(f"Found {len(points)} track points")
        
        # Enhance elevation data if available
        enhanced_points = self.enhance_elevation_data(points)
        
        # Convert to XY coordinates
        xy_points = self.lat_lon_to_xy(enhanced_points)
        
        # Create output directory for this GPX file
        base_name = gpx_file.stem
        file_output_dir = self.output_dir / base_name
        file_output_dir.mkdir(exist_ok=True)
        
        # Create direct conversion SVG
        direct_path = self.create_direct_svg_path(xy_points)
        if direct_path:
            direct_svg = self.create_svg(direct_path, base_name, is_optimized=False)
            direct_file = file_output_dir / f"{base_name}_direct.svg"
            direct_file.write_text(direct_svg, encoding='utf-8')
            print(f"Created direct SVG: {direct_file}")
        
        # Create optimized SVG
        optimized_path = self.create_optimized_svg_path(xy_points)
        if optimized_path:
            optimized_svg = self.create_svg(optimized_path, base_name, is_optimized=True)
            optimized_file = file_output_dir / f"{base_name}_optimized.svg"
            optimized_file.write_text(optimized_svg, encoding='utf-8')
            print(f"Created optimized SVG: {optimized_file}")
            
            # Calculate compression ratio
            original_points = len(xy_points)
            simplified_points = len(self.douglas_peucker(xy_points, epsilon=2.0))
            compression_ratio = (1 - simplified_points / original_points) * 100
            print(f"Optimization: {original_points} → {simplified_points} points ({compression_ratio:.1f}% reduction)")
        
        # Create elevation profile SVG if elevation data is available
        if any(p.ele is not None for p in enhanced_points):
            elevation_svg = self.create_elevation_profile_svg(enhanced_points, base_name)
            if elevation_svg:
                elevation_file = file_output_dir / f"{base_name}_elevation.svg"
                elevation_file.write_text(elevation_svg, encoding='utf-8')
                print(f"Created elevation profile SVG: {elevation_file}")
        
        print(f"Total output files: {len(list(file_output_dir.glob('*.svg')))}")
    
    def process_all_files(self):
        """Process all GPX files in the input directory."""
        gpx_files = list(self.input_dir.glob("*.gpx"))
        
        if not gpx_files:
            print(f"No GPX files found in {self.input_dir}")
            print("Please place your .gpx files in the 'input' directory")
            return
        
        print(f"Found {len(gpx_files)} GPX file(s)")
        
        for gpx_file in gpx_files:
            try:
                self.convert_file(gpx_file)
                print()
            except Exception as e:
                print(f"Error converting {gpx_file.name}: {e}")
                print()

def main():
    """Main function to run the converter."""
    print("GPX to SVG Converter")
    print("===================")
    
    # Create converter instance
    converter = GPXToSVGConverter()
    
    # Process all files
    converter.process_all_files()
    
    print("Conversion complete!")
    print(f"Check the '{converter.output_dir}' directory for your SVG files")

if __name__ == "__main__":
    main()
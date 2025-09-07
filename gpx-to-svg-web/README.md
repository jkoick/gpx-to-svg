# GPX to SVG Web Converter

A modern web application that converts GPX track data to beautiful SVG maps with customizable styling, built with Next.js and shadcn/ui components.

## Features

### 🎯 Core Functionality
- **GPX File Upload**: Drag-and-drop or click to upload GPX files
- **Real-time Preview**: Instant SVG generation and preview
- **Multiple Export Options**: Download track SVG and elevation profile
- **Track Information**: Display GPX metadata including track name and point count

### 🎨 Customization Options
- **Track Style**: Choose between direct path or optimized/smooth curves
- **Color Picker**: Customize track color with both color picker and hex input
- **Stroke Width**: Adjustable line thickness (1-10px)
- **Elevation Profile**: Optional elevation chart generation

### 🛠 Technical Features
- **Douglas-Peucker Algorithm**: Path optimization for smoother curves
- **Web Mercator Projection**: Proper coordinate transformation
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Comprehensive error messages and validation
- **Loading States**: Visual feedback during processing

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **UI Components**: shadcn/ui with Tailwind CSS
- **Styling**: Tailwind CSS with custom theme
- **File Handling**: react-dropzone for file uploads
- **Icons**: Lucide React icons
- **TypeScript**: Full type safety

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gpx-to-svg-web
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload GPX File**: 
   - Drag and drop a `.gpx` file into the upload area, or
   - Click the upload area to select a file from your device

2. **Configure Settings**:
   - Choose track style (direct or optimized)
   - Select track color using the color picker
   - Adjust stroke width with the slider
   - Enable elevation profile if your GPX has elevation data

3. **Generate SVG**:
   - Click "Generate SVG" button
   - Preview the generated map in the preview area
   - Download the SVG files using the download buttons

## GPX Processing

### Supported Features
- **Track Points**: Extracts latitude, longitude, and elevation data
- **Track Names**: Preserves GPX track names in SVG output
- **Elevation Data**: Processes elevation information when available
- **Multiple Track Segments**: Handles complex GPX structures

### Coordinate Transformation
- Uses Web Mercator projection for accurate mapping
- Maintains proper aspect ratios
- Automatically scales and centers the track within SVG canvas

### Path Optimization
- **Direct Mode**: One-to-one conversion of all track points
- **Optimized Mode**: Uses Douglas-Peucker algorithm to reduce points while maintaining track shape
- Creates smooth curves using quadratic Bezier curves

## Output Files

### Track SVG
- Vector graphics representation of the GPS track
- Customizable colors and stroke width
- Scalable without quality loss
- Includes track metadata in SVG comments

### Elevation Profile SVG
- Height changes visualization along the track
- Color gradient from blue (low) to red (high) elevation
- Grid lines and elevation labels
- Separate downloadable file

## Browser Compatibility

- Modern browsers supporting ES6+ features
- Chrome, Firefox, Safari, Edge
- Mobile browsers supported

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original Python implementation that inspired this web version
- shadcn/ui for the beautiful component library
- The GPS and mapping community for GPX format standards

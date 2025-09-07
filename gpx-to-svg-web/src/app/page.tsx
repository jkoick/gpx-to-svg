"use client";

import { useState, useCallback, useEffect } from "react";
import {
  MapIcon,
  DownloadIcon,
  SettingsIcon,
  AlertCircleIcon,
  LoaderIcon,
  Upload,
  Settings,
  Route,
  Palette,
  Box,
} from "lucide-react";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@/components/ui/dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { SimpleColorPicker } from "@/components/ui/simple-color-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  SVGPreviewSkeleton,
  ConfigSkeleton,
} from "@/components/ui/svg-preview-skeleton";
import { Viewer3D } from "@/components/ui/3d-viewer";
import { GPXParser, ParsedGPX } from "@/lib/gpx-parser";
import { SVGGenerator } from "@/lib/svg-generator";

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [generatedSvg, setGeneratedSvg] = useState<string>("");
  const [elevationSvg, setElevationSvg] = useState<string>("");
  const [isLoadingOSMData, setIsLoadingOSMData] = useState(false);
  const [parsedGPX, setParsedGPX] = useState<ParsedGPX | null>(null);
  const [trackStyle, setTrackStyle] = useState<"direct" | "optimized">(
    "direct"
  );
  const [trackColor, setTrackColor] = useState("#FF6B6B");
  const [strokeWidth, setStrokeWidth] = useState([2]);
  const [includeElevation, setIncludeElevation] = useState(false);
  const [includeRoads, setIncludeRoads] = useState(false);
  const [includeBuildings, setIncludeBuildings] = useState(false);

  // Road styling
  const [roadMajorColor, setRoadMajorColor] = useState("#FFD700");
  const [roadMajorWidth, setRoadMajorWidth] = useState([3]);
  const [roadMinorColor, setRoadMinorColor] = useState("#FFA500");
  const [roadMinorWidth, setRoadMinorWidth] = useState([2]);
  const [roadPathColor, setRoadPathColor] = useState("#FF8C00");
  const [roadPathWidth, setRoadPathWidth] = useState([1]);

  // Building styling
  const [buildingFillColor, setBuildingFillColor] = useState("#B0B0B0");
  const [buildingStrokeColor, setBuildingStrokeColor] = useState("#808080");
  const [buildingStrokeWidth, setBuildingStrokeWidth] = useState([1]);

  // 3D Model settings (optimized for 3D printing)
  const [modelWidth, setModelWidth] = useState([200]);
  const [modelDepth, setModelDepth] = useState([200]);
  const [minBuildingHeight, setMinBuildingHeight] = useState([5]);
  const [maxBuildingHeight, setMaxBuildingHeight] = useState([30]);
  const [pathExtrusionHeight, setPathExtrusionHeight] = useState([2]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string>("");
  const [currentView, setCurrentView] = useState<"2d" | "3d">("2d");

  // Cache for expensive OSM data
  const [osmDataCache, setOsmDataCache] = useState<{
    data: any;
    bounds: string;
    includeRoads: boolean;
    includeBuildings: boolean;
  } | null>(null);
  const [fastUpdateTimer, setFastUpdateTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [slowUpdateTimer, setSlowUpdateTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  const handleFileDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploadedFiles(acceptedFiles);
    setGeneratedSvg("");
    setElevationSvg("");
    setError("");
    setIsInitialLoad(true);

    if (acceptedFiles.length > 0) {
      try {
        const parsed = await GPXParser.parseGPXFile(acceptedFiles[0]);
        setParsedGPX(parsed);
        setIsInitialLoad(false);
        console.log("Parsed GPX:", parsed);
      } catch (err) {
        setError(`Failed to parse GPX file: ${err}`);
        setParsedGPX(null);
        setIsInitialLoad(false);
      }
    }
  }, []);

  const handleGenerateSVG = useCallback(async () => {
    if (!parsedGPX) return;

    setIsGenerating(true);
    setError("");

    // Set loading state if OSM data will be fetched
    if ((includeRoads || includeBuildings) && !osmDataCache) {
      setIsLoadingOSMData(true);
    }

    try {
      // Create bounds key for cache comparison
      const boundsKey = `${includeRoads}-${includeBuildings}`;
      const currentCacheKey = osmDataCache
        ? `${osmDataCache.includeRoads}-${osmDataCache.includeBuildings}`
        : "";

      const svgOptions = {
        trackStyle,
        trackColor,
        strokeWidth: strokeWidth[0],
        includeElevation,
        includeRoads,
        includeBuildings,
        roadStyles: {
          majorColor: roadMajorColor,
          majorWidth: roadMajorWidth[0],
          minorColor: roadMinorColor,
          minorWidth: roadMinorWidth[0],
          pathColor: roadPathColor,
          pathWidth: roadPathWidth[0],
        },
        buildingStyles: {
          fillColor: buildingFillColor,
          strokeColor: buildingStrokeColor,
          strokeWidth: buildingStrokeWidth[0],
        },
        // Use cached data if available and settings match
        cachedOSMData:
          boundsKey === currentCacheKey && osmDataCache
            ? {
                data: osmDataCache.data,
                bounds: JSON.parse(osmDataCache.bounds),
              }
            : null,
      };

      // Generate main SVG
      const result = await SVGGenerator.generateSVG(
        parsedGPX.points,
        svgOptions,
        parsedGPX.name
      );

      setGeneratedSvg(result.svg);

      // Cache OSM data if it was fetched
      if (result.osmData && result.osmBounds) {
        setOsmDataCache({
          data: result.osmData,
          bounds: JSON.stringify(result.osmBounds),
          includeRoads,
          includeBuildings,
        });
      }

      // Generate elevation profile if requested and elevation data is available
      if (
        includeElevation &&
        parsedGPX.points.some((p) => p.ele !== undefined)
      ) {
        try {
          const elevationProfile = SVGGenerator.generateElevationProfile(
            parsedGPX.points,
            svgOptions
          );
          setElevationSvg(elevationProfile);
        } catch (elevationError) {
          console.warn("Could not generate elevation profile:", elevationError);
        }
      } else {
        setElevationSvg("");
      }
    } catch (err) {
      setError(`Failed to generate SVG: ${err}`);
    } finally {
      setIsGenerating(false);
      setIsLoadingOSMData(false);
    }
  }, [
    parsedGPX,
    trackStyle,
    trackColor,
    strokeWidth,
    includeElevation,
    includeRoads,
    includeBuildings,
    roadMajorColor,
    roadMajorWidth,
    roadMinorColor,
    roadMinorWidth,
    roadPathColor,
    roadPathWidth,
    buildingFillColor,
    buildingStrokeColor,
    buildingStrokeWidth,
    osmDataCache,
  ]);

  // Fast settings that only affect styling (no API calls needed)
  const fastSettings = [
    trackColor,
    strokeWidth,
    roadMajorColor,
    roadMajorWidth,
    roadMinorColor,
    roadMinorWidth,
    roadPathColor,
    roadPathWidth,
    buildingFillColor,
    buildingStrokeColor,
    buildingStrokeWidth,
  ];

  // Slow settings that require API calls or major reprocessing
  const slowSettings = [
    trackStyle,
    includeElevation,
    includeRoads,
    includeBuildings,
  ];

  // Handle fast updates (styling only) - immediate with short debounce
  useEffect(() => {
    if (generatedSvg && parsedGPX) {
      // Clear any existing fast timer
      if (fastUpdateTimer) {
        clearTimeout(fastUpdateTimer);
      }

      const timer = setTimeout(() => {
        // Only regenerate if we're not changing slow settings
        if (!isGenerating) {
          handleGenerateSVG();
        }
      }, 100); // Very short debounce for fast changes

      setFastUpdateTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, fastSettings);

  // Handle slow updates (API calls) - longer debounce
  useEffect(() => {
    if (generatedSvg && parsedGPX) {
      // Clear any existing slow timer
      if (slowUpdateTimer) {
        clearTimeout(slowUpdateTimer);
      }

      // Clear fast timer to avoid conflicts
      if (fastUpdateTimer) {
        clearTimeout(fastUpdateTimer);
        setFastUpdateTimer(null);
      }

      const timer = setTimeout(() => {
        // Clear cache when slow settings change
        setOsmDataCache(null);
        handleGenerateSVG();
      }, 500); // Longer debounce for expensive operations

      setSlowUpdateTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, slowSettings);

  const downloadSVG = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <MapIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-balance">
                GPX to SVG Converter
              </h1>
              <p className="text-muted-foreground text-pretty">
                Convert your GPX track data to beautiful SVG maps with
                customizable styling
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Sidebar - Controls */}
          <div className="xl:col-span-4">
            <div className="pr-2 space-y-6">
              {/* File Upload */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload GPX File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Dropzone
                    onDrop={handleFileDrop}
                    accept={{
                      "application/gpx+xml": [".gpx"],
                      "text/xml": [".gpx"],
                    }}
                    maxFiles={1}
                    src={uploadedFiles}
                    className="h-32"
                  >
                    <DropzoneEmptyState>
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <MapIcon size={16} />
                        </div>
                        <p className="my-2 w-full truncate text-wrap font-medium text-sm">
                          {uploadedFiles.length > 0
                            ? uploadedFiles[0].name
                            : "Upload GPX File"}
                        </p>
                        <p className="w-full truncate text-wrap text-muted-foreground text-xs">
                          Drag and drop or click to{" "}
                          {uploadedFiles.length > 0 ? "replace" : "upload"} your
                          .gpx file
                        </p>
                      </div>
                    </DropzoneEmptyState>
                    <DropzoneContent />
                  </Dropzone>
                </CardContent>
              </Card>

              {/* GPX Info */}
              {parsedGPX && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground space-y-1">
                      {parsedGPX.name && (
                        <p>
                          <strong>Track Name:</strong> {parsedGPX.name}
                        </p>
                      )}
                      <p>
                        <strong>Total Points:</strong>{" "}
                        {parsedGPX.totalPoints.toLocaleString()}
                      </p>
                      <p>
                        <strong>Elevation Data:</strong>{" "}
                        {parsedGPX.points.filter((p) => p.ele !== undefined)
                          .length > 0
                          ? "Available"
                          : "Not Available"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Configuration Panel */}
              {isInitialLoad ? (
                <ConfigSkeleton />
              ) : parsedGPX ? (
                <>
                  {/* Track Settings */}
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Track Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <Label htmlFor="track-style">Track Style</Label>
                        <Select
                          value={trackStyle}
                          onValueChange={(value) =>
                            setTrackStyle(value as "direct" | "optimized")
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="direct">Direct Path</SelectItem>
                            <SelectItem value="optimized">
                              Optimized/Smooth
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Track Color</Label>
                          <SimpleColorPicker
                            value={trackColor}
                            onChange={setTrackColor}
                            label=""
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Stroke Width</Label>
                          <span className="text-sm text-muted-foreground">
                            {strokeWidth[0]}px
                          </span>
                        </div>
                        <Slider
                          value={strokeWidth}
                          onValueChange={setStrokeWidth}
                          max={20}
                          min={1}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="elevation">
                            Include Elevation Profile
                          </Label>
                          <Switch
                            id="elevation"
                            checked={includeElevation}
                            onCheckedChange={setIncludeElevation}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="roads">Include Roads & Paths</Label>
                          <Switch
                            id="roads"
                            checked={includeRoads}
                            onCheckedChange={setIncludeRoads}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="buildings">Include Buildings</Label>
                          <Switch
                            id="buildings"
                            checked={includeBuildings}
                            onCheckedChange={setIncludeBuildings}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Road Styling */}
                  {includeRoads && (
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                          <Route className="h-5 w-5" />
                          Road Styling
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          <div className="space-y-3 pl-4 border-l-2 border-muted">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Major Roads</Label>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Color</Label>
                              <SimpleColorPicker
                                value={roadMajorColor}
                                onChange={setRoadMajorColor}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Width</Label>
                              <span className="text-sm text-muted-foreground">
                                {roadMajorWidth[0]}px
                              </span>
                            </div>
                            <Slider
                              value={roadMajorWidth}
                              onValueChange={setRoadMajorWidth}
                              max={10}
                              min={1}
                              step={1}
                            />
                          </div>

                          <Separator />

                          <div className="space-y-3 pl-4 border-l-2 border-muted">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Minor Roads</Label>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Color</Label>
                              <SimpleColorPicker
                                value={roadMinorColor}
                                onChange={setRoadMinorColor}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Width</Label>
                              <span className="text-sm text-muted-foreground">
                                {roadMinorWidth[0]}px
                              </span>
                            </div>
                            <Slider
                              value={roadMinorWidth}
                              onValueChange={setRoadMinorWidth}
                              max={8}
                              min={1}
                              step={1}
                            />
                          </div>

                          <Separator />

                          <div className="space-y-3 pl-4 border-l-2 border-muted">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Paths & Trails</Label>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Color</Label>
                              <SimpleColorPicker
                                value={roadPathColor}
                                onChange={setRoadPathColor}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Width</Label>
                              <span className="text-sm text-muted-foreground">
                                {roadPathWidth[0]}px
                              </span>
                            </div>
                            <Slider
                              value={roadPathWidth}
                              onValueChange={setRoadPathWidth}
                              max={5}
                              min={1}
                              step={1}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Building Styling */}
                  {includeBuildings && (
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                          <Palette className="h-5 w-5" />
                          Building Styling
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Fill Color</Label>
                            <SimpleColorPicker
                              value={buildingFillColor}
                              onChange={setBuildingFillColor}
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Stroke</Label>
                            <SimpleColorPicker
                              value={buildingStrokeColor}
                              onChange={setBuildingStrokeColor}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Width</Label>
                            <span className="text-sm text-muted-foreground">
                              {buildingStrokeWidth[0]}px
                            </span>
                          </div>
                          <Slider
                            value={buildingStrokeWidth}
                            onValueChange={setBuildingStrokeWidth}
                            max={5}
                            min={0}
                            step={1}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 3D Model Settings */}
                  {includeBuildings && currentView === "3d" && (
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2">
                          <Box className="h-5 w-5" />
                          3D Model Settings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Model Width</Label>
                              <span className="text-sm text-muted-foreground">
                                {modelWidth[0]}mm
                              </span>
                            </div>
                            <Slider
                              value={modelWidth}
                              onValueChange={setModelWidth}
                              max={300}
                              min={100}
                              step={10}
                            />
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Model Depth</Label>
                              <span className="text-sm text-muted-foreground">
                                {modelDepth[0]}mm
                              </span>
                            </div>
                            <Slider
                              value={modelDepth}
                              onValueChange={setModelDepth}
                              max={300}
                              min={100}
                              step={10}
                            />
                          </div>

                          <Separator />

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">
                                Min Building Height
                              </Label>
                              <span className="text-sm text-muted-foreground">
                                {minBuildingHeight[0]}mm
                              </span>
                            </div>
                            <Slider
                              value={minBuildingHeight}
                              onValueChange={setMinBuildingHeight}
                              max={10}
                              min={1}
                              step={1}
                            />
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">
                                Max Building Height
                              </Label>
                              <span className="text-sm text-muted-foreground">
                                {maxBuildingHeight[0]}mm
                              </span>
                            </div>
                            <Slider
                              value={maxBuildingHeight}
                              onValueChange={setMaxBuildingHeight}
                              max={30}
                              min={4}
                              step={1}
                            />
                          </div>

                          <Separator />

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Path Height</Label>
                              <span className="text-sm text-muted-foreground">
                                {pathExtrusionHeight[0]}mm
                              </span>
                            </div>
                            <Slider
                              value={pathExtrusionHeight}
                              onValueChange={setPathExtrusionHeight}
                              max={10}
                              min={0.5}
                              step={0.5}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="xl:col-span-8">
            {/* Preview with Tabs */}
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle>Preview</CardTitle>
                    <Tabs
                      value={currentView}
                      onValueChange={(value) =>
                        setCurrentView(value as "2d" | "3d")
                      }
                    >
                      <TabsList>
                        <TabsTrigger
                          value="2d"
                          className="flex items-center gap-2"
                        >
                          <MapIcon className="h-4 w-4" />
                          2D SVG
                        </TabsTrigger>
                        <TabsTrigger
                          value="3d"
                          className="flex items-center gap-2"
                        >
                          <Box className="h-4 w-4" />
                          3D Model
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="flex gap-2">
                    {generatedSvg && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadSVG(
                            generatedSvg,
                            `${parsedGPX?.name || "track"}_${trackStyle}.svg`
                          )
                        }
                      >
                        <DownloadIcon className="h-4 w-4 mr-2" />
                        Download Track
                      </Button>
                    )}
                    {elevationSvg && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadSVG(
                            elevationSvg,
                            `${parsedGPX?.name || "track"}_elevation.svg`
                          )
                        }
                      >
                        <DownloadIcon className="h-4 w-4 mr-2" />
                        Download Elevation
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Error Display */}
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircleIcon className="h-4 w-4 text-destructive" />
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  </div>
                )}

                <Tabs
                  value={currentView}
                  onValueChange={(value) =>
                    setCurrentView(value as "2d" | "3d")
                  }
                  className="flex-1"
                >
                  <TabsContent value="2d" className="flex-1 mt-0">
                    <div className="h-full bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center min-h-0 overflow-auto">
                      {/* SVG Preview */}
                      {isGenerating ? (
                        <SVGPreviewSkeleton />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {generatedSvg ? (
                            <div className="w-full h-full p-4">
                              <div
                                className="w-full h-full flex items-center justify-center"
                                dangerouslySetInnerHTML={{
                                  __html: generatedSvg,
                                }}
                              />
                            </div>
                          ) : parsedGPX ? (
                            <div className="text-center space-y-4">
                              <MapIcon className="h-16 w-16 text-muted-foreground mx-auto" />
                              <div>
                                <p className="font-medium">Ready to Convert</p>
                                <p className="text-sm text-muted-foreground mb-4">
                                  File: {uploadedFiles[0]?.name} (
                                  {parsedGPX.totalPoints.toLocaleString()}{" "}
                                  points)
                                  {(includeRoads || includeBuildings) && (
                                    <span className="block text-yellow-600 mt-1">
                                      ⚠️ Map data fetching may take 10-30
                                      seconds
                                    </span>
                                  )}
                                </p>
                                <Button
                                  onClick={handleGenerateSVG}
                                  disabled={isGenerating}
                                  className="mt-4"
                                >
                                  {isGenerating ? (
                                    <>
                                      <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                                      {includeRoads || includeBuildings
                                        ? "Fetching map data..."
                                        : "Generating..."}
                                    </>
                                  ) : (
                                    <>Generate SVG</>
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center space-y-2">
                              <MapIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                              <p className="text-muted-foreground">
                                Upload a GPX file to see the preview here
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Elevation Profile Preview */}
                    {elevationSvg && (
                      <div className="mt-4 border-2 border-dashed border-muted rounded-lg bg-muted/20 p-4">
                        <h3 className="font-medium mb-4">Elevation Profile</h3>
                        <div
                          className="w-full flex items-center justify-center"
                          dangerouslySetInnerHTML={{ __html: elevationSvg }}
                        />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="3d" className="flex-1 mt-0">
                    <div className="h-full bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/25">
                      {isGenerating ? (
                        <div className="h-full flex items-center justify-center">
                          <SVGPreviewSkeleton />
                        </div>
                      ) : parsedGPX ? (
                        <Viewer3D
                          osmData={osmDataCache?.data}
                          bounds={
                            osmDataCache?.data
                              ? JSON.parse(osmDataCache.bounds)
                              : undefined
                          }
                          gpxPoints={parsedGPX.points}
                          buildingStyles={{
                            fillColor: buildingFillColor,
                            strokeColor: buildingStrokeColor,
                          }}
                          trackColor={trackColor}
                          strokeWidth={strokeWidth[0]}
                          modelDimensions={{
                            width: modelWidth[0],
                            depth: modelDepth[0],
                          }}
                          buildingHeightRange={{
                            min: minBuildingHeight[0],
                            max: maxBuildingHeight[0],
                          }}
                          pathExtrusionHeight={pathExtrusionHeight[0]}
                          className="h-full"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <Box className="h-12 w-12 mx-auto text-muted-foreground" />
                            <p className="text-muted-foreground">
                              Upload a GPX file to see the 3D model
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

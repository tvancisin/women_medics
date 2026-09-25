<script lang="ts">
  import { onMount } from "svelte";
  import mapboxgl from "mapbox-gl";
  import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker";
  import {
    getEdinburghSevenPointFeatures,
    getStudentPointFeatures,
    getTimelineMarkerFeatures,
    getWomenDoctorBirthplaceFeatures,
    getWomenDoctorCareerLocationFeatures,
    getWomenDoctorsWarLocationFeatures,
  } from "./map/featureBuilders";

  // Component inputs
  export let currentYear: number;
  export let garrettJourneyData: unknown = null;
  export let barryJourneyData: unknown = null;
  export let riotData: unknown = null;
  export let womenPhysiologyGeoData: unknown = null;
  export let firstClassesGeoData: unknown = null;
  export let firstClassesPathsData: unknown = null;
  export let physiologyPathsData: unknown = null;
  export let womenDoctorsData: unknown = null;
  export let womenCareers1915Data: unknown = null;
  export let colonies: unknown = null;
  export let suez: unknown = null;
  export let edinburghRoutes: unknown = null;
  export let edinburghSevenData: unknown = null;
  export let womenDoctorsWarData: unknown = null;
  export let showWomenDoctorCareerLocations = false;
  export let showWomenDoctorsWarLocations = false;

  // Local Mapbox state
  let map: mapboxgl.Map;
  let mapContainer: HTMLDivElement;
  let styleReady = false;
  const pathAnimationFrames = new Map<string, number>();
  let hasAnimatedBarryLine = false;
  let hasAnimatedGarrettLine = false;
  let hasAnimatedFirstClassesPaths = false;
  let hasAnimatedPhysiologyPaths = false;
  let hasAnimatedSuezRoutesReverse = false;
  let hasAnimatedSuezRoutesForward = false;
  let hasAnimatedRiotRoute = false;
  let hasDrawnEdinburghSeven = false;
  let hasAnimatedEdinburghRoutes = false;
  let hasDrawnOldMapOverlay = false;
  let oldMapOverlayFadeTimeout: ReturnType<typeof setTimeout> | null = null;
  let hasDrawnFirstClassesMapOverlay = false;
  let firstClassesMapOverlayFadeTimeout: ReturnType<typeof setTimeout> | null =
    null;
  let hasDrawnPhysiologyMapOverlay = false;
  let physiologyMapOverlayFadeTimeout: ReturnType<typeof setTimeout> | null =
    null;
  let hasDrawn1886MapOverlay = false;
  let mapOverlay1886FadeTimeout: ReturnType<typeof setTimeout> | null = null;
  let hasDrawnWomenDoctorBirthplaces = false;
  let hasDrawnWomenDoctorCareerLocations = false;
  let hasDrawnWomenDoctorsWarLocations = false;
  let hasFocusedWomenDoctorsMilestone = false;
  let hasFocusedOfficialMedicsMilestone = false;
  let timelineMarkersDataKey = "";
  const timelineLabelMarkers = new Map<string, mapboxgl.Marker>();
  const womenDoctorsWarLabelMarkers = new Map<string, mapboxgl.Marker>();
  let womenDoctorCareerPopup: mapboxgl.Popup | null = null;
  let hasWomenDoctorCareerHoverHandlers = false;

  type LayerConfig = {
    sourceId: string;
    layerId: string;
  };

  type DataLayerConfig = LayerConfig & {
    rawData: unknown;
  };

  type CircleLayerConfig = LayerConfig & {
    features: GeoJSON.Feature<GeoJSON.Point>[];
    paint: Record<string, unknown>;
  };

  type LabelPlacement = {
    anchor: "top" | "bottom" | "left" | "right";
    offset: [number, number];
  };

  type JourneyLineConfig = {
    journeyData: unknown;
    sourceId: string;
    lineLayerId: string;
    lineColor: string;
  };

  type AnimatedLineConfig = DataLayerConfig & {
    milestoneYear: number;
    continueAfterMilestone?: boolean;
    lineColor?: string;
    lineOpacity?: number;
    lineWidth?: number;
    durationMs?: number;
    reverse?: boolean;
  };

  // Keep Mapbox IDs centralized so layers and sources are easy to rename together.
  const rawEnvToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  const envToken = (rawEnvToken ?? "").trim().replace(/^"|"$/g, "");
  const barrySourceId = "barry-journey";
  const barryLineLayerId = "barry-journey-line";
  const garrettSourceId = "garrett-journey";
  const garrettLineLayerId = "garrett-journey-line";
  const physiologyStudentsSourceId = "physiology-students";
  const physiologyStudentsLayerId = "physiology-students-circles";
  const edinburghSevenSourceId = "edinburgh-seven";
  const edinburghSevenLayerId = "edinburgh-seven-circles";
  const firstClassesSourceId = "first-classes";
  const firstClassesLayerId = "first-classes-circles";
  const firstClassesPathsSourceId = "first-classes-paths";
  const firstClassesPathsLayerId = "first-classes-paths-lines";
  const physiologyPathsSourceId = "physiology-paths";
  const physiologyPathsLayerId = "physiology-paths-lines";
  const womenDoctorsBirthplacesSourceId = "women-doctors-birthplaces";
  const womenDoctorsBirthplacesLayerId = "women-doctors-birthplaces-circles";
  const womenDoctorsCareerLocationsSourceId = "women-doctors-careers";
  const womenDoctorsCareerLocationsLayerId = "women-doctors-careers-circles";
  const womenDoctorsWarLocationsSourceId = "women-doctors-war-locations";
  const womenDoctorsWarLocationsLayerId = "women-doctors-war-locations-circles";
  const timelineMarkersSourceId = "timeline-location-markers";
  const timelineMarkersCircleLayerId = "timeline-location-markers-circles";
  const timelineMarkersTextLayerId = "timeline-location-markers-text";
  const schoolOfMedicineForWomenSourceId = "school-of-medicine-for-women-1886";
  const schoolOfMedicineForWomenLayerId =
    "school-of-medicine-for-women-1886-circles";
  const collegeOfMedicineForWomenSourceId =
    "college-of-medicine-for-women-1889";
  const collegeOfMedicineForWomenLayerId =
    "college-of-medicine-for-women-1889-circles";
  const oldMapOverlaySourceId = "old-map-overlay-1726";
  const oldMapOverlayLayerId = "old-map-overlay-1726-raster";
  const firstClassesMapOverlaySourceId = "first-classes-map-overlay-1867";
  const firstClassesMapOverlayLayerId = "first-classes-map-overlay-1867-raster";
  const physiologyMapOverlaySourceId = "physiology-map-overlay-1875";
  const physiologyMapOverlayLayerId = "physiology-map-overlay-1875-raster";
  const mapOverlay1886SourceId = "map-overlay-1886";
  const mapOverlay1886LayerId = "map-overlay-1886-raster";
  const coloniesSourceId = "colonies-1885";
  const coloniesFillLayerId = "colonies-1885-fill";
  const coloniesLineLayerId = "colonies-1885-line";
  const suezSourceId = "suez-routes";
  const suezLineLayerId = "suez-routes-line";
  const edinburghRoutesSourceId = "edinburgh-routes";
  const edinburghRoutesLineLayerId = "edinburgh-routes-line";
  const riotRouteSourceId = "edinburgh-riot-route";
  const riotRouteLineLayerId = "edinburgh-riot-route-line";
  const barryJourneyYear = 1809;
  const garrettJourneyYear = 1862;
  const firstClassesYear = 1867;
  const edinburghSevenYear = 1869;
  const edinburghSevenRiotYear = 1870;
  const physiologyYear = 1875;
  const oldMapOverlayStartYear = 1726;
  const oldMapOverlayEndYear = 1760;
  const firstClassesMapOverlayYear = 1867;
  const physiologyMapOverlayStartYear = 1870;
  const physiologyMapOverlayEndYear = 1875;
  const mapOverlay1886Year = 1886;
  const mapOverlay1886EndYear = 1889;
  const schoolOfMedicineForWomenYear = 1886;
  const collegeOfMedicineForWomenYear = 1889;
  const historicalMapOverlayOpacity = 0.8;
  const historicalMapOverlayFadeDurationMs = 900;
  const animatedLineDurationMs = 20_000;
  const studentPathAnimationDurationMs = 6_000;
  const womenDoctorsBirthplacesYear = 1911;
  const womenDoctorsFocusYear = 1911;
  const suezRoutesReverseYear = 1911;
  const suezRoutesForwardYear = 1912;
  const womenDoctorsCareerLocationsYear = 1915;
  const womenDoctorsWarYears = [1915, 1916, 1917, 1918, 1919];
  const foregroundMarkerLayerIds = [
    firstClassesLayerId,
    physiologyStudentsLayerId,
    edinburghSevenLayerId,
    womenDoctorsBirthplacesLayerId,
    womenDoctorsCareerLocationsLayerId,
    womenDoctorsWarLocationsLayerId,
    timelineMarkersCircleLayerId,
    timelineMarkersTextLayerId,
  ];
  const circleMarkerPaint: Record<string, unknown> = {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      2,
      3.2,
      5,
      2.3,
      8,
      3.4,
    ],
    "circle-color": "white",
    "circle-opacity": 0.8,
    "circle-stroke-color": "black",
    "circle-stroke-width": 1,
    "circle-stroke-opacity": 1,
  };
  const timelineMarkerCirclePaint: Record<string, unknown> = {
    ...circleMarkerPaint,
    "circle-radius": 8,
    "circle-color": "black",
    "circle-stroke-color": "white",
    "circle-stroke-width": 1.5,
    "circle-stroke-opacity": 1,
  };
  const womenDoctorsWarCirclePaint: Record<string, unknown> = {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["get", "value"],
      2,
      6,
      277,
      24,
    ],
    "circle-color": "white",
    "circle-opacity": 0.78,
    "circle-stroke-color": "#171717",
    "circle-stroke-width": 1.5,
    "circle-stroke-opacity": 1,
  };
  const defaultWomenDoctorsWarLabelPlacement: LabelPlacement = {
    anchor: "top",
    offset: [0, 10],
  };
  const womenDoctorsWarLabelPlacements: Record<string, LabelPlacement> = {
    "abbaye de royaumont": { anchor: "left", offset: [10, 0] },
    valjevo: { anchor: "right", offset: [-10, 0] },
    mladenovac: { anchor: "left", offset: [10, 0] },
    serbia: { anchor: "bottom", offset: [0, -10] },
  };

  // GeoJSON guards used by map-specific route and overlay helpers.
  const isGeoJsonData = (value: unknown): value is GeoJSON.GeoJSON => {
    return Boolean(value && typeof value === "object" && "type" in value);
  };

  const getLineCoordinates = (
    journeyData: unknown,
  ): [number, number][] | null => {
    if (!isGeoJsonData(journeyData)) return null;

    if (journeyData.type === "Feature") {
      const feature = journeyData as GeoJSON.Feature;
      if (feature.geometry?.type === "LineString") {
        return feature.geometry.coordinates as [number, number][];
      }
      return null;
    }

    if (journeyData.type === "FeatureCollection") {
      const featureCollection = journeyData as GeoJSON.FeatureCollection;
      const lineFeature = featureCollection.features.find(
        (feature) => feature.geometry?.type === "LineString",
      );
      if (!lineFeature || lineFeature.geometry.type !== "LineString") {
        return null;
      }
      return lineFeature.geometry.coordinates as [number, number][];
    }

    return null;
  };

  // Draws one-off journey routes, such as Barry and Garrett, from GeoJSON lines.
  const animateJourneyLine = ({
    journeyData,
    sourceId,
    lineLayerId,
    lineColor,
  }: JourneyLineConfig) => {
    if (!map || !styleReady || !map.isStyleLoaded()) return false;

    const fullCoords = getLineCoordinates(journeyData);
    if (!fullCoords || fullCoords.length < 2) return false;

    cancelPathAnimation(lineLayerId);

    // Start with a zero-length line so the animation visibly draws from the first waypoint.
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [fullCoords[0], fullCoords[0]],
          },
        },
      });
    }

    if (!map.getLayer(lineLayerId)) {
      map.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": lineColor,
          "line-width": 1,
          "line-opacity": 0.95,
        },
      });
    }

    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
    source.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [fullCoords[0], fullCoords[0]],
      },
    });

    // Lower values draw faster; each route segment gets the same visual time.
    const framesPerSegment = 5;
    let frame = 0;

    const step = () => {
      const totalFrames = (fullCoords.length - 1) * framesPerSegment;
      if (frame >= totalFrames) return;

      const segmentIndex = Math.floor(frame / framesPerSegment);
      const t = (frame % framesPerSegment) / framesPerSegment;

      const from = fullCoords[segmentIndex] as [number, number];
      const to = fullCoords[segmentIndex + 1] as [number, number];

      // Interpolate between waypoints so the line grows smoothly, not point by point.
      const interpolated: [number, number] = [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ];

      // Keep all previous waypoints + current interpolated position
      const coords = [...fullCoords.slice(0, segmentIndex + 1), interpolated];

      source.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      });

      frame++;
      pathAnimationFrames.set(lineLayerId, requestAnimationFrame(step));
    };

    pathAnimationFrames.set(lineLayerId, requestAnimationFrame(step));
    return true;
  };

  // Mapbox layer/source helpers. These are deliberately small so timeline
  // reactions can describe "what happens" without repeating Mapbox plumbing.
  function removeLayerAndSource(sourceId: string, layerId: string) {
    if (!map || !styleReady) return;

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }

  function removeCircleLayer({ sourceId, layerId }: LayerConfig) {
    removeLayerAndSource(sourceId, layerId);
  }

  function bringForegroundMarkersToFront() {
    for (const layerId of foregroundMarkerLayerIds) {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    }
  }

  function clearOldMapOverlayFade() {
    if (oldMapOverlayFadeTimeout === null) return;

    clearTimeout(oldMapOverlayFadeTimeout);
    oldMapOverlayFadeTimeout = null;
  }

  function removeOldMapOverlay() {
    clearOldMapOverlayFade();
    hasDrawnOldMapOverlay = false;
    removeLayerAndSource(oldMapOverlaySourceId, oldMapOverlayLayerId);
  }

  function fadeOutOldMapOverlay() {
    if (!map || !styleReady || oldMapOverlayFadeTimeout !== null) return;

    if (!map.getLayer(oldMapOverlayLayerId)) {
      removeOldMapOverlay();
      return;
    }

    map.setPaintProperty(oldMapOverlayLayerId, "raster-opacity", 0);
    oldMapOverlayFadeTimeout = setTimeout(() => {
      oldMapOverlayFadeTimeout = null;
      hasDrawnOldMapOverlay = false;
      removeLayerAndSource(oldMapOverlaySourceId, oldMapOverlayLayerId);
    }, historicalMapOverlayFadeDurationMs);
  }

  function drawOldMapOverlay() {
    if (!map || !styleReady) return false;

    clearOldMapOverlayFade();

    if (!map.getSource(oldMapOverlaySourceId)) {
      map.addSource(oldMapOverlaySourceId, {
        type: "raster",
        tiles: [
          `https://api.mapbox.com/v4/tomasvancisin.1popvk/{z}/{x}/{y}.png?access_token=${envToken}`,
        ],
        tileSize: 256,
      });
    }

    if (!map.getLayer(oldMapOverlayLayerId)) {
      map.addLayer({
        id: oldMapOverlayLayerId,
        type: "raster",
        source: oldMapOverlaySourceId,
        paint: {
          "raster-opacity": historicalMapOverlayOpacity,
          "raster-opacity-transition": {
            duration: historicalMapOverlayFadeDurationMs,
          },
        },
      });
    }

    map.setPaintProperty(
      oldMapOverlayLayerId,
      "raster-opacity",
      historicalMapOverlayOpacity,
    );

    bringForegroundMarkersToFront();
    return true;
  }

  function clearFirstClassesMapOverlayFade() {
    if (firstClassesMapOverlayFadeTimeout === null) return;

    clearTimeout(firstClassesMapOverlayFadeTimeout);
    firstClassesMapOverlayFadeTimeout = null;
  }

  function removeFirstClassesMapOverlay() {
    clearFirstClassesMapOverlayFade();
    hasDrawnFirstClassesMapOverlay = false;
    removeLayerAndSource(
      firstClassesMapOverlaySourceId,
      firstClassesMapOverlayLayerId,
    );
  }

  function fadeOutFirstClassesMapOverlay() {
    if (!map || !styleReady || firstClassesMapOverlayFadeTimeout !== null) {
      return;
    }

    if (!map.getLayer(firstClassesMapOverlayLayerId)) {
      removeFirstClassesMapOverlay();
      return;
    }

    map.setPaintProperty(firstClassesMapOverlayLayerId, "raster-opacity", 0);
    firstClassesMapOverlayFadeTimeout = setTimeout(() => {
      firstClassesMapOverlayFadeTimeout = null;
      hasDrawnFirstClassesMapOverlay = false;
      removeLayerAndSource(
        firstClassesMapOverlaySourceId,
        firstClassesMapOverlayLayerId,
      );
    }, historicalMapOverlayFadeDurationMs);
  }

  function drawFirstClassesMapOverlay() {
    if (!map || !styleReady) return false;

    clearFirstClassesMapOverlayFade();

    if (!map.getSource(firstClassesMapOverlaySourceId)) {
      map.addSource(firstClassesMapOverlaySourceId, {
        type: "raster",
        tiles: [
          `https://api.mapbox.com/v4/tomasvancisin.rezmqd/{z}/{x}/{y}.png?access_token=${envToken}`,
        ],
        tileSize: 256,
      });
    }

    if (!map.getLayer(firstClassesMapOverlayLayerId)) {
      map.addLayer({
        id: firstClassesMapOverlayLayerId,
        type: "raster",
        source: firstClassesMapOverlaySourceId,
        paint: {
          "raster-opacity": historicalMapOverlayOpacity,
          "raster-opacity-transition": {
            duration: historicalMapOverlayFadeDurationMs,
          },
        },
      });
    }

    map.setPaintProperty(
      firstClassesMapOverlayLayerId,
      "raster-opacity",
      historicalMapOverlayOpacity,
    );

    bringForegroundMarkersToFront();
    return true;
  }

  function clearPhysiologyMapOverlayFade() {
    if (physiologyMapOverlayFadeTimeout === null) return;

    clearTimeout(physiologyMapOverlayFadeTimeout);
    physiologyMapOverlayFadeTimeout = null;
  }

  function removePhysiologyMapOverlay() {
    clearPhysiologyMapOverlayFade();
    hasDrawnPhysiologyMapOverlay = false;
    removeLayerAndSource(
      physiologyMapOverlaySourceId,
      physiologyMapOverlayLayerId,
    );
  }

  function fadeOutPhysiologyMapOverlay() {
    if (!map || !styleReady || physiologyMapOverlayFadeTimeout !== null) {
      return;
    }

    if (!map.getLayer(physiologyMapOverlayLayerId)) {
      removePhysiologyMapOverlay();
      return;
    }

    map.setPaintProperty(physiologyMapOverlayLayerId, "raster-opacity", 0);
    physiologyMapOverlayFadeTimeout = setTimeout(() => {
      physiologyMapOverlayFadeTimeout = null;
      hasDrawnPhysiologyMapOverlay = false;
      removeLayerAndSource(
        physiologyMapOverlaySourceId,
        physiologyMapOverlayLayerId,
      );
    }, historicalMapOverlayFadeDurationMs);
  }

  function drawPhysiologyMapOverlay() {
    if (!map || !styleReady) return false;

    clearPhysiologyMapOverlayFade();

    if (!map.getSource(physiologyMapOverlaySourceId)) {
      map.addSource(physiologyMapOverlaySourceId, {
        type: "raster",
        tiles: [
          `https://api.mapbox.com/v4/tomasvancisin.sq1kxl/{z}/{x}/{y}.png?access_token=${envToken}`,
        ],
        tileSize: 256,
      });
    }

    if (!map.getLayer(physiologyMapOverlayLayerId)) {
      map.addLayer({
        id: physiologyMapOverlayLayerId,
        type: "raster",
        source: physiologyMapOverlaySourceId,
        paint: {
          "raster-opacity": historicalMapOverlayOpacity,
          "raster-opacity-transition": {
            duration: historicalMapOverlayFadeDurationMs,
          },
        },
      });
    }

    map.setPaintProperty(
      physiologyMapOverlayLayerId,
      "raster-opacity",
      historicalMapOverlayOpacity,
    );

    bringForegroundMarkersToFront();
    // The physiology overlay is used at the 1870 riot milestone; keep its
    // animated route above the raster tiles instead of obscuring it.
    if (map.getLayer(riotRouteLineLayerId)) {
      map.moveLayer(riotRouteLineLayerId);
    }
    return true;
  }

  function clear1886MapOverlayFade() {
    if (mapOverlay1886FadeTimeout === null) return;

    clearTimeout(mapOverlay1886FadeTimeout);
    mapOverlay1886FadeTimeout = null;
  }

  function remove1886MapOverlay() {
    clear1886MapOverlayFade();
    hasDrawn1886MapOverlay = false;
    removeLayerAndSource(mapOverlay1886SourceId, mapOverlay1886LayerId);
  }

  function fadeOut1886MapOverlay() {
    if (!map || !styleReady || mapOverlay1886FadeTimeout !== null) return;

    if (!map.getLayer(mapOverlay1886LayerId)) {
      remove1886MapOverlay();
      return;
    }

    map.setPaintProperty(mapOverlay1886LayerId, "raster-opacity", 0);
    mapOverlay1886FadeTimeout = setTimeout(() => {
      mapOverlay1886FadeTimeout = null;
      hasDrawn1886MapOverlay = false;
      removeLayerAndSource(mapOverlay1886SourceId, mapOverlay1886LayerId);
    }, historicalMapOverlayFadeDurationMs);
  }

  function draw1886MapOverlay() {
    if (!map || !styleReady) return false;

    clear1886MapOverlayFade();

    if (!map.getSource(mapOverlay1886SourceId)) {
      map.addSource(mapOverlay1886SourceId, {
        type: "raster",
        tiles: [
          `https://api.mapbox.com/v4/tomasvancisin.dobh64/{z}/{x}/{y}.png?access_token=${envToken}`,
        ],
        tileSize: 256,
      });
    }

    if (!map.getLayer(mapOverlay1886LayerId)) {
      map.addLayer({
        id: mapOverlay1886LayerId,
        type: "raster",
        source: mapOverlay1886SourceId,
        paint: {
          "raster-opacity": historicalMapOverlayOpacity,
          "raster-opacity-transition": {
            duration: historicalMapOverlayFadeDurationMs,
          },
        },
      });
    }

    map.setPaintProperty(
      mapOverlay1886LayerId,
      "raster-opacity",
      historicalMapOverlayOpacity,
    );

    bringForegroundMarkersToFront();
    return true;
  }

  function cancelPathAnimation(layerId: string) {
    const frame = pathAnimationFrames.get(layerId);
    if (frame === undefined) return;

    cancelAnimationFrame(frame);
    pathAnimationFrames.delete(layerId);
  }

  const getAnimatedLineFeatureCollection = (
    rawData: unknown,
    progress: number,
    reverse = false,
  ): GeoJSON.FeatureCollection<GeoJSON.LineString> | null => {
    if (!isGeoJsonData(rawData) || rawData.type !== "FeatureCollection") {
      return null;
    }

    const clampedProgress = Math.min(1, Math.max(0, progress));
    const features = (rawData as GeoJSON.FeatureCollection).features.flatMap(
      (feature) => {
        const coordinateSets =
          feature.geometry?.type === "LineString"
            ? [feature.geometry.coordinates as GeoJSON.Position[]]
            : feature.geometry?.type === "MultiLineString"
              ? (feature.geometry.coordinates as GeoJSON.Position[][])
              : [];

        return coordinateSets.flatMap((rawCoordinates) => {
          if (rawCoordinates.length === 0) return [];

          const coordinates = reverse
            ? [...rawCoordinates].reverse()
            : rawCoordinates;

          if (coordinates.length === 1 || clampedProgress <= 0) {
            return [
              {
                type: "Feature",
                properties: feature.properties ?? {},
                geometry: {
                  type: "LineString",
                  coordinates: [coordinates[0], coordinates[0]],
                },
              } satisfies GeoJSON.Feature<GeoJSON.LineString>,
            ];
          }

          if (clampedProgress >= 1) {
            return [
              {
                type: "Feature",
                properties: feature.properties ?? {},
                geometry: { type: "LineString", coordinates },
              } satisfies GeoJSON.Feature<GeoJSON.LineString>,
            ];
          }

          const scaledIndex = clampedProgress * (coordinates.length - 1);
          const segmentIndex = Math.floor(scaledIndex);
          const segmentProgress = scaledIndex - segmentIndex;
          const from = coordinates[segmentIndex];
          const to = coordinates[segmentIndex + 1];
          const interpolated: GeoJSON.Position = [
            from[0] + (to[0] - from[0]) * segmentProgress,
            from[1] + (to[1] - from[1]) * segmentProgress,
          ];

          return [
            {
              type: "Feature",
              properties: feature.properties ?? {},
              geometry: {
                type: "LineString",
                coordinates: [
                  ...coordinates.slice(0, segmentIndex + 1),
                  interpolated,
                ],
              },
            } satisfies GeoJSON.Feature<GeoJSON.LineString>,
          ];
        });
      },
    );

    return { type: "FeatureCollection", features };
  };

  function drawColoniesLayer(rawData: unknown) {
    if (!map || !styleReady || !isGeoJsonData(rawData)) return false;

    const existingSource = map.getSource(coloniesSourceId) as
      | mapboxgl.GeoJSONSource
      | undefined;

    if (existingSource) {
      existingSource.setData(rawData);
    } else {
      map.addSource(coloniesSourceId, {
        type: "geojson",
        data: rawData,
      });
    }

    if (!map.getLayer(coloniesFillLayerId)) {
      map.addLayer({
        id: coloniesFillLayerId,
        type: "fill",
        source: coloniesSourceId,
        paint: {
          "fill-color": "#9f7aea",
          "fill-opacity": 0.18,
        },
      });
    }

    if (!map.getLayer(coloniesLineLayerId)) {
      map.addLayer({
        id: coloniesLineLayerId,
        type: "line",
        source: coloniesSourceId,
        paint: {
          "line-color": "#d8c7ff",
          "line-opacity": 0.42,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 6, 1.2],
        },
      });
    }

    return true;
  }

  function drawCircleLayer({
    features,
    sourceId,
    layerId,
    paint,
  }: CircleLayerConfig) {
    if (!map || !styleReady) return false;

    const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features,
    };

    if (data.features.length === 0) return false;

    const existingSource = map.getSource(sourceId) as
      | mapboxgl.GeoJSONSource
      | undefined;

    if (existingSource) {
      existingSource.setData(data);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data,
      });
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "circle",
        source: sourceId,
        paint,
      });
    }

    bringForegroundMarkersToFront();
    return true;
  }

  function drawStudentPointLayer({
    rawData,
    sourceId,
    layerId,
  }: DataLayerConfig) {
    return drawCircleLayer({
      features: getStudentPointFeatures(rawData),
      sourceId,
      layerId,
      paint: circleMarkerPaint,
    });
  }

  function drawEdinburghSevenLayer(rawData: unknown) {
    return drawCircleLayer({
      features: getEdinburghSevenPointFeatures(rawData),
      sourceId: edinburghSevenSourceId,
      layerId: edinburghSevenLayerId,
      paint: circleMarkerPaint,
    });
  }

  function drawTimelineMarkerCircle({
    year,
    sourceId,
    layerId,
  }: LayerConfig & { year: number }) {
    return drawCircleLayer({
      features: getTimelineMarkerFeatures(year),
      sourceId,
      layerId,
      paint: timelineMarkerCirclePaint,
    });
  }

  function syncTimelineMarkerLabels(
    features: GeoJSON.Feature<GeoJSON.Point>[],
  ) {
    if (!map) return;

    const activeMarkerKeys = new Set<string>();

    for (const feature of features) {
      const [longitude, latitude] = feature.geometry.coordinates;
      const label = String(feature.properties?.label ?? "");
      const markerKey = `${feature.properties?.id ?? ""}-${longitude}-${latitude}`;
      activeMarkerKeys.add(markerKey);

      const existingMarker = timelineLabelMarkers.get(markerKey);
      if (existingMarker) {
        existingMarker.getElement().textContent = label;
        continue;
      }

      const element = document.createElement("div");
      element.className = "timeline-image-marker-label";
      element.textContent = label;

      const marker = new mapboxgl.Marker({
        element,
        anchor: "left",
        offset: [8, 0],
      })
        .setLngLat([longitude, latitude])
        .addTo(map);
      timelineLabelMarkers.set(markerKey, marker);
    }

    for (const [markerKey, marker] of timelineLabelMarkers) {
      if (!activeMarkerKeys.has(markerKey)) {
        marker.remove();
        timelineLabelMarkers.delete(markerKey);
      }
    }
  }

  function drawTimelineMarkerLayers(year: number) {
    if (!map || !styleReady) return false;

    const labelFeatures = getTimelineMarkerFeatures(year);
    const features = [
      schoolOfMedicineForWomenYear,
      collegeOfMedicineForWomenYear,
    ].includes(Math.floor(year))
      ? []
      : labelFeatures;
    const dataKey = features
      .map((feature) => String(feature.properties?.id ?? ""))
      .join("|");
    const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features,
    };

    const existingSource = map.getSource(timelineMarkersSourceId) as
      | mapboxgl.GeoJSONSource
      | undefined;

    if (existingSource && dataKey !== timelineMarkersDataKey) {
      existingSource.setData(data);
      timelineMarkersDataKey = dataKey;
    } else if (!existingSource) {
      map.addSource(timelineMarkersSourceId, {
        type: "geojson",
        data,
      });
      timelineMarkersDataKey = dataKey;
    }

    if (!map.getLayer(timelineMarkersCircleLayerId)) {
      map.addLayer({
        id: timelineMarkersCircleLayerId,
        type: "circle",
        source: timelineMarkersSourceId,
        paint: timelineMarkerCirclePaint,
      });
    }

    if (map.getLayer(timelineMarkersTextLayerId)) {
      map.removeLayer(timelineMarkersTextLayerId);
    }

    syncTimelineMarkerLabels(labelFeatures);

    bringForegroundMarkersToFront();

    return true;
  }

  function drawWomenDoctorBirthplaceLayer({
    rawData,
    sourceId,
    layerId,
  }: DataLayerConfig) {
    return drawCircleLayer({
      features: getWomenDoctorBirthplaceFeatures(rawData),
      sourceId,
      layerId,
      paint: circleMarkerPaint,
    });
  }

  function drawWomenDoctorCareerLocationLayer({
    rawData,
    sourceId,
    layerId,
  }: DataLayerConfig) {
    const didDraw = drawCircleLayer({
      features: getWomenDoctorCareerLocationFeatures(rawData),
      sourceId,
      layerId,
      paint: circleMarkerPaint,
    });

    if (didDraw) {
      addWomenDoctorCareerHoverHandlers();
    }

    return didDraw;
  }

  function appendCareerPopupField(
    container: HTMLDivElement,
    label: string,
    value: unknown,
  ) {
    const text = String(value ?? "").trim();
    if (!text) return;

    const field = document.createElement("div");
    field.className = "women-doctor-career-popup-field";
    const fieldLabel = document.createElement("span");
    fieldLabel.className = "women-doctor-career-popup-label";
    fieldLabel.textContent = `${label}: `;
    field.append(fieldLabel, document.createTextNode(text));
    container.append(field);
  }

  function showWomenDoctorCareerPopup(event: mapboxgl.MapLayerMouseEvent) {
    if (!map) return;

    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== "Point") return;

    const properties = feature.properties ?? {};
    const content = document.createElement("div");
    content.className = "women-doctor-career-popup";
    const name = document.createElement("strong");
    name.className = "women-doctor-career-popup-name";
    name.textContent = String(properties.name ?? "Unknown doctor");
    content.append(name);

    appendCareerPopupField(content, "Location", properties.career_location);
    appendCareerPopupField(content, "Country", properties.country);
    appendCareerPopupField(content, "Region", properties.region);
    appendCareerPopupField(content, "Position", properties.position_1915);
    appendCareerPopupField(content, "Position code", properties.position_codes);
    appendCareerPopupField(content, "Specialism", properties.specialism);
    appendCareerPopupField(
      content,
      "First qualification",
      properties.first_qual,
    );
    appendCareerPopupField(
      content,
      "Student registration",
      properties.student_registration,
    );

    map.getCanvas().style.cursor = "pointer";
    womenDoctorCareerPopup ??= new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: "women-doctor-career-map-popup",
    });
    womenDoctorCareerPopup
      .setLngLat(event.lngLat)
      .setDOMContent(content)
      .addTo(map);
  }

  function hideWomenDoctorCareerPopup() {
    if (!map) return;

    map.getCanvas().style.cursor = "";
    womenDoctorCareerPopup?.remove();
  }

  function addWomenDoctorCareerHoverHandlers() {
    if (!map || hasWomenDoctorCareerHoverHandlers) return;

    map.on(
      "mouseenter",
      womenDoctorsCareerLocationsLayerId,
      showWomenDoctorCareerPopup,
    );
    map.on(
      "mouseleave",
      womenDoctorsCareerLocationsLayerId,
      hideWomenDoctorCareerPopup,
    );
    hasWomenDoctorCareerHoverHandlers = true;
  }

  function removeWomenDoctorCareerLocationLayer() {
    hideWomenDoctorCareerPopup();

    if (map && hasWomenDoctorCareerHoverHandlers) {
      map.off(
        "mouseenter",
        womenDoctorsCareerLocationsLayerId,
        showWomenDoctorCareerPopup,
      );
      map.off(
        "mouseleave",
        womenDoctorsCareerLocationsLayerId,
        hideWomenDoctorCareerPopup,
      );
      hasWomenDoctorCareerHoverHandlers = false;
    }

    removeCircleLayer({
      sourceId: womenDoctorsCareerLocationsSourceId,
      layerId: womenDoctorsCareerLocationsLayerId,
    });
  }

  function syncWomenDoctorsWarLocationLabels(
    features: GeoJSON.Feature<GeoJSON.Point>[],
  ) {
    if (!map) return;

    const activeMarkerKeys = new Set<string>();

    for (const feature of features) {
      const [longitude, latitude] = feature.geometry.coordinates;
      const location = String(feature.properties?.location ?? "Unknown");
      const value = String(feature.properties?.value ?? "");
      const markerKey = `${location}-${longitude}-${latitude}`;
      const label = `${location}\n${value}`;
      const labelPlacement =
        womenDoctorsWarLabelPlacements[location.toLowerCase()] ??
        defaultWomenDoctorsWarLabelPlacement;
      activeMarkerKeys.add(markerKey);

      const existingMarker = womenDoctorsWarLabelMarkers.get(markerKey);
      if (existingMarker) {
        existingMarker.getElement().textContent = label;
        continue;
      }

      const element = document.createElement("div");
      element.className = "women-doctors-war-location-label";
      element.textContent = label;

      const marker = new mapboxgl.Marker({
        element,
        anchor: labelPlacement.anchor,
        offset: labelPlacement.offset,
      })
        .setLngLat([longitude, latitude])
        .addTo(map);
      womenDoctorsWarLabelMarkers.set(markerKey, marker);
    }

    for (const [markerKey, marker] of womenDoctorsWarLabelMarkers) {
      if (!activeMarkerKeys.has(markerKey)) {
        marker.remove();
        womenDoctorsWarLabelMarkers.delete(markerKey);
      }
    }
  }

  function drawWomenDoctorsWarLocationLayer(rawData: unknown) {
    const features = getWomenDoctorsWarLocationFeatures(
      rawData,
      womenDoctorsWarYears,
    );
    const didDraw = drawCircleLayer({
      features,
      sourceId: womenDoctorsWarLocationsSourceId,
      layerId: womenDoctorsWarLocationsLayerId,
      paint: womenDoctorsWarCirclePaint,
    });

    if (!didDraw || !map || !styleReady) return false;
    syncWomenDoctorsWarLocationLabels(features);
    bringForegroundMarkersToFront();
    return true;
  }

  function removeWomenDoctorsWarLocationLayer() {
    for (const marker of womenDoctorsWarLabelMarkers.values()) {
      marker.remove();
    }
    womenDoctorsWarLabelMarkers.clear();

    removeLayerAndSource(
      womenDoctorsWarLocationsSourceId,
      womenDoctorsWarLocationsLayerId,
    );
  }

  function animateGeoJsonLineLayer({
    rawData,
    sourceId,
    layerId,
    milestoneYear,
    continueAfterMilestone = false,
    lineColor = "white",
    lineOpacity = 0.5,
    lineWidth = 1,
    durationMs = animatedLineDurationMs,
    reverse = false,
  }: AnimatedLineConfig) {
    if (!map || !styleReady || !isGeoJsonData(rawData)) {
      return false;
    }

    const initialData = getAnimatedLineFeatureCollection(rawData, 0, reverse);
    if (!initialData || initialData.features.length === 0) {
      return false;
    }

    const existingSource = map.getSource(sourceId) as
      | mapboxgl.GeoJSONSource
      | undefined;

    if (existingSource) {
      existingSource.setData(initialData);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: initialData,
      });
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": lineColor,
          "line-opacity": lineOpacity,
          "line-width": lineWidth,
        },
      });
    }

    const existingAnimationFrame = pathAnimationFrames.get(layerId);
    if (existingAnimationFrame !== undefined) {
      cancelAnimationFrame(existingAnimationFrame);
      pathAnimationFrames.delete(layerId);
    }

    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const nextData = getAnimatedLineFeatureCollection(
        rawData,
        progress,
        reverse,
      );
      if (nextData) {
        source.setData(nextData);
      }

      if (
        progress < 1 &&
        (continueAfterMilestone || currentYear === milestoneYear)
      ) {
        pathAnimationFrames.set(layerId, requestAnimationFrame(step));
      } else {
        pathAnimationFrames.delete(layerId);
      }
    };

    pathAnimationFrames.set(layerId, requestAnimationFrame(step));
    return true;
  }

  function startBarryJourney() {
    hasAnimatedBarryLine = animateJourneyLine({
      journeyData: barryJourneyData,
      sourceId: barrySourceId,
      lineLayerId: barryLineLayerId,
      lineColor: "white",
    });
    map.flyTo({
      center: [-5.2883, 53.55],
      zoom: 6.2,
      duration: 3000,
      essential: true,
    });
  }

  function startGarrettJourney() {
    hasAnimatedGarrettLine = animateJourneyLine({
      journeyData: garrettJourneyData,
      sourceId: garrettSourceId,
      lineLayerId: garrettLineLayerId,
      lineColor: "white",
    });
    map.flyTo({
      center: [-2.1883, 54.5533],
      duration: 2000,
      essential: true,
    });
  }

  function focusEdinburghClasses() {
    map.flyTo({
      center: [-3.18, 55.95],
      zoom: 13,
      duration: 3000,
      essential: true,
    });
  }

  // Historical colonies polygon layer is mounted as soon as the map and data are ready.
  $: if (map && styleReady && colonies) {
    drawColoniesLayer(colonies);
  }

  // Location labels appear once and stay visible after their timeline year.
  $: if (map && styleReady) {
    drawTimelineMarkerLayers(currentYear);
  }

  //// 1726
  // Show the historical Edinburgh map.
  $: if (
    map &&
    styleReady &&
    currentYear >= oldMapOverlayStartYear &&
    currentYear <= oldMapOverlayEndYear &&
    (!hasDrawnOldMapOverlay ||
      oldMapOverlayFadeTimeout !== null ||
      !map.getLayer(oldMapOverlayLayerId))
  ) {
    hasDrawnOldMapOverlay = drawOldMapOverlay();
    map.flyTo({
      center: [-3.192, 55.948],
      zoom: 15,
      duration: 1000,
      essential: true,
    });
  }

  // Fade out the historical map afterward.
  $: if (
    map &&
    styleReady &&
    currentYear > oldMapOverlayEndYear &&
    (hasDrawnOldMapOverlay || map.getLayer(oldMapOverlayLayerId))
  ) {
    fadeOutOldMapOverlay();
  }

  //// 1809
  // Draw Barry's journey.
  $: if (
    map &&
    styleReady &&
    currentYear === barryJourneyYear &&
    barryJourneyData &&
    !hasAnimatedBarryLine
  ) {
    startBarryJourney();
  }

  // Allow Barry's journey to replay.
  $: if (map && currentYear < barryJourneyYear) {
    hasAnimatedBarryLine = false;
  }

  // Remove Barry's journey afterward.
  $: if (
    map &&
    styleReady &&
    currentYear > barryJourneyYear &&
    (map.getLayer(barryLineLayerId) || map.getSource(barrySourceId))
  ) {
    cancelPathAnimation(barryLineLayerId);
    removeLayerAndSource(barrySourceId, barryLineLayerId);
  }

  //// 1862
  // Draw Garrett's journey.
  $: if (
    map &&
    styleReady &&
    currentYear >= garrettJourneyYear &&
    garrettJourneyData &&
    !hasAnimatedGarrettLine
  ) {
    startGarrettJourney();
  }

  // Allow Garrett's journey to replay.
  $: if (map && currentYear < garrettJourneyYear) {
    hasAnimatedGarrettLine = false;
  }

  // Remove Garrett's journey afterward.
  $: if (
    map &&
    styleReady &&
    currentYear > garrettJourneyYear &&
    (map.getLayer(garrettLineLayerId) || map.getSource(garrettSourceId))
  ) {
    cancelPathAnimation(garrettLineLayerId);
    removeLayerAndSource(garrettSourceId, garrettLineLayerId);
  }

  //// 1867
  // Focus on Edinburgh.
  $: if (map && styleReady && currentYear == firstClassesYear) {
    focusEdinburghClasses();
  }

  // Show map.
  $: if (
    map &&
    styleReady &&
    currentYear === firstClassesMapOverlayYear &&
    (!hasDrawnFirstClassesMapOverlay ||
      firstClassesMapOverlayFadeTimeout !== null ||
      !map.getLayer(firstClassesMapOverlayLayerId))
  ) {
    hasDrawnFirstClassesMapOverlay = drawFirstClassesMapOverlay();
  }

  // Fade out the first-classes map.
  $: if (
    map &&
    styleReady &&
    currentYear > firstClassesMapOverlayYear &&
    (hasDrawnFirstClassesMapOverlay ||
      map.getLayer(firstClassesMapOverlayLayerId))
  ) {
    fadeOutFirstClassesMapOverlay();
  }

  // Draw circles.
  $: if (
    map &&
    styleReady &&
    currentYear === firstClassesYear &&
    Array.isArray(firstClassesGeoData) &&
    firstClassesGeoData.length > 0
  ) {
    drawStudentPointLayer({
      rawData: firstClassesGeoData,
      sourceId: firstClassesSourceId,
      layerId: firstClassesLayerId,
    });
  }

  // Animate the students' paths.
  $: if (
    map &&
    styleReady &&
    currentYear === firstClassesYear &&
    isGeoJsonData(firstClassesPathsData) &&
    !hasAnimatedFirstClassesPaths
  ) {
    hasAnimatedFirstClassesPaths = animateGeoJsonLineLayer({
      rawData: firstClassesPathsData,
      sourceId: firstClassesPathsSourceId,
      layerId: firstClassesPathsLayerId,
      milestoneYear: firstClassesYear,
      lineColor: "black",
      durationMs: studentPathAnimationDurationMs,
    });
  }

  // Keep student points above their paths.
  $: if (
    map &&
    styleReady &&
    currentYear === firstClassesYear &&
    map.getLayer(firstClassesLayerId) &&
    map.getLayer(firstClassesPathsLayerId)
  ) {
    map.moveLayer(firstClassesLayerId);
  }

  // Clear the first-classes layers afterward.
  $: if (map && styleReady && currentYear > firstClassesYear) {
    cancelPathAnimation(firstClassesPathsLayerId);
    hasAnimatedFirstClassesPaths = false;
    removeLayerAndSource(firstClassesPathsSourceId, firstClassesPathsLayerId);
    removeCircleLayer({
      sourceId: firstClassesSourceId,
      layerId: firstClassesLayerId,
    });
  }

  //// 1869
  // Animate the Edinburgh Seven routes.
  $: if (
    map &&
    styleReady &&
    currentYear === edinburghSevenYear &&
    edinburghRoutes &&
    !hasAnimatedEdinburghRoutes
  ) {
    hasAnimatedEdinburghRoutes = animateGeoJsonLineLayer({
      rawData: edinburghRoutes,
      sourceId: edinburghRoutesSourceId,
      layerId: edinburghRoutesLineLayerId,
      milestoneYear: edinburghSevenYear,
    });
  }

  // Show the Edinburgh Seven markers.
  $: if (
    map &&
    styleReady &&
    currentYear === edinburghSevenYear &&
    Array.isArray(edinburghSevenData) &&
    edinburghSevenData.length > 0 &&
    !hasDrawnEdinburghSeven
  ) {
    hasDrawnEdinburghSeven = drawEdinburghSevenLayer(edinburghSevenData);
    map.flyTo({
      center: [7.1883, 54.5533],
      duration: 2000,
      zoom: 5,
      essential: true,
    });
  }

  // Clear the Edinburgh Seven layers outside this year.
  $: if (map && styleReady && currentYear !== edinburghSevenYear) {
    hasDrawnEdinburghSeven = false;
    removeCircleLayer({
      sourceId: edinburghSevenSourceId,
      layerId: edinburghSevenLayerId,
    });
    cancelPathAnimation(edinburghRoutesLineLayerId);
    hasAnimatedEdinburghRoutes = false;
    removeLayerAndSource(edinburghRoutesSourceId, edinburghRoutesLineLayerId);
  }

  //// 1870
  // Focus on Edinburgh and draw the route of the Surgeons' Hall riot.
  $: if (map && styleReady && currentYear == edinburghSevenRiotYear) {
    map.flyTo({
      center: [ -3.185, 55.9443],
      zoom: 15.5,
      duration: 2000,
      essential: true,
    });
  }

  $: if (
    map &&
    styleReady &&
    currentYear === edinburghSevenRiotYear &&
    riotData &&
    !hasAnimatedRiotRoute
  ) {
    hasAnimatedRiotRoute = animateGeoJsonLineLayer({
      rawData: riotData,
      sourceId: riotRouteSourceId,
      layerId: riotRouteLineLayerId,
      milestoneYear: edinburghSevenRiotYear,
      lineColor: "black",
      lineOpacity: 1,
      lineWidth: 5,
      durationMs: 10000,
    });
  }

  // Remove the route when leaving the 1870 milestone so it can replay on return.
  $: if (map && styleReady && currentYear !== edinburghSevenRiotYear) {
    cancelPathAnimation(riotRouteLineLayerId);
    hasAnimatedRiotRoute = false;
    removeLayerAndSource(riotRouteSourceId, riotRouteLineLayerId);
  }

  //// 1870–1875
  // Keep the historical physiology map visible through the 1875 milestone.
  $: if (
    map &&
    styleReady &&
    currentYear >= physiologyMapOverlayStartYear &&
    currentYear <= physiologyMapOverlayEndYear &&
    (!hasDrawnPhysiologyMapOverlay ||
      physiologyMapOverlayFadeTimeout !== null ||
      !map.getLayer(physiologyMapOverlayLayerId))
  ) {
    hasDrawnPhysiologyMapOverlay = drawPhysiologyMapOverlay();
  }

  // Fade out the physiology map after 1875.
  $: if (
    map &&
    styleReady &&
    currentYear > physiologyMapOverlayEndYear &&
    (hasDrawnPhysiologyMapOverlay || map.getLayer(physiologyMapOverlayLayerId))
  ) {
    fadeOutPhysiologyMapOverlay();
  }

  // Show the physiology students.
  $: if (
    map &&
    styleReady &&
    currentYear === physiologyYear &&
    Array.isArray(womenPhysiologyGeoData) &&
    womenPhysiologyGeoData.length > 0
  ) {
    drawStudentPointLayer({
      rawData: womenPhysiologyGeoData,
      sourceId: physiologyStudentsSourceId,
      layerId: physiologyStudentsLayerId,
    });
    focusEdinburghClasses();
  }

  // Animate the students' paths.
  $: if (
    map &&
    styleReady &&
    currentYear === physiologyYear &&
    isGeoJsonData(physiologyPathsData) &&
    !hasAnimatedPhysiologyPaths
  ) {
    hasAnimatedPhysiologyPaths = animateGeoJsonLineLayer({
      rawData: physiologyPathsData,
      sourceId: physiologyPathsSourceId,
      layerId: physiologyPathsLayerId,
      milestoneYear: physiologyYear,
      lineColor: "black",
      durationMs: studentPathAnimationDurationMs,
    });
  }

  // Keep student points above their paths.
  $: if (
    map &&
    styleReady &&
    currentYear === physiologyYear &&
    map.getLayer(physiologyStudentsLayerId) &&
    map.getLayer(physiologyPathsLayerId)
  ) {
    map.moveLayer(physiologyStudentsLayerId);
  }

  // Clear the physiology layers afterward.
  $: if (map && styleReady && currentYear > physiologyYear) {
    cancelPathAnimation(physiologyPathsLayerId);
    hasAnimatedPhysiologyPaths = false;
    removeLayerAndSource(physiologyPathsSourceId, physiologyPathsLayerId);
    removeCircleLayer({
      sourceId: physiologyStudentsSourceId,
      layerId: physiologyStudentsLayerId,
    });
  }

  //// 1886
  // Show the 1886 map.
  $: if (
    map &&
    styleReady &&
    currentYear === mapOverlay1886Year &&
    (!hasDrawn1886MapOverlay ||
      mapOverlay1886FadeTimeout !== null ||
      !map.getLayer(mapOverlay1886LayerId))
  ) {
    hasDrawn1886MapOverlay = draw1886MapOverlay();
  }

  // Show the School of Medicine for Women circle.
  $: if (map && styleReady && currentYear === schoolOfMedicineForWomenYear) {
    drawTimelineMarkerCircle({
      year: schoolOfMedicineForWomenYear,
      sourceId: schoolOfMedicineForWomenSourceId,
      layerId: schoolOfMedicineForWomenLayerId,
    });
  }

  // Remove the school circle outside this year.
  $: if (map && styleReady && currentYear !== schoolOfMedicineForWomenYear) {
    removeCircleLayer({
      sourceId: schoolOfMedicineForWomenSourceId,
      layerId: schoolOfMedicineForWomenLayerId,
    });
  }

  // Fade out the 1886 map afterward.
  $: if (
    map &&
    styleReady &&
    currentYear > mapOverlay1886EndYear &&
    (hasDrawn1886MapOverlay || map.getLayer(mapOverlay1886LayerId))
  ) {
    fadeOut1886MapOverlay();
  }

  //// 1889
  // Show the College of Medicine for Women circle.
  $: if (map && styleReady && currentYear === collegeOfMedicineForWomenYear) {
    drawTimelineMarkerCircle({
      year: collegeOfMedicineForWomenYear,
      sourceId: collegeOfMedicineForWomenSourceId,
      layerId: collegeOfMedicineForWomenLayerId,
    });
  }

  // Remove the college circle outside this year.
  $: if (map && styleReady && currentYear !== collegeOfMedicineForWomenYear) {
    removeCircleLayer({
      sourceId: collegeOfMedicineForWomenSourceId,
      layerId: collegeOfMedicineForWomenLayerId,
    });
  }

  //// 1911
  // Zoom out to the global overview.
  $: if (
    map &&
    currentYear >= womenDoctorsFocusYear &&
    !hasFocusedWomenDoctorsMilestone
  ) {
    map.flyTo({
      center: [70.1883, 10.9433],
      zoom: 1.5,
      duration: 2000,
      essential: true,
    });
    hasFocusedWomenDoctorsMilestone = true;
  }

  // // Animate the Suez route.
  // $: if (
  //   map &&
  //   styleReady &&
  //   currentYear >= suezRoutesReverseYear &&
  //   suez &&
  //   !hasAnimatedSuezRoutesReverse
  // ) {
  //   hasAnimatedSuezRoutesReverse = animateGeoJsonLineLayer({
  //     rawData: suez,
  //     sourceId: suezSourceId,
  //     layerId: suezLineLayerId,
  //     milestoneYear: suezRoutesReverseYear,
  //     continueAfterMilestone: true,
  //     lineColor: "#51d1c2",
  //     lineOpacity: 0.58,
  //     lineWidth: 1.4,
  //     reverse: true,
  //   });
  // }

  // Show women doctors' birthplaces.
  $: if (
    map &&
    styleReady &&
    currentYear >= womenDoctorsBirthplacesYear &&
    currentYear < womenDoctorsCareerLocationsYear &&
    Array.isArray(womenDoctorsData) &&
    womenDoctorsData.length > 0 &&
    !hasDrawnWomenDoctorBirthplaces
  ) {
    hasDrawnWomenDoctorBirthplaces = drawWomenDoctorBirthplaceLayer({
      rawData: womenDoctorsData,
      sourceId: womenDoctorsBirthplacesSourceId,
      layerId: womenDoctorsBirthplacesLayerId,
    });
  }

  // Clear 1911 birthplace circles.
  $: if (map && styleReady && currentYear >= womenDoctorsCareerLocationsYear) {
    hasDrawnWomenDoctorBirthplaces = false;
    removeCircleLayer({
      sourceId: womenDoctorsBirthplacesSourceId,
      layerId: womenDoctorsBirthplacesLayerId,
    });
  }

  //// 1915
  // Draw career location circles.
  $: if (
    map &&
    styleReady &&
    currentYear >= womenDoctorsCareerLocationsYear &&
    showWomenDoctorCareerLocations &&
    Array.isArray(womenCareers1915Data) &&
    womenCareers1915Data.length > 0 &&
    !hasDrawnWomenDoctorCareerLocations
  ) {
    hasDrawnWomenDoctorCareerLocations = drawWomenDoctorCareerLocationLayer({
      rawData: womenCareers1915Data,
      sourceId: womenDoctorsCareerLocationsSourceId,
      layerId: womenDoctorsCareerLocationsLayerId,
    });
  }

  // $: if (
  //   map &&
  //   styleReady &&
  //   currentYear >= suezRoutesForwardYear &&
  //   suez &&
  //   !hasAnimatedSuezRoutesForward
  // ) {
  //   hasAnimatedSuezRoutesForward = animateGeoJsonLineLayer({
  //     rawData: suez,
  //     sourceId: suezSourceId,
  //     layerId: suezLineLayerId,
  //     milestoneYear: suezRoutesForwardYear,
  //     continueAfterMilestone: true,
  //     lineColor: "#51d1c2",
  //     lineOpacity: 0.58,
  //     lineWidth: 1.4,
  //   });
  // }

  // Remove career location circles
  $: if (
    map &&
    styleReady &&
    (currentYear < womenDoctorsCareerLocationsYear ||
      !showWomenDoctorCareerLocations)
  ) {
    hasDrawnWomenDoctorCareerLocations = false;
    removeWomenDoctorCareerLocationLayer();
  }

  //// 1919
  // Show aggregated war-location circles.
  $: if (
    map &&
    styleReady &&
    showWomenDoctorsWarLocations &&
    !hasDrawnWomenDoctorsWarLocations
  ) {
    hasDrawnWomenDoctorsWarLocations =
      drawWomenDoctorsWarLocationLayer(womenDoctorsWarData);

    map.flyTo({
      center: [20.1883, 42.5533],
      duration: 2000,
      zoom: 3.5,
      essential: true,
    });
  }

  // Clear war-location circles outside this milestone.
  $: if (
    map &&
    styleReady &&
    !showWomenDoctorsWarLocations &&
    (hasDrawnWomenDoctorsWarLocations ||
      map.getLayer(womenDoctorsWarLocationsLayerId))
  ) {
    hasDrawnWomenDoctorsWarLocations = false;
    removeWomenDoctorsWarLocationLayer();
  }

  onMount(() => {
    mapboxgl.accessToken = envToken;
    mapboxgl.workerClass = MapboxWorker as unknown as new (
      ...args: unknown[]
    ) => Worker;

    map = new mapboxgl.Map({
      container: mapContainer,
      center: [-3.25, 55.95],
      zoom: 12,
      logoPosition: "top-right",
      // style: "mapbox://styles/mapbox/dark-v12",
      style: "mapbox://styles/tomasvancisin/cmub2wzm7009v01qt4sj39282",
      attributionControl: false,
      projection: "naturalEarth",
    });

    map.on("error", (event) => {
      console.error("Background map error", event.error);
    });

    map.on("load", () => {
      styleReady = true;
    });

    const handleResize = () => {
      map.resize();
    };

    map.on("load", handleResize);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearOldMapOverlayFade();
      clearFirstClassesMapOverlayFade();
      clearPhysiologyMapOverlayFade();
      clear1886MapOverlayFade();
      for (const frame of pathAnimationFrames.values()) {
        cancelAnimationFrame(frame);
      }
      pathAnimationFrames.clear();
      for (const marker of timelineLabelMarkers.values()) {
        marker.remove();
      }
      timelineLabelMarkers.clear();
      for (const marker of womenDoctorsWarLabelMarkers.values()) {
        marker.remove();
      }
      womenDoctorsWarLabelMarkers.clear();
      removeWomenDoctorCareerLocationLayer();
      removeCircleLayer({
        sourceId: edinburghSevenSourceId,
        layerId: edinburghSevenLayerId,
      });
      map.remove();
    };
  });
</script>

<div class="background-map">
  <div bind:this={mapContainer} class="map"></div>
</div>

<style>
  .background-map {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  .map {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  :global(.timeline-image-marker-label) {
    box-sizing: border-box;
    padding: 3px 6px;
    background: #000;
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    pointer-events: none;
    border-radius: 3px;
  }

  :global(.women-doctors-war-location-label) {
    box-sizing: border-box;
    padding: 3px 6px;
    background: #000;
    color: #fff;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
    text-align: center;
    white-space: pre-line;
    pointer-events: none;
    border-radius: 3px;
  }

  :global(.women-doctor-career-map-popup .mapboxgl-popup-content) {
    padding: 10px 12px;
    background: #111;
    color: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
    font-family: "Montserrat", sans-serif;
    font-size: 12px;
    line-height: 1.35;
  }

  :global(.women-doctor-career-popup) {
    max-width: 260px;
  }

  :global(.women-doctor-career-popup-name) {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
  }

  :global(.women-doctor-career-popup-field) {
    margin-top: 2px;
  }

  :global(.women-doctor-career-popup-label) {
    color: rgba(255, 255, 255, 0.65);
  }
</style>

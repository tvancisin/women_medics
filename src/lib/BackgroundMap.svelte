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
  } from "./map/featureBuilders";

  // Component inputs
  export let currentYear: number;
  export let garrettJourneyData: unknown = null;
  export let barryJourneyData: unknown = null;
  export let womenPhysiologyGeoData: unknown = null;
  export let firstClassesGeoData: unknown = null;
  export let firstClassesPathsData: unknown = null;
  export let physiologyPathsData: unknown = null;
  export let womenDoctorsData: unknown = null;
  export let womenCareers1915Data: unknown = null;
  export let colonies: unknown = null;
  export let suez: unknown = null;
  export let edinburghSevenData: unknown = null;

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
  let hasDrawnEdinburghSeven = false;
  let hasDrawnOldMapOverlay = false;
  let oldMapOverlayFadeTimeout: ReturnType<typeof setTimeout> | null = null;
  let hasDrawnWomenDoctorBirthplaces = false;
  let hasDrawnWomenDoctorCareerLocations = false;
  let hasFocusedWomenDoctorsMilestone = false;
  let hasFocusedOfficialMedicsMilestone = false;
  let timelineMarkersDataKey = "";
  const timelineLabelMarkers = new Map<string, mapboxgl.Marker>();
  const edinburghSevenMarkers = new Map<string, mapboxgl.Marker>();

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
  const timelineMarkersSourceId = "timeline-location-markers";
  const timelineMarkersCircleLayerId = "timeline-location-markers-circles";
  const timelineMarkersTextLayerId = "timeline-location-markers-text";
  const oldMapOverlaySourceId = "old-map-overlay-1726";
  const oldMapOverlayLayerId = "old-map-overlay-1726-raster";
  const coloniesSourceId = "colonies-1885";
  const coloniesFillLayerId = "colonies-1885-fill";
  const coloniesLineLayerId = "colonies-1885-line";
  const suezSourceId = "suez-routes";
  const suezLineLayerId = "suez-routes-line";
  const barryJourneyYear = 1809;
  const garrettJourneyYear = 1862;
  const firstClassesYear = 1867;
  const edinburghSevenYear = 1869;
  const physiologyYear = 1875;
  const oldMapOverlayStartYear = 1726;
  const oldMapOverlayEndYear = 1760;
  const historicalMapOverlayOpacity = 0.8;
  const historicalMapOverlayFadeDurationMs = 900;
  const womenDoctorsBirthplacesYear = 1911;
  const womenDoctorsFocusYear = 1911;
  const suezRoutesReverseYear = 1911;
  const suezRoutesForwardYear = 1912;
  const womenDoctorsCareerLocationsYear = 1912;
  const officialMedicsYear = 1914;
  const foregroundMarkerLayerIds = [
    firstClassesLayerId,
    physiologyStudentsLayerId,
    womenDoctorsBirthplacesLayerId,
    womenDoctorsCareerLocationsLayerId,
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
    "circle-color": "#f2c14e",
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

        if (coordinateSets.length === 0) {
          return [];
        }

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
                geometry: {
                  type: "LineString",
                  coordinates,
                },
              } satisfies GeoJSON.Feature<GeoJSON.LineString>,
            ];
          }

          const scaledIndex = clampedProgress * (coordinates.length - 1);
          const segmentIndex = Math.floor(scaledIndex);
          const t = scaledIndex - segmentIndex;
          const from = coordinates[segmentIndex];
          const to =
            coordinates[Math.min(segmentIndex + 1, coordinates.length - 1)];
          const interpolated: GeoJSON.Position = [
            from[0] + (to[0] - from[0]) * t,
            from[1] + (to[1] - from[1]) * t,
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

    return {
      type: "FeatureCollection",
      features,
    };
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

  function edinburghSevenImageUrl(img: unknown) {
    const fileName = String(img ?? "").trim();
    if (!fileName || fileName.toLowerCase() === "null") return "";

    // The portraits are static files in public/, so this also works when the
    // site is deployed below a sub-path (for example, on GitHub Pages).
    return `${import.meta.env.BASE_URL}img/edin_forty/${encodeURIComponent(fileName)}`;
  }

  function clearEdinburghSevenMarkers() {
    for (const marker of edinburghSevenMarkers.values()) {
      marker.remove();
    }
    edinburghSevenMarkers.clear();
  }

  function drawEdinburghSevenMarkers(rawData: unknown) {
    if (!map || !styleReady) return false;

    const features = getEdinburghSevenPointFeatures(rawData);
    if (features.length === 0) return false;

    const activeMarkerKeys = new Set<string>();

    for (const [index, feature] of features.entries()) {
      const [longitude, latitude] = feature.geometry.coordinates;
      const name = String(feature.properties?.name ?? "Unknown");
      const markerKey = `${index}-${longitude}-${latitude}`;
      const imageUrl = edinburghSevenImageUrl(feature.properties?.img);
      activeMarkerKeys.add(markerKey);

      const existingMarker = edinburghSevenMarkers.get(markerKey);
      if (existingMarker) {
        existingMarker.getElement().style.backgroundImage = imageUrl
          ? `url("${imageUrl}")`
          : "";
        continue;
      }

      const element = document.createElement("div");
      element.className = "edinburgh-seven-marker";
      element.title = name;
      element.setAttribute("aria-label", `${name}'s birthplace`);
      if (imageUrl) {
        element.style.backgroundImage = `url("${imageUrl}")`;
      }

      const marker = new mapboxgl.Marker({ element, anchor: "center" })
        .setLngLat([longitude, latitude])
        .addTo(map);
      edinburghSevenMarkers.set(markerKey, marker);
    }

    for (const [markerKey, marker] of edinburghSevenMarkers) {
      if (!activeMarkerKeys.has(markerKey)) {
        marker.remove();
        edinburghSevenMarkers.delete(markerKey);
      }
    }

    return true;
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

    const features = getTimelineMarkerFeatures(year);
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

    syncTimelineMarkerLabels(features);

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
    return drawCircleLayer({
      features: getWomenDoctorCareerLocationFeatures(rawData),
      sourceId,
      layerId,
      paint: circleMarkerPaint,
    });
  }

  function animateGeoJsonLineLayer({
    rawData,
    sourceId,
    layerId,
    milestoneYear,
    continueAfterMilestone = false,
    lineColor = "white",
    lineOpacity = 0.3,
    lineWidth = 1,
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
    const durationMs = 10000;
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
      center: [-5.1883, 54.5533],
      zoom: 5.5,
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
      center: [-3.21, 55.9533],
      zoom: 13,
      duration: 3000,
      essential: true,
    });
  }

  // Timeline reactions
  // Historical colonies polygon layer is mounted as soon as the map and data are ready.
  $: if (map && styleReady && colonies) {
    drawColoniesLayer(colonies);
  }

  // Location labels appear once and stay visible after their timeline year.
  $: if (map && styleReady) {
    drawTimelineMarkerLayers(currentYear);
  }

  //// year 1726
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
      zoom: 14.5,
      duration: 1000,
      essential: true,
    });
  }

  // Journey milestones draw animated routes and move the camera to the route.
  $: if (
    map &&
    styleReady &&
    currentYear === barryJourneyYear &&
    barryJourneyData &&
    !hasAnimatedBarryLine
  ) {
    startBarryJourney();
  }

  $: if (
    map &&
    styleReady &&
    currentYear >= garrettJourneyYear &&
    garrettJourneyData &&
    !hasAnimatedGarrettLine
  ) {
    startGarrettJourney();
  }

  $: if (
    map &&
    styleReady &&
    currentYear >= suezRoutesReverseYear &&
    suez &&
    !hasAnimatedSuezRoutesReverse
  ) {
    hasAnimatedSuezRoutesReverse = animateGeoJsonLineLayer({
      rawData: suez,
      sourceId: suezSourceId,
      layerId: suezLineLayerId,
      milestoneYear: suezRoutesReverseYear,
      continueAfterMilestone: true,
      lineColor: "#51d1c2",
      lineOpacity: 0.58,
      lineWidth: 1.4,
      reverse: true,
    });
  }

  $: if (
    map &&
    styleReady &&
    currentYear >= suezRoutesForwardYear &&
    suez &&
    !hasAnimatedSuezRoutesForward
  ) {
    hasAnimatedSuezRoutesForward = animateGeoJsonLineLayer({
      rawData: suez,
      sourceId: suezSourceId,
      layerId: suezLineLayerId,
      milestoneYear: suezRoutesForwardYear,
      continueAfterMilestone: true,
      lineColor: "#51d1c2",
      lineOpacity: 0.58,
      lineWidth: 1.4,
    });
  }

  $: if (map && styleReady && currentYear == firstClassesYear) {
    focusEdinburghClasses();
  }

  $: if (
    map &&
    styleReady &&
    currentYear < oldMapOverlayStartYear &&
    (hasDrawnOldMapOverlay ||
      map.getLayer(oldMapOverlayLayerId) ||
      map.getSource(oldMapOverlaySourceId))
  ) {
    removeOldMapOverlay();
  }

  $: if (
    map &&
    styleReady &&
    currentYear > oldMapOverlayEndYear &&
    (hasDrawnOldMapOverlay || map.getLayer(oldMapOverlayLayerId))
  ) {
    fadeOutOldMapOverlay();
  }

  $: if (
    map &&
    styleReady &&
    currentYear >= officialMedicsYear &&
    !hasFocusedOfficialMedicsMilestone
  ) {
    focusEdinburghClasses();
    hasFocusedOfficialMedicsMilestone = true;
  }

  // First women attending classes: draw student points and animated walking paths.
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
    });
  }

  $: if (
    map &&
    styleReady &&
    currentYear === firstClassesYear &&
    map.getLayer(firstClassesLayerId) &&
    map.getLayer(firstClassesPathsLayerId)
  ) {
    map.moveLayer(firstClassesLayerId);
  }

  // Edinburgh Seven/Forty: show birthplace markers at the 1869 milestone.
  $: if (
    map &&
    styleReady &&
    currentYear === edinburghSevenYear &&
    Array.isArray(edinburghSevenData) &&
    edinburghSevenData.length > 0 &&
    !hasDrawnEdinburghSeven
  ) {
    hasDrawnEdinburghSeven = drawEdinburghSevenMarkers(edinburghSevenData);
    map.flyTo({
      center: [20.1883, 40.9433],
      zoom: 3,
      duration: 2000,
      essential: true,
    });
  }

  // Physiology students: draw the later student cohort and associated paths.
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
    });
  }

  $: if (
    map &&
    styleReady &&
    currentYear === physiologyYear &&
    map.getLayer(physiologyStudentsLayerId) &&
    map.getLayer(physiologyPathsLayerId)
  ) {
    map.moveLayer(physiologyStudentsLayerId);
  }

  // Women doctors: show birthplace distribution once enough data is in scope.
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

  // Career locations replace birthplace distribution at the next story beat.
  $: if (
    map &&
    styleReady &&
    currentYear >= womenDoctorsCareerLocationsYear &&
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

  // Reset state when the user scrubs backward so route animations can replay.
  $: if (map && currentYear < garrettJourneyYear) {
    hasAnimatedGarrettLine = false;
  }

  $: if (map && currentYear < barryJourneyYear) {
    hasAnimatedBarryLine = false;
  }

  $: if (map && styleReady && currentYear !== edinburghSevenYear) {
    hasDrawnEdinburghSeven = false;
    clearEdinburghSevenMarkers();
  }

  // Remove one-off journey routes after their focused timeline moment.
  $: if (
    map &&
    styleReady &&
    currentYear > barryJourneyYear &&
    (map.getLayer(barryLineLayerId) || map.getSource(barrySourceId))
  ) {
    cancelPathAnimation(barryLineLayerId);
    removeLayerAndSource(barrySourceId, barryLineLayerId);
  }

  $: if (
    map &&
    styleReady &&
    currentYear > garrettJourneyYear &&
    (map.getLayer(garrettLineLayerId) || map.getSource(garrettSourceId))
  ) {
    cancelPathAnimation(garrettLineLayerId);
    removeLayerAndSource(garrettSourceId, garrettLineLayerId);
  }

  // Remove transient student/path layers after their focused timeline moment.
  $: if (map && styleReady && currentYear > firstClassesYear) {
    cancelPathAnimation(firstClassesPathsLayerId);
    hasAnimatedFirstClassesPaths = false;
    removeLayerAndSource(firstClassesPathsSourceId, firstClassesPathsLayerId);
    removeCircleLayer({
      sourceId: firstClassesSourceId,
      layerId: firstClassesLayerId,
    });
  }

  $: if (map && styleReady && currentYear > physiologyYear) {
    cancelPathAnimation(physiologyPathsLayerId);
    hasAnimatedPhysiologyPaths = false;
    removeLayerAndSource(physiologyPathsSourceId, physiologyPathsLayerId);
    removeCircleLayer({
      sourceId: physiologyStudentsSourceId,
      layerId: physiologyStudentsLayerId,
    });
  }

  // Hide birthplace data when scrubbing before that part of the story.
  $: if (map && styleReady && currentYear < womenDoctorsBirthplacesYear) {
    hasDrawnWomenDoctorBirthplaces = false;
    hasFocusedWomenDoctorsMilestone = false;
    removeCircleLayer({
      sourceId: womenDoctorsBirthplacesSourceId,
      layerId: womenDoctorsBirthplacesLayerId,
    });
  }

  $: if (map && styleReady && currentYear >= womenDoctorsCareerLocationsYear) {
    hasDrawnWomenDoctorBirthplaces = false;
    removeCircleLayer({
      sourceId: womenDoctorsBirthplacesSourceId,
      layerId: womenDoctorsBirthplacesLayerId,
    });
  }

  $: if (map && styleReady && currentYear < womenDoctorsCareerLocationsYear) {
    hasDrawnWomenDoctorCareerLocations = false;
    removeCircleLayer({
      sourceId: womenDoctorsCareerLocationsSourceId,
      layerId: womenDoctorsCareerLocationsLayerId,
    });
  }

  $: if (map && styleReady && currentYear < officialMedicsYear) {
    hasFocusedOfficialMedicsMilestone = false;
  }

  // Later timeline overview: zoom out to the broader women doctors distribution.
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
      style: "mapbox://styles/mapbox/dark-v11",
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
      for (const frame of pathAnimationFrames.values()) {
        cancelAnimationFrame(frame);
      }
      pathAnimationFrames.clear();
      for (const marker of timelineLabelMarkers.values()) {
        marker.remove();
      }
      timelineLabelMarkers.clear();
      clearEdinburghSevenMarkers();
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

  /* These DOM markers allow portraits to be cropped into circles. Markers
   * without an image leave background-image unset and use this grey fallback.
   */
  :global(.edinburgh-seven-marker) {
    width: 30px;
    height: 30px;
    box-sizing: border-box;
    border: 1px solid rgba(0, 0, 0, 0.9);
    border-radius: 50%;
    background-color: #777;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }
</style>

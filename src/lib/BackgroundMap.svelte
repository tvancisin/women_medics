<script lang="ts">
  import { onMount } from "svelte";
  import mapboxgl from "mapbox-gl";
  import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker";
  import { timelineImageMarkers } from "../datastore";
  import "mapbox-gl/dist/mapbox-gl.css";

  // Component inputs
  export let currentYear: number;
  export let garrettJourneyData: unknown = null;
  export let barryJourneyData: unknown = null;
  export let womenPhysiologyGeoData: unknown = null;
  export let firstClassesGeoData: unknown = null;
  export let firstClassesPathsData: unknown = null;
  export let physiologyPathsData: unknown = null;
  export let womenDoctorsData: unknown = null;
  export let colonies: unknown = null;

  // Local Mapbox state
  let map: mapboxgl.Map;
  let mapContainer: HTMLDivElement;
  let styleReady = false;
  let animationFrame: number;
  const pathAnimationFrames = new Map<string, number>();
  let hasAnimatedBarryLine = false;
  let hasAnimatedGarrettLine = false;
  let hasAnimatedFirstClassesPaths = false;
  let hasAnimatedPhysiologyPaths = false;
  let hasDrawnWomenDoctorBirthplaces = false;
  let hasDrawnWomenDoctorCareerLocations = false;
  let hasFocusedWomenDoctorsMilestone = false;
  let hasFocusedOfficialMedicsMilestone = false;
  let timelineMarkersDataKey = "";

  // Raw data from JSON/CSV loaders is intentionally typed defensively here.
  // The conversion helpers below validate coordinates before drawing anything.
  type StudentGeoDatum = {
    source_data?: {
      entry_year?: number | string;
      name?: string;
      lat?: number | string;
      lon?: number | string;
      university_address?: {
        original_name?: string;
        lat?: number | string;
        lon?: number | string;
      };
    };
  };

  type WomenDoctorDatum = {
    name?: {
      original?: string;
    };
    source_data?: {
      "First Qual"?: number | string | null;
      "Year of student registration"?: number | string | null;
      name?: string;
      birthplace?: {
        country?: string | null;
        country_code?: string | null;
        lat?: number | string | null;
        lon?: number | string | null;
        original_name?: string | null;
        place_name?: string | null;
      } | null;
      career_locations?: Array<{
        year?: number | string | null;
        country?: string | null;
        country_code?: string | null;
        lat?: number | string | null;
        lon?: number | string | null;
        original_name?: string | null;
        place_name?: string | null;
      }> | null;
    };
  };

  type LayerConfig = {
    sourceId: string;
    layerId: string;
  };

  type DataLayerConfig = LayerConfig & {
    rawData: unknown;
  };

  type JourneyLineConfig = {
    journeyData: unknown;
    sourceId: string;
    lineLayerId: string;
    lineColor: string;
  };

  type AnimatedLineConfig = DataLayerConfig & {
    milestoneYear: number;
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
  const coloniesSourceId = "colonies-1885";
  const coloniesFillLayerId = "colonies-1885-fill";
  const coloniesLineLayerId = "colonies-1885-line";
  const barryJourneyYear = 1809;
  const garrettJourneyYear = 1862;
  const firstClassesYear = 1867;
  const physiologyYear = 1875;
  const womenDoctorsBirthplacesYear = 1884;
  const womenDoctorsFocusYear = 1911;
  const womenDoctorsCareerLocationsYear = 1912;
  const barryJourneyDimYear = 1810;
  const garrettJourneyDimYear = 1864;
  const officialMedicsYear = 1914;

  // Data normalization helpers: convert loose imported data into GeoJSON shapes
  // that Mapbox can render consistently.
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

  const getStudentPointFeatures = (
    rawData: unknown,
  ): GeoJSON.Feature<GeoJSON.Point>[] => {
    if (!Array.isArray(rawData)) {
      return [];
    }

    return (rawData as StudentGeoDatum[]).flatMap((row) => {
      const sourceData = row.source_data;
      const universityAddress = sourceData?.university_address;
      const directLat = Number(sourceData?.lat);
      const directLon = Number(sourceData?.lon);
      const addressLat = Number(universityAddress?.lat);
      const addressLon = Number(universityAddress?.lon);
      const lat = Number.isFinite(directLat) ? directLat : addressLat;
      const lon = Number.isFinite(directLon) ? directLon : addressLon;

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return [];
      }

      const feature: GeoJSON.Feature<GeoJSON.Point> = {
        type: "Feature",
        properties: {
          name: sourceData?.name ?? "Unknown",
          entry_year: sourceData?.entry_year ?? null,
          address: universityAddress?.original_name ?? "",
        },
        geometry: {
          type: "Point",
          coordinates: [lon, lat],
        },
      };

      return [feature];
    });
  };

  const getWomenDoctorBirthplaceFeatures = (
    rawData: unknown,
  ): GeoJSON.Feature<GeoJSON.Point>[] => {
    if (!Array.isArray(rawData)) {
      return [];
    }

    return (rawData as WomenDoctorDatum[]).flatMap((row) => {
      const sourceData = row.source_data;
      const birthplace = sourceData?.birthplace;
      const lat = Number(birthplace?.lat);
      const lon = Number(birthplace?.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return [];
      }

      const feature: GeoJSON.Feature<GeoJSON.Point> = {
        type: "Feature",
        properties: {
          name: sourceData?.name ?? row.name?.original ?? "Unknown",
          first_qual: sourceData?.["First Qual"] ?? null,
          student_registration:
            sourceData?.["Year of student registration"] ?? null,
          birthplace:
            birthplace?.place_name ?? birthplace?.original_name ?? "Unknown",
          birthplace_original: birthplace?.original_name ?? "",
          country: birthplace?.country ?? "",
          country_code: birthplace?.country_code ?? "",
        },
        geometry: {
          type: "Point",
          coordinates: [lon, lat],
        },
      };

      return [feature];
    });
  };

  const getWomenDoctorCareerLocationFeatures = (
    rawData: unknown,
  ): GeoJSON.Feature<GeoJSON.Point>[] => {
    if (!Array.isArray(rawData)) {
      return [];
    }

    return (rawData as WomenDoctorDatum[]).flatMap((row) => {
      const sourceData = row.source_data;
      const careerLocations = sourceData?.career_locations;

      if (!Array.isArray(careerLocations)) {
        return [];
      }

      return careerLocations.flatMap((careerLocation, index) => {
        const lat = Number(careerLocation.lat);
        const lon = Number(careerLocation.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return [];
        }

        const feature: GeoJSON.Feature<GeoJSON.Point> = {
          type: "Feature",
          properties: {
            name: sourceData?.name ?? row.name?.original ?? "Unknown",
            first_qual: sourceData?.["First Qual"] ?? null,
            student_registration:
              sourceData?.["Year of student registration"] ?? null,
            career_year: careerLocation.year ?? null,
            career_location:
              careerLocation.place_name ??
              careerLocation.original_name ??
              "Unknown",
            career_location_original: careerLocation.original_name ?? "",
            country: careerLocation.country ?? "",
            country_code: careerLocation.country_code ?? "",
            location_index: index,
          },
          geometry: {
            type: "Point",
            coordinates: [lon, lat],
          },
        };

        return [feature];
      });
    });
  };

  const getTimelineMarkerFeatures = (
    year: number,
  ): GeoJSON.Feature<GeoJSON.Point>[] => {
    const displayYear = Math.floor(year);

    return timelineImageMarkers
      .filter((marker) => marker.year === displayYear)
      .map(({ id, year: markerYear, coordinates, alt }) => {
        const [latitude, longitude] = coordinates;

        return {
          type: "Feature",
          properties: {
            id,
            year: markerYear,
            label: alt,
          },
          geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
        };
      });
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

    if (animationFrame) cancelAnimationFrame(animationFrame);

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
      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
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

  function cancelPathAnimation(layerId: string) {
    const frame = pathAnimationFrames.get(layerId);
    if (frame === undefined) return;

    cancelAnimationFrame(frame);
    pathAnimationFrames.delete(layerId);
  }

  const getAnimatedLineFeatureCollection = (
    rawData: unknown,
    progress: number,
  ): GeoJSON.FeatureCollection<GeoJSON.LineString> | null => {
    if (!isGeoJsonData(rawData) || rawData.type !== "FeatureCollection") {
      return null;
    }

    const clampedProgress = Math.min(1, Math.max(0, progress));
    const features = (rawData as GeoJSON.FeatureCollection).features.flatMap(
      (feature) => {
        if (feature.geometry?.type !== "LineString") {
          return [];
        }

        const coordinates = feature.geometry.coordinates as GeoJSON.Position[];
        if (coordinates.length === 0) return [];

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
        const to = coordinates[Math.min(segmentIndex + 1, coordinates.length - 1)];
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
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            0.4,
            6,
            1.2,
          ],
        },
      });
    }

    return true;
  }

  function drawStudentPointLayer({
    rawData,
    sourceId,
    layerId,
  }: DataLayerConfig) {
    if (!map || !styleReady) return false;

    const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: getStudentPointFeatures(rawData),
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
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 4],
          "circle-color": "white",
          "circle-opacity": 0.85,
          "circle-stroke-color": "#111",
          "circle-stroke-width": 1,
        },
      });
    }

    return true;
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
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            1,
            8,
            3,
            12,
            6,
            14,
            8,
          ],
          "circle-color": "#ffffff",
          "circle-opacity": 0.95,
          "circle-stroke-color": "#202020",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            0.25,
            12,
            1.5,
          ],
        },
      });
    }

    if (!map.getLayer(timelineMarkersTextLayerId)) {
      map.addLayer({
        id: timelineMarkersTextLayerId,
        type: "symbol",
        source: timelineMarkersSourceId,
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            3,
            8,
            7,
            12,
            13,
            14,
            16,
          ],
          "text-anchor": "left",
          "text-offset": [0.8, 0],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0, 0, 0, 0.85)",
          "text-halo-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            0.25,
            12,
            1.5,
          ],
        },
      });
    }

    if (map.getLayer(timelineMarkersCircleLayerId)) {
      map.moveLayer(timelineMarkersCircleLayerId);
    }

    if (map.getLayer(timelineMarkersTextLayerId)) {
      map.moveLayer(timelineMarkersTextLayerId);
    }

    return true;
  }

  function drawWomenDoctorBirthplaceLayer({
    rawData,
    sourceId,
    layerId,
  }: DataLayerConfig) {
    if (!map || !styleReady) return false;

    const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: getWomenDoctorBirthplaceFeatures(rawData),
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
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            1.5,
            5,
            2,
            8,
            3,
          ],
          "circle-color": "#f2c14e",
          "circle-opacity": 0.92,
          "circle-stroke-color": "white",
          "circle-stroke-opacity": 1,
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            0.6,
            8,
            1,
          ],
        },
      });
    }

    return true;
  }

  function drawWomenDoctorCareerLocationLayer({
    rawData,
    sourceId,
    layerId,
  }: DataLayerConfig) {
    if (!map || !styleReady) return false;

    const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: getWomenDoctorCareerLocationFeatures(rawData),
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
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            1.7,
            5,
            2.3,
            8,
            3.4,
          ],
          "circle-color": "#51d1c2",
          "circle-opacity": 0.9,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.95,
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            0.5,
            8,
            1,
          ],
        },
      });
    }

    return true;
  }

  function animateGeoJsonLineLayer({
    rawData,
    sourceId,
    layerId,
    milestoneYear,
  }: AnimatedLineConfig) {
    if (!map || !styleReady || !isGeoJsonData(rawData)) {
      return false;
    }

    const initialData = getAnimatedLineFeatureCollection(rawData, 0);
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
          "line-color": "white",
          "line-opacity": 0.3,
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
      const nextData = getAnimatedLineFeatureCollection(rawData, progress);
      if (nextData) {
        source.setData(nextData);
      }

      if (progress < 1 && currentYear === milestoneYear) {
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
      center: [-3.23, 55.9533],
      zoom: 12.5,
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

  $: if (map && styleReady && currentYear == firstClassesYear) {
    focusEdinburghClasses();
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
    Array.isArray(womenDoctorsData) &&
    womenDoctorsData.length > 0 &&
    !hasDrawnWomenDoctorCareerLocations
  ) {
    hasDrawnWomenDoctorCareerLocations = drawWomenDoctorCareerLocationLayer({
      rawData: womenDoctorsData,
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

  // Dim completed journeys after their main story beat has passed.
  $: if (
    map &&
    currentYear >= garrettJourneyDimYear &&
    map.getLayer(garrettLineLayerId)
  ) {
    map.setPaintProperty(garrettLineLayerId, "line-opacity", 0.3);
  }

  $: if (
    map &&
    currentYear >= barryJourneyDimYear &&
    map.getLayer(barryLineLayerId)
  ) {
    map.setPaintProperty(barryLineLayerId, "line-opacity", 0.3);
  }

  // Remove transient student/path layers after their focused timeline moment.
  $: if (map && styleReady && currentYear > firstClassesYear) {
    cancelPathAnimation(firstClassesPathsLayerId);
    hasAnimatedFirstClassesPaths = false;
    removeLayerAndSource(firstClassesPathsSourceId, firstClassesPathsLayerId);
    removeLayerAndSource(firstClassesSourceId, firstClassesLayerId);
  }

  $: if (map && styleReady && currentYear > physiologyYear) {
    cancelPathAnimation(physiologyPathsLayerId);
    hasAnimatedPhysiologyPaths = false;
    removeLayerAndSource(physiologyPathsSourceId, physiologyPathsLayerId);
    removeLayerAndSource(physiologyStudentsSourceId, physiologyStudentsLayerId);
  }

  // Hide birthplace data when scrubbing before that part of the story.
  $: if (map && styleReady && currentYear < womenDoctorsBirthplacesYear) {
    hasDrawnWomenDoctorBirthplaces = false;
    hasFocusedWomenDoctorsMilestone = false;
    removeLayerAndSource(
      womenDoctorsBirthplacesSourceId,
      womenDoctorsBirthplacesLayerId,
    );
  }

  $: if (map && styleReady && currentYear >= womenDoctorsCareerLocationsYear) {
    hasDrawnWomenDoctorBirthplaces = false;
    removeLayerAndSource(
      womenDoctorsBirthplacesSourceId,
      womenDoctorsBirthplacesLayerId,
    );
  }

  $: if (map && styleReady && currentYear < womenDoctorsCareerLocationsYear) {
    hasDrawnWomenDoctorCareerLocations = false;
    removeLayerAndSource(
      womenDoctorsCareerLocationsSourceId,
      womenDoctorsCareerLocationsLayerId,
    );
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
      center: [-3.1883, 55.9533],
      zoom: 12,
      // pitch: 60,
      logoPosition: "top-right",
      style: "mapbox://styles/mapbox/dark-v11",
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
      if (animationFrame) cancelAnimationFrame(animationFrame);
      for (const frame of pathAnimationFrames.values()) {
        cancelAnimationFrame(frame);
      }
      pathAnimationFrames.clear();
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
</style>

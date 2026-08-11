<script lang="ts">
  import { onMount } from "svelte";
  import mapboxgl from "mapbox-gl";
  import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker";
  import "mapbox-gl/dist/mapbox-gl.css";

  export let currentYear: number;
  export let garrettJourneyData: unknown = null;
  export let barryJourneyData: unknown = null;
  export let womenPhysiologyGeoData: unknown = null;
  export let firstClassesGeoData: unknown = null;
  export let firstClassesPathsData: unknown = null;
  export let physiologyPathsData: unknown = null;

  let map: mapboxgl.Map;
  let mapContainer: HTMLDivElement;
  let styleReady = false;
  let animationFrame: number;
  let pathAnimationFrames = new Map<string, number>();
  let hasAnimatedBarryLine = false;
  let hasAnimatedGarrettLine = false;
  let hasFocusedBarryMilestone = false;
  let hasAnimatedFirstClassesPaths = false;
  let hasAnimatedPhysiologyPaths = false;
  let imageMarkers = new Map<string, mapboxgl.Marker>();

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

  type ImageMarkerConfig = {
    id: string;
    year: number;
    coordinates: [number, number];
    imageName: string;
    alt: string;
  };

  const rawEnvToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  const envToken = (rawEnvToken ?? "").trim().replace(/^"|"$/g, "");
  const baseUrl = import.meta.env.BASE_URL;
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
  const timelineImageMarkers: ImageMarkerConfig[] = [
    {
      id: "university-founded",
      year: 1583,
      coordinates: [55.94741706177913, -3.1872452967325717],
      imageName: "uni_logo.png",
      alt: "University of Edinburgh",
    },
    {
      id: "school-of-medicine",
      year: 1726,
      coordinates: [55.94528777582195, -3.190270487035351],
      imageName: "uni_logo.png",
      alt: "School of Medicine",
    },
    {
      id: "school",
      year: 1886,
      coordinates: [55.94884986998478, -3.1830358396746496],
      imageName: "uni_logo.png",
      alt: "Schoolof Medicine",
    },
    {
      id: "college",
      year: 1889,
      coordinates: [55.94772479242563, -3.1889092603064184],
      imageName: "uni_logo.png",
      alt: "College of Medicine",
    },
  ];

  const addImageMarker = ({
    id,
    coordinates,
    imageName,
    alt,
  }: ImageMarkerConfig) => {
    if (!map || imageMarkers.has(id)) return;

    const [latitude, longitude] = coordinates;
    const markerImage = document.createElement("img");
    markerImage.src = `${baseUrl}img/${imageName}`;
    markerImage.alt = alt;
    markerImage.style.width = "15px";
    markerImage.style.height = "15px";
    markerImage.style.display = "block";
    markerImage.style.objectFit = "contain";

    const marker = new mapboxgl.Marker({
      element: markerImage,
      anchor: "center",
    })
      .setLngLat([longitude, latitude])
      .addTo(map);

    imageMarkers.set(id, marker);
  };

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

  const animateJourneyLine = ({
    journeyData,
    sourceId,
    lineLayerId,
    lineColor,
  }: {
    journeyData: unknown;
    sourceId: string;
    lineLayerId: string;
    lineColor: string;
  }) => {
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

  $: if (map) {
    for (const marker of timelineImageMarkers) {
      if (currentYear >= marker.year) {
        addImageMarker(marker);
      }
    }
  }

  $: if (
    map &&
    styleReady &&
    currentYear === 1809 &&
    barryJourneyData &&
    !hasAnimatedBarryLine
  ) {
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
    hasFocusedBarryMilestone = true;
  }

  $: if (
    map &&
    styleReady &&
    currentYear >= 1862 &&
    garrettJourneyData &&
    !hasAnimatedGarrettLine
  ) {
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

  $: if (map && styleReady && currentYear >= 1867) {
    map.flyTo({
      center: [-3.1883, 55.9533],
      zoom: 12,
      duration: 3000,
      essential: true,
    });
  }

  function removeLayerAndSource(sourceId: string, layerId: string) {
    if (!map || !styleReady) return;

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
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

  function drawStudentPointLayer({
    rawData,
    sourceId,
    layerId,
  }: {
    rawData: unknown;
    sourceId: string;
    layerId: string;
  }) {
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

  function drawGeoJsonLineLayer({
    rawData,
    sourceId,
    layerId,
  }: {
    rawData: unknown;
    sourceId: string;
    layerId: string;
  }) {
    if (!map || !styleReady || !isGeoJsonData(rawData)) {
      return false;
    }

    const data = rawData as GeoJSON.GeoJSON;
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
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "white",
          "line-opacity": 0.3,
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
  }: {
    rawData: unknown;
    sourceId: string;
    layerId: string;
    milestoneYear: number;
  }) {
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

  $: if (
    map &&
    styleReady &&
    currentYear === 1867 &&
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
    currentYear === 1867 &&
    isGeoJsonData(firstClassesPathsData) &&
    !hasAnimatedFirstClassesPaths
  ) {
    hasAnimatedFirstClassesPaths = animateGeoJsonLineLayer({
      rawData: firstClassesPathsData,
      sourceId: firstClassesPathsSourceId,
      layerId: firstClassesPathsLayerId,
      milestoneYear: 1867,
    });
  }

  $: if (
    map &&
    styleReady &&
    currentYear === 1867 &&
    map.getLayer(firstClassesLayerId) &&
    map.getLayer(firstClassesPathsLayerId)
  ) {
    map.moveLayer(firstClassesLayerId);
  }

  $: if (
    map &&
    styleReady &&
    currentYear === 1875 &&
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
    currentYear === 1875 &&
    isGeoJsonData(physiologyPathsData) &&
    !hasAnimatedPhysiologyPaths
  ) {
    hasAnimatedPhysiologyPaths = animateGeoJsonLineLayer({
      rawData: physiologyPathsData,
      sourceId: physiologyPathsSourceId,
      layerId: physiologyPathsLayerId,
      milestoneYear: 1875,
    });
  }

  $: if (
    map &&
    styleReady &&
    currentYear === 1875 &&
    map.getLayer(physiologyStudentsLayerId) &&
    map.getLayer(physiologyPathsLayerId)
  ) {
    map.moveLayer(physiologyStudentsLayerId);
  }

  $: if (map && currentYear < 1862) {
    hasAnimatedGarrettLine = false;
  }

  $: if (map && currentYear < 1809) {
    hasAnimatedBarryLine = false;
    hasFocusedBarryMilestone = false;
  }

  // dimming
  $: if (map && currentYear >= 1864 && map.getLayer(garrettLineLayerId)) {
    map.setPaintProperty(garrettLineLayerId, "line-opacity", 0.3);
  }

  $: if (map && currentYear >= 1810 && map.getLayer(barryLineLayerId)) {
    map.setPaintProperty(barryLineLayerId, "line-opacity", 0.3);
  }

  $: if (map && styleReady && currentYear > 1867) {
    const firstClassesAnimationFrame = pathAnimationFrames.get(
      firstClassesPathsLayerId,
    );
    if (firstClassesAnimationFrame !== undefined) {
      cancelAnimationFrame(firstClassesAnimationFrame);
      pathAnimationFrames.delete(firstClassesPathsLayerId);
    }
    hasAnimatedFirstClassesPaths = false;
    removeLayerAndSource(firstClassesPathsSourceId, firstClassesPathsLayerId);
    removeLayerAndSource(firstClassesSourceId, firstClassesLayerId);
  }

  $: if (map && styleReady && currentYear > 1875) {
    const physiologyAnimationFrame = pathAnimationFrames.get(
      physiologyPathsLayerId,
    );
    if (physiologyAnimationFrame !== undefined) {
      cancelAnimationFrame(physiologyAnimationFrame);
      pathAnimationFrames.delete(physiologyPathsLayerId);
    }
    hasAnimatedPhysiologyPaths = false;
    removeLayerAndSource(physiologyPathsSourceId, physiologyPathsLayerId);
    removeLayerAndSource(physiologyStudentsSourceId, physiologyStudentsLayerId);
  }

  $: if (map && currentYear >= 1886) {
    map.flyTo({
      center: [-3.1883, 55.9433],
      zoom: 14,
      duration: 1000,
      essential: true,
    });
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
      imageMarkers.forEach((marker) => marker.remove());
      imageMarkers.clear();
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

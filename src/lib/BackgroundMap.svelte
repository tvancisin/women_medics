<script lang="ts">
  import { onMount } from "svelte";
  import mapboxgl from "mapbox-gl";
  import "mapbox-gl/dist/mapbox-gl.css";

  export let currentYear: number;
  export let garrettJourneyData: unknown = null;
  export let barryJourneyData: unknown = null;

  let map: mapboxgl.Map;
  let mapContainer: HTMLDivElement;
  let styleReady = false;
  let animationFrame: number;
  let hasAnimatedBarryLine = false;
  let hasAnimatedGarrettLine = false;
  let hasFocusedBarryMilestone = false;
  let imageMarkers = new Map<string, mapboxgl.Marker>();

  type ImageMarkerConfig = {
    id: string;
    year: number;
    coordinates: [number, number];
    imageName: string;
    alt: string;
  };

  const rawEnvToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  const envToken = (rawEnvToken ?? "").trim().replace(/^"|"$/g, "");
  const barrySourceId = "barry-journey";
  const barryLineLayerId = "barry-journey-line";
  const garrettSourceId = "garrett-journey";
  const garrettLineLayerId = "garrett-journey-line";
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
      coordinates: [55.947346356539505, -3.19082680144295],
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
    markerImage.src = `/img/${imageName}`;
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
    })
  }

  $: if (map && styleReady && currentYear >= 1867) {
    map.flyTo({
      center: [-3.1883, 55.9533],
      zoom: 12,
      duration: 3000,
      essential: true,
    });
  }

  $: if (map && currentYear < 1862) {
    hasAnimatedGarrettLine = false;
  }

  $: if (map && currentYear < 1809) {
    hasAnimatedBarryLine = false;
    hasFocusedBarryMilestone = false;
  }

  $: if (map && currentYear >= 1864 && map.getLayer(garrettLineLayerId)) {
    map.setPaintProperty(garrettLineLayerId, "line-opacity", 0.5);
  }

  $: if (map && currentYear >= 1810 && map.getLayer(barryLineLayerId)) {
    map.setPaintProperty(barryLineLayerId, "line-opacity", 0.5);
  }

  onMount(() => {
    mapboxgl.accessToken = envToken;

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

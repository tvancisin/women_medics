<script lang="ts">
  import "leaflet/dist/leaflet.css";
  import L from "leaflet";
  import { onDestroy, onMount } from "svelte";

  export let data: unknown = null;

  type PhysiologyGeoRow = {
    source_data?: {
      name?: string;
      university_address?: {
        original_name?: string;
        lat?: number;
        lon?: number;
      };
    };
  };

  type MapLocation = {
    name: string;
    address: string;
    lat: number;
    lon: number;
  };

  const defaultCenter: [number, number] = [55.9533, -3.1883];
  const defaultZoom = 11;

  let mapElement: HTMLDivElement;
  let map: ReturnType<typeof L.map> | null = null;
  let locationLayer: ReturnType<typeof L.layerGroup> | null = null;

  const recenterMap = () => {
    if (!map) {
      return;
    }

    map.setView(defaultCenter, defaultZoom, { animate: false });
  };

  const invalidateMapSize = () => {
    if (!map) {
      return;
    }

    requestAnimationFrame(() => {
      map?.invalidateSize({ pan: false, animate: false });
      recenterMap();
    });
  };

  const getLocations = (rawData: unknown): MapLocation[] => {
    if (!Array.isArray(rawData)) {
      return [];
    }

    const rows = rawData as PhysiologyGeoRow[];
    return rows
      .map((row) => {
        const universityAddress = row.source_data?.university_address;
        const lat = Number(universityAddress?.lat);
        const lon = Number(universityAddress?.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }

        return {
          name: row.source_data?.name ?? "Unknown",
          address: universityAddress?.original_name ?? "Unknown address",
          lat,
          lon,
        };
      })
      .filter((location): location is MapLocation => location !== null);
  };

  const renderLocationCircles = () => {
    if (!map || !locationLayer) {
      return;
    }

    locationLayer.clearLayers();
    const locations = getLocations(data);

    locations.forEach((location) => {
      L.circleMarker([location.lat, location.lon], {
        radius: 5,
        color: "#d9f0ff",
        fillColor: "black",
        fillOpacity: 0.8,
        weight: 1,
      })
        .addTo(locationLayer)
        .bindPopup(
          `<strong>${location.name}</strong><br />${location.address}`,
        );
    });

  };

  $: if (map && locationLayer && data) {
    invalidateMapSize();
    renderLocationCircles();
  }

  onMount(() => {
    // Center on Edinburgh and keep this intentionally minimal for now.
    map = L.map(mapElement, {
      zoomControl: true,
      attributionControl: true,
    }).setView(defaultCenter, defaultZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    locationLayer = L.layerGroup().addTo(map);
    invalidateMapSize();
    renderLocationCircles();

    const resizeObserver = new ResizeObserver(() => {
      invalidateMapSize();
    });
    resizeObserver.observe(mapElement);

    return () => {
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    locationLayer?.clearLayers();
    locationLayer = null;
    map?.remove();
    map = null;
  });
</script>

<div class="map-wrap">
  <div class="map" bind:this={mapElement}></div>
</div>

<style>
  .map-wrap {
    width: 100%;
    height: 100%;
    padding: 0.75rem;
    box-sizing: border-box;
  }

  .map {
    width: 100%;
    height: 100%;
    min-height: 320px;
    border-radius: 6px;
    overflow: hidden;
  }
</style>

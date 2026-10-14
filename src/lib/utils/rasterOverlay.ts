import type mapboxgl from "mapbox-gl";

type HistoricalRasterOverlayOptions = {
  getMap: () => mapboxgl.Map | undefined;
  isStyleReady: () => boolean;
  sourceId: string;
  layerId: string;
  tileUrl: string;
  opacity: number;
  fadeDurationMs: number;
  onShown?: () => void;
};

/** Controls one historical raster source and its matching Mapbox layer. */
export function createHistoricalRasterOverlay({
  getMap,
  isStyleReady,
  sourceId,
  layerId,
  tileUrl,
  opacity,
  fadeDurationMs,
  onShown,
}: HistoricalRasterOverlayOptions) {
  let isShown = false;
  let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

  const hasLayer = () => Boolean(getMap()?.getLayer(layerId));

  const clearFade = () => {
    if (fadeTimeout === null) return;

    clearTimeout(fadeTimeout);
    fadeTimeout = null;
  };

  const remove = () => {
    clearFade();
    isShown = false;

    const map = getMap();
    if (!map) return;

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  };

  const show = () => {
    const map = getMap();
    if (!map || !isStyleReady()) return false;

    clearFade();

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
      });
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": opacity,
          "raster-opacity-transition": { duration: fadeDurationMs },
        },
      });
    }

    map.setPaintProperty(layerId, "raster-opacity", opacity);
    isShown = true;
    onShown?.();
    return true;
  };

  const fadeOut = () => {
    const map = getMap();
    if (!map || !isStyleReady() || fadeTimeout !== null) return;

    if (!map.getLayer(layerId)) {
      remove();
      return;
    }

    map.setPaintProperty(layerId, "raster-opacity", 0);
    fadeTimeout = setTimeout(() => {
      fadeTimeout = null;
      remove();
    }, fadeDurationMs);
  };

  return {
    show,
    fadeOut,
    clearFade,
    remove,
    hasLayer,
    isShown: () => isShown,
    isFading: () => fadeTimeout !== null,
    isPresent: () => isShown || hasLayer(),
  };
}

<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import L from "leaflet";
	import "leaflet/dist/leaflet.css";

	let mapElement: HTMLDivElement;
	let map: ReturnType<typeof L.map> | null = null;

	onMount(() => {
		// Center on Edinburgh and keep this intentionally minimal for now.
		map = L.map(mapElement, {
			zoomControl: true,
			attributionControl: true,
		}).setView([55.9533, -3.1883], 11);

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			maxZoom: 19,
			attribution: "&copy; OpenStreetMap contributors",
		}).addTo(map);

		L.circleMarker([55.9533, -3.1883], {
			radius: 8,
			color: "#d9f0ff",
			fillColor: "#2f9bd8",
			fillOpacity: 0.9,
		})
			.addTo(map)
			.bindPopup("Edinburgh");
	});

	onDestroy(() => {
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

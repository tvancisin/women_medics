<script lang="ts">
	import * as d3 from "d3";

	type WomenMedicsDatum = { year: number; number: number };

	export let currentYear: number;
	export let timelineY: number;
	export let yearToX: (year: number) => number;
	export let womenMedicsData: WomenMedicsDatum[] = [];

	const chartPaddingTop = 80;
	const chartPaddingBottom = 16;

	// Keep values up to the current animated year only.
	$: visibleData = womenMedicsData
		.filter((d) => d.year <= currentYear)
		.sort((a, b) => a.year - b.year);

	$: minYear = womenMedicsData.length > 0 ? womenMedicsData[0].year : 1914;
	$: maxYear = womenMedicsData.length > 0 ? womenMedicsData[womenMedicsData.length - 1].year : 1966;

	// Keep y-scale fixed by using the full dataset max, not only currently visible points.
	$: maxY = d3.max(womenMedicsData, (d: WomenMedicsDatum) => d.number) ?? 0;

	// SVG y grows downward, so the range is inverted: bigger values map higher up.
	$: yScale = d3
		.scaleLinear()
		.domain([0, maxY > 0 ? maxY : 1])
		.range([timelineY - chartPaddingBottom, chartPaddingTop]);

	$: xScale = d3
		.scaleLinear()
		.domain([minYear, maxYear])
		.range([yearToX(minYear), yearToX(maxYear)]);

	$: linePath = d3
		.line<WomenMedicsDatum>()
		.x((d: WomenMedicsDatum) => xScale(d.year))
		.y((d: WomenMedicsDatum) => yScale(d.number))(visibleData);
</script>

{#if currentYear >= 1914 && visibleData.length > 1 && linePath}
	<path d={linePath} fill="none" stroke="gray" stroke-width="1" />
{/if}

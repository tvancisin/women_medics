<script lang="ts">
	import * as d3 from "d3";

	type WomenMedicsDatum = { year: number; number: number };

	export let currentYear: number;
	export let timelineY: number;
	export let yearToX: (year: number) => number;
	export let womenMedicsData: WomenMedicsDatum[] = [];

	const chartPaddingTop = 80;
	const chartPaddingBottom = 0;

	// Keep values up to the current animated year only.
	$: visibleData = womenMedicsData
		.filter((d) => d.year <= currentYear)
		.sort((a, b) => a.year - b.year);

	$: sortedData = [...womenMedicsData].sort((a, b) => a.year - b.year);

	// Keep y-scale fixed by using the full dataset max, not only currently visible points.
	$: maxY = d3.max(womenMedicsData, (d: WomenMedicsDatum) => d.number) ?? 0;

	// SVG y grows downward, so the range is inverted: bigger values map higher up.
	$: yScale = d3
		.scaleLinear()
		.domain([0, maxY > 0 ? maxY : 1])
		.range([timelineY - chartPaddingBottom, chartPaddingTop * 4]);

	$: areaPath = d3
		.area<WomenMedicsDatum>()
		.x((d: WomenMedicsDatum) => yearToX(d.year))
		.y0(timelineY - chartPaddingBottom)
		.y1((d: WomenMedicsDatum) => yScale(d.number))(visibleData);

	$: linePath = d3
		.line<WomenMedicsDatum>()
		.x((d: WomenMedicsDatum) => yearToX(d.year))
		.y((d: WomenMedicsDatum) => yScale(d.number))(visibleData);

	const interpolateValueAtYear = (year: number): number | null => {
		if (sortedData.length === 0) {
			return null;
		}

		if (year <= sortedData[0].year) {
			return sortedData[0].number;
		}

		for (let i = 1; i < sortedData.length; i += 1) {
			const previous = sortedData[i - 1];
			const next = sortedData[i];

			if (year <= next.year) {
				const yearSpan = next.year - previous.year;
				if (yearSpan <= 0) {
					return next.number;
				}

				const t = (year - previous.year) / yearSpan;
				return previous.number + (next.number - previous.number) * t;
			}
		}

		return sortedData[sortedData.length - 1].number;
	};

	$: currentValue = interpolateValueAtYear(currentYear);
	$: markerX = yearToX(currentYear);
	$: markerY = currentValue === null ? timelineY : yScale(currentValue);
	$: markerLabel = currentValue === null ? "" : `${Math.round(currentValue)}`;
</script>

{#if currentYear >= 1914 && visibleData.length > 1 && areaPath}
	<path d={areaPath} class="area-shape" />
	{#if linePath}
		<path d={linePath} class="area-top-line" fill="none" />
	{/if}
	{#if currentValue !== null && currentYear <= 1966 }
		<circle class="line-head" cx={markerX} cy={markerY} r="4" />
		<text class="line-head-label" x={markerX + 8} y={markerY + 3}>
			{markerLabel}
		</text>
	{/if}
{/if}

<style>
	.area-shape {
		fill: rgba(255, 255, 255, 0.1);
		stroke: none;
	}

	.area-top-line {
		stroke: rgba(255, 255, 255, 0.7);
		stroke-width: 1;
	}

	.line-head {
		fill: #fff;
	}

	.line-head-label {
		fill: #fff;
		font-size: 11px;
		font-family: Montserrat;
		pointer-events: none;
	}
</style>

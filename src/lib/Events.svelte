<script lang="ts">
	type HistoricalEvent = {
		startYear: number;
		endYear: number;
		description: string;
	};

	type MilestoneLabel = {
		year: number;
		label: string;
	};

	export let events: HistoricalEvent[] = [];
	export let currentYear: number;
	export let startYear: number;
	export let timelineY: number;
	export let yearToX: (year: number) => number;

	const milestoneLabels: MilestoneLabel[] = [
		{ year: 1726, label: "School of Medicine" },
		{ year: 1867, label: "First female students" },
		{ year: 1869, label: "Edinburgh Seven" },
		{ year: 1892, label: "Women admitted to universities" }
	];

	$: displayYear = Math.floor(currentYear);
	$: activeMilestone = milestoneLabels.find((milestone) => milestone.year === displayYear);
</script>

{#each events as event, index (event.description + index)}
	{@const start = event.startYear}
	{@const end = event.endYear}
	{@const visibleEnd = Math.min(end, currentYear)}
	{@const isVisible = visibleEnd >= start && visibleEnd >= startYear}
	{#if isVisible}
		{@const x1 = yearToX(Math.max(start, startYear))}
		{@const x2 = yearToX(visibleEnd)}
		<rect
			class="historical-event"
			x={Math.min(x1, x2)}
			y="0"
			width={Math.max(1, Math.abs(x2 - x1))}
			height={timelineY}
			aria-label={event.description}
		/>
        <text
            class="event-label"
            x={x2 - 5}
            y={100 + index * 20}
            text-anchor="end">
            {event.description}
        </text>
	{/if}
{/each}


<style>
	.historical-event {
		fill: #ffffff;
		opacity: 0.05;
		pointer-events: none;
	}
    .event-label {
        fill: gray;
        font-size: 12px;
        pointer-events: none;
    }
</style>

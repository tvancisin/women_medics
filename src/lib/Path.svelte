<script lang="ts">
	import { onMount } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { tweened } from "svelte/motion";

	export let x = 0;
	export let height = 0;
	export let label = "";

	const shortLengthPx = 50;
	let shrinkStarted = false;
	let shrinkTimeoutId: ReturnType<typeof setTimeout> | null = null;

	const drawProgress = tweened(0, {
		duration: 900,
		easing: cubicOut,
	});
	const pathLengthPx = tweened(0, {
		duration: 800,
		easing: cubicOut,
	});

	$: startY = height - 30;
	$: middleY = height / 2;
	$: fullLengthPx = Math.max(0, startY - middleY);
	$: shortLength = Math.min(shortLengthPx, fullLengthPx);
	$: if (!shrinkStarted) {
		pathLengthPx.set(fullLengthPx, { duration: 0 });
	}
	$: endY = startY - $pathLengthPx;
	$: controlY = (startY + endY) / 2;
	$: pathD = `M ${x} ${startY} Q ${x} ${controlY} ${x} ${endY}`;
	$: dashOffset = 1 - $drawProgress;

	onMount(() => {
		const runAnimation = async () => {
			await drawProgress.set(1);
			shrinkTimeoutId = setTimeout(() => {
				shrinkStarted = true;
				pathLengthPx.set(shortLength);
			}, 1000);
		};

		runAnimation();

		return () => {
			if (shrinkTimeoutId !== null) {
				clearTimeout(shrinkTimeoutId);
			}
		};
	});
</script>

<path
	class="event-path"
	d={pathD}
	fill="none"
	pathLength="1"
	stroke-dasharray="1"
	stroke-dashoffset={dashOffset}
/>
<circle cx={x} cy={endY} r="4" fill="gray" />
{#if label}
	<text
		class="event-label"
		x={x + 5}
		y={endY - 8}
		text-anchor="start"
		transform={`rotate(-45 ${x + 10} ${endY - 10})`}
	>{label}</text>
{/if}

<style>
	.event-path {
		stroke: gray;
		stroke-width: 1;
		stroke-linecap: round;
		pointer-events: none;
	}

	.event-label {
		fill: #fff;
		font-size: 12px;
		pointer-events: none;
	}
</style>

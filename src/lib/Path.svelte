<script lang="ts">
	import { onMount } from "svelte";
	import { cubicOut } from "svelte/easing";
	import { tweened } from "svelte/motion";

	export let x = 0;
	export let height = 0;

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

<style>
	.event-path {
		stroke: gray;
		stroke-width: 1;
		stroke-linecap: round;
		pointer-events: none;
	}
</style>

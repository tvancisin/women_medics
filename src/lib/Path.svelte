<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";

  export let x = 0;
  export let year = 0;
  export let height = 0;
  export let label = "";
  export let labelIndex = 1;
  export let shrink = false;
  export let topByYear: Map<number, number> = new Map();

  const fallbackShrinkLength = 40;
  $: markerTop = topByYear.get(year);

  const pathLengthPx = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });
  const markerSizePx = tweened(5, {
    duration: 500,
    easing: cubicOut,
  });

  $: startY = height - 30;
  $: middleY = height - 100;
  $: fullLength = Math.max(0, startY - middleY);

  onMount(() => {
    pathLengthPx.set(fullLength);
    markerSizePx.set(50);
  });

  // path rises
  $: endY = startY - $pathLengthPx;

  $: shrinkLength =
    markerTop === undefined
      ? fallbackShrinkLength
      : Math.max(0, startY - markerTop - 20);

  $: if (shrink) {
    pathLengthPx.set(shrinkLength);
    markerSizePx.set(10);
  }

  // $: labelYOffset =
  //   labelIndex >= 4 && labelIndex <=7 ? -4 + (labelIndex - 3) * 12 : -4;
  // $: markerY = shrink ? endY + labelYOffset : endY;
  // $: labelY = markerY;
  // $: pathD = `M ${x} ${startY} L ${x} ${markerY}`;
  $: pathD = `M ${x} ${startY} L ${x} ${endY}`;
</script>

<path class="event-path" d={pathD} fill="none" />
<!-- <rect
  class="event-marker"
  x={x - $markerSizePx / 2}
  // y={markerY - 5}
  y={endY - $markerSizePx / 2}
  width={$markerSizePx}
  height={$markerSizePx}
  fill="white"
  rx="2"
/> -->
{#if label}
  <text
    class="event-label"
    x={x + 20}
    // y={labelY}
    y={endY  + 2}
    transform="rotate(-90, {x}, {endY})"
    text-anchor="start">{label}</text
  >
{/if}

<style>
  .event-path {
    stroke: rgb(255, 255, 255);
    stroke-width: 1;
    stroke-linecap: round;
    pointer-events: none;
  }

  .event-label {
    fill: #fff;
    font-size: 10px;
    pointer-events: none;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";

  export let x = 0;
  export let height = 0;
  export let label = "";
  export let labelIndex = 1;
  export let shrink = false;

  const pathLengthPx = tweened(0, {
    duration: 900,
    easing: cubicOut,
  });

  $: startY = height - 100;
  $: middleY = height - 200;
  $: fullLength = Math.max(0, startY - middleY);

  onMount(() => {
    pathLengthPx.set(fullLength);
  });

  // path rises
  $: endY = startY - $pathLengthPx;

  $: if (shrink) {
    pathLengthPx.set(-40);
  }

  $: labelYOffset =
    labelIndex >= 4 ? -4 + (labelIndex - 3) * 12 : -4;
  $: markerY = shrink ? endY + labelYOffset : endY;
  $: labelY = markerY;
  $: pathD = `M ${x} ${startY} L ${x} ${markerY}`;
</script>

<path class="event-path" d={pathD} fill="none" />
<rect
  class="event-marker"
  x={x - 2.5}
  y={markerY - 5}
  width="5"
  height="5"
  fill="orange"
  rx="2"
/>
{#if label && shrink}
  <text
    class="event-label"
    x={x + 5}
    y={labelY}
    text-anchor="start">{label}</text>
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
    font-size: 10px;
    pointer-events: none;
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";

  export let x = 0;
  export let height = 0;
  export let label = "";
  export let shrink = false;

  const pathLengthPx = tweened(0, {
    duration: 900,
    easing: cubicOut,
  });

  $: startY = height - 30;
  $: middleY = height - 200;
  $: fullLength = Math.max(0, startY - middleY);

  // Tip of the path rises from startY toward middleY as pathLengthPx grows.
  $: endY = startY - $pathLengthPx;
  $: pathD = `M ${x} ${startY} L ${x} ${endY}`;

  onMount(() => {
    pathLengthPx.set(fullLength);
  });

  $: if (shrink) {
    pathLengthPx.set(50);
  }
</script>

<path class="event-path" d={pathD} fill="none" />
<rect
  class="event-marker"
  x={x - 2.5}
  y={endY - 5}
  width="5"
  height="5"
  fill="orange"
  rx="2"
/>
{#if label && shrink}
  <text
    class="event-label"
    x={x + 5}
    y={endY - 4}
    text-anchor="start"
    transform={`rotate(-45 ${x + 5} ${endY - 4})`}>{label}</text
  >
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

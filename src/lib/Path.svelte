<script lang="ts">
  import { onMount, tick } from "svelte";
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
  const labelPaddingX = 4;
  const labelBackgroundHeight = 16;
  let labelTextElement: SVGTextElement | null = null;
  let labelWidth = 0;
  $: markerTop = topByYear.get(year);
  $: labelBackgroundWidth = Math.ceil(labelWidth) + labelPaddingX * 2;

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

  $: pathD = `M ${x} ${startY} L ${x} ${endY}`;

  async function updateLabelWidth() {
    await tick();

    if (!labelTextElement) {
      labelWidth = 0;
      return;
    }

    labelWidth = labelTextElement.getComputedTextLength();
  }

  $: if (label) {
    updateLabelWidth();
  }
</script>

<path class="event-path" d={pathD} fill="none" />
{#if label}
  <g
    transform="rotate(-90, {x}, {endY})"
  >
    <rect
      class="event-label-background"
      x={x + 16}
      y={endY - 10}
      width={labelBackgroundWidth}
      height={labelBackgroundHeight}
      rx="2"
    />
    <text
      bind:this={labelTextElement}
      class="event-label"
      x={x + 20}
      y={endY + 2}
      text-anchor="start"
    >
      {label}
    </text>
  </g>
{/if}

<style>
  .event-path {
    stroke: rgb(255, 255, 255);
    stroke-width: 1;
    stroke-linecap: round;
    pointer-events: none;
  }

  .event-label-background {
    fill: #000;
    pointer-events: none;
  }

  .event-label {
    fill: #fafafa;
    font-size: 12px;
    font-family: "Montserrat";
    font-weight: 500;
    pointer-events: none;
  }
</style>

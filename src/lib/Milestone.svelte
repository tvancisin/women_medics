<script lang="ts">
  import { tick } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { tweened } from "svelte/motion";

  export let x = 0;
  export let height = 0;
  export let label = "";
  export let active = false;
  export let mutedInactiveLabel = false;
  export let expandedInactive = false;
  export let raised = false;

  const collapsedPathLength = 20;
  // Keep the expanded 1726 label and raised 1916 milestone at one height.
  const raisedPathLength = 250;
  const inactiveLabelMaxLength = 18;
  $: shortenedLabel =
    expandedInactive || label.length <= inactiveLabelMaxLength
      ? label
      : `${label.slice(0, inactiveLabelMaxLength).trimEnd()}…`;
  $: labelPaddingX = active || expandedInactive ? 4 : 3;
  $: labelBackgroundHeight = active || expandedInactive ? 20 : 14;
  $: labelBackgroundOffsetX = active || expandedInactive ? 16 : 8;
  $: labelTextOffsetX = active || expandedInactive ? 20 : 11;
  $: labelBackgroundCenterOffsetY = active || expandedInactive ? 3 : 1;
  let labelTextElement: SVGTextElement | null = null;
  let labelWidth = 0;
  $: labelBackgroundWidth = Math.ceil(labelWidth) + labelPaddingX * 2;

  const pathLengthPx = tweened(0, {
    duration: 400,
    easing: cubicOut,
  });
  $: startY = height - 30;
  $: middleY = height - 90;
  $: fullLength = Math.max(0, startY - middleY);
  $: inactivePathLength = expandedInactive
    ? raisedPathLength
    : Math.min(fullLength, collapsedPathLength);
  $: targetPathLength = raised
    ? raisedPathLength
    : active
      ? fullLength
      : inactivePathLength;

  $: pathLengthPx.set(targetPathLength);

  $: endY = startY - $pathLengthPx;

  $: pathD = `M ${x} ${startY} L ${x} ${endY}`;

  async function updateLabelWidth() {
    await tick();

    if (!labelTextElement) {
      labelWidth = 0;
      return;
    }

    labelWidth = labelTextElement.getComputedTextLength();
  }

  // Inactive labels use shortened text and a smaller font, so remeasure them.
  $: if (shortenedLabel && !active) {
    updateLabelWidth();
  }
</script>

<path
  class="event-path"
  class:inactive={!active}
  class:muted-inactive={!active && mutedInactiveLabel}
  d={pathD}
  fill="none"
/>
{#if label && !active}
  <g
    transform="rotate(-90, {x}, {endY})"
  >
    <rect
      class="event-label-background"
      x={x + labelBackgroundOffsetX}
      y={endY - labelBackgroundCenterOffsetY - labelBackgroundHeight / 2}
      width={labelBackgroundWidth}
      height={labelBackgroundHeight}
      rx="2"
    />
    <text
      bind:this={labelTextElement}
      class="event-label"
      class:inactive={!active}
      class:muted-inactive={mutedInactiveLabel}
      class:expanded-inactive={expandedInactive}
      x={x + labelTextOffsetX}
      y={endY + 2}
      text-anchor="start"
    >
      {shortenedLabel}
    </text>
  </g>
{/if}

<style>
  .event-path {
    stroke: rgb(255, 255, 255);
    stroke-width: 2px;
    stroke-linecap: round;
    pointer-events: none;
  }

  .event-path.inactive {
    stroke: #ffffff;
  }

  .event-path.inactive.muted-inactive {
    stroke: rgba(180, 180, 180, 0.95);
  }

  .event-label-background {
    fill: #000;
    pointer-events: none;
  }

  .event-label {
    fill: #fafafa;
    font-size: 16px;
    font-family: "Montserrat";
    font-weight: 500;
    pointer-events: none;
  }

  .event-label.inactive {
    fill: #ffffff;
    font-size: 10px;
  }

  .event-label.inactive.muted-inactive {
    fill: rgba(180, 180, 180, 0.95);
  }

  .event-label.inactive.expanded-inactive {
    font-size: 16px;
  }
</style>

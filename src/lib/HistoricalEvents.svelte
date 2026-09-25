<script lang="ts">
  type HistoricalEvent = {
    startYear: number;
    endYear: number;
    description: string;
  };

  export let events: HistoricalEvent[] = [];
  export let currentYear: number;
  export let domainStartYear: number;
  export let domainEndYear: number;
  export let timelineY: number;
  export let yearToX: (year: number) => number;

  const eventBandHeight = 50;
  $: eventBandY = timelineY;
</script>

{#each events as event, index (event.description + index)}
  {@const start = event.startYear}
  {@const end = event.endYear}
  {@const visibleStart = Math.max(start, domainStartYear)}
  {@const visibleEnd = Math.min(end, currentYear, domainEndYear)}
  {@const isVisible = visibleEnd >= visibleStart}
  {#if isVisible}
    {@const x1 = yearToX(visibleStart)}
    {@const x2 = yearToX(visibleEnd)}
    <rect
      class="historical-event"
      x={Math.min(x1, x2)}
      y={eventBandY}
      width={Math.max(1, Math.abs(x2 - x1))}
      height={eventBandHeight}
      fill="#fff"
      aria-label={event.description}
    />
    <text
      class="event-label"
      x={x2 - 5}
      y={eventBandY +
        eventBandHeight -
        5 -
        (event.description === "FIRST MICROORGANISMS OBSERVED" ||
        event.description === "LONDON-EDINBURGH RAIL"
          ? 13
          : 0)}
      text-anchor={event.startYear <= domainStartYear ? "start" : "end"}
    >
      {event.description}
    </text>
  {/if}
{/each}

<!-- TODO -->
<!-- move to how how medicine looks like men vs women in medicine now -->
<!-- also look at how to represent uncertainty -->

<style>
  .historical-event {
    opacity: 0.15;
    pointer-events: none;
  }
  .event-label {
    fill: rgb(214, 214, 214);
    font-size: 10px;
    pointer-events: none;
  }
</style>

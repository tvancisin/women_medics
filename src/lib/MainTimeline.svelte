<script lang="ts">
  import { historicalEvents } from "./data/timeline";
  import Doctors from "./Doctors.svelte";
  import HistoricalEvents from "./HistoricalEvents.svelte";
  import Linechart from "./Linechart.svelte";
  import Path from "./Path.svelte";

  type WomenMedicsDatum = { year: number; number: number };

  export let width = 0;
  export let height = 0;
  export let currentYear: number;
  export let startYear: number;
  export let endYear: number;
  export let timelineDomainStart: number;
  export let timelineDomainEnd: number;
  export let timelineY: number;
  export let axisStart: number;
  export let axisRight: number;
  export let pauseYears: number[] = [];
  export let milestoneLabels: Map<number, string> = new Map();
  export let shrinkEnabledYears: Set<number> = new Set();
  export let topByYear: Map<number, number> = new Map();
  export let womenDoctorsData: unknown = [];
  export let womenMedicsData: WomenMedicsDatum[] = [];
  export let yearToX: (year: number) => number;

  const tickLength = 5;
  const buildTimelineTickValues = (maxYear: number) => {
    const values = [startYear];
    for (let year = 1600; year <= maxYear; year += 50) values.push(year);
    return values;
  };

  $: currentYearX = yearToX(currentYear);
  $: axisEnd = currentYearX;
  $: fullTickValues =
    width > 0 && height > 0 ? buildTimelineTickValues(endYear) : [];
  $: tickValues =
    width > 0 && height > 0 ? buildTimelineTickValues(currentYear) : [];
  $: displayYear = Math.floor(currentYear);
  $: isCurrentYearInTimelineDomain =
    currentYear >= timelineDomainStart && currentYear <= timelineDomainEnd;
  $: visibleMilestoneYears = pauseYears.filter(
    (year) => displayYear >= year && milestoneLabels.has(year),
  );
</script>

<svg {width} {height}>
  {#if width > 0 && height > 0}
    <rect
      class="timeline-background"
      x="0"
      y={height - 30}
      width={width}
      height="30"
      aria-hidden="true"
    ></rect>

    <g class="timeline-underlay" aria-hidden="true">
      <line
        class="domain"
        x1={axisStart}
        y1={timelineY}
        x2={axisRight}
        y2={timelineY}
      ></line>

      {#each fullTickValues as year}
        <g class="tick" transform={`translate(${yearToX(year)}, ${timelineY})`}>
          <line x1="0" y1="0" x2="0" y2={tickLength}></line>
          <text x="0" y={tickLength + 12} text-anchor="middle">{year}</text>
        </g>
      {/each}
    </g>

    {#if isCurrentYearInTimelineDomain}
      <circle cx={currentYearX} cy={timelineY} r="4" fill="#fff"></circle>
    {/if}

    <line
      class="domain"
      x1={axisStart}
      y1={timelineY}
      x2={axisEnd}
      y2={timelineY}
    ></line>

    {#each tickValues as year}
      <g class="tick" transform={`translate(${yearToX(year)}, ${timelineY})`}>
        <line x1="0" y1="0" x2="0" y2={tickLength}></line>
        <text x="0" y={tickLength + 12} text-anchor="middle">{year}</text>
      </g>
    {/each}

    <HistoricalEvents
      events={historicalEvents}
      {currentYear}
      domainStartYear={timelineDomainStart}
      domainEndYear={timelineDomainEnd}
      {timelineY}
      {yearToX}
    />

    <Doctors
      {womenDoctorsData}
      {currentYear}
      {timelineY}
      {yearToX}
      {womenMedicsData}
    />

    {#each visibleMilestoneYears as year, index (year)}
      <Path
        x={yearToX(year)}
        {year}
        {height}
        label={milestoneLabels.get(year) ?? ""}
        labelIndex={index + 1}
        shrink={shrinkEnabledYears.has(year)}
        {topByYear}
      />
    {/each}

    <Linechart
      {currentYear}
      domainStartYear={timelineDomainStart}
      domainEndYear={timelineDomainEnd}
      {timelineY}
      {yearToX}
      {womenMedicsData}
    />
  {/if}
</svg>

<style>
  svg {
    position: relative;
    z-index: 1;
    display: block;
    pointer-events: none;
  }

  .domain {
    stroke: rgb(255, 255, 255);
    stroke-width: 1px;
  }

  .timeline-underlay {
    opacity: 0.4;
  }

  .timeline-background {
    fill: rgba(0, 0, 0, 0.65);
  }

  .tick line {
    stroke: #fff;
  }

  .tick text {
    fill: #fff;
    font-size: 14px;
    font-family: Montserrat;
  }
</style>

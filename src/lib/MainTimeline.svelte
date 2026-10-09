<script lang="ts">
  import { historicalEvents } from "./utils/const";
  import DoctorsAreaChart from "./DoctorsAreaChart.svelte";
  import HistoricalEvents from "./HistoricalEvents.svelte";
  import UniAreaChart from "./UniAreaChart.svelte";
  import Milestone from "./Milestone.svelte";

  type WomenMedicsDatum = { year: number; number: number };

  export let width = 0;
  export let height = 0;
  export let currentYear: number;
  export let startYear: number;
  export let universityEstablishedYear: number;
  export let endYear: number;
  export let timelineDomainStart: number;
  export let timelineDomainEnd: number;
  export let timelineY: number;
  export let axisStart: number;
  export let axisRight: number;
  export let pauseYears: number[] = [];
  export let milestoneLabels: Map<number, string> = new Map();
  export let womenDoctorsData: unknown = [];
  export let womenMedicsData: WomenMedicsDatum[] = [];
  export let menMedicsData: WomenMedicsDatum[] = [];
  export let yearToX: (year: number) => number;

  const tickLength = 5;
  const mutedInactiveMilestoneYears = new Set([1886, 1889, 1911, 1915]);
  let expandedMilestonePathLength = 0;
  const buildTimelineTickValues = (maxYear: number) => {
    const values = [startYear];
    for (let year = 1600; year <= maxYear; year += 50) values.push(year);
    return values;
  };
  const buildMinorTimelineTickValues = (maxYear: number) => {
    const values = [];
    for (let year = 1625; year < maxYear; year += 50) values.push(year);
    return values;
  };

  $: currentYearX = yearToX(currentYear);
  $: expandedMilestonePathLength = height - 100;
  $: yearCounterPanelX = currentYearX;
  $: yearCounterTextX = yearCounterPanelX;
  $: yearsSinceUniversityEstablished = Math.max(
    0,
    Math.floor(currentYear) - universityEstablishedYear,
  );
  $: yearCounterUnit = yearsSinceUniversityEstablished === 1 ? "Year" : "Years";
  $: axisEnd = currentYearX;
  $: fullTickValues =
    width > 0 && height > 0 ? buildTimelineTickValues(endYear) : [];
  $: fullMinorTickValues =
    width > 0 && height > 0 ? buildMinorTimelineTickValues(endYear) : [];
  $: tickValues =
    width > 0 && height > 0 ? buildTimelineTickValues(currentYear) : [];
  $: minorTickValues =
    width > 0 && height > 0 ? buildMinorTimelineTickValues(currentYear) : [];
  $: displayYear = Math.floor(currentYear);
  $: isCurrentYearInTimelineDomain =
    currentYear >= timelineDomainStart && currentYear <= timelineDomainEnd;
  $: visibleMilestoneYears = pauseYears.filter(
    (year) => displayYear >= year && milestoneLabels.has(year),
  );
  $: milestoneComparison300LineY =
    height - 30 - expandedMilestonePathLength + 20;
  $: milestoneComparison110LineY = milestoneComparison300LineY + 40;
  $: milestoneComparison300StartX = yearToX(1726) + 5;
  $: milestoneComparison110StartX = yearToX(1916) + 5;
  $: milestoneComparisonEndX = yearToX(2026) - 5;
  $: milestoneComparison300LabelX =
    (milestoneComparison300StartX + milestoneComparisonEndX) / 2;
  $: milestoneComparison110LabelX =
    (milestoneComparison110StartX + milestoneComparisonEndX) / 2;
</script>

<svg {width} {height}>
  {#if width > 0 && height > 0}
    <defs>
      <marker
        id="milestone-comparison-arrow"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" class="milestone-comparison-arrow" />
      </marker>
    </defs>
    <rect
      class="timeline-background"
      x="0"
      y={height - 30}
      {width}
      height="30"
      aria-hidden="true"
    ></rect>

    <g class="timeline-underlay" aria-hidden="true">
      <!-- <line
        class="domain"
        x1={axisStart}
        y1={timelineY}
        x2={axisRight}
        y2={timelineY}
      ></line> -->

      <!-- {#each fullTickValues as year}
        <g class="tick" transform={`translate(${yearToX(year)}, ${timelineY})`}>
          <line x1="0" y1="0" x2="0" y2={tickLength}></line>
          <text x="0" y={tickLength + 16} text-anchor="middle">{year}</text>
        </g>
      {/each} -->

      {#each fullMinorTickValues as year}
        <g
          class="minor-tick"
          transform={`translate(${yearToX(year)}, ${timelineY})`}
        >
          <line x1="0" y1="0" x2="0" y2={tickLength}></line>
        </g>
      {/each}
    </g>

    {#if isCurrentYearInTimelineDomain}
      <circle cx={currentYearX} cy={timelineY} r="5" fill="#fff"></circle>
      <!-- <rect
        class="year-counter-background"
        x={yearCounterPanelX}
        y={timelineY + 20}
        width="112"
        height="30"
        rx="3"
        aria-hidden="true"
      ></rect> -->
      <!-- <text
        class="year-counter-label"
        x={yearCounterTextX}
        y={timelineY + 44}
        text-anchor="middle">Since Foundation</text
      >
      <text
        class="year-counter"
        x={yearCounterTextX}
        y={timelineY + 33}
        text-anchor="middle"
        aria-label={`${yearsSinceUniversityEstablished} years since the University was established`}
        >{yearsSinceUniversityEstablished} {yearCounterUnit}</text
      > -->
    {/if}

    {#if currentYear >= 1583}
      <line
        class="domain"
        x1={yearToX(1583)}
        y1={timelineY}
        x2={axisEnd}
        y2={timelineY}
      ></line>
    {/if}

    {#each tickValues as year}
      <g class="tick" transform={`translate(${yearToX(year)}, ${timelineY})`}>
        <line x1="0" y1="0" x2="0" y2={tickLength}></line>
        <text x="0" y={tickLength + 16} text-anchor="middle">{year}</text>
      </g>
    {/each}

    {#each minorTickValues as year}
      <g
        class="minor-tick"
        transform={`translate(${yearToX(year)}, ${timelineY})`}
      >
        <line x1="0" y1="0" x2="0" y2={tickLength}></line>
      </g>
    {/each}

    <!-- <HistoricalEvents
      events={historicalEvents}
      {currentYear}
      domainStartYear={timelineDomainStart}
      domainEndYear={timelineDomainEnd}
      {timelineY}
      {yearToX}
    /> -->

    <!-- <DoctorsAreaChart
      {womenDoctorsData}
      {currentYear}
      {timelineY}
      {yearToX}
      {womenMedicsData}
    /> -->

    {#each visibleMilestoneYears as year (year)}
      <Milestone
        x={yearToX(year)}
        {height}
        label={year === 1726 && displayYear === 2026
          ? "1726"
          : (milestoneLabels.get(year) ?? "")}
        active={currentYear === year}
        mutedInactiveLabel={mutedInactiveMilestoneYears.has(year)}
        expandedInactive={year === 1726 && displayYear === 2026}
        expandedPathLength={expandedMilestonePathLength}
      />
    {/each}

    {#if displayYear === 2026}
      <Milestone
        x={yearToX(2026)}
        {height}
        label="2026"
        expandedInactive={true}
        expandedPathLength={expandedMilestonePathLength}
      />
      <g class="milestone-comparison" aria-label="300 years between 1726 and 2026">
        <line
          x1={milestoneComparison300StartX}
          y1={milestoneComparison300LineY}
          x2={milestoneComparisonEndX}
          y2={milestoneComparison300LineY}
          marker-start="url(#milestone-comparison-arrow)"
          marker-end="url(#milestone-comparison-arrow)"
        />
        <text
          x={milestoneComparison300LabelX}
          y={milestoneComparison300LineY - 10}
          text-anchor="middle">Men: 300 years</text
        >
      </g>
      <g class="milestone-comparison" aria-label="110 years between 1916 and 2026">
        <line
          x1={milestoneComparison110StartX}
          y1={milestoneComparison110LineY}
          x2={milestoneComparisonEndX}
          y2={milestoneComparison110LineY}
          marker-start="url(#milestone-comparison-arrow)"
          marker-end="url(#milestone-comparison-arrow)"
        />
        <text
          x={milestoneComparison110LabelX}
          y={milestoneComparison110LineY - 10}
          text-anchor="middle">Women: 110 years</text
        >
      </g>
    {/if}

    <UniAreaChart
      {width}
      {currentYear}
      domainStartYear={timelineDomainStart}
      domainEndYear={timelineDomainEnd}
      {timelineY}
      {yearToX}
      {womenMedicsData}
      {menMedicsData}
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
    stroke-width: 2px;
  }

  .year-indicator-line {
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1px;
  }

  .timeline-underlay {
    opacity: 0.4;
  }

  .timeline-background {
    fill: #151c24d7;
  }

  .year-counter {
    fill: #ffffff;
    font-family: Montserrat;
    font-size: 14px;
    font-weight: 600;
  }

  .year-counter-background {
    fill: #151c24;
  }

  .year-counter-label {
    fill: #ffffff;
    font-family: Montserrat;
    font-size: 11px;
  }

  .tick line {
    stroke: #fff;
  }

  .minor-tick line {
    stroke: #fff;
  }

  .tick text {
    fill: #fff;
    font-size: 16px;
    font-family: Montserrat;
  }

  .milestone-comparison line {
    stroke: rgba(180, 180, 180, 0.95);
    stroke-width: 1.5;
  }

  .milestone-comparison-arrow {
    fill: rgba(180, 180, 180, 0.95);
  }

  .milestone-comparison text {
    fill: rgba(180, 180, 180, 0.95);
    font-family: Montserrat;
    font-size: 14px;
    font-weight: 500;
    pointer-events: none;
  }
</style>

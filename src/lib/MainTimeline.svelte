<script lang="ts">
  import { historicalEvents } from "./utils/const";
  import DoctorsAreaChart from "./DoctorsAreaChart.svelte";
  import HistoricalEvents from "./HistoricalEvents.svelte";
  import UniAreaChart from "./UniAreaChart.svelte";
  import Milestone from "./Milestone.svelte";

  type WomenMedicsDatum = { year: number; number: number };
  type TimelineMilestone = { id: string; year: number; label: string };
  type RenderedMilestone = TimelineMilestone & { milestoneIds: string[] };

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
  export let milestones: TimelineMilestone[] = [];
  export let pausedMilestoneId: string | null = null;
  export let womenDoctorsData: unknown = [];
  export let womenMedicsData: WomenMedicsDatum[] = [];
  export let menMedicsData: WomenMedicsDatum[] = [];
  export let yearToX: (year: number) => number;
  export let timelineStretchProgress = 0;

  const tickLength = 5;
  const inactiveMilestoneLabelLeftExtent = 8;
  const inactiveMilestoneLabelRightExtent = 6;
  const inactiveMilestoneLabelGap = 2;
  const activeMilestoneLabelGap = 6;
  const womenMedicsAreaChartStartYear = 1914;
  const areaChartMilestoneLabelGap = 1;
  const womenMedicalEducationPeriodStartYear = 1886;
  const womenMedicalEducationPeriodEndYear = 1915;
  const womenMedicalEducationPeriodHeight = 70;
  const womenMedicalEducationPeriodTickYears = [
    1890, 1895, 1900, 1905, 1910,
  ];
  const mutedInactiveMilestoneYears = new Set([1886, 1889, 1911, 1915]);
  let expandedMilestonePathLength = 0;
  let inactiveMilestoneLabelXs = new Map<string, number>();
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
  const buildRenderedMilestones = (maximumYear = Number.POSITIVE_INFINITY) => {
    const milestonesByYear = new Map<number, TimelineMilestone[]>();

    for (const milestone of milestones) {
      if (maximumYear < milestone.year) continue;
      const milestonesForYear = milestonesByYear.get(milestone.year) ?? [];
      milestonesForYear.push(milestone);
      milestonesByYear.set(milestone.year, milestonesForYear);
    }

    return Array.from(milestonesByYear.values()).map((milestonesForYear) => {
      const labelMilestone = milestonesForYear[milestonesForYear.length - 1];
      return {
        ...labelMilestone,
        milestoneIds: milestonesForYear.map((milestone) => milestone.id),
      } satisfies RenderedMilestone;
    });
  };
  $: timelineMilestones = buildRenderedMilestones();
  $: visibleMilestones = buildRenderedMilestones(displayYear);
  $: inactiveMilestoneLabelXs = (() => {
    const labelXs = new Map<string, number>();
    let nextLeft = Number.POSITIVE_INFINITY;
    let isLatestInactiveLabel = true;
    const rightBoundaryX =
      yearToX(womenMedicsAreaChartStartYear) - areaChartMilestoneLabelGap;

    for (const milestone of [...timelineMilestones].reverse()) {

      const targetX = yearToX(milestone.year);
      const maximumX = isLatestInactiveLabel
        ? rightBoundaryX - inactiveMilestoneLabelRightExtent
        : nextLeft -
          inactiveMilestoneLabelGap -
          inactiveMilestoneLabelRightExtent;
      const labelX = Math.min(targetX, maximumX);

      labelXs.set(milestone.id, labelX);
      nextLeft = labelX - inactiveMilestoneLabelLeftExtent;
      isLatestInactiveLabel = false;
    }

    return labelXs;
  })();
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

    {#if currentYear >= womenMedicalEducationPeriodStartYear}
      <rect
        class="women-medical-education-period"
        x={yearToX(womenMedicalEducationPeriodStartYear)}
        y={height - womenMedicalEducationPeriodHeight - 2}
        width={
          yearToX(womenMedicalEducationPeriodEndYear) -
          yearToX(womenMedicalEducationPeriodStartYear)
        }
        height={womenMedicalEducationPeriodHeight}
        aria-label="Women’s medical education period, 1886 to 1915"
      ></rect>
    {/if}

    <g class="timeline-underlay" aria-hidden="true">
      <line
        class="domain"
        x1={axisStart}
        y1={timelineY}
        x2={axisRight}
        y2={timelineY}
      ></line>

      {#each fullTickValues as year}
        {#if !(timelineStretchProgress > 0 && year === 1900)}
          <g class="tick" transform={`translate(${yearToX(year)}, ${timelineY})`}>
            <line x1="0" y1="0" x2="0" y2={tickLength}></line>
            <text x="0" y={tickLength + 16} text-anchor="middle">{year}</text>
          </g>
        {/if}
      {/each}

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
      {#if !(timelineStretchProgress > 0 && year === 1900)}
        <g class="tick" transform={`translate(${yearToX(year)}, ${timelineY})`}>
          <line x1="0" y1="0" x2="0" y2={tickLength}></line>
          <text x="0" y={tickLength + 16} text-anchor="middle">{year}</text>
        </g>
      {/if}
    {/each}

    {#each minorTickValues as year}
      <g
        class="minor-tick"
        transform={`translate(${yearToX(year)}, ${timelineY})`}
      >
        <line x1="0" y1="0" x2="0" y2={tickLength}></line>
      </g>
    {/each}

    {#if timelineStretchProgress > 0}
      <g class="timeline-stretch-ticks" opacity={timelineStretchProgress}>
        {#each womenMedicalEducationPeriodTickYears as year}
          <g
            class="tick"
            class:timeline-stretch-tick--reached={currentYear >= year}
            transform={`translate(${yearToX(year)}, ${timelineY})`}
          >
            <line x1="0" y1="0" x2="0" y2={tickLength}></line>
            <text x="0" y={tickLength + 16} text-anchor="middle">{year}</text>
          </g>
        {/each}
      </g>
    {/if}

    <!-- <HistoricalEvents
      events={historicalEvents}
      {currentYear}
      domainStartYear={timelineDomainStart}
      domainEndYear={timelineDomainEnd}
      {timelineY}
      {yearToX}
    /> -->

    <DoctorsAreaChart
      {womenDoctorsData}
      {currentYear}
      {timelineY}
      {yearToX}
      {womenMedicsData}
    />

    {#each visibleMilestones as milestone (milestone.id)}
      <Milestone
        x={yearToX(milestone.year)}
        labelX={
          inactiveMilestoneLabelXs.get(milestone.id) ?? yearToX(milestone.year)
        }
        {height}
        label={milestone.year === 1726 && displayYear === 2026
          ? "1726"
          : milestone.label}
        active={milestone.milestoneIds.includes(pausedMilestoneId ?? "")}
        mutedInactiveLabel={mutedInactiveMilestoneYears.has(milestone.year)}
        expandedInactive={milestone.year === 1726 && displayYear === 2026}
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

  .women-medical-education-period {
    fill: rgba(180, 180, 180, 0.2);
    stroke: rgba(180, 180, 180, 0.95);
    stroke-width: 1px;
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

  .timeline-stretch-ticks .tick text {
    fill: rgba(180, 180, 180, 0.9);
    font-size: 14px;
  }

  .timeline-stretch-ticks .tick.timeline-stretch-tick--reached text {
    fill: #fff;
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

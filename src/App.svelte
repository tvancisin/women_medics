<script lang="ts">
  import { onMount } from "svelte";
  import Path from "./lib/Path.svelte";
  import Events from "./lib/Events.svelte";
  import { historicalEvents } from "./datastore";

  console.log(historicalEvents);

  const startYear = 1583;
  const endYear = 2026;
  const stepYears = 10;
  const pauseYears = [1583, 1726, 1867, 1869, 1892];
  const milestoneLabels = new Map<number, string>([
    [1583, "University of Edinburgh founded"],
    [1726, "School of Medicine"],
    [1867, "First female students"],
    [1869, "Edinburgh Seven"],
    [1892, "Women admitted to universities"],
  ]);
  const pauseDurationMs = 3000;
  const margin = { top: 20, right: 40, bottom: 30, left: 40 };
  const tickLength = 5;
  const totalRange = endYear - startYear;

  let height = 0;
  let width = 0;
  let currentYear = startYear;
  let animationStartMs = 0;
  let animationFrameId: number | null = null;
  let nextPauseIndex = 0;
  let pausedAtYear: number | null = null;
  let pauseStartMs: number | null = null;

  $: maxSpan = Math.max(0, width - margin.left - margin.right);
  $: timelineY = Math.max(margin.top, height - margin.bottom);

  $: axisStart = margin.left;
  $: progressTarget =
    totalRange > 0 ? (currentYear - startYear) / totalRange : 0;
  $: clampedProgress = Math.min(1, Math.max(0, progressTarget));
  $: span = maxSpan * clampedProgress;
  $: axisEnd = axisStart + span;

  // adding ticks
  const buildTickValues = (maxYear: number) => {
    const values = [startYear];
    for (let year = 1600; year <= maxYear; year += 20) {
      values.push(year);
    }
    return values;
  };

  // calculating x position for a given year
  $: yearToX = (year: number) => {
    const currentRange = currentYear - startYear;
    if (currentRange <= 0) return axisStart;
    const yearProgress = (year - startYear) / currentRange;
    return axisStart + yearProgress * span;
  };

  $: tickValues = width > 0 && height > 0 ? buildTickValues(currentYear) : [];
  $: displayYear = Math.floor(currentYear);

  onMount(() => {
    const updateYearFromClock = () => {
      if (pauseStartMs !== null && pausedAtYear !== null) {
        const pausedMs = Date.now() - pauseStartMs;
        currentYear = pausedAtYear;

        if (pausedMs >= pauseDurationMs) {
          animationStartMs += pauseDurationMs;
          pauseStartMs = null;
          pausedAtYear = null;
          nextPauseIndex += 1;
        }

        return;
      }

      const elapsedSeconds = (Date.now() - animationStartMs) / 500;
      const yearsElapsed = elapsedSeconds * stepYears;
      currentYear = Math.min(startYear + yearsElapsed, endYear);

      const nextPauseYear = pauseYears[nextPauseIndex];
      if (nextPauseYear !== undefined && currentYear >= nextPauseYear) {
        currentYear = nextPauseYear;
        pausedAtYear = nextPauseYear;
        pauseStartMs = Date.now();
      }
    };

    animationStartMs = Date.now();

    const animate = () => {
      updateYearFromClock();
      if (currentYear < endYear) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    const handleVisibilityChange = () => {
      updateYearFromClock();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  });
</script>

<main bind:clientWidth={width} bind:clientHeight={height}>
  <h1>Women in Medicine</h1>
  <svg {width} {height}>
    {#if width > 0 && height > 0}
      <Events
        events={historicalEvents}
        {currentYear}
        {startYear}
        {timelineY}
        {yearToX}
      />
      <line
        class="domain"
        x1={axisStart}
        y1={timelineY}
        x2={axisEnd}
        y2={timelineY}
      ></line>
      <text
        x={yearToX(displayYear)}
        y={timelineY - 10}
        text-anchor="middle"
        fill="#fff"
        font-size="18px"
      >
        {displayYear}
      </text>
      {#each pauseYears.filter((year) => displayYear >= year) as year (year)}
        <Path
          x={yearToX(year)}
          {height}
          label={milestoneLabels.get(year) ?? ""}
        />
      {/each}
      {#each tickValues as year}
        <g class="tick" transform={`translate(${yearToX(year)}, ${timelineY})`}>
          <line x1="0" y1="0" x2="0" y2={tickLength}></line>
          <text x="0" y={tickLength + 12} text-anchor="middle">{year}</text>
        </g>
      {/each}
      <circle cx={axisEnd} cy={timelineY} r="3" fill="#fff"></circle>
    {/if}
  </svg>
</main>

<style>
  main {
    width: 100%;
    height: 100vh;
  }

  h1 {
    position: absolute;
    color: rgb(253, 250, 245);
    right: 50%;
    transform: translateX(50%);
    margin: 5px;
  }

  .domain {
    stroke: gray;
    stroke-width: 2px;
  }

  .tick line {
    stroke: #fff;
  }

  .tick text {
    fill: #fff;
    font-size: 12px;
    font-family: Montserrat;
  }
</style>

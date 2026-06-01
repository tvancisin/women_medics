<script lang="ts">
  import { onMount } from "svelte";
  import { getIndividualCSV, historicalEvents } from "./datastore";
  import Path from "./lib/Path.svelte";
  import Events from "./lib/Events.svelte";
  import Linechart from "./lib/Linechart.svelte";
  import MapView from "./lib/MapView.svelte";

  const startYear = 1583;
  const endYear = 2026;
  const stepYears = 20;
  const margin = { top: 20, right: 40, bottom: 30, left: 40 };
  const tickLength = 5;
  const totalRange = endYear - startYear;
  // amking sure divs with details fit within the screen
  const clampedLeft = (x: number) =>
    Math.min(Math.max(10, x - 500), width - 1010);

  // Dev-only: set to false or remove this flag and the related blocks below to restore auto-resume.
  const devRequireClickToResume = true;

  const pauseYears = [1583, 1726, 1862, 1867, 1869, 1875, 1892];
  const milestoneLabels = new Map<number, string>([
    [1583, "University of Edinburgh founded"],
    [1726, "School of Medicine"],
    [1862, "Elizabeth Garrett refusal"],
    [1867, "First female students"],
    [1869, "Edinburgh Seven"],
    [1875, "First physiology course for women"],
    [1892, "Women admitted to universities"],
  ]);
  const pauseDurationMs = 1000;

  let height = 0;
  let width = 0;
  let currentYear = startYear;
  let animationStartMs = 0;
  let animationFrameId: number | null = null;
  let nextPauseIndex = 0;
  let pausedAtYear: number | null = null;
  let pauseStartMs: number | null = null;
  let shrinkEnabledYears = new Set<number>();
  let womenMedicsData: Array<{ year: number; number: number }> = [];

  // Dev-only: remove these two variables with the click-to-resume behavior.
  let awaitingResumeClick = false;
  let resumeRequested = false;

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

  // Dev-only: remove this handler together with the Continue button markup.
  const handleResumeClick = () => {
    if (pausedAtYear !== null) {
      const nextShrinkYears = new Set(shrinkEnabledYears);
      nextShrinkYears.add(pausedAtYear);
      shrinkEnabledYears = nextShrinkYears;
    }
    resumeRequested = true;
    awaitingResumeClick = false;
  };

  onMount(() => {
    const loadWomenMedicsData = async () => {
      try {
        const rawWomenMedicsData = (await getIndividualCSV(
          "/data/women_medics_1914_1966.csv"
        )) as Array<{ year?: string; number?: string }>;
        womenMedicsData = rawWomenMedicsData
          .map((row: { year?: string; number?: string }) => {
            const firstYear = Number(String(row.year ?? "").split("-")[0]);
            const total = Number(row.number);
            return { year: firstYear, number: total };
          })
          .filter(
            (row: { year: number; number: number }) =>
              Number.isFinite(row.year) && Number.isFinite(row.number)
          );
      } catch (error: unknown) {
        console.error("Failed to load women_medics_1914_1966.csv", error);
      }
    };

    loadWomenMedicsData();
    

    // Runs once per animation frame and updates timeline state from wall-clock time.
    const updateYearFromClock = () => {
      // 1) Pause branch: when a milestone pause is active, keep the year frozen.
      if (pauseStartMs !== null && pausedAtYear !== null) {
        const pausedMs = Date.now() - pauseStartMs;
        currentYear = pausedAtYear;

        // 2) After pauseDurationMs, resume progression and trigger path shrink for that milestone.
        if (pausedMs >= pauseDurationMs) {
          // Dev-only: this gate keeps the existing timed pause, but requires a click before resuming.
          if (devRequireClickToResume && !resumeRequested) {
            awaitingResumeClick = true;
            return;
          }

          // Trigger path shrink for the milestone we're leaving — works
          // whether the button triggered this or the timer fired automatically.
          const nextShrinkYears = new Set(shrinkEnabledYears);
          nextShrinkYears.add(pausedAtYear);
          shrinkEnabledYears = nextShrinkYears;

          // Keep timeline speed consistent by discounting time spent paused.
          animationStartMs += pausedMs;
          // Clear pause state so normal timeline movement can continue.
          pauseStartMs = null;
          pausedAtYear = null;
          nextPauseIndex += 1;
          awaitingResumeClick = false;
          resumeRequested = false;
        }

        // While paused, skip normal progression logic.
        return;
      }

      // 3) Normal progression branch: map elapsed wall-clock time to timeline year.
      const elapsedSeconds = (Date.now() - animationStartMs) / 500;
      const yearsElapsed = elapsedSeconds * stepYears;
      currentYear = Math.min(startYear + yearsElapsed, endYear);

      // 4) Enter a new pause when the next milestone is reached.
      const nextPauseYear = pauseYears[nextPauseIndex];
      if (nextPauseYear !== undefined && currentYear >= nextPauseYear) {
        currentYear = nextPauseYear;
        pausedAtYear = nextPauseYear;
        pauseStartMs = Date.now();
        awaitingResumeClick = false;
        resumeRequested = false;
      }
    };

    // Anchor animation time so progression starts from "now".
    animationStartMs = Date.now();

    // Frame loop: update state, then queue the next frame until we reach endYear.
    const animate = () => {
      updateYearFromClock();
      if (currentYear < endYear) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Keep state coherent when the tab visibility changes.
    const handleVisibilityChange = () => {
      updateYearFromClock();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Cleanup to prevent a leaked animation loop/listener on component unmount.
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  });

  $: console.log(womenMedicsData);
  
</script>

<main bind:clientWidth={width} bind:clientHeight={height}>
  <!-- Dev-only: remove this button block with the click-to-resume behavior. -->
  {#if devRequireClickToResume && awaitingResumeClick}
    <button class="resume-button" type="button" on:click={handleResumeClick}>
      Continue
    </button>
  {/if}
  <!-- <h1>Women in Medicine</h1> -->
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
      <!-- when the current year reaches each milestone in pauseYears, a Path component is rendered for it -->
      {#each pauseYears.filter((year) => displayYear >= year) as year (year)}
        <Path
          x={yearToX(year)}
          {height}
          label={milestoneLabels.get(year) ?? ""}
          shrink={shrinkEnabledYears.has(year)}
        />
      {/each}
      {#each tickValues as year}
        <g class="tick" transform={`translate(${yearToX(year)}, ${timelineY})`}>
          <line x1="0" y1="0" x2="0" y2={tickLength}></line>
          <text x="0" y={tickLength + 12} text-anchor="middle">{year}</text>
        </g>
      {/each}
      <circle cx={axisEnd} cy={timelineY} r="3" fill="#fff"></circle>
      <Linechart {currentYear} {timelineY} {yearToX} {womenMedicsData} />
    {/if}
  </svg>
  {#each pauseYears as year (year)}
    <div
      class="milestone-card"
      class:is-garrett={year === 1862}
      class:is-visible={pausedAtYear === year}
      style="left: {clampedLeft(yearToX(year))}px;"
    >
      {#if year === 1862}
        <div class="milestone-text">{milestoneLabels.get(year) ?? ""}</div>
        <img class="milestone-image" src="/img/garrett.png" alt="Elizabeth Garrett" />
      {:else if year === 1875}
      <MapView />
      {:else}
        {milestoneLabels.get(year) ?? ""}
      {/if}
    </div>
  {/each}
</main>

<style>
  main {
    width: 100%;
    height: 100vh;
    position: relative;
  }

  .milestone-card {
    position: absolute;
    top: 15vh;
    width: 1000px;
    height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 10px;
    border-radius: 4px;
    background-color: rgb(46, 46, 46);
    opacity: 0;
    transform: translateY(8px) scale(0.98);
    transition:
      opacity 260ms ease,
      transform 260ms ease;
    pointer-events: none;
  }

  .milestone-card.is-visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }

  .milestone-card.is-garrett {
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1rem;
    padding-top: 1rem;
    text-align: center;
  }

  .milestone-text {
    width: 100%;
  }

  .milestone-image {
    width: 100%;
    max-width: 100%;
    max-height: calc(100% - 2rem);
    object-fit: contain;
    display: block;
  }

  /* Dev-only: remove this style block with the Continue button markup. */
  .resume-button {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.4);
    background: rgba(20, 20, 20, 0.75);
    color: #fff;
    font: inherit;
    cursor: pointer;
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

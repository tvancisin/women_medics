<script lang="ts">
  import { onMount } from "svelte";
  import {
    getCSV,
    getJson,
    historicalEvents,
  } from "./datastore";
  import Path from "./lib/Path.svelte";
  import HistoricalEvents from "./lib/HistoricalEvents.svelte";
  import Linechart from "./lib/Linechart.svelte";
  import MapView from "./lib/MapView.svelte";
  import Bar from "./lib/Bar.svelte";
  import BackgroundMap from "./lib/BackgroundMap.svelte";

  const startYear = 1582;
  const endYear = 2026;
  const stepYears = 20;
  const margin = { top: 20, right: 40, bottom: 30, left: 40 };
  const tickLength = 5;
  const totalRange = endYear - startYear;

  let milesstoneCardWidth: number | null = null,
    milestoneCardHeight: number | null = null;

  // keeping the detail div inside screen
  const milestoneCardWidth = 400;
  const milestoneMarkerSize = 20;
  const collapsedMarkerDefaultOffset = 80;
  const collapsedMarkerOverlapOffset = 110;
  const collapsedMarkerOverlapThresholdPx = milestoneMarkerSize + 6;

  // Anchor cards differently depending on whether the milestone is left or right of center.
  const card_left = [1726, 1809];
  const clampedLeft = (x: number, year: number) => {
    // return x < width / 2 ? x + 10 : x - milestoneCardWidth - 10;
    if (card_left.includes(year)) {
      return x - milestoneCardWidth - 15;
    } else {
      return x + 15;
    }
  };
  const centeredMarkerLeft = (x: number) => x - milestoneMarkerSize / 2;

  // Dev-only: set to false or remove this flag and the related blocks below to restore auto-resume.
  const devRequireClickToResume = true;

  const pauseYears = [1809, 1862, 1867, 1869, 1875, 1884, 1886, 1889];
  const milestoneLabels = new Map<number, string>([
    // [1583, "University Founded 1583"],
    // [1726, "School of Medicine 1726"],
    [1809, "Margaret Bulkley / James Barry 1809"],
    [1862, "Elizabeth Garrett 1862"],
    [1867, "First classes for women 1867"],
    [1869, "Edinburgh Seven/Forty 1869"],
    [1875, "Physiology students 1875"],
    [1884, "Triple Qualification 1884"],
    [1886, "School of Medicine for Women 1886"],
    [1889, "College of Medicine for Women 1889"],
    // [1889, "Universities Scotland Act 1889"],
    // [1892, "Women admitted to universities"],
    // [1914, "Official female medics"],
  ]);

  const splitMilestoneYears = new Set([1809, 1862]);

  // Map each pause year to the image shown when the card is shrunk (is-past).
  // Point multiple years at the same path, or leave a year out to show no image.
  const milestoneImages = new Map<number, string>([
    // [1809, "/img/uni_logo.jpg"],
    // [1862, "/img/garrett_pic.jpg"],
    // [1867, "/img/uni_logo.png"],
    // [1869, "/img/uni_logo.png"],
    // [1875, "/img/uni_logo.png"],
  ]);
  const pauseDurationMs = 1000;

  let height = 0;
  let width = 0;
  let garrettJourneyData: unknown = null;
  let barryJourneyData: unknown = null;
  let currentYear = startYear;
  let animationStartMs = 0;
  let animationFrameId: number | null = null;
  let nextPauseIndex = 0;
  let pausedAtYear: number | null = null;
  let pauseStartMs: number | null = null;
  let shrinkEnabledYears = new Set<number>();
  let womenMedicsData: Array<{ year: number; number: number }> = [];
  let edinburghSevenData: Array<Record<string, string>> = [];
  let firstClassesData: Array<Record<string, string>> = [];

  const edinburghFortyImageUrl = (img?: string) => {
    const fileName = String(img ?? "").trim();
    if (!fileName || fileName.toLowerCase() === "null") return undefined;

    const src = fileName.startsWith("/")
      ? fileName
      : `/img/edin_forty/${fileName}`;
    return `url("${src}")`;
  };

  type FirstClassesLabel = {
    key: string;
    x: number;
    y: number;
    label: string;
    fontSize: number;
  };
  let firstClassesLabels: FirstClassesLabel[] = [];
  type PhysiologyGeoDatum = {
    source_data?: {
      entry_year?: number | string;
    };
  };
  let womenPhysiologyGeoData: PhysiologyGeoDatum[] = [];

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

  $: firstClassesLabels = (() => {
    const itemCount = firstClassesData.length;
    const containerWidth = milesstoneCardWidth ?? 0;
    const containerHeight = milestoneCardHeight ?? 0;

    if (itemCount === 0 || containerWidth <= 0 || containerHeight <= 0) {
      return [];
    }

    const labels = firstClassesData.map(
      (item, index) => item.name ?? `Entry ${index + 1}`,
    );
    const horizontalPadding = Math.min(20, containerWidth * 0.025);
    const topBottomPadding = Math.min(18, containerHeight * 0.05);
    const preferredFontSizePx = 10;
    const minReadableFontSizePx = 8;
    const lineHeightFactor = 1.2;
    const rowGapFactor = 0.18;
    const charWidthFactor = 0.54;
    const columnInnerPadding = 4;
    const columnGap = 8;

    const usableWidth = Math.max(1, containerWidth - horizontalPadding * 2);
    const usableHeight = Math.max(1, containerHeight - topBottomPadding * 2);
    type Layout = {
      fontSizePx: number;
      rows: number;
      columns: number;
      columnWidth: number;
      rowStep: number;
      startY: number;
    };

    const fitsWidth = (columns: number, rows: number, fontSizePx: number, columnWidth: number) => {
      for (let column = 0; column < columns; column += 1) {
        const start = column * rows;
        const end = Math.min(start + rows, itemCount);
        let maxChars = 1;
        for (let i = start; i < end; i += 1) {
          maxChars = Math.max(maxChars, labels[i].length);
        }
        const estimatedTextWidth = maxChars * fontSizePx * charWidthFactor;
        if (estimatedTextWidth > Math.max(1, columnWidth - columnInnerPadding * 2)) {
          return false;
        }
      }
      return true;
    };

    let chosenLayout: Layout | null = null;

    for (
      let fontSizePx = preferredFontSizePx;
      fontSizePx >= minReadableFontSizePx;
      fontSizePx -= 0.25
    ) {
      const lineHeight = fontSizePx * lineHeightFactor;
      const rowGap = fontSizePx * rowGapFactor;
      const rowStep = lineHeight + rowGap;
      const maxRows = Math.max(1, Math.floor((usableHeight + rowGap) / rowStep));
      const columns = Math.max(1, Math.ceil(itemCount / maxRows));
      const rows = Math.max(1, Math.ceil(itemCount / columns));

      const totalGapWidth = (columns - 1) * columnGap;
      const columnWidth = Math.max(1, (usableWidth - totalGapWidth) / columns);
      const totalRowsHeight = rows * lineHeight + Math.max(0, rows - 1) * rowGap;

      const fitsHeight = totalRowsHeight <= usableHeight;
      const widthOk = fitsWidth(columns, rows, fontSizePx, columnWidth);

      if (fitsHeight && widthOk) {
        chosenLayout = {
          fontSizePx,
          rows,
          columns,
          columnWidth,
          rowStep,
          startY: topBottomPadding + Math.max(0, (usableHeight - totalRowsHeight) / 2),
        };
        break;
      }
    }

    if (!chosenLayout) {
      const fallbackFont = minReadableFontSizePx;
      const lineHeight = fallbackFont * lineHeightFactor;
      const rowGap = fallbackFont * rowGapFactor;
      const rowStep = lineHeight + rowGap;
      const maxRows = Math.max(1, Math.floor((usableHeight + rowGap) / rowStep));
      const columns = Math.max(1, Math.ceil(itemCount / maxRows));
      const rows = Math.max(1, Math.ceil(itemCount / columns));
      const totalGapWidth = (columns - 1) * columnGap;
      const columnWidth = Math.max(1, (usableWidth - totalGapWidth) / columns);
      const totalRowsHeight = rows * lineHeight + Math.max(0, rows - 1) * rowGap;
      chosenLayout = {
        fontSizePx: fallbackFont,
        rows,
        columns,
        columnWidth,
        rowStep,
        startY: topBottomPadding + Math.max(0, (usableHeight - totalRowsHeight) / 2),
      };
    }

    const { fontSizePx, rows, columnWidth, rowStep, startY } = chosenLayout;

    return firstClassesData.map((item, index) => {
      const row = index % rows;
      const column = Math.floor(index / rows);
      const x =
        horizontalPadding + column * (columnWidth + columnGap) + columnInnerPadding;
      const y = startY + row * rowStep;
      const label = labels[index];

      return {
        key: `${index}-${label}`,
        x,
        y,
        label,
        fontSize: fontSizePx,
      };
    });
  })();

  let topByYear: Map<number, number> = new Map();
  $: collapsedMarkerTopByYear = (() => {
    topByYear = new Map<number, number>();
    let previousCollapsedYear: number | null = null;

    for (const year of pauseYears) {
      if (!shrinkEnabledYears.has(year)) {
        continue;
      }

      const defaultTop = height - collapsedMarkerDefaultOffset;
      const overlapTop = height - collapsedMarkerOverlapOffset;

      if (previousCollapsedYear === null) {
        topByYear.set(year, defaultTop);
        previousCollapsedYear = year;
        continue;
      }

      const markerX = centeredMarkerLeft(yearToX(year));
      const previousX = centeredMarkerLeft(yearToX(previousCollapsedYear));
      const previousTop = topByYear.get(previousCollapsedYear) ?? defaultTop;
      const isClose =
        Math.abs(markerX - previousX) < collapsedMarkerOverlapThresholdPx;

      if (isClose) {
        topByYear.set(
          year,
          previousTop === overlapTop ? defaultTop : overlapTop,
        );
      } else {
        topByYear.set(year, defaultTop);
      }

      previousCollapsedYear = year;
    }
    return topByYear;
  })();

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

  const getPhysiologyDataForYear = (year: number) =>
    womenPhysiologyGeoData.filter(
      (d) => Number(d.source_data?.entry_year) === year,
    );

  onMount(() => {
    const loadCsvData = async () => {
      try {
        const [rawWomenMedicsData, rawEdinburghSevenData, first_classes] =
          (await getCSV([
            "/data/women_medics_1914_1966.csv",
            "/data/edinburgh_seven.csv",
            "/data/first_women_classes_1867.csv",
          ])) as [
            Array<{ year?: string; number?: string }>,
            Array<Record<string, string>>,
            Array<Record<string, string>>,
          ];

        womenMedicsData = rawWomenMedicsData
          .map((row: { year?: string; number?: string }) => {
            const firstYear = Number(String(row.year ?? "").split("-")[0]);
            const total = Number(row.number);
            return { year: firstYear, number: total };
          })
          .filter(
            (row: { year: number; number: number }) =>
              Number.isFinite(row.year) && Number.isFinite(row.number),
          );

        edinburghSevenData = rawEdinburghSevenData;
        firstClassesData = first_classes;
      } catch (error: unknown) {
        console.error(
          "Failed to load women_medics_1914_1966.csv and/or edinburgh_seven.csv",
          error,
        );
      }
    };

    const loadJsonData = async () => {
      try {
        const [
          rawWomenPhysiologyGeoData,
          rawGarrettJourneyData,
          rawBarryJourneyData,
        ] = await getJson([
          "/data/women_physiology_geo.json",
          "/data/geo/garrett_journey.json",
          "/data/geo/barry_journey.json",
        ]);

        womenPhysiologyGeoData = Array.isArray(rawWomenPhysiologyGeoData)
          ? (rawWomenPhysiologyGeoData as PhysiologyGeoDatum[])
          : [];

        garrettJourneyData = rawGarrettJourneyData ?? null;
        barryJourneyData = rawBarryJourneyData ?? null;
      } catch (error: unknown) {
        console.error(
          "Failed to load women_physiology_geo.json and/or garrett_journey.json",
          error,
        );
      }
    };

    loadCsvData();
    loadJsonData();

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
</script>

<main bind:clientWidth={width} bind:clientHeight={height}>
  <BackgroundMap
    {currentYear}
    {garrettJourneyData}
    {barryJourneyData}
    {womenPhysiologyGeoData}
  />
  <!-- Dev-only: remove this button block with the click-to-resume behavior. -->
  {#if devRequireClickToResume && awaitingResumeClick}
    <button class="resume-button" type="button" on:click={handleResumeClick}>
      Continue
    </button>
  {/if}
  <svg {width} {height}>
    {#if width > 0 && height > 0}
      <HistoricalEvents
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

      {#each pauseYears.filter((year) => displayYear >= year && milestoneLabels.has(year)) as year, index (year)}
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
      <!-- {#if displayYear >= 1869}
        <Bar x={yearToX(1869)} {height} data={edinburghSevenData} />
      {/if}
      {#if displayYear >= 1875}
        <Bar x={yearToX(1875)} {height} data={getPhysiologyDataForYear(1875)} />
      {/if}
      {#if displayYear >= 1878}
        <Bar x={yearToX(1878)} {height} data={getPhysiologyDataForYear(1878)} />
      {/if}
      {#if displayYear >= 1883}
        <Bar x={yearToX(1883)} {height} data={getPhysiologyDataForYear(1883)} />
      {/if}
      {#if displayYear >= 1886}
        <Bar x={yearToX(1886)} {height} data={getPhysiologyDataForYear(1886)} />
      {/if}
      {#if displayYear >= 1891}
        <Bar x={yearToX(1891)} {height} data={getPhysiologyDataForYear(1891)} />
      {/if} -->
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
      class:milestone-card--split={splitMilestoneYears.has(year)}
      class:milestone-card--first-classes-active={year === 1867 && pausedAtYear === year}
      class:is-active={pausedAtYear === year}
      class:is-past={shrinkEnabledYears.has(year)}
      style:background-image={shrinkEnabledYears.has(year) &&
      milestoneImages.has(year)
        ? `url(${milestoneImages.get(year)})`
        : undefined}
      style:width={pausedAtYear === year && year === 1867 ? "80vw" : undefined}
      style:top={pausedAtYear === year
        ? "15vh"
        : `${collapsedMarkerTopByYear.get(year) ?? height - collapsedMarkerDefaultOffset}px`}
      style:left="{pausedAtYear === year
        ? year === 1867
          ? 0.1 * width
          : clampedLeft(yearToX(year), year)
        : centeredMarkerLeft(yearToX(year))}px"
    >
      {#if year === 1809}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src="/img/barry.jpg"
              alt="Margaret Bulkley / James Barry"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              James Barry (born Margaret Anne Bulkley, or Bulkeley; c. 1789[a] –
              25 July 1865) was a military surgeon in the British Army.
              Originally from the city of Cork in Ireland, Barry obtained a
              medical degree from the University of Edinburgh Medical School,
              then served first in Cape Town, South Africa, and subsequently in
              many parts of the British Empire.
            </div>
          </div>
        </div>
      {:else if year === 1862}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src="/img/garrett_pic.jpg"
              alt="Elizabeth Garrett"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              Elizabeth Garrett Anderson (9 June 1836 – 17 December 1917) was an
              English physician and suffragist. She is known for being the first
              woman to qualify in Britain as a physician and surgeon and as a
              co-founder and dean of the London School of Medicine for Women,
              which was the first medical school in Britain to train women as
              doctors. She was the first female dean of a British medical
              school, the first woman in Britain to be elected to a school board
              and, as mayor of Aldeburgh, the first female mayor in Britain.
            </div>
          </div>
        </div>
      {:else if year === 1867}
        <div
          class="first-classes-list"
          bind:clientWidth={milesstoneCardWidth}
          bind:clientHeight={milestoneCardHeight}
        >
          <svg
            height={milestoneCardHeight ?? 0}
            width={milesstoneCardWidth ?? 0}
            aria-label="First classes for women represented as circles"
          >
            {#each firstClassesLabels as item (item.key)}
              <!-- <circle
                cx={circle.cx}
                cy={circle.cy}
                r={circle.r}
                fill="rgba(255, 255, 255, 0.82)"
                stroke="rgba(255, 255, 255, 0.35)"
                stroke-width="1"
              >
                <title>{circle.label}</title>
              </circle> -->
              <text
                x={item.x}
                y={item.y}
                class="first-classes-name"
                text-anchor="start"
                style:font-size={`${item.fontSize}px`}
              >
                {item.label}
              </text>
            {/each}
          </svg>
          <!-- {#each firstClassesData as d}
            <p>{d.name}</p>
          {/each} -->
        </div>
      {:else if year === 1869}
        <div class="edinburgh_forty">
          {#each edinburghSevenData as d (d.name)}
            <div class="edinburgh_forty-item">
              <div
                class="edinburgh_forty-circle"
                style:background-image={edinburghFortyImageUrl(d.img)}
              ></div>
              <div class="edinburgh_forty-name">{d.name}</div>
            </div>
          {/each}
        </div>
      {:else if year === 1892}
        <div class="milestone-text">{milestoneLabels.get(year) ?? ""}</div>
        <img
          class="milestone-image"
          src="/img/ordinance_1892.png"
          alt="Women Admitted to Universities"
        />
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

  svg {
    position: relative;
    z-index: 1;
    display: block;
  }

  .milestone-card {
    position: absolute;
    z-index: 2;
    width: 30px;
    box-sizing: border-box;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 10px;
    border-radius: 7px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    background-color: rgb(0, 0, 0);
    opacity: 0;
    transform: translateY(8px);
    transition:
      width 260ms ease,
      height 260ms ease,
      top 260ms ease,
      left 260ms ease,
      opacity 260ms ease,
      transform 260ms ease;
    pointer-events: none;
    overflow: hidden;
  }

  .milestone-card.is-active,
  .milestone-card.is-past {
    opacity: 1;
  }

  .milestone-card.is-active {
    width: 400px;
    height: 75vh;
    transform: translateY(8px);
    pointer-events: auto;
  }

  .milestone-card--split {
    padding: 0;
  }

  .milestone-card--split .milestone-card-split-layout {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .milestone-card--split .milestone-card-split-half {
    flex: 1 1 50%;
    min-height: 0;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
  }

  .milestone-card--split .milestone-card-split-image {
    padding: 0.5rem;
    align-items: center;
  }

  .milestone-card--split .milestone-card-split-text {
    padding: 30px;
    text-align: left;
  }

  .milestone-card-title {
    font-size: 12px;
    line-height: 1.3;
  }

  .milestone-card.is-past {
    width: 20px;
    height: 20px;
    padding: 0;
    gap: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    font-size: 0;
  }

  .milestone-card.is-past > * {
    display: none;
  }

  .milestone-text {
    width: 100%;
    font-size: 12px;
    flex: 0 0 auto;
  }

  .milestone-image {
    width: auto;
    max-width: 100%;
    max-height: calc(100% - 5rem);
    object-fit: contain;
    display: block;
    flex: 1 1 auto;
    min-height: 0;
  }

  .first-classes-list {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .first-classes-name {
    fill: rgba(255, 255, 255, 0.95);
    dominant-baseline: hanging;
    pointer-events: none;
  }

  .edinburgh_forty {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 3px;
    padding: 3px;
    overflow: hidden;
  }

  .edinburgh_forty-item {
    min-width: 0;
    min-height: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 3px;
    background: rgba(255, 255, 255, 0.12);
  }

  .edinburgh_forty-circle {
    width: min(36px, 70%);
    aspect-ratio: 1;
    border-radius: 50%;
    flex: 0 0 auto;
    background: rgba(56, 56, 56, 0.82);
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
  }

  .edinburgh_forty-name {
    width: 100%;
    min-width: 0;
    color: #fff;
    font-size: 8px;
    line-height: 1.1;
    text-align: center;
    overflow-wrap: anywhere;
  }

  /* Dev-only: remove this style block with the Continue button markup. */
  .resume-button {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 10;
    padding: 0.5rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.4);
    background: rgba(20, 20, 20, 0.75);
    color: #fff;
    font: inherit;
    cursor: pointer;
  }

  .domain {
    stroke: gray;
    stroke-width: 1px;
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

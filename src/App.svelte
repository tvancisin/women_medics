<script lang="ts">
  import { onMount } from "svelte";
  import { getCSV, getJson } from "./lib/data/loaders";
  import BackgroundMap from "./lib/BackgroundMap.svelte";
  import MainTimeline from "./lib/MainTimeline.svelte";
  import { normalizeWomenCareer1915Region } from "./lib/map/featureBuilders";

  const baseUrl = import.meta.env.BASE_URL;
  const publicUrl = (path: string) => `${baseUrl}${path}`;

  const startYear = 1550;
  const endYear = 2026;
  const stepYears = 50;
  const timelineZoomTriggerYear = 1862;
  const timelineResetTriggerYear = 1914;
  const timelineZoomDomainStart = 1850;
  const timelineZoomDomainEnd = 1930;
  const timelineZoomDurationMs = 1600;
  const margin = { top: 20, right: 40, bottom: 30, left: 40 };

  // keeping the detail div inside screen
  const milestoneCardWidth = 400;
  const milestoneMarkerSize = 20;
  const collapsedMarkerDefaultOffset = 90;
  const collapsedMarkerOverlapOffset = 110;
  const collapsedMarkerOverlapThresholdPx = milestoneMarkerSize + 6;

  // Anchor cards differently depending on whether the milestone is left or right of center.
  const card_left = [1726, 1809, 1867, 1869, 1875, 1886, 1889];
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

  const pauseYears = [
    1583, 1726, 1809, 1862, 1867, 1869, 1875, 1886, 1889, 1911, 1912, 1914,
  ];
  const milestoneLabels = new Map<number, string>([
    [1583, "Foundation of the University 1582"],
    [1726, "School of Medicine 1726"],
    [1809, "Margaret Bulkley / James Barry 1809"],
    [1862, "Elizabeth Garrett 1862"],
    [1867, "First classes for women 1867"],
    [1869, "Edinburgh Seven/Forty 1869"],
    [1875, "Physiology students 1875"],
    // [1884, "Triple Qualification 1884"],
    [1886, "School of Medicine for Women 1886"],
    [1889, "College of Medicine for Women 1889"],
    // [1889, "Universities Scotland Act 1889"],
    // [1892, "Women admitted to universities"],
    [1911, "Women Doctors"],
    [1912, "Women Doctors travelling abroad"],
    [1914, "Official female medics"],
  ]);

  const splitMilestoneYears = new Set([1809, 1862, 1867, 1875]);

  // Point multiple years at the same path, or leave a year out to show no image.
  const pauseDurationMs = 500;

  let height = 0;
  let width = 0;
  let garrettJourneyData: unknown = null;
  let barryJourneyData: unknown = null;
  let firstClassesPathsData: unknown = null;
  let physiologyPathsData: unknown = null;
  let colonies: unknown = null;
  let suez: unknown = null;
  let womenDoctorsData: unknown = null;
  let womenCareers1915Data: unknown = null;
  let currentYear = startYear;
  let animationStartMs = 0;
  let animationFrameId: number | null = null;
  let timelineZoomFrameId: number | null = null;
  let hasZoomedTimeline = false;
  let hasResetTimeline = false;
  let timelineDomainStart = startYear;
  let timelineDomainEnd = endYear;
  let nextPauseIndex = 0;
  let pausedAtYear: number | null = null;
  let pauseStartMs: number | null = null;
  let shrinkEnabledYears = new Set<number>();
  let womenMedicsData: Array<{ year: number; number: number }> = [];
  let edinburghSevenData: Array<Record<string, string>> = [];

  type FirstClassesGeoDatum = {
    source_data?: {
      entry_year?: number | string;
    };
  };
  let firstClassesGeoData: FirstClassesGeoDatum[] = [];

  type WomenDoctorDatum = {
    source_data?: {
      "Year of student registration"?: number | string | null;
    };
  };

  type WomenCareer1915Datum = {
    source_data?: {
      "Position codes"?: string | null;
      career_location_1915?: {
        region?: string | null;
      } | null;
    };
  };

  type CareerPositionCount = {
    code: string;
    count: number;
    percent: number;
  };

  type CareerRegionGroup = {
    region: string;
    total: number;
    statedCount: number;
    notStatedCount: number;
    statedPercent: number;
    notStatedPercent: number;
    positions: CareerPositionCount[];
  };

  const edinburghFortyImageUrl = (img?: string) => {
    const fileName = String(img ?? "").trim();
    if (!fileName || fileName.toLowerCase() === "null") return undefined;

    const normalizedPath = fileName.startsWith("/")
      ? fileName.slice(1)
      : `img/edin_forty/${fileName}`;
    const src = publicUrl(normalizedPath);
    return `url("${src}")`;
  };

  const universityFoundedBackgroundImage = `url("${publicUrl("img/edinburgh_1583.jpg")}")`;
  type PhysiologyGeoDatum = {
    source_data?: {
      entry_year?: number | string;
    };
  };
  let womenPhysiologyGeoData: PhysiologyGeoDatum[] = [];

  const getStudentRegistrationYear = (doctor: WomenDoctorDatum) => {
    const rawYear = doctor.source_data?.["Year of student registration"];

    if (rawYear === null || rawYear === undefined || rawYear === "") {
      return Number.POSITIVE_INFINITY;
    }

    const year = Number(rawYear);
    return Number.isFinite(year) ? year : Number.POSITIVE_INFINITY;
  };

  const displayLabel = (value: unknown, fallback = "Not stated") => {
    const label = String(value ?? "").trim();
    return label && label.toLowerCase() !== "null" ? label : fallback;
  };

  const isStatedPosition = (position: string) => {
    return position.trim().toLowerCase() !== "not stated";
  };

  const buildCareerPositionGroups = (rawData: unknown): CareerRegionGroup[] => {
    if (!Array.isArray(rawData)) return [];

    const countsByRegion = new Map<
      string,
      {
        counts: Map<string, number>;
        notStatedCount: number;
        statedCount: number;
      }
    >();

    for (const row of rawData as WomenCareer1915Datum[]) {
      const sourceData = row.source_data;
      const region = normalizeWomenCareer1915Region(
        sourceData?.career_location_1915?.region,
      );
      const position = displayLabel(sourceData?.["Position codes"]);

      if (!countsByRegion.has(region)) {
        countsByRegion.set(region, {
          counts: new Map<string, number>(),
          notStatedCount: 0,
          statedCount: 0,
        });
      }

      const regionCounts = countsByRegion.get(region);
      if (!regionCounts) continue;

      if (isStatedPosition(position)) {
        regionCounts.statedCount += 1;
        regionCounts.counts.set(
          position,
          (regionCounts.counts.get(position) ?? 0) + 1,
        );
      } else {
        regionCounts.notStatedCount += 1;
      }
    }

    return Array.from(countsByRegion.entries())
      .map(([region, regionCounts]) => {
        const entries = Array.from(regionCounts.counts.entries()).sort(
          ([positionA, countA], [positionB, countB]) =>
            countB - countA || positionA.localeCompare(positionB),
        );
        const topEntries = entries.slice(0, 5);
        const maxCount = Math.max(...topEntries.map(([, count]) => count), 1);
        const total = regionCounts.statedCount + regionCounts.notStatedCount;

        return {
          region,
          total,
          statedCount: regionCounts.statedCount,
          notStatedCount: regionCounts.notStatedCount,
          statedPercent:
            total > 0 ? (regionCounts.statedCount / total) * 100 : 0,
          notStatedPercent:
            total > 0 ? (regionCounts.notStatedCount / total) * 100 : 0,
          positions: topEntries.map(([code, count]) => ({
            code,
            count,
            percent: (count / maxCount) * 100,
          })),
        };
      })
      .sort(
        (regionA, regionB) =>
          regionB.total - regionA.total ||
          regionA.region.localeCompare(regionB.region),
      );
  };

  // Dev-only: remove these two variables with the click-to-resume behavior.
  let awaitingResumeClick = false;
  let resumeRequested = false;

  $: careerPositionGroups = buildCareerPositionGroups(womenCareers1915Data);

  $: maxSpan = Math.max(0, width - margin.left - margin.right);
  $: timelineY = Math.max(margin.top, height - margin.bottom);

  $: axisStart = margin.left;
  $: axisRight = axisStart + maxSpan;
  $: timelineDomainSpan = Math.max(1, timelineDomainEnd - timelineDomainStart);

  const timelineZoomEase = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const startTimelineDomainTransition = (
    targetStartYear: number,
    targetEndYear: number,
    onComplete?: () => void,
  ) => {
    if (timelineZoomFrameId !== null) {
      cancelAnimationFrame(timelineZoomFrameId);
    }

    const fromStart = timelineDomainStart;
    const fromEnd = timelineDomainEnd;
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / timelineZoomDurationMs);
      const eased = timelineZoomEase(progress);

      timelineDomainStart = fromStart + (targetStartYear - fromStart) * eased;
      timelineDomainEnd = fromEnd + (targetEndYear - fromEnd) * eased;

      if (progress < 1) {
        timelineZoomFrameId = requestAnimationFrame(step);
      } else {
        timelineDomainStart = targetStartYear;
        timelineDomainEnd = targetEndYear;
        timelineZoomFrameId = null;
        onComplete?.();
      }
    };

    timelineZoomFrameId = requestAnimationFrame(step);
  };

  // calculating x position for a given year
  $: yearToX = (year: number) => {
    const yearProgress = (year - timelineDomainStart) / timelineDomainSpan;
    return axisStart + yearProgress * maxSpan;
  };

  $: if (
    currentYear >= timelineZoomTriggerYear &&
    currentYear < timelineResetTriggerYear &&
    !hasZoomedTimeline
  ) {
    hasZoomedTimeline = true;
    startTimelineDomainTransition(
      timelineZoomDomainStart,
      timelineZoomDomainEnd,
    );
  }

  $: if (currentYear >= timelineResetTriggerYear && !hasResetTimeline) {
    hasResetTimeline = true;
    hasZoomedTimeline = false;
    startTimelineDomainTransition(startYear, endYear);
  }

  // milestone divs
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

  // init
  onMount(() => {
    const loadCsvData = async () => {
      try {
        const [rawWomenMedicsData, rawEdinburghSevenData] = (await getCSV([
          publicUrl("data/women_medics_1914_1966.csv"),
          publicUrl("data/edinburgh_forty.csv"),
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

        // firstClassesData = first_classes;
      } catch (error: unknown) {
        console.error("Failed to load", error);
      }
    };

    const loadJsonData = async () => {
      try {
        const [
          rawWomenPhysiologyGeoData,
          rawGarrettJourneyData,
          rawBarryJourneyData,
          rawFirstClasses,
          rawFirstClassesPaths,
          rawPhysiologyPaths,
          rawWomenDoctors,
          rawWomenDoctors1915,
          rawColonies,
          rawSuez,
        ] = await getJson([
          publicUrl("data/women_physiology_geo.json"),
          publicUrl("data/geo/garrett_journey.json"),
          publicUrl("data/geo/barry_journey.json"),
          publicUrl("data/first_women_classes_1867_geo.json"),
          publicUrl("data/geo/walking_paths_first_classes.json"),
          publicUrl("data/geo/walking_paths_physiology.json"),
          publicUrl("data/women_doctors_enhanced.json"),
          publicUrl("data/women_careers_1915.json"),
          publicUrl("data/geo/colonies_1885.json"),
          publicUrl("data/geo/suez_routes.json"),
        ]);

        womenPhysiologyGeoData = Array.isArray(rawWomenPhysiologyGeoData)
          ? (rawWomenPhysiologyGeoData as PhysiologyGeoDatum[])
          : [];

        firstClassesGeoData = Array.isArray(rawFirstClasses)
          ? (rawFirstClasses as FirstClassesGeoDatum[])
          : [];

        garrettJourneyData = rawGarrettJourneyData ?? null;
        barryJourneyData = rawBarryJourneyData ?? null;
        firstClassesPathsData = rawFirstClassesPaths ?? null;
        physiologyPathsData = rawPhysiologyPaths ?? null;
        colonies = rawColonies ?? null;
        suez = rawSuez ?? null;
        womenDoctorsData = Array.isArray(rawWomenDoctors)
          ? [...(rawWomenDoctors as WomenDoctorDatum[])].sort((a, b) => {
              return (
                getStudentRegistrationYear(a) - getStudentRegistrationYear(b)
              );
            })
          : null;
        womenCareers1915Data = Array.isArray(rawWomenDoctors1915)
          ? rawWomenDoctors1915
          : null;
      } catch (error: unknown) {
        console.error("Failed to load timeline JSON data", error);
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
      if (timelineZoomFrameId !== null) {
        cancelAnimationFrame(timelineZoomFrameId);
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
    {firstClassesGeoData}
    {firstClassesPathsData}
    {physiologyPathsData}
    {womenDoctorsData}
    {womenCareers1915Data}
    {colonies}
    {suez}
    {edinburghSevenData}
  />
  <!-- Dev-only: remove this button block with the click-to-resume behavior. -->
  {#if devRequireClickToResume && awaitingResumeClick}
    <button class="resume-button" type="button" on:click={handleResumeClick}>
      Continue
    </button>
  {/if}
  <MainTimeline
    {width}
    {height}
    {currentYear}
    {startYear}
    {endYear}
    {timelineDomainStart}
    {timelineDomainEnd}
    {timelineY}
    {axisStart}
    {axisRight}
    {pauseYears}
    {milestoneLabels}
    {shrinkEnabledYears}
    {topByYear}
    {womenDoctorsData}
    {womenMedicsData}
    {yearToX}
  />

  {#each pauseYears as year (year)}
    <div
      class="milestone-card"
      class:milestone-card--university-founded={year === 1583}
      class:milestone-card--text-only={year === 1726}
      class:milestone-card--split={splitMilestoneYears.has(year)}
      class:is-active={pausedAtYear === year}
      class:is-past={shrinkEnabledYears.has(year)}
      style:top={pausedAtYear === year
        ? "15vh"
        : `${collapsedMarkerTopByYear.get(year) ?? height - collapsedMarkerDefaultOffset}px`}
      style:left="{pausedAtYear === year
        ? clampedLeft(yearToX(year), year)
        : centeredMarkerLeft(yearToX(year))}px"
    >
      {#if year === 1583}
        <div
          class="university-founded-card-image"
          style:background-image={universityFoundedBackgroundImage}
        ></div>
        <div class="university-founded-card-text">
          <em
            >Edenburgum Scotiae Metropolis Cologne: G. Braun & F. Hogenberg, ca.
            1582</em
          >
          <br />
          The University was founded in 1582, the same year as the map shown above.
        </div>
      {:else if year === 1726}
        <div class="milestone-card-text-only">
          <div class="milestone-card-title">
            In 1726, when the School of Medicine was established, the population
            of Edinburgh was roughly 40,000 people. The education took place at
            the Old College (currently School of Law) as well as at the Old
            Surgeon's Hall.
          </div>
        </div>
      {:else if year === 1809}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/barry.jpg")}
              alt="Margaret Bulkley / James Barry"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              Margaret Anne Bulkley (1789 - 1865), lived as James Barry
              throughout his medical education and career. In 1809, he travelled
              from London to Edinburgh to study medicine and graduated in 1812.
            </div>
          </div>
        </div>
      {:else if year === 1862}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/garrett_pic.jpg")}
              alt="Elizabeth Garrett"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              Elizabeth Garrett Anderson (1836 - 1917) came to Edinburgh in
              1862, trying to enroll at the School of Medicine. She also tried
              to enroll at Universities of Cambridge, Glasgow, Oxford, and St
              Andrews, but was rejected by all. She eventually became the first
              woman to qualify as a physician and surgeon.
            </div>
          </div>
        </div>
      {:else if year === 1867}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/masson.jpg")}
              alt="David Masson"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              The very first classes women could attend at the University were
              David Mather Masson's (1822 – 1907) English literature classes. A
              supporter of women's suffrage, Masson started teching women in
              1867 at Hopetoun Rooms (67-73 Queen Street)
            </div>
          </div>
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
      {:else if year === 1875}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/mckendrick.jpg")}
              alt="John Gray McKendrick"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              John Gray McKendrick (1841 – 1926) was a Scottish physiologist. He
              served as Regius Professor of Physiology at the University of
              Glasgow from 1876 to 1906, and was co-founder of the Physiological
              Society. When he was John Hughes Bennett's assistant, he taught
              physiology to the women medical students in 1871–72, including
              Sophia Jex-Blake. <a
                href="https://en.wikipedia.org/wiki/John_Gray_McKendrick"
                target="_blank"
                rel="noopener noreferrer"
                style="color: white">More info</a
              >
            </div>
          </div>
        </div>
      {:else if year === 1912}
        <div class="career-chart">
          <div class="career-chart-title">
            {milestoneLabels.get(year) ?? ""}
          </div>
          {#if careerPositionGroups.length > 0}
            <div class="career-region-list">
              {#each careerPositionGroups as regionGroup (regionGroup.region)}
                <section class="career-region">
                  <div class="career-region-heading">
                    <div class="career-region-summary">
                      <span class="career-region-name"
                        >{regionGroup.region}</span
                      >
                      <div
                        class="career-statement-indicator"
                        aria-label={`Stated occupations: ${regionGroup.statedCount}; not stated: ${regionGroup.notStatedCount}`}
                        title={`Stated occupations: ${regionGroup.statedCount}; not stated: ${regionGroup.notStatedCount}`}
                      >
                        <div class="career-statement-track">
                          <div
                            class="career-statement-fill career-statement-fill-stated"
                            style:width={`${regionGroup.statedPercent}%`}
                          ></div>
                          <div
                            class="career-statement-fill career-statement-fill-not-stated"
                            style:width={`${regionGroup.notStatedPercent}%`}
                          ></div>
                        </div>
                        <span
                          class="career-statement-count career-statement-count-stated"
                        >
                          {regionGroup.statedCount}
                        </span>
                        <span
                          class="career-statement-count career-statement-count-not-stated"
                        >
                          {regionGroup.notStatedCount}
                        </span>
                      </div>
                    </div>
                    <span class="career-region-total">{regionGroup.total}</span>
                  </div>
                  {#if regionGroup.positions.length > 0}
                    <div class="career-bars">
                      {#each regionGroup.positions as position (position.code)}
                        <div class="career-bar-row">
                          <div class="career-bar-label" title={position.code}>
                            {position.code}
                          </div>
                          <div
                            class="career-bar-track"
                            aria-label={`${position.code}: ${position.count}`}
                          >
                            <div
                              class="career-bar-fill"
                              style:width={`${position.percent}%`}
                            ></div>
                          </div>
                          <div class="career-bar-value">{position.count}</div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </section>
              {/each}
            </div>
          {:else}
            <div class="career-chart-empty">No 1915 career data</div>
          {/if}
        </div>
      {:else if year === 1892}
        <div class="milestone-text">{milestoneLabels.get(year) ?? ""}</div>
        <img
          class="milestone-image"
          src={publicUrl("img/ordinance_1892.png")}
          alt="Women Admitted to Universities"
        />
      {:else}
        <!-- {milestoneLabels.get(year) ?? ""} -->
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

  .milestone-card--text-only {
    align-items: flex-start;
    justify-content: flex-start;
    padding: 30px;
    text-align: left;
  }

  .milestone-card-text-only {
    width: 100%;
  }

  .milestone-card--university-founded {
    align-items: stretch;
    justify-content: flex-start;
    padding: 0;
    background-color: #000;
  }

  .milestone-card--university-founded.is-active {
    width: min(80vw, 720px);
    height: min(75vh, calc(min(80vw, 720px) * 0.751 + 52px));
    flex-direction: column;
    padding: 5px;
  }

  .university-founded-card-image {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    background-color: #000;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
  }

  .university-founded-card-text {
    width: 100%;
    box-sizing: border-box;
    flex: 0 0 52px;
    padding: 10px 10px 14px;
    background: rgba(0, 0, 0, 0.88);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.25;
    text-align: left;
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
    font-weight: 700;
    line-height: 1.25;
    text-align: left;
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

  .career-chart {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 18px;
    overflow-y: auto;
    text-align: left;
  }

  .career-chart-title {
    margin-bottom: 16px;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.25;
  }

  .career-region-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .career-region {
    border-top: 1px solid rgba(255, 255, 255, 0.24);
    padding-top: 10px;
  }

  .career-region-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
  }

  .career-region-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .career-region-name {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .career-region-total {
    flex: 0 0 auto;
  }

  .career-statement-indicator {
    display: grid;
    grid-template-columns: 70px auto auto;
    align-items: center;
    gap: 5px;
    flex: 0 0 auto;
  }

  .career-statement-track {
    display: flex;
    width: 70px;
    height: 8px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.14);
  }

  .career-statement-fill {
    height: 100%;
  }

  .career-statement-fill-stated {
    background: #f2c14e;
  }

  .career-statement-fill-not-stated {
    background: rgba(255, 255, 255, 0.38);
  }

  .career-statement-count {
    position: relative;
    padding-left: 7px;
    color: rgba(255, 255, 255, 0.82);
    font-size: 9px;
    line-height: 1;
  }

  .career-statement-count::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 4px;
    height: 4px;
    transform: translateY(-50%);
    background: currentColor;
  }

  .career-statement-count-stated::before {
    color: #f2c14e;
  }

  .career-statement-count-not-stated::before {
    color: rgba(255, 255, 255, 0.46);
  }

  .career-bars {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .career-bar-row {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(90px, 1fr) 26px;
    gap: 8px;
    align-items: center;
    min-height: 18px;
  }

  .career-bar-label {
    min-width: 0;
    color: rgba(255, 255, 255, 0.88);
    font-size: 10px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .career-bar-track {
    height: 8px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.16);
  }

  .career-bar-fill {
    height: 100%;
    min-width: 2px;
    background: #f2c14e;
  }

  .career-bar-value {
    color: rgba(255, 255, 255, 0.82);
    font-size: 10px;
    line-height: 1;
    text-align: right;
  }

  .career-chart-empty {
    color: rgba(255, 255, 255, 0.74);
    font-size: 12px;
    line-height: 1.4;
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
    width: min(40px, 70%);
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
</style>

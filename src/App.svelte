<script lang="ts">
// todo
// decide on the historical events for the timeline bottom
// image of the original old college


  import { onMount } from "svelte";
  import { getCSV, getJson } from "./lib/data/loaders";
  import BackgroundMap from "./lib/BackgroundMap.svelte";
  import MainTimeline from "./lib/MainTimeline.svelte";
  import { normalizeWomenCareer1915Region } from "./lib/map/featureBuilders";

  const baseUrl = import.meta.env.BASE_URL;
  const publicUrl = (path: string) => `${baseUrl}${path}`;

  const startYear = 1583;
  const universityEstablishedYear = 1583;
  const endYear = 2026;
  const stepYears = 50;
  const timelineZoomTriggerYear = 1862;
  const timelineResetTriggerYear = 1914;
  const timelineZoomDomainStart = 1850;
  const timelineZoomDomainEnd = 1915;
  const timelineZoomDurationMs = 1600;
  // Set to false to keep the timeline at its full 1550–2026 range.
  const enableTimelineSpreading = false;
  const margin = { top: 20, right: 40, bottom: 50, left: 40 };

  // keeping the detail div inside screen
  const milestoneCardWidth = 400;
  const universityFoundedImageAspectRatio = 7272 / 5461;
  const milestoneCardBottomOffset = 95;
  const milestoneCardTopClearance = 80;
  const universityFoundedCardChromeHeight = 97;

  // Anchor cards differently depending on whether the milestone is left or right of center.
  const card_left = [1726, 1809];
  const clampedLeft = (x: number, year: number) => {
    // return x < width / 2 ? x + 10 : x - milestoneCardWidth - 10;
    if (card_left.includes(year)) {
      return x - milestoneCardWidth;
    } else {
      return x;
    }
  };

  // Dev-only: set to false or remove this flag and the related blocks below to restore auto-resume.
  const devRequireClickToResume = true;
  const pauseYears = [
    1583, 1726, 1809, 1862, 1867, 1869, 1870, 1875, 1886, 1889, 1911, 1915,
    1919,
  ];
  const milestoneLabels = new Map<number, string>([
    [1583, "University of Edinburgh Founded 1582"],
    [1726, "School of Medicine 1726"],
    [1809, "Margaret Bulkley / James Barry 1809"],
    [1862, "Elizabeth Garrett 1862"],
    [1867, "First classes for women 1867"],
    [1869, "Edinburgh Seven/Forty 1869"],
    [1870, "The Riot 1870"],
    [1875, "Physiology students 1875"],
    // [1884, "Triple Qualification 1884"],
    [1886, "School of Medicine for Women 1886"],
    [1889, "College of Medicine for Women 1889"],
    // [1889, "Universities Scotland Act 1889"],
    // [1892, "Women admitted to universities"],
    [1911, "School and College Students 1911"],
    [1915, "Career Locations in 1915"],
    [1919, "Women Doctors in WWI, 1915-1919"],
  ]);

  const splitMilestoneYears = new Set([
    1809, 1862, 1867, 1870, 1875, 1886, 1889, 1911, 1919,
  ]);
  const womenDoctorsWarMilestoneYear = 1919;

  // Point multiple years at the same path, or leave a year out to show no image.
  const pauseDurationMs = 500;

  let height = 0;
  let width = 0;
  let garrettJourneyData: unknown = null;
  let barryJourneyData: unknown = null;
  let riotData: unknown = null;
  let firstClassesPathsData: unknown = null;
  let physiologyPathsData: unknown = null;
  let colonies: unknown = null;
  let suez: unknown = null;
  let edinburghRoutes: unknown = null;
  let womenDoctorsWarData: unknown = null;
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
  let womenMedicsData: Array<{ year: number; number: number }> = [];
  let edinburghSevenData: Array<Record<string, string>> = [];
  const edinburghSevenNames = [
    "Sophia Jex-Blake",
    "Isabel Pryer",
    "Mary Pechey",
    "Matilda Chaplin",
    "Helen Evans",
    "Mary Anderson",
    "Emily Bovell",
  ];
  const edinburghSevenOrder = new Map(
    edinburghSevenNames.map((name, index) => [name, index]),
  );

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
      .filter(([region]) => region !== "Other")
      .map(([region, regionCounts]) => {
        const entries = Array.from(regionCounts.counts.entries()).sort(
          ([positionA, countA], [positionB, countB]) =>
            countB - countA || positionA.localeCompare(positionB),
        );
        const topEntries = entries.slice(0, 3);
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
  $: orderedEdinburghFortyData = [...edinburghSevenData].sort(
    (personA, personB) =>
      (edinburghSevenOrder.get(personA.name) ?? Number.MAX_SAFE_INTEGER) -
      (edinburghSevenOrder.get(personB.name) ?? Number.MAX_SAFE_INTEGER),
  );

  $: maxSpan = Math.max(0, width - margin.left - margin.right);
  $: timelineY = Math.max(margin.top, height - margin.bottom);

  $: axisStart = margin.left;
  $: axisRight = axisStart + maxSpan;
  $: timelineDomainSpan = Math.max(1, timelineDomainEnd - timelineDomainStart);
  $: universityFoundedAvailableHeight = Math.max(
    0,
    height - milestoneCardBottomOffset - milestoneCardTopClearance,
  );
  $: universityFoundedPreferredWidth =
    Math.max(
      0,
      universityFoundedAvailableHeight - universityFoundedCardChromeHeight,
    ) *
      universityFoundedImageAspectRatio +
    10;
  $: universityFoundedCardWidth = Math.min(
    universityFoundedPreferredWidth,
    Math.max(0, width - margin.left),
  );
  $: universityFoundedCardHeight = Math.min(
    universityFoundedAvailableHeight,
    Math.max(
      0,
      (universityFoundedCardWidth - 10) / universityFoundedImageAspectRatio +
        universityFoundedCardChromeHeight,
    ),
  );

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
    enableTimelineSpreading &&
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

  $: if (
    enableTimelineSpreading &&
    currentYear >= timelineResetTriggerYear &&
    !hasResetTimeline
  ) {
    hasResetTimeline = true;
    hasZoomedTimeline = false;
    startTimelineDomainTransition(startYear, endYear);
  }

  // Dev-only: remove this handler together with the Continue button markup.
  const handleResumeClick = () => {
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
          rawEdinburghRoutes,
          rawWomenWarData,
          rawRiotData,
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
          publicUrl("data/geo/edinburgh_routes.json"),
          publicUrl("data/women_war.json"),
          publicUrl("data/geo/riot.json"),
        ]);

        womenPhysiologyGeoData = Array.isArray(rawWomenPhysiologyGeoData)
          ? (rawWomenPhysiologyGeoData as PhysiologyGeoDatum[])
          : [];

        firstClassesGeoData = Array.isArray(rawFirstClasses)
          ? (rawFirstClasses as FirstClassesGeoDatum[])
          : [];

        garrettJourneyData = rawGarrettJourneyData ?? null;
        barryJourneyData = rawBarryJourneyData ?? null;
        riotData = rawRiotData ?? null;
        firstClassesPathsData = rawFirstClassesPaths ?? null;
        physiologyPathsData = rawPhysiologyPaths ?? null;
        colonies = rawColonies ?? null;
        suez = rawSuez ?? null;
        edinburghRoutes = rawEdinburghRoutes ?? null;
        womenDoctorsWarData = rawWomenWarData ?? null;
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
    {riotData}
    {womenPhysiologyGeoData}
    {firstClassesGeoData}
    {firstClassesPathsData}
    {physiologyPathsData}
    {womenDoctorsData}
    {womenCareers1915Data}
    {colonies}
    {suez}
    {edinburghRoutes}
    {edinburghSevenData}
    {womenDoctorsWarData}
    showWomenDoctorCareerLocations={pausedAtYear === 1915}
    showWomenDoctorsWarLocations={pausedAtYear === womenDoctorsWarMilestoneYear}
  />
  <img
    class="site-logo"
    src={publicUrl("img/logo.png")}
    alt="Women Medics"
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
    {universityEstablishedYear}
    {endYear}
    {timelineDomainStart}
    {timelineDomainEnd}
    {timelineY}
    {axisStart}
    {axisRight}
    {pauseYears}
    {milestoneLabels}
    {womenDoctorsData}
    {womenMedicsData}
    {yearToX}
  />

  {#each pauseYears as year (year)}
    <div
      class="milestone-card"
      class:milestone-card--university-founded={year === 1583}
      class:milestone-card--edinburgh-forty={year === 1869}
      class:milestone-card--split={splitMilestoneYears.has(year)}
      class:is-active={pausedAtYear === year}
      style:bottom="95px"
      style:left={`${clampedLeft(yearToX(year), year)}px`}
      style:width={
        year === 1583 && pausedAtYear === year
          ? `${universityFoundedCardWidth}px`
          : undefined
      }
      style:height={
        year === 1583 && pausedAtYear === year
          ? `${universityFoundedCardHeight}px`
          : undefined
      }
    >
      <h1 class="milestone-card-heading">{milestoneLabels.get(year) ?? ""}</h1>
      {#if year === 1869}
        <p class="edinburgh-forty-intro">
          The Edinburgh Seven are known to be the first women to matriculate at
          the University of Edinburgh in 1869. However, there were actually 40
          women who enrolled in the School of Medicine that year. The women
          faced significant opposition and discrimination, but their
          determination paved the way for future generations of women in
          medicine.
        </p>
      {/if}
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
              Born as Margaret Anne Bulkley (1789 - 1865), James Barry lived as
              a man throughout his medical education and career. In 1809, he
              travelled from London to Edinburgh by boat (~9 days of travel) to
              study medicine and graduated in 1812.
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
              Elizabeth Garrett Anderson (1836 - 1917) came to Edinburgh (most
              likely by train, North British Railway was completed in 1846) in
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
              src={publicUrl("img/first_english_classes_building.jpg")}
              alt="David Masson"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              The very first classes women could attend at the University (2
              years before Edinburgh Seven's enrollment) were David Masson's
              (1822 – 1907) English Literature classes. A supporter of women's
              suffrage, Masson started teching women in 1867 at Hopetoun Rooms
              (67-73 Queen Street).
            </div>
          </div>
        </div>
      {:else if year === 1869}
        <div class="edinburgh_forty">
          {#each orderedEdinburghFortyData as d (d.name)}
            <div
              class="edinburgh_forty-item"
              class:edinburgh_forty-item--edinburgh-seven={edinburghSevenOrder.has(
                d.name,
              )}
            >
              <div
                class="edinburgh_forty-circle"
                style:background-image={edinburghFortyImageUrl(d.img)}
              ></div>
              <div class="edinburgh_forty-name">{d.name}</div>
            </div>
          {/each}
        </div>
      {:else if year === 1870}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/surgeon_riot.jpg")}
              alt="Edinburgh Surgeon's Hall"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              "We were proceeding in the dusk of a November afternoon to the
              weekly class examination when we found a noisy crowd assembled
              round the entrance. On our approach the gates were closed and a
              loud yelling and hooting were set up by men inside and outside the
              grounds leading to the Hall. We stood for a few minutes surrounded
              by the hooting crowd of young men, unable to make our way to the
              classroom which stood a little way back from the road, when a male
              student rushed from the Hall and opened the gates from the
              inside."
            </div>
          </div>
        </div>
      {:else if year === 1875}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/gayfield_house.jpg")}
              alt="John Gray McKendrick"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              After Edinburgh Seven/Forty were refused graduation and a general
              backlash against women studying medicine, there were still
              professors who supported women in this regard. One of them was
              John Gray McKendrick (1841-1926), who started teaching pyhsiology
              to women at Gayfield House (18 East London Street) in 1875.
            </div>
          </div>
        </div>
      {:else if year === 1886}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/esmw.jpg")}
              alt="Women Doctors"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              Sophia Jex-Blake (1840 - 1912), the leading figure of the
              Edinburgh Seven/Forty, established the School of Medicine for
              Women in 1886, which, unlike the University, allowed women to
              study medicine.
            </div>
          </div>
        </div>
      {:else if year === 1889}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/ecmw.png")}
              alt="Women Doctors"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              Edinburgh College of Medicine for Women was established by The
              Scottish Association for the Medical Education of Women whose
              leading members included John Inglis, the father of Elsie Inglis.
              Elsie Inglis went on to become a leader in the suffrage movement
              and found the Scottish Women's Hospital.
            </div>
          </div>
        </div>
      {:else if year === 1911}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/photo_outside_efi.jpg")}
              alt="Women Doctors"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              By 1911, 360 women have studied medicine at the School of Medicine
              and College of Medicine for Women. [Picture taken from outside the
              now Edinburgh Futures Institute]
            </div>
          </div>
        </div>
      {:else if year === 1915}
        <div class="career-chart">
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
                        aria-label={`Known professions: ${regionGroup.statedCount}; unknown professions: ${regionGroup.notStatedCount}`}
                        title={`Known professions: ${regionGroup.statedCount}; unknown professions: ${regionGroup.notStatedCount}`}
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
                          {regionGroup.statedCount} known
                        </span>
                        <span
                          class="career-statement-count career-statement-count-not-stated"
                        >
                          {regionGroup.notStatedCount} unknown
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
      {:else if year === womenDoctorsWarMilestoneYear}
        <div class="milestone-card-split-layout">
          <div class="milestone-card-split-half milestone-card-split-image">
            <img
              class="milestone-image"
              src={publicUrl("img/women_war.jpg")}
              alt="Women Doctors"
            />
          </div>
          <div class="milestone-card-split-half milestone-card-split-text">
            <div class="milestone-card-title">
              During the First World War, women doctors served in various
              capacities, including in military hospitals and overseas. The
              image above shows a group of women doctors during the war.
            </div>
          </div>
        </div>
        <!-- {:else if year === 1892}
        <div class="milestone-text">{milestoneLabels.get(year) ?? ""}</div>
        <img
          class="milestone-image"
          src={publicUrl("img/ordinance_1892.png")}
          alt="Women Admitted to Universities"
        /> -->
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

  .site-logo {
    position: absolute;
    top: 0px;
    left: 0px;
    z-index: 3;
    height: 75px;
    pointer-events: none;
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
    color: rgb(150, 150, 150);
    font-size: 10px;
    font-weight: 600;
    border-radius: 7px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    background-color: #151c24;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .milestone-card.is-active {
    opacity: 1;
  }

  .milestone-card.is-active {
    width: 400px;
    height: auto;
    max-height: calc(100vh - 95px - 80px);
    pointer-events: auto;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .milestone-card--edinburgh-forty.is-active {
    width: min(500px, calc(100vw - 32px));
    height: calc(100vh - 95px - 80px);
    container-type: size;
  }

  .milestone-card-heading {
    flex: 0 0 auto;
    margin: 10px 10px 5px;
    color: #fff;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.1;
    text-align: center;
  }

  .edinburgh-forty-intro {
    flex: 0 0 auto;
    margin: 0 16px 8px;
    color: rgb(150, 150, 150);
    font-size: clamp(8px, 1.2vh, 12px);
    line-height: 1.25;
  }

  .milestone-card--split {
    padding: 0;
  }

  .milestone-card-text-only {
    width: 100%;
    flex: 1 1 auto;
    box-sizing: border-box;
    padding: 0 30px 30px;
    text-align: left;
  }

  .milestone-card--university-founded {
    align-items: stretch;
    justify-content: flex-start;
    padding: 0;
    background-color: #151c24;
  }

  .milestone-card--university-founded.is-active {
    width: min(90vw, 800px);
    height: calc(100vh - 95px - 80px);
    flex-direction: column;
    padding: 5px;
  }

  .milestone-card--university-founded .milestone-card-heading {
    margin: 5px 5px 8px;
  }

  .university-founded-card-image {
    width: 100%;
    min-height: 0;
    flex: 1 1 0;
    background-color: #000;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
  }

  .university-founded-card-text {
    width: 100%;
    box-sizing: border-box;
    flex: 0 0 52px;
    padding: 10px 0px 0px;
    background-color: #151c24;
    font-size: 12px;
    line-height: 1.25;
    text-align: center;
  }

  .milestone-card--split .milestone-card-split-layout {
    width: 100%;
    height: auto;
    flex: 0 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .milestone-card--split .milestone-card-split-half {
    min-height: 0;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
  }

  .milestone-card--split .milestone-card-split-image {
    flex: 0 0 auto;
    width: 100%;
    padding: 0.5rem;
    align-items: center;
  }

  .milestone-card--split .milestone-card-split-text {
    flex: 0 0 auto;
    padding: 20px;
    padding-top: 5px;
    text-align: left;
  }

  .milestone-card-title {
    font-size: 12px;
    line-height: 1.25;
    text-align: left;
  }

  .milestone-image {
    width: 100%;
    height: auto;
    max-width: 100%;
    max-height: 45vh;
    object-fit: contain;
    display: block;
    flex: 0 0 auto;
    min-height: 0;
    border-radius: 3px;
  }

  .career-chart {
    width: 100%;
    height: auto;
    flex: 1 1 auto;
    min-height: 0;
    box-sizing: border-box;
    padding: 18px;
    overflow-y: auto;
    text-align: left;
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
    background: white;
  }

  .career-statement-fill-not-stated {
    background: rgba(146, 136, 136, 0.58);
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
    color: white;
  }

  .career-statement-count-not-stated::before {
    color: rgba(146, 136, 136, 0.58);
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
    background: white;
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
    min-height: 0;
    box-sizing: border-box;
    flex: 1 1 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    grid-template-rows: repeat(8, minmax(0, 1fr));
    gap: clamp(1px, 0.4cqh, 3px);
    padding: clamp(1px, 0.4cqh, 3px);
    overflow: hidden;
  }

  .edinburgh_forty-item {
    min-width: 0;
    min-height: 0;
    box-sizing: border-box;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    justify-items: center;
    align-items: center;
    gap: clamp(1px, 0.35cqh, 3px);
    padding: clamp(1px, 0.35cqh, 3px);
    background: #0d1116;
    border-radius: 3px;
    overflow: hidden;
  }

  .edinburgh_forty-item--edinburgh-seven {
    background: #3e5269;
  }

  .edinburgh_forty-circle {
    width: auto;
    height: 100%;
    max-width: 100%;
    min-height: 0;
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
    font-size: clamp(5px, 1.5cqh, 10px);
    line-height: 1.05;
    text-align: center;
    overflow-wrap: anywhere;
    font-weight: 400;
  }

  /* Dev-only: remove this style block with the Continue button markup. */
  .resume-button {
    position: absolute;
    top: 35px;
    right: 16px;
    z-index: 10;
    padding: 0.5rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.4);
    background: rgba(20, 20, 20, 0.75);
    color: #fff;
    font: inherit;
    cursor: pointer;
  }
</style>

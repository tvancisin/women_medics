<script lang="ts">
  import { onMount } from "svelte";
  import { getCSV, getJson } from "./lib/data/loaders";
  import BackgroundMap from "./lib/BackgroundMap.svelte";
  import MainTimeline from "./lib/MainTimeline.svelte";

  const baseUrl = import.meta.env.BASE_URL;
  const publicUrl = (path: string) => `${baseUrl}${path}`;

  const startYear = 1583;
  const universityEstablishedYear = 1583;
  const endYear = 2026;
  const stepYears = 100;
  const timelineZoomTriggerYear = 1862;
  const timelineResetTriggerYear = 1914;
  const timelineZoomDomainStart = 1850;
  const timelineZoomDomainEnd = 1915;
  const timelineZoomDurationMs = 1600;
  // Set to false to keep the timeline at its full 1550–2026 range.
  const enableTimelineSpreading = false;
  const margin = { top: 20, right: 40, bottom: 30, left: 40 };

  // Add a credit object for each milestone year that needs map or image credits.
  const creditsByYear = [
    {
      year: 1583,
      map: "Edenburgum Scotiae Metropolis Cologne: G. Braun & F. Hogenberg, ca. 1582",
      image: "",
    },
    {
      year: 1726,
      map: "The plan of the city and castle of Edinburgh anno 1742 / by Willm. Edgar, architect.",
      image: "",
    },
    {
      year: 1809,
      map: "",
      image:
        "Dr James Barry, c. 1820s. Unknown artist. Museum Africa, Johannesburg. Wikimedia Commons. Public domain.",
    },
    {
      year: 1862,
      map: "",
      image:
        "Elizabeth Garrett Anderson. Photograph by Walery, published by Sampson Low & Co. in February 1889",
    },
    {
      year: 1867,
      map: "Plan of Edinburgh & Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory. By John Bartholomew, F.R.G.S. 1867 ",
      image:
        "Street elevation from north east showing Mary Erskine School, 1910. Historic Environment Scotland Archives, via Trove.scot, image 2657634.",
    },
    {
      year: 1870,
      map: "Plan of Edinburgh & Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory. By John Bartholomew, F.R.G.S. 1875",
      image: "Surgeons' Hall, Edinburgh, c. 1870. The National Archives",
    },
    {
      year: 1875,
      map: "Plan of Edinburgh & Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory. By John Bartholomew, F.R.G.S. 1875",
      image:
        "Gayfield House, Edinburgh, Hstoric Environment Scotland, Trove.scot, image 1098306",
    },
    {
      year: 1886,
      map: "Plan of Edinburgh and Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory by John Bartholomew. 1888-9",
      image:
        "Kim Traynor, “Chisholm House, Surgeons’ Square,” 23 July 2011, Geograph Britain and Ireland, CC BY-SA 2.0.",
    },
    {
      year: 1889,
      map: "Plan of Edinburgh and Leith with Suburbs, from Ordnance and Actual Surveys. Constructed for the Post Office Directory by John Bartholomew. 1888-9",
      image:
        "General view of Minto House, Chambers Street incorporating Free Tron Church, 1880. Historic Environment Scotland / Canmore, via trove.scot",
    },
  ];

  // keeping the detail div inside screen
  const milestoneCardWidth = 400;
  const universityFoundedImageAspectRatio = 7272 / 5461;
  const milestoneCardBottomOffset = 95;
  const milestoneCardTopClearance = 80;
  // Heading (22px), its vertical margins (13px), and the card's 5px top/bottom padding.
  const universityFoundedCardChromeHeight = 45;

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
    1583, 1682, 1726, 1809, 1862, 1867, 1869, 1870, 1875, 1886, 1889, 1911,
    1915, 1916,
    // 1919,
  ];
  const milestoneLabels = new Map<number, string>([
    [1583, "University of Edinburgh Founded 1582"],
    [1726, "School of Medicine 1726"],
    [1809, "Margaret Bulkley/James Barry 1809"],
    [1862, "Elizabeth Garrett 1862"],
    [1867, "First Classes for Women 1867"],
    [1869, "Edinburgh Seven/Forty 1869"],
    [1870, "The Riot 1870"],
    [1875, "Physiology Students 1875"],
    // [1884, "Triple Qualification 1884"],
    [1886, "School of Medicine for Women 1886"],
    [1889, "College of Medicine for Women 1889"],
    // [1889, "Universities Scotland Act 1889"],
    // [1892, "Women admitted to universities"],
    [1911, "School and College Students 1911"],
    [1915, "Career Locations in 1915"],
    [1916, "Equal Medical Education 1916"],
    // [1919, "Women Doctors in WWI, 1915-1919"],
  ]);

  const splitMilestoneYears = new Set([
    1809, 1862, 1867, 1870, 1875, 1886, 1889, 1911,
  ]);
  // const womenDoctorsWarMilestoneYear = 1919;

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
  let menMedicsData: Array<{ year: number; number: number }> = [];
  $: activeCredits = creditsByYear.find(
    (credits) => credits.year === pausedAtYear,
  );
  $: mapCredit = activeCredits?.map ?? "";
  $: imageCredit = activeCredits?.image ?? "";
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
      career_location_1915?: {
        country?: string | null;
        region?: string | null;
      } | null;
    };
  };

  type CareerCountryCount = {
    country: string;
    count: number;
    percent: number;
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

  const getAcademicYearEnd = (value: string | undefined) => {
    const [startText, endText] = String(value ?? "")
      .trim()
      .split(/[-–—]/)
      .map((year) => year.trim());
    const startYear = Number(startText);
    const endYear = Number(endText ?? startText);

    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
      return Number.NaN;
    }

    if (!endText || endText.length >= startText.length) {
      return endYear;
    }

    const abbreviatedDigits = 10 ** endText.length;
    const endAcademicYear =
      Math.floor(startYear / abbreviatedDigits) * abbreviatedDigits + endYear;

    return endAcademicYear < startYear
      ? endAcademicYear + abbreviatedDigits
      : endAcademicYear;
  };

  const getCareerCountry = (
    careerLocation: NonNullable<
      WomenCareer1915Datum["source_data"]
    >["career_location_1915"],
  ) => {
    const country = String(careerLocation?.country ?? "").trim();
    if (!country || country.toLowerCase() === "null") return null;

    if (country.toLowerCase() === "democratic republic of the congo") {
      return "Congo";
    }

    if (country.toLowerCase() === "myanmar (burma)") {
      return "Myanmar";
    }

    if (country.toLowerCase() !== "united kingdom") return country;

    const region = String(careerLocation?.region ?? "")
      .trim()
      .toLowerCase();
    if (region === "london") return "England";
    if (["england", "scotland", "wales", "ireland"].includes(region)) {
      return `${region[0].toUpperCase()}${region.slice(1)}`;
    }

    return country;
  };

  const buildCareerCountryCounts = (rawData: unknown): CareerCountryCount[] => {
    if (!Array.isArray(rawData)) return [];

    const countsByCountry = new Map<string, number>();

    for (const row of rawData as WomenCareer1915Datum[]) {
      const country = getCareerCountry(row.source_data?.career_location_1915);
      if (!country) continue;
      countsByCountry.set(country, (countsByCountry.get(country) ?? 0) + 1);
    }

    const countries = Array.from(countsByCountry.entries()).sort(
      ([countryA, countA], [countryB, countB]) =>
        countB - countA || countryA.localeCompare(countryB),
    );
    const maxCount = Math.max(...countries.map(([, count]) => count), 1);

    return countries.map(([country, count]) => ({
      country,
      count,
      percent: (count / maxCount) * 100,
    }));
  };

  // Dev-only: remove these two variables with the click-to-resume behavior.
  let awaitingResumeClick = false;
  let resumeRequested = false;

  $: careerCountryCounts = buildCareerCountryCounts(womenCareers1915Data);
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
        const [rawWomenMedicsData, rawMenMedicsData, rawEdinburghSevenData] = (await getCSV([
          publicUrl("data/women_medics_1914_1966.csv"),
          publicUrl("data/men_medics_1836_1966.csv"),
          publicUrl("data/edinburgh_forty.csv"),
        ])) as [
          Array<{ year?: string; number?: string }>,
          Array<Record<string, string>>,
          Array<Record<string, string>>,
        ];

        womenMedicsData = rawWomenMedicsData
          .map((row: { year?: string; number?: string }) => {
            const year = getAcademicYearEnd(row.year);
            const total = Number(row.number);
            return { year, number: total };
          })
          .filter(
            (row: { year: number; number: number }) =>
              Number.isFinite(row.year) && Number.isFinite(row.number),
          );

        menMedicsData = rawMenMedicsData
          .map((row: { year?: string; number?: string }) => {
            const year = getAcademicYearEnd(row.year);
            const total = Number(row.number);
            return { year, number: total };
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

        console.log(womenCareers1915Data);
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
  <!-- 1919 map inputs temporarily disabled:
  {womenDoctorsWarData}
  showWomenDoctorsWarLocations={pausedAtYear === womenDoctorsWarMilestoneYear}
  -->
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
    showWomenDoctorCareerLocations={pausedAtYear === 1915}
  />
  <img
    class="site-logo"
    src={publicUrl("img/logo_adjusted.png")}
    alt="Edinburgh Futures Institute"
  />
  <h1 id="data-led-methods">Data-Led Methods and Research Technology</h1>
  <!-- {#if mapCredit || imageCredit}
    <aside class="map-image-credits" aria-label="Map and image credits">
      {#if mapCredit}
        <em>Map Credit: {mapCredit}</em>
      {/if}
      {#if imageCredit}
        <em>Image Credit: {imageCredit}</em>
      {/if}
    </aside>
  {/if} -->
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
    {menMedicsData}
    {yearToX}
  />

  {#each pauseYears.filter((year) => milestoneLabels.has(year)) as year (year)}
    <div
      class="milestone-card"
      class:milestone-card--university-founded={year === 1583}
      class:milestone-card--edinburgh-forty={year === 1869}
      class:milestone-card--women-doctors-1911={year === 1911}
      class:milestone-card--split={splitMilestoneYears.has(year)}
      class:is-active={pausedAtYear === year}
      style:bottom={`${milestoneCardBottomOffset}px`}
      style:left={`${clampedLeft(yearToX(year), year)}px`}
      style:width={year === 1583 && pausedAtYear === year
        ? `${universityFoundedCardWidth}px`
        : undefined}
      style:height={year === 1583 && pausedAtYear === year
        ? `${universityFoundedCardHeight}px`
        : undefined}
    >
      <h1 class="milestone-card-heading">{milestoneLabels.get(year) ?? ""}</h1>
      {#if year === 1583}
        <div
          class="university-founded-card-image"
          style:background-image={universityFoundedBackgroundImage}
        ></div>
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
              Born as Margaret Anne Bulkley, James Barry lived as a man
              throughout their medical education and career. In 1809, they
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
              Elizabeth Garrett Anderson came to Edinburgh (most likely by
              train) in 1862, trying to enroll at the School of Medicine. She
              also tried to enroll at Universities of Cambridge, Glasgow,
              Oxford, and St Andrews, but was rejected by all.
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
              The very first classes women could attend at the University (
              before Edinburgh Seven) were David Masson's English Literature
              classes. A supporter of women's suffrage, Masson started teching
              women in 1867 at Hopetoun Rooms (67-73 Queen Street).
            </div>
          </div>
        </div>
      {:else if year === 1869}
        <p class="edinburgh-forty-intro">
          The Edinburgh Seven are known to be the first women to matriculate at
          a University in the UK. What's much less known is that there were
          actually 40 women who matriculated at the School of Medicine in 1869.
        </p>
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
              A crowd of several hundred gathered as the Edinburgh Seven arrived
              for their anatomy exam, facing mud, abuse and blocked gates.
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
              After the Edinburgh Seven were refused graduation, there were
              still professors who supported women in their pursuit to study
              medicine. One of them was John Gray McKendrick, who started
              teaching pyhsiology to women at Gayfield House (18 East London
              Street) in 1875.
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
              Sophia Jex-Blake, the leading figure of the Edinburgh Seven/Forty,
              established the School of Medicine for Women in 1886, which,
              unlike the University, allowed women to obtain a full medical
              education.
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
              id="women-doctors-1911-photo"
              class="milestone-image"
              src={publicUrl("img/photo_outside_efi.jpg")}
              alt="Women doctors outside the Edinburgh Futures Institute"
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
          {#if careerCountryCounts.length > 0}
            <div class="career-country-list">
              {#each careerCountryCounts as country (country.country)}
                <div class="career-country-row">
                  <div class="career-country-name">{country.country}</div>
                  <div
                    class="career-country-track"
                    aria-label={`${country.country}: ${country.count} women`}
                  >
                    <div
                      class="career-country-fill"
                      style:width={`${country.percent}%`}
                    ></div>
                  </div>
                  <div class="career-country-count">{country.count}</div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="career-chart-empty">No 1915 career data</div>
          {/if}
        </div>
      {:else if year === 1916}
        <div class="milestone-card-text-only">
          <div class="milestone-card-title">
            After decades of separate medical education, wartime pressure and
            campaigning led the University to admit women to its medical classes
            alongside men.
          </div>
        </div>
        <!-- 1919 milestone temporarily disabled.
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
      -->
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

  #data-led-methods {
    position: absolute;
    top: 36px;
    left: 66px;
    z-index: 3;
    margin: 0;
    padding: 0.5rem 1rem;
    color: #ffffffdc;
    font-family: "Jost";
    font-size: 14px;
    font-weight: 375;
    letter-spacing: 0.02em;
    pointer-events: none;
  }

  .map-image-credits {
    position: absolute;
    top: 0;
    left: 50%;
    z-index: 3;
    box-sizing: border-box;
    width: max-content;
    max-width: calc(100vw - 32px);
    height: 40px;
    padding: 0 16px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #ffffffdc;
    background-color: #000;
    font-family: "Jost";
    font-size: 14px;
    line-height: 1.2;
    text-align: center;
    pointer-events: none;
    gap: 2px;
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
    border-radius: 5px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    background-color: #151c24;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
    border: 2px solid rgba(109, 109, 109, 0.24);
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

  .milestone-card--women-doctors-1911.is-active {
    width: min(500px, calc(100vw - 32px));
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

  .career-country-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .career-country-row {
    display: grid;
    grid-template-columns: minmax(92px, 1fr) minmax(110px, 2.25fr) 28px;
    gap: 8px;
    align-items: center;
    min-height: 20px;
  }

  .career-country-name {
    min-width: 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 11px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .career-country-track {
    height: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.16);
  }

  .career-country-fill {
    height: 100%;
    min-width: 2px;
    background: #fff;
  }

  .career-country-count {
    color: rgba(255, 255, 255, 0.88);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
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
    background: #495563;
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

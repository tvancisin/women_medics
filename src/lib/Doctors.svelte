<script lang="ts">
  import * as d3 from "d3";

  export let womenDoctorsData: unknown = [];
  export let currentYear: number;
  export let timelineY: number;
  export let yearToX: (year: number) => number;
  export let womenMedicsData: WomenMedicsDatum[] = [];

  type WomenMedicsDatum = {
    year: number;
    number: number;
  };

  type WomenDoctorDatum = {
    name?: {
      original?: string;
    };
    source_data?: {
      name?: string;
      "Year of student registration"?: number | string | null;
    };
  };

  type DoctorTimelinePoint = {
    id: string;
    name: string;
    year: number;
    stackIndex: number;
  };

  type DoctorYearCount = {
    year: number;
    count: number;
  };

  const circleRadius = 2.5;
  const stackGap = 0.5;
  const axisOffset = 10;
  const flowStartOffset = 80;
  const chartPaddingTop = 80;
  const chartPaddingBottom = 0;
  const stackStep = circleRadius * 2 + stackGap;
  const areaStartYear = 1914;

  const getRegistrationYear = (doctor: WomenDoctorDatum) => {
    const rawYear = doctor.source_data?.["Year of student registration"];

    if (rawYear === null || rawYear === undefined || rawYear === "") {
      return null;
    }

    const year = Number(rawYear);
    return Number.isFinite(year) ? year : null;
  };

  $: sortedDoctors = Array.isArray(womenDoctorsData)
    ? [...(womenDoctorsData as WomenDoctorDatum[])].sort((a, b) => {
        const yearA = getRegistrationYear(a) ?? Number.POSITIVE_INFINITY;
        const yearB = getRegistrationYear(b) ?? Number.POSITIVE_INFINITY;

        if (yearA !== yearB) return yearA - yearB;

        const nameA = a.name?.original ?? a.source_data?.name ?? "";
        const nameB = b.name?.original ?? b.source_data?.name ?? "";
        return nameA.localeCompare(nameB);
      })
    : [];

  $: doctorTimelinePoints = (() => {
    const stackCountsByYear = new Map<number, number>();

    return sortedDoctors
      .map((doctor) => {
        const year = getRegistrationYear(doctor);
        if (year === null || year > currentYear || currentYear >= areaStartYear) {
          return null;
        }

        const stackIndex = stackCountsByYear.get(year) ?? 0;
        stackCountsByYear.set(year, stackIndex + 1);

        const name = doctor.name?.original ?? doctor.source_data?.name ?? "Unknown";

        return {
          id: `${year}-${stackIndex}-${name}`,
          name,
          year,
          stackIndex,
        };
      })
      .filter((point): point is DoctorTimelinePoint => point !== null);
  })();

  $: doctorYearCounts = (() => {
    const countsByYear = new Map<number, number>();

    for (const doctor of sortedDoctors) {
      const year = getRegistrationYear(doctor);
      if (year === null || year > currentYear) continue;

      countsByYear.set(year, (countsByYear.get(year) ?? 0) + 1);
    }

    return [...countsByYear.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);
  })();

  $: maxY = d3.max(womenMedicsData, (d: WomenMedicsDatum) => d.number) ?? 0;

  $: doctorCountYScale = d3
    .scaleLinear()
    .domain([0, maxY > 0 ? maxY : 1])
    .range([timelineY - chartPaddingBottom, chartPaddingTop * 4]);

  $: doctorAreaPath = d3
    .area<DoctorYearCount>()
    .x((d) => yearToX(d.year))
    .y0(timelineY - chartPaddingBottom)
    .y1((d) => doctorCountYScale(d.count))
    .curve(d3.curveMonotoneX)(doctorYearCounts);

  $: doctorLinePath = d3
    .line<DoctorYearCount>()
    .x((d) => yearToX(d.year))
    .y((d) => doctorCountYScale(d.count))
    .curve(d3.curveMonotoneX)(doctorYearCounts);
</script>

<g class="doctors">
  {#if currentYear >= areaStartYear && doctorAreaPath}
    <path class="doctor-area" d={doctorAreaPath} />
    {#if doctorLinePath}
      <path class="doctor-area-line" d={doctorLinePath} />
    {/if}
  {:else}
    {#each doctorTimelinePoints as doctor (doctor.id)}
      <circle
        class="doctor-registration"
        cx={yearToX(doctor.year)}
        cy={timelineY - axisOffset - doctor.stackIndex * stackStep}
        r={circleRadius}
        style:--doctor-flow-distance={`${axisOffset + flowStartOffset + doctor.stackIndex * stackStep}px`}
      >
        <title>{doctor.name} ({doctor.year})</title>
      </circle>
    {/each}
  {/if}
</g>

<style>
  .doctor-registration {
    fill: #f2c14e;
    stroke: rgba(0, 0, 0, 0.75);
    stroke-width: 0.75;
    animation: doctor-flow-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
    transform-box: fill-box;
    transform-origin: center;
  }

  .doctor-area {
    fill: rgba(242, 193, 78, 0.28);
    stroke: none;
    animation: doctor-area-in 650ms ease both;
  }

  .doctor-area-line {
    fill: none;
    stroke: rgba(242, 193, 78, 0.95);
    stroke-width: 1.5;
    animation: doctor-area-in 650ms ease both;
  }

  @keyframes doctor-flow-in {
    from {
      opacity: 0;
      transform: translateY(var(--doctor-flow-distance));
    }

    60% {
      opacity: 1;
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes doctor-area-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }
</style>

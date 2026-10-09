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
    source_data?: {
      "Year of student registration"?: number | string | null;
    };
  };

  type DoctorYearCount = {
    year: number;
    count: number;
  };

  const chartPaddingTop = 80;
  const chartPaddingBottom = 2;

  const getRegistrationYear = (doctor: WomenDoctorDatum) => {
    const rawYear = doctor.source_data?.["Year of student registration"];

    if (rawYear === null || rawYear === undefined || rawYear === "") {
      return null;
    }

    const year = Number(rawYear);
    return Number.isFinite(year) ? year : null;
  };

  $: doctorYearCounts = (() => {
    const countsByYear = new Map<number, number>();

    if (!Array.isArray(womenDoctorsData)) return [];

    for (const doctor of womenDoctorsData as WomenDoctorDatum[]) {
      const year = getRegistrationYear(doctor);
      if (year === null) continue;

      countsByYear.set(year, (countsByYear.get(year) ?? 0) + 1);
    }

    return [...countsByYear.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);
  })();

  // Reveal the chart one year at a time as the timeline advances.
  $: visibleDoctorYearCounts = doctorYearCounts.filter(
    (doctorYearCount) => doctorYearCount.year <= currentYear,
  );

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
    .curve(d3.curveMonotoneX)(visibleDoctorYearCounts);

  $: doctorLinePath = d3
    .line<DoctorYearCount>()
    .x((d) => yearToX(d.year))
    .y((d) => doctorCountYScale(d.count))
    .curve(d3.curveMonotoneX)(visibleDoctorYearCounts);

  const interpolateValueAtYear = (year: number): number | null => {
    if (doctorYearCounts.length === 0) return null;

    if (year <= doctorYearCounts[0].year) {
      return doctorYearCounts[0].count;
    }

    for (let index = 1; index < doctorYearCounts.length; index += 1) {
      const previous = doctorYearCounts[index - 1];
      const next = doctorYearCounts[index];

      if (year <= next.year) {
        const yearSpan = next.year - previous.year;
        if (yearSpan <= 0) return next.count;

        const progress = (year - previous.year) / yearSpan;
        return previous.count + (next.count - previous.count) * progress;
      }
    }

    return doctorYearCounts[doctorYearCounts.length - 1].count;
  };

  $: currentValue = interpolateValueAtYear(currentYear);
  $: markerX = yearToX(currentYear);
  $: markerY = currentValue === null ? timelineY : doctorCountYScale(currentValue);
  $: markerLabel = currentValue === null ? "" : `${Math.round(currentValue)}`;
  $: showMarker =
    currentValue !== null &&
    currentYear <= (doctorYearCounts.at(-1)?.year ?? currentYear);
</script>

<g class="doctors">
  {#if visibleDoctorYearCounts.length > 0 && doctorAreaPath}
    <path class="doctor-area" d={doctorAreaPath} />
    {#if doctorLinePath}
      <path class="doctor-area-line" d={doctorLinePath} />
    {/if}
    {#if showMarker}
      <circle class="doctor-line-head" cx={markerX} cy={markerY} r="4" />
      <text class="doctor-line-head-label" x={markerX + 8} y={markerY + 3}>
        {markerLabel}
      </text>
    {/if}
  {/if}
</g>

<style>
  .doctor-area {
    fill: rgba(0, 0, 0, 0.892);
    stroke: none;
  }

  .doctor-area-line {
    fill: none;
    stroke: rgba(180, 180, 180, 0.95);
    stroke-width: 1.5;
  }

  .doctor-line-head {
    fill: rgb(180, 180, 180);
  }

  .doctor-line-head-label {
    fill: rgb(180, 180, 180);
    font-family: Montserrat;
    font-size: 11px;
    pointer-events: none;
  }
</style>

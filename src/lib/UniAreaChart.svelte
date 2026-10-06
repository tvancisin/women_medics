<script lang="ts">
  import * as d3 from "d3";

  type WomenMedicsDatum = { year: number; number: number };

  export let width: number;
  export let currentYear: number;
  export let domainStartYear: number;
  export let domainEndYear: number;
  export let timelineY: number;
  export let yearToX: (year: number) => number;
  export let womenMedicsData: WomenMedicsDatum[] = [];
  export let menMedicsData: WomenMedicsDatum[] = [];

  const chartPaddingBottom = 0;
  const chartPaddingTop = 50;
  const menMissingDataStartYear = 1833;
  const trailingMissingDataEndYear = 1970;

  $: projectionData =
    womenMedicsData.length === 0
      ? []
      : (() => {
          const last = [...womenMedicsData]
            .sort((a, b) => a.year - b.year)
            .at(-1);

          if (!last) return [];

          const data = [{ year: last.year, number: last.number }];

          for (let year = last.year + 1; year <= 2026; year++) {
            data.push({
              year,
              number: last.number + (year - last.year) * 2,
            });
          }

          return data;
        })();

  $: projectionVisibleData =
    currentYear <= 1966
      ? []
      : projectionData.filter(
          (d) =>
            d.year <= currentYear &&
            d.year >= domainStartYear &&
            d.year <= domainEndYear,
        );

  $: projectionPath = d3
    .line<WomenMedicsDatum>()
    .x((d) => yearToX(d.year))
    .y((d) => yScale(d.number))(projectionVisibleData);

  // Keep values up to the current animated year only.
  $: visibleData = womenMedicsData
    .filter(
      (d) =>
        d.year <= currentYear &&
        d.year >= domainStartYear &&
        d.year <= domainEndYear,
    )
    .sort((a, b) => a.year - b.year);

  $: sortedData = [...womenMedicsData].sort((a, b) => a.year - b.year);

  // Both charts use one fixed scale so their values remain directly comparable.
  $: maxY =
    d3.max(
      [...womenMedicsData, ...menMedicsData],
      (d: WomenMedicsDatum) => d.number,
    ) ?? 0;

  // SVG y grows downward, so the range is inverted: bigger values map higher up.
  $: yScale = d3
    .scaleLinear()
    .domain([0, maxY > 0 ? maxY : 1])
    .range([timelineY - chartPaddingBottom, chartPaddingTop]);

  // Show the comparison scale only once both series are visible at the end
  // of the timeline. Its horizontal tick lines double as a full-width grid.
  $: showYAxis = currentYear >= 2026 && maxY > 0;
  // D3 orders ticks from the bottom value to the top value. Remove that
  // final tick so the y-axis does not have a tick at its upper endpoint.
  $: yTickValues = showYAxis
    ? yScale.ticks(4).slice(0, -1)
    : [];
  $: yTickLabel = d3.format(",");

  $: areaPath = d3
    .area<WomenMedicsDatum>()
    .x((d: WomenMedicsDatum) => yearToX(d.year))
    .y0(timelineY - chartPaddingBottom)
    .y1((d: WomenMedicsDatum) => yScale(d.number))(visibleData);

  $: linePath = d3
    .line<WomenMedicsDatum>()
    .x((d: WomenMedicsDatum) => yearToX(d.year))
    .y((d: WomenMedicsDatum) => yScale(d.number))(visibleData);

  $: visibleMenData =
    currentYear >= 2026
      ? menMedicsData
          .filter(
            (d) =>
              d.year <= currentYear &&
              d.year >= domainStartYear &&
              d.year <= domainEndYear,
          )
          .sort((a, b) => a.year - b.year)
      : [];

  // Continue the first observed year-to-year change backwards to signal the
  // period before the men's series begins. This is a visual cue only, not
  // additional data.
  $: menMissingnessData = (() => {
    const sortedMenData = [...menMedicsData].sort((a, b) => a.year - b.year);
    const [first, second] = sortedMenData;

    if (!first || !second || first.year <= menMissingDataStartYear) return [];

    const yearlyChange =
      (second.number - first.number) / (second.year - first.year);

    return [
      {
        year: menMissingDataStartYear,
        number:
          first.number + (menMissingDataStartYear - first.year) * yearlyChange,
      },
      first,
    ];
  })();

  $: menMissingnessPath = d3
    .line<WomenMedicsDatum>()
    .x((d) => yearToX(d.year))
    .y((d) => yScale(d.number))(menMissingnessData);

  $: showMenMissingness =
    currentYear >= 2026 && menMissingnessData.length === 2 && menMissingnessPath;

  $: womenTrailingMissingnessData = (() => {
    const last = sortedData.at(-1);
    const previous = sortedData.at(-2);

    if (!last || !previous || last.year >= trailingMissingDataEndYear) return [];

    const yearlyChange =
      (last.number - previous.number) / (last.year - previous.year);

    return [
      last,
      {
        year: trailingMissingDataEndYear,
        number: last.number + (trailingMissingDataEndYear - last.year) * yearlyChange,
      },
    ];
  })();

  $: womenTrailingMissingnessPath = d3
    .line<WomenMedicsDatum>()
    .x((d) => yearToX(d.year))
    .y((d) => yScale(d.number))(womenTrailingMissingnessData);

  $: showWomenTrailingMissingness =
    currentYear >= 2026 &&
    womenTrailingMissingnessData.length === 2 &&
    womenTrailingMissingnessPath;

  // Continue the final observed direction for a short distance beyond the
  // men's data to signal where the series becomes unavailable.
  $: menTrailingMissingnessData = (() => {
    const sortedMenData = [...menMedicsData].sort((a, b) => a.year - b.year);
    const last = sortedMenData.at(-1);
    const previous = sortedMenData.at(-2);

    if (!last || !previous || last.year >= trailingMissingDataEndYear) return [];

    const yearlyChange =
      (last.number - previous.number) / (last.year - previous.year);

    return [
      last,
      {
        year: trailingMissingDataEndYear,
        number:
          last.number +
          (trailingMissingDataEndYear - last.year) * yearlyChange,
      },
    ];
  })();

  $: menTrailingMissingnessPath = d3
    .line<WomenMedicsDatum>()
    .x((d) => yearToX(d.year))
    .y((d) => yScale(d.number))(menTrailingMissingnessData);

  $: showMenTrailingMissingness =
    currentYear >= 2026 &&
    menTrailingMissingnessData.length === 2 &&
    menTrailingMissingnessPath;

  $: menAreaPath = d3
    .area<WomenMedicsDatum>()
    .x((d: WomenMedicsDatum) => yearToX(d.year))
    .y0(timelineY - chartPaddingBottom)
    .y1((d: WomenMedicsDatum) => yScale(d.number))(visibleMenData);

  $: menLinePath = d3
    .line<WomenMedicsDatum>()
    .x((d: WomenMedicsDatum) => yearToX(d.year))
    .y((d: WomenMedicsDatum) => yScale(d.number))(visibleMenData);

  const interpolateValueAtYear = (year: number): number | null => {
    if (sortedData.length === 0) {
      return null;
    }

    if (year <= sortedData[0].year) {
      return sortedData[0].number;
    }

    for (let i = 1; i < sortedData.length; i += 1) {
      const previous = sortedData[i - 1];
      const next = sortedData[i];

      if (year <= next.year) {
        const yearSpan = next.year - previous.year;
        if (yearSpan <= 0) {
          return next.number;
        }

        const t = (year - previous.year) / yearSpan;
        return previous.number + (next.number - previous.number) * t;
      }
    }

    return sortedData[sortedData.length - 1].number;
  };

  $: currentValue = interpolateValueAtYear(currentYear);
  $: markerX = yearToX(currentYear);
  $: markerY = currentValue === null ? timelineY : yScale(currentValue);
  $: markerLabel = currentValue === null ? "" : `${Math.round(currentValue)}`;
  $: currentYearIsVisible =
    currentYear >= domainStartYear && currentYear <= domainEndYear;
</script>

{#if showMenMissingness}
  <defs>
    <linearGradient
      id="men-missingness-gradient"
      gradientUnits="userSpaceOnUse"
      x1={yearToX(menMissingnessData[0].year)}
      y1={yScale(menMissingnessData[0].number)}
      x2={yearToX(menMissingnessData[1].year)}
      y2={yScale(menMissingnessData[1].number)}
    >
      <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0" />
      <stop offset="100%" stop-color="#7dd3fc" stop-opacity="1" />
    </linearGradient>
  </defs>
{/if}

{#if showMenTrailingMissingness}
  <defs>
    <linearGradient
      id="men-trailing-missingness-gradient"
      gradientUnits="userSpaceOnUse"
      x1={yearToX(menTrailingMissingnessData[0].year)}
      y1={yScale(menTrailingMissingnessData[0].number)}
      x2={yearToX(menTrailingMissingnessData[1].year)}
      y2={yScale(menTrailingMissingnessData[1].number)}
    >
      <stop offset="0%" stop-color="#7dd3fc" stop-opacity="1" />
      <stop offset="100%" stop-color="#7dd3fc" stop-opacity="0" />
    </linearGradient>
  </defs>
{/if}

{#if showWomenTrailingMissingness}
  <defs>
    <linearGradient
      id="women-trailing-missingness-gradient"
      gradientUnits="userSpaceOnUse"
      x1={yearToX(womenTrailingMissingnessData[0].year)}
      y1={yScale(womenTrailingMissingnessData[0].number)}
      x2={yearToX(womenTrailingMissingnessData[1].year)}
      y2={yScale(womenTrailingMissingnessData[1].number)}
    >
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
  </defs>
{/if}

{#if showYAxis}
  <g class="y-axis" aria-label="Number of medical students">
    <line
      class="y-axis-line"
      x1="0"
      y1={chartPaddingTop}
      x2="0"
      y2={timelineY}
    />
    {#each yTickValues as tick}
      <g class="y-axis-tick" transform={`translate(0, ${yScale(tick)})`}>
        <line x1="0" y1="0" x2={width} y2="0" />
        <text x="8" y="-6">{yTickLabel(tick)}</text>
      </g>
    {/each}
  </g>
{/if}

{#if currentYear >= 1914 && visibleData.length > 1 && areaPath}
  <path d={areaPath} class="area-shape" />
  {#if linePath}
    <path d={linePath} class="area-top-line" fill="none" />
  {/if}
  {#if currentValue !== null && currentYear <= 1966 && currentYearIsVisible}
    <circle class="line-head" cx={markerX} cy={markerY} r="4" />
    <text class="line-head-label" x={markerX + 8} y={markerY + 3}>
      {markerLabel}
    </text>
  {/if}
  <!-- {#if projectionPath}
    <path d={projectionPath} class="projection-line" fill="none" />
  {/if} -->
{/if}

{#if showWomenTrailingMissingness}
  <path
    d={womenTrailingMissingnessPath}
    class="women-missingness-line"
    fill="none"
    aria-label="Estimated trend after women's student data ends"
  />
  <text
    class="women-missingness-label"
    x={yearToX(womenTrailingMissingnessData[1].year) + 6}
    y={yScale(womenTrailingMissingnessData[1].number) - 6}
  >no data</text>
{/if}

{#if showMenMissingness}
  <path
    d={menMissingnessPath}
    class="men-missingness-line"
    fill="none"
    aria-label="Estimated trend before men's student data begins"
  />
  <text
    class="men-missingness-label"
    x={yearToX(menMissingnessData[0].year) - 6}
    y={yScale(menMissingnessData[0].number) - 6}
    text-anchor="end"
  >no data</text>
{/if}

{#if showMenTrailingMissingness}
  <path
    d={menTrailingMissingnessPath}
    class="men-missingness-line"
    fill="none"
    aria-label="Estimated trend after men's student data ends"
  />
  <text
    class="men-missingness-label"
    x={yearToX(menTrailingMissingnessData[1].year) + 6}
    y={yScale(menTrailingMissingnessData[1].number) - 6}
  >no data</text>
{/if}

{#if currentYear >= 2026 && visibleMenData.length > 1 && menAreaPath}
  <path d={menAreaPath} class="men-area-shape" />
  {#if menLinePath}
    <path d={menLinePath} class="men-area-top-line" fill="none" />
  {/if}
{/if}

<style>
  .y-axis-line {
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 1;
  }

  .y-axis-tick line {
    stroke: rgba(255, 255, 255, 0.25);
    stroke-width: 1;
    stroke-dasharray: 5 4;
  }

  .y-axis-tick text {
    fill: rgba(255, 255, 255, 0.85);
    font-family: Montserrat;
    font-size: 11px;
  }

  .area-shape {
    fill: rgba(255, 255, 255, 0.1);
    stroke: none;
  }

  .area-top-line {
    stroke: rgba(255, 255, 255, 0.7);
    stroke-width: 1;
  }

  .men-area-shape {
    fill: rgba(125, 211, 252, 0.18);
    stroke: none;
  }

  .men-area-top-line {
    stroke: rgba(125, 211, 252, 0.85);
    stroke-width: 1;
  }

  .men-missingness-line {
    stroke-width: 1;
  }

  .women-missingness-line {
    stroke: url(#women-trailing-missingness-gradient);
    stroke-width: 1;
  }

  .men-missingness-line[aria-label="Estimated trend before men's student data begins"] {
    stroke: url(#men-missingness-gradient);
  }

  .men-missingness-line[aria-label="Estimated trend after men's student data ends"] {
    stroke: url(#men-trailing-missingness-gradient);
  }

  .men-missingness-label {
    fill: rgba(125, 211, 252, 0.7);
    font-family: Montserrat;
    font-size: 11px;
    pointer-events: none;
  }

  .women-missingness-label {
    fill: rgba(255, 255, 255, 0.7);
    font-family: Montserrat;
    font-size: 11px;
    pointer-events: none;
  }

  .line-head {
    fill: #fff;
  }

  .line-head-label {
    fill: #fff;
    font-size: 11px;
    font-family: Montserrat;
    pointer-events: none;
  }
  .projection-line {
    stroke: rgba(255, 255, 255, 0.7);
    stroke-width: 1;
    stroke-dasharray: 5 4;
    fill: none;
  }
</style>

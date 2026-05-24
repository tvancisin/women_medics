
<script lang="ts">
  import { onMount } from "svelte";
  import { axisBottom, easeLinear, scaleLinear, select, transition } from "d3";

  const startYear = 1583;
  const endYear = 2026;
  const stepYears = 10;
  const pauseDurationMs = 3000;
  const compactConnectorPx = 20;
  const pauseYears = new Set<number>([1726, 1867, 1869]);
  const pausedYears = new Set<number>();

  let pausedUntil = 0;
  let xScale: ReturnType<typeof scaleLinear> | null = null;
  let height = 0;
  let width = 0;
  let currentYear = startYear;
  let displayYear = startYear;
  let axisGroupEl: SVGGElement | null = null;

  let milestonePanelEl: HTMLDivElement | null = null;
  let nowMs = Date.now();
  $: sidePadding = Math.max(24, width * 0.08);
  $: maxSpan = Math.max(0, width - sidePadding * 2);
  $: labelProgress = (displayYear - startYear) / (endYear - startYear);
  $: labelX = sidePadding + maxSpan * labelProgress;
  $: labelY = Math.max(0, height - 80);
  $: timelineY = Math.max(0, height - 40);
  $: milestoneX = xScale ? xScale(1726) : sidePadding;
  $: isPauseActive = nowMs < pausedUntil;
  $: isDetailed1726Panel =
    displayYear === 1726 && isPauseActive && pausedYears.has(1726);
  $: panelBottom = milestonePanelEl
    ? milestonePanelEl.offsetTop + milestonePanelEl.offsetHeight
    : timelineY;
  $: connectorY = isDetailed1726Panel
    ? Math.min(panelBottom, timelineY)
    : Math.max(0, timelineY - compactConnectorPx);
  $: connectorHeight = isDetailed1726Panel
    ? Math.max(0, timelineY - connectorY)
    : Math.min(compactConnectorPx, timelineY);


  $: console.log(isDetailed1726Panel)

  // adding ticks
  const buildTickValues = (maxYear: number) => {
    const values = [startYear];
    for (let year = startYear + 20; year <= maxYear; year += 20) {
      values.push(year);
    }
    return values;
  };

  // redrawing timeline every second
  const drawTimeline = () => {
    if (!axisGroupEl || width <= 0 || height <= 0) return;

    const progress = (currentYear - startYear) / (endYear - startYear);
    const span = maxSpan * progress;
    const xStart = sidePadding;
    const xEnd = xStart + span;

    const axisGroup = select(axisGroupEl).attr(
      "transform",
      `translate(0, ${timelineY})`,
    );

    xScale = scaleLinear()
      .domain([startYear, currentYear])
      .range([xStart, xEnd]);

    const xAxis = axisBottom(xScale)
      .tickValues(buildTickValues(currentYear))
      .tickFormat((d: number) => `${d}`);

    const t = transition().duration(1000).ease(easeLinear);
    axisGroup.transition(t).call(xAxis);

    axisGroup.selectAll(".domain").attr("stroke", "#ffffff");
    axisGroup.selectAll(".tick line").attr("stroke", "#ffffff");
    axisGroup
      .selectAll(".tick text")
      .attr("fill", "#ffffff")
      .attr("font-size", "12px")
      .attr("font-family", "Montserrat");
  };

  const isPaused = () => Date.now() < pausedUntil;
  
  // checking every year if puse is needed
  const maybePauseAtYear = (year: number) => {
    if (pauseYears.has(year) && !pausedYears.has(year)) {
      pausedYears.add(year);
      pausedUntil = Date.now() + pauseDurationMs;
    }
  };

  onMount(() => {
    const decadeTimer = setInterval(() => {
      nowMs = Date.now();

      if (currentYear >= endYear) {
        clearInterval(decadeTimer);
        return;
      }

      if (isPaused()) {
        return;
      }

      currentYear = Math.min(currentYear + stepYears, endYear);
    }, 1000);

    const yearDisplayTimer = setInterval(() => {
      nowMs = Date.now();

      if (displayYear >= endYear) {
        clearInterval(yearDisplayTimer);
        return;
      }

      if (isPaused()) {
        return;
      }

      if (displayYear < currentYear) {
        displayYear = Math.min(displayYear + 1, currentYear, endYear);
        maybePauseAtYear(displayYear);
      }
    }, 100);

    return () => {
      clearInterval(decadeTimer);
      clearInterval(yearDisplayTimer);
    };
  });

  $: if (axisGroupEl && width > 0 && height > 0 && currentYear >= startYear) {
    drawTimeline();
  }
</script>

<main bind:clientWidth={width} bind:clientHeight={height}>
  <h1>Women in Medicine</h1>
  <h2 style:left={`${labelX}px`} style:top={`${labelY}px`}>{displayYear}</h2>

  {#if displayYear >= 1726}
    <div
      bind:this={milestonePanelEl}
      class="milestone-panel"
      class:compact={!isDetailed1726Panel}
      style:left={`${milestoneX}px`}
    >
      {#if isDetailed1726Panel}
        <img src="/img/uni_logo.png" alt="University crest" />
        <p>
          The medical school was established in 1726, making it the oldest
          medical school in the United Kingdom and the oldest medical school in
          the English-speaking world.
        </p>
      {:else}
        <p>Medical School</p>
      {/if}
    </div>
  {/if}

  <svg {width} {height}>
    <g bind:this={axisGroupEl}></g>
    {#if displayYear >= 1726}
      <rect
        x={milestoneX}
        y={connectorY}
        width={0.5}
        opacity="1"
        height={connectorHeight}
        fill="gray"
      />
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

  h2 {
    position: absolute;
    transform: translateX(-50%);
    margin: 0;
    color: rgb(253, 250, 245);
    font-size: 2rem;
    font-family: Montserrat;
  }

  .milestone-panel {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 250px;
    z-index: 2;
  }

  .milestone-panel img {
    width: 100%;
    max-width: 100px;
    height: auto;
    object-fit: contain;
  }

  .milestone-panel p {
    margin: 0;
    color: rgb(253, 250, 245);
    font-family: Montserrat, sans-serif;
    font-size: 12px;
    line-height: 1.3;
  }

  .milestone-panel.compact {
    top: calc(100% - 95px);
    width: 130px;
    gap: 0;
  }
</style>

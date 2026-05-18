<script lang="ts">
  import { onMount } from "svelte";
  import { axisBottom, easeLinear, scaleLinear, select, transition } from "d3";

  const startYear = 1583;
  const endYear = 2026;
  const stepYears = 10;

  let height = 0;
  let width = 0;
  let currentYear = startYear;
  let axisGroupEl: SVGGElement | null = null;

  // adding ticks
  const buildTickValues = (maxYear: number) => {
    const values = [startYear];
    for (let year = startYear + 20; year <= maxYear; year += 20) {
      values.push(year);
    }
    // if (values[values.length - 1] !== maxYear) {
    //   values.push(maxYear);
    // }
    return values;
  };

  // redrawing timeline every second
  const drawTimeline = () => {
    if (!axisGroupEl || width <= 0 || height <= 0) return;

    const y = Math.max(0, height - 40);
    const sidePadding = Math.max(24, width * 0.08);
    const maxSpan = Math.max(0, width - sidePadding * 2);
    const progress = (currentYear - startYear) / (endYear - startYear);
    const span = maxSpan * progress;
    const xStart = sidePadding;
    const xEnd = xStart + span;

    const axisGroup = select(axisGroupEl).attr(
      "transform",
      `translate(0, ${y})`,
    );

    const xScale = scaleLinear()
      .domain([startYear, currentYear])
      .range([xStart, xEnd]);
    const xAxis = axisBottom(xScale)
      .tickValues(buildTickValues(currentYear))
      .tickFormat((d) => `${d}`);

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

  onMount(() => {
    const timer = setInterval(() => {
      if (currentYear >= endYear) {
        clearInterval(timer);
        return;
      }

      currentYear = Math.min(currentYear + stepYears, endYear);
    }, 1000);

    return () => clearInterval(timer);
  });

  $: if (axisGroupEl && width > 0 && height > 0 && currentYear >= startYear) {
    drawTimeline();
  }
</script>

<main bind:clientWidth={width} bind:clientHeight={height}>
  <h1>Women in Medicine</h1>
  <svg {width} {height}>
    <g bind:this={axisGroupEl}></g>
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
</style>

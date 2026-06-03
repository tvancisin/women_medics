<script lang="ts">
  import * as d3 from "d3";
  export let data: unknown[] = [];
  export let x: number;
  export let height: number;

  let yScale = d3
    .scaleLinear()
    .domain([0, 490])
    .range([height - 30, 0]);
</script>

{#each data as data, index}
  <circle cx={x} cy={height - 105 - index * 4} r="1" fill="white" />
{/each}

<!-- <rect
  x={x - 2.5}
  y={yScale(data.length)}
  width="1"
  height={yScale(0) - yScale(data.length)}
  fill="white"
/> -->

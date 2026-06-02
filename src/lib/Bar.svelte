<script lang="ts">
  export let edinburghSevenData: Array<Record<string, string>> = [];
  export let x: number;
  export let height: number;
</script>
{#each edinburghSevenData as data, index}
  <circle
    cx={x}
    cy={height - 105 - index * 4}
    r="1"
    fill="white"
  />
{/each}

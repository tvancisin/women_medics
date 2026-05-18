<script>
  let height = 0;
  let width = 0;
</script>

<main bind:clientWidth={width} bind:clientHeight={height}>
  <h1>Women in Medicine</h1>
  <svg {width} {height}></svg>
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

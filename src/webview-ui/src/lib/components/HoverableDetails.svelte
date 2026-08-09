<script lang="ts">
  import { slide } from 'svelte/transition'

  let props = $props<{
    summary: string
    details: string[]
  }>()
  const colors = {
    over: 'green',
    out: 'blue',
  }
  $inspect('comp sum/det', props.summary, props.details)
  let isOpen = $state(false)
</script>

<details
  style="--text-color: {isOpen ? colors.over : colors.out};"
  open={isOpen}
  onmouseenter={() => (isOpen = true)}
  onmouseleave={() => (isOpen = false)}
>
  <!-- Standard JS preventDefault inside the Svelte 5 event attribute -->
  <summary
    onclick={(e) => e.preventDefault()}
    style:color={isOpen ? props.colors.out : ''}
    >{props.summary} ({props.details.length})</summary
  >

  {#if isOpen}
    <div transition:slide={{ duration: 250 }} class="bordered">
      {#each props.details as detail (detail)}
        <div class="detail">{detail}</div>
      {/each}
    </div>
  {/if}
</details>

<style lang="scss">
  details {
    color: var(--text-color);
    transition: color 0.2s ease-in-out;
    width: 12rem;
  }

  .bordered {
    border: 1px solid gray;
    border-radius: 4px;
    max-width: 12rem;
    padding: 0.5rem 1rem;
    margin-top: 0.25rem;
    overflow: hidden;
  }
  summary {
    @extend .bordered; /* does not work in Svelte Playground*/
    padding: 2px 1rem;
    cursor: pointer;
    user-select: none;
  }

  .detail {
    padding: 0;
    margin: 0;
    font-family: monospace;
    font-size: 12px;
    line-height: 16px;
  }
</style>

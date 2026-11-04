<script lang="ts">
  // components/CRSummaryDetails
  import { onMount } from 'svelte';
  type PROPS = {
    summary: string;
    details: string;
  };
  let { summary, details }: PROPS = $props();
</script>

<details>
  <summary> {summary} </summary>
  <pre>
  {details}
  </pre>
</details>

<style lang="scss">
  details * {
    margin: 0;
  }
  details {
    background-color: hsl(0 0% 25%);
    width: max-content;
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    overflow: hidden;
  }
  details > pre {
    opacity: 0;
    /* margin up and down */
    padding-block: 1rem;
    margin-left: 1rem;
  }
  details[open] pre {
    animation: fadeIn 0.75s linear forwards;
  }
  pre {
    border: 1px solid hsl(0 0% 45%);
    border-radius: 10px;
    padding: 1rem;
    margin: 0.5rem 0 0 3rem !important;
  }
  @keyframes fadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  summary {
    font-size: 1.5rem;
    color: hsl(0 0% 85%);
    background-color: hsl(0 0% 35%);
    margin-inline-start: 1rem;
    /* should be instead of margin-left in above details > p */
    list-style-position: outside;
    margin-left: 3rem;
    cursor: pointer;
    width: max-content;
    padding: 2px 3rem;
    border-radius: 8px;
  }
  summary::marker {
    color: hsl(0 0% 60%);
  }
</style>

<!--
@component
	CRSpinner wraps an HTMLButtonElement named button, so it could be bound to a parent variable say
    let btnCreate:HTMLButtonElement
  <CRSpinner bind:button={btnCreate} ...><CRSpinner>
  and it is the only way to get reference to the embedded button.
  There is no way for now to get reference via document.querySelector('CRSpinner')
  or document.getElementsByTagName('CRSpinner')[0]

	CRSpinner component features a 3/4 circle skyblue spinner. In order to start and stop spinning its spinOn
	property should be bound to a parent boolean variable, e.g. let loading:boolean = false (not a $state rune)
	Spin starts when loading is set to true and stops when it is false
	Mandatory props are 
		- caption     -- a button title
    - spinOn      -- boolean controlling spin on/off  with loading true/false
    - button      -- a parent variable bound to internal CRSpinner button via parent code like
										import CRSpinner from '$lib/components/CRSpinner.svelte'
										let btnCreate:HTMLButtonElement
										let cursor:boolean           -- true set it to 'pointer', false to 'not allowed'
										let loading:boolean = false  -- keep spinner idle until loading = true
										let hidden:boolean = true    -- hidden until conditionally visible, 
																										false for initially visible buttons like Create Todo
																										All buttons should be visible only when applicable
										Property formaction is defined for SvelteKIt enhance with URL actions like
										'?/createTodo', '?/updateTodo', '?'deleteTodo'. '?/toggleTodoCompleted',...
										so formaction='?/createTodo' would submit form data to action in +page.server.ts
										export const actions: Actions = {
										createTodo: async ({ request }) => { ...
										Property cursor is optional and is used to warn user for action not allowed
										<CRSpinner 
												bind:button={btnCreate} 
												caption='Create Todo' 
												spinOn={loading}
												hidden={hidden}
												/* optional */
												cursor={cursor}   		/* default is true (pointer) false for 'not allowed'
												width='6rem'      		/* max-content + padding='4px 1.5rem  -- default, */
																							/* or other values iin units like px */
												height='2rem'     		/* default, but could be specified in values of other units e,g, px */
												top='0'				    		/* adjust position:absolute of spinner to get along with button's hight */
												color='skyblue'   		/= but could be rgba, hsa or #xxxxxx forma as well */
												spinnerSize='1.3rem'	/* spinner circle diameter, default is 1em but could be different */
											  duration='3s'     		/* duration in seconds for one RPM, default is 1.5s */
										>
										</CRSpinner>
-->
<script lang="ts">
  // components/CRSpinner.svelte
  export type TButtonSpinner = HTMLButtonElement & CRSpinner;

  type TProps = {
    caption: string;
    button: HTMLButtonElement;
    spinOn: boolean;
    formaction?: string;
    hidden?: boolean;
    disabled?: boolean;
    cursor?: boolean;
    color?: string;
    duration?: string;
    spinnerSize?: string;
    top?: string;
    width?: string;
    height?: string;
  };
  let {
    caption = 'button',
    button = $bindable(),
    formaction,
    spinOn,
    hidden = $bindable(true),
    disabled = $bindable(false),
    cursor = $bindable(true),
    color = `skyblue`,
    duration = `1.5s`,
    spinnerSize = `1em`,
    top = `0`,
    width = 'max-content',
    height = '2rem',
  }: TProps = $props();
</script>

{#snippet spinner(color: string)}
  <!-- styling for a spinner itself -->
  <div
    class="spinner"
    style:border-color="{color} transparent {color}
    {color}"
    style="--duration: {duration}"
    style:text-wrap="nowrap !important"
    style:width={spinnerSize}
    style:height={spinnerSize}
    style:top={Number(height) / 2}
  ></div>
{/snippet}

<p style="position:relative;margin:0;padding:0;display:inline-block;">
  <!-- styling for an embedded button -->
  <button
    bind:this={button}
    type="submit"
    class:hidden
    {formaction}
    {disabled}
    style:cursor={cursor ? 'pointer' : 'not-allowed'}
    style:width
    style:height
    style:top={Number(height) / 2}
    style:padding="4px 1.5rem"
  >
    {#if spinOn}
      <!-- NOTE: must have ancestor with position relative to get proper position -->
      {@render spinner(color)}
    {/if}
    {caption}
  </button>
</p>

<style>
  .spinner {
    position: absolute;
    display: inline-block;
    vertical-align: middle;
    margin: 0 4pt;
    border-width: calc(1em / 4);
    border-style: solid;
    border-radius: 50%;
    animation: var(--duration) infinite rotate;
    position: absolute;
    left: 0;
    /* top: 0.5rem !important; */
  }
  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
  .hidden {
    display: none;
  }
  button {
    display: inline-block;
  }
</style>

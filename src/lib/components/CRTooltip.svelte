<!-- 
@component
CRTooltip could accept the following props, though all are optional
  type TProps = {
    delay?: number;                 // transform params delay duration and baseScale
    duration?: number;
    baseScale?: number;

    caption?: string;               // caption, a string, and panel snippet are mutually exclusive.
                                    // The caption string can be styled by CSS style string or a class name
                                    // sent as captionCSS prop. When both panel and caption are specified 
                                    // inside the props the caption string is ignored

    captionCSS?: string;            // user styling as a CSS class name or a style string applied e.g. captionCSS='caption-class'
                                    // with :global(.caption-class){...} or with a style captionCSS='font-size:14px; color:orange;'
                                    // CRTooltip has a default caption CSS class .caption-default that can be overridden
                                    // by sending a class name or style string via captionCSS prop.

                                    // When the parent page have several hovering elements that uses the same styling avoid
                                    // repeating <Tooltip captionCSS="caption-class" ...> for each hovering element
                                    // but define var props structure that includes several common props along with caption-class
                                    // and spread it via {...props} inside <Tooltip {...props} ...> for each
                                    // hovering element that uses the same styling

    panel?: TPanel;          // A snippet object defined by parent page and sent as object name to a component via $props().
                                    // If caption and panel snippet name are both specified the caption is ignored
                                    // e.g. for {#snippet userDetails(user)} we specify $props()
                                    // panel={userDetails}   -- a function reference, not as a string panel="userDetails"
    panelArgs?: TPanelArgs;         // When panel accepts arguments the parent page sends to the Tooltip component panelArgs prop
                                    // as an array of arguments to be forwarded to the panel snippet
                                    // For instance for userDetails snippet defined as
                                    //      {#snippet userDetails([fName, lName, isAdmin]: [string, string, boolean])}
                                    // where args are sent as a tuple (an array of fixed length with item types)
                                    // the parent page sends panelArgs={['John:', 'Doe', true]} to the Tooltip component
                                    // and the Tooltip component forwards it to the userDetails snippet when rendering it
                                    //      {@render runtimePanel?.(panelArgs)} 

    children?: Snippet;             // Any HTML markup content between <Tooltip> children... </Tooltip> tags.
                                    // Children is a hovering element triggering tooltip visibility via mouseenter/mouseleave
                                    // so children HTML markup is usually encapsulated in a single HTML hovering element

    preferredPos?: string;          // When, due to scrolling, there is a lack of space around the hovering element CRTooltip
                                    // tries to find an available space following the recommended sequence by the preferredPos
                                    // prop string or, if not specified, by the default one 'top,left,right,bottom'
    
    toolbarHeight?: number          // If a page has a toolbar in layout its height would impact calculation of the proper
                                    // tooltip top position required by preferredPos, so its height should be sent via props.
                                    // Not only toolbar but the other styling including layout and styling of children block
                                    // defined in layout. So try to find the exact value otherwise tooltip in the top position
                                    // could be clipped on its top part 

  };

-->

<script lang="ts">
  //  components/CRTooltip.svelte
  import { type Snippet, onMount } from 'svelte';
  import { cubicInOut } from 'svelte/easing'; // for animated transition
  import type { EasingFunction } from 'svelte/transition';
  import * as utils from '$lib/utils';

  // fade scale animation for displaying/hiding tooltip
  export interface FadeScaleParams {
    delay?: number;
    duration?: number;
    easing?: EasingFunction;
    baseScale?: number;
    translateX?: string;
    translateY?: string;
  }

  const fadeScale = <IProps extends FadeScaleParams>(
    node: HTMLElement,
    {
      delay = 100,
      duration = 1600,
      easing = (x: number) => x,
      baseScale = 0,
      translateX = '1rem',
      translateY = '-160%',
    }: IProps,
  ) => {
    const opacity = +getComputedStyle(node).opacity;
    const m = getComputedStyle(node).transform.match(/scale(([0-9.]+))/);
    const scale = m ? Number(m[1]) : 1;
    const is = 1 - baseScale;
    // transform: translate uses matrix's last two entries for translate x and y
    // with scaleX=1 skewX=0 skewY=0  scaleY=1 (1-no scale and 0-no skew) just translate
    // NOTE: transform: translate is defined in the Tooltip.svelte and must specify
    // the same left/top values as the one in this css return value
    return {
      delay,
      duration,
      css: (t: number) => {
        const eased = easing(t);
        return `opacity: ${eased * opacity}; transform: translate(${translateX},${translateY}) scale(${eased * scale * is + baseScale}) `;
      },
    };
  };

  const hoveringId = 'hovering-' + utils.sixHash();
  // as caption and panel are mutually exclusive
  // even when both are received via $props()
  // we use the same tooltipPanelId for both
  // const tooltipPanelId = 'tooltip-' + utils.sixHash();
  let tooltipPanelEl = $state<HTMLElement | null>(null);
  const round = Math.round;

  type TPanelArgs = any[] | object;
  type TPanel = Snippet<[...any[]]> | null;
  type TProps = {
    delay?: number;
    duration?: number;
    baseScale?: number;
    caption?: string;
    captionCSS?: string;
    panel?: Snippet<[...any[]]> | null;
    panelArgs?: TPanelArgs; // arguments to forward
    children?: Snippet;
    preferredPos?: string;
    toolbarHeight?: number;
  };

  let {
    duration = 1000,
    delay = 800,
    baseScale = 0,
    caption = '',
    captionCSS = '',
    panel,
    panelArgs, // arguments to forward
    children,
    preferredPos = 'top,left,right,bottom',
    toolbarHeight = 0,
  }: TProps = $props();

  // Need to define variables as the setTooltipPos function adjusted them
  // to position properly based on preferredPos settings and available
  // space around the hovering element
  let translateX = $state<string>('');
  let translateY = $state<string>('');

  let runtimePanel: TPanel = panel ? panel : caption ? captionPanel : null;

  if (!runtimePanel) {
    throw new Error('panel or caption is mandatory');
  }

  const getPreferred = () => {
    return preferredPos.replace(/s+/g, '').split(',') as string[];
  };

  let visible = $state(false);
  let initial = $state(true);

  // the setTooltipPos examine necessary parameters for applying
  // tooltip at required position and is forced to iterate over
  // the preferredPos list until params for a position match
  const OK = $state({
    top: false,
    bottom: false,
    leftRightBottom: false,
    topBottomRight: false,
    left: false,
    right: false,
  });

  // the setTooltipPos is triggered via mouseenter and has to have
  // rectangles for hovering element and its accompanying tooltip
  // to move tooltip to the proper space. The HoverData is bound
  // to accompanying hovering element via its id set by this
  // component initially in onMount and is saved in a Record list
  type HoverData = {
    hoverRect: DOMRect;
    tooltipRect: DOMRect;
  };
  // Record is an array type of a given key type and value type
  // where  key is a hovering element id inserted inside onMount
  // and registered in hoverRec array easy to fetch it when
  // onmouseenter handler has to display tooltip in a required
  // preferredPos position
  type HoverRecord = Record<string, HoverData>;
  const hoverRec: HoverRecord = {};

  const addRecord = (key: string, hr: DOMRect, tr: DOMRect) => {
    hoverRec[key] = { hoverRect: hr, tooltipRect: tr };
  };

  // triggered via mouseenter of the hovering elements to set its
  // accompanying tooltip in requiredPos position
  const setTooltipPos = (hoveringElement: HTMLElement) => {
    // NOTE: If your app has a Toolbar its height should be included in calculation.
    // For svelte-postgres app the toolbar height is 32px

    const { hoverRect, tooltipRect } = hoverRec[
      hoveringElement.id
    ] as HoverData;
    if (!hoverRect || !tooltipRect) {
      return;
    }

    translateX = '';

    // is there enough space at the right side of the screen for width and for height
    OK.topBottomRight =
      hoverRect.left - window.scrollX + tooltipRect.width < window.innerWidth;

    // is there enough space before the bottom side of the screen
    OK.leftRightBottom =
      hoverRect.top - window.scrollY + tooltipRect.height < window.innerHeight;

    OK.top =
      hoverRect.top - window.scrollY - toolbarHeight > tooltipRect.height;

    OK.bottom =
      hoverRect.bottom - window.scrollY + tooltipRect.height <
      window.innerHeight;

    OK.left = hoverRect.left - window.scrollX > tooltipRect.width;

    OK.right =
      hoverRect.right - window.scrollX + tooltipRect.width < window.innerWidth;

    for (let i = 0; i < getPreferred().length; i++) {
      const pref = getPreferred();
      switch (pref[i] as string) {
        case 'top':
          if (OK.top && OK.topBottomRight) {
            translateX = '0px';
            translateY = `${-tooltipRect.height}px`;
          }
          break;
        case 'left':
          if (OK.left && OK.leftRightBottom) {
            translateX = `${-tooltipRect.width}px`;
            translateY = '0px';
          }
          break;
        case 'right':
          if (OK.right && OK.leftRightBottom) {
            translateX = `${hoverRect.width}px`;
            translateY = '0px';
          }
          break;
        case 'bottom':
          if (OK.bottom && OK.topBottomRight) {
            translateX = '0px';
            translateY = `${hoverRect.height + 5}px`;
          }
          break;
        default:
          break;
      }
      // if available position is found turn the tooltip on and exit teh loop
      if (translateX !== '') {
        visible = true;
        break;
      }
    }
    // no available position was found so we improvise
    if (translateX === '') {
      translateY = OK.top
        ? `${-tooltipRect.height}px`
        : `${hoverRect.height}px`;
      translateX = OK.left
        ? `${window.innerWidth - (hoverRect.right - window.scrollX) - hoverRect.width}px`
        : '0px';
      visible = true;
    }
  };

  const toggle = (event: MouseEvent) => {
    if (event.type === 'mouseenter') {
      setTooltipPos(event.currentTarget as HTMLElement);
    } else {
      visible = false;
    }
  };

  onMount(() => {
    setTimeout(() => {
      // tooltipPanelEl holds panel or captionPanel
      // depending on the $props() passed to this component
      // and we take the child as a runtimePanel
      // const ttPanelWrapper = document.getElementById(
      //   tooltipPanelId,
      // ) as HTMLElement;

      if (tooltipPanelEl) {
        // ttPanel is a panel or a captionPanel to be show as a tooltip
        const ttPanel = tooltipPanelEl.children[0] as HTMLElement;

        // hoveringEl is the element that triggers the tooltip
        // child wrapper children are hovering elements mouseenter/mouseleave
        const hoveringEl = document.getElementById(hoveringId) as HTMLElement;

        if (ttPanel && hoveringEl) {
          addRecord(
            hoveringId,
            hoveringEl.getBoundingClientRect() as DOMRect,
            ttPanel.getBoundingClientRect() as DOMRect,
          );
        }

        // Clean up after logging
        (tooltipPanelEl as HTMLElement).remove();
      }
    }, 0);

    window.addEventListener('scrollend', () => {
      translateX = '0px';
      translateY = '0px';
    });
  });
</script>

<!-- <p>{JSON.stringify(panelArgs, null, 2)}</p> -->
<!-- 
    NOTE: transform:translate is defined in the fade-scale and must specify
    the same left/top values as the one in this tooltipPanelEl handler

    On initial===true we find dimensions of tooltip panel wrapping it via 
    @render and then destroy wrapper after getting dimensions
-->
{#if initial}
  <div
    bind:this={tooltipPanelEl}
    style="position:absolute;top:-9999px !important;left:-9999px !important;visibility:hidden;padding:0;margin:0;border:none;outline:none;width:max-content;"
    class="ttWrapper"
  >
    {@render runtimePanel?.(panelArgs)}
  </div>
{/if}

{#snippet captionPanel(style?: string)}
  {#if captionCSS.includes(':')}
    <div
      bind:this={tooltipPanelEl}
      class="caption-default"
      style={captionCSS ?? ''}
    >
      {caption}
    </div>
  {:else}
    <div
      bind:this={tooltipPanelEl}
      class="caption-default {captionCSS}"
      style={style ??
        'padding:6px 0.5rem;margin:0 !important;height: 1rem !important;'}
    >
      {caption}
    </div>
  {/if}
{/snippet}

{#snippet handler()}
  {#if visible}
    <div
      id="ttWrapperId"
      style={`position:absolute;  
      transform: translate(${translateX},${translateY});
      opacity: 0.85;
      padding: 0;
      margin:0;
      width:0;
      height:0;
      border:none;
      outline:none;
    `}
      transition:fadeScale={{
        delay,
        duration,
        easing: cubicInOut,
        baseScale,
        translateX,
        translateY,
      }}
    >
      <div class="ttWrapper">
        {@render runtimePanel?.(panelArgs)}
      </div>
    </div>
  {/if}
{/snippet}

<div
  id={hoveringId}
  class="child-wrapper"
  onmouseenter={toggle}
  onmouseleave={toggle}
  aria-hidden={true}
>
  {@render handler()}
  {@render children?.()}
</div>

<style>
  .child-wrapper {
    display: inline-block;
    margin: 0;
    padding: 0;
    width: max-content;
    height: auto;
    border: none;
    outline: none;
    z-index: 10;
  }
  .ttWrapper {
    /* position: relative; */
    width: max-content;
    /*height: auto;*/
    margin: 0 !important;
    padding: 0 !important;
    border: none;
    outline: none;
  }
  .caption-default {
    border: 1px solid skyblue;
    border-radius: 5px;
    color: yellow;
    background-color: navy;
    width: max-content;
    padding: 3px 1rem;
    margin: 0;
    text-align: center;
    font-size: 14px;
    line-height: 14px;
    font-family: Arial, Helvetica, sans-serif;
    z-index: 10;
  }
</style>

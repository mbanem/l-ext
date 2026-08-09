<script lang="ts">
  let hoveringElRect = $state<DOMRect>()
  let tooltipRect = $state<DOMRect>()
  let tooltipEl = $state<HTMLElement>()
  let reactTooltip = $state<HTMLElement | string>()

  export function setTooltip(
    tooltip: HTMLElement | string,
    customStyles: Partial<CSSStyleDeclaration> = {},
  ) {
    try {
      reactTooltip = tooltip as HTMLElement | string
      if (typeof tooltip === 'string' || tooltip instanceof String) {
        tooltipEl = document.createElement('div') as HTMLDivElement
        tooltipEl.style.cssText =
          'text-wrap: nowrap; position: fixed; opacity: 1; border: 1px solid gray; border-radius: 4px; padding: 2px 0.5rem; margin: 0; text-align: center;'

        Object.assign(tooltipEl.style, customStyles)
        tooltipEl.innerHTML = tooltip as string
        document.body.appendChild(tooltipEl)
        tooltipRect = tooltipEl.getBoundingClientRect()
      } else {
        tooltipRect = (tooltip as HTMLElement).getBoundingClientRect()
        tooltipEl = tooltip as HTMLElement
      }
      tooltipEl.style.cssText +=
        'opacity:0; transform:scale(0); transition: opacity 0.5s ease, transform 0.8s ease;'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log('setTooltip catch', msg)
    }
    return tooltipEl
  }
  function positionTooltip(tooltipEl: HTMLElement, stick?: TStick) {
    try {
      // top-left position of the hovering element
      let x = window.scrollX + (hoveringElRect as DOMRect).left
      let y = window.scrollY + (hoveringElRect as DOMRect).top
      if (stick) {
        switch (stick) {
          case 'left':
            x -= (tooltipRect as DOMRect).width + 6
            break
          case 'right':
            x += (hoveringElRect as DOMRect).width + 6
            break
          case 'above':
            x += ((hoveringElRect as DOMRect).width - tooltipRect!.width) / 2
            y -= tooltipRect!.height + 6
            break
          case 'above-at-left':
            x -= tooltipRect!.width / 2
            y -= tooltipRect!.height + 6
            break
          case 'below':
            y += (hoveringElRect as DOMRect).height + 6
            break
          default:
            y -= 6
            break
        }
      }
      tooltipEl.style.cssText += `position:absolute;left:${x}px;top:${y}px;opacity:1;z-index:100`
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log('catch positionTooltip failed', msg)
    }
  }
  export function hideTooltip() {
    if (!tooltipEl) {
      return
    }
    ;(tooltipEl as HTMLElement).style.opacity = '0'
    if (typeof reactTooltip === 'string' || reactTooltip instanceof String) {
      console.log('try to delete tooltipEl', tooltipEl)
      document.body.removeChild(tooltipEl as HTMLElement)
    }
  }

  export function showTooltip(
    e: MouseEvent | HTMLElement,
    tooltip: HTMLElement | string,
    stick: TStick,
    customStyles: Partial<CSSStyleDeclaration> = {
      backgroundColor: 'aliceblue',
      color: 'navy',
    },
    timeout: number = 0,
  ) {
    try {
      tooltipEl = setTooltip(tooltip, customStyles) as HTMLElement
      let hoveringEl: HTMLElement
      if (e instanceof MouseEvent) {
        hoveringEl = document.elementFromPoint(
          e.clientX,
          e.clientY,
        ) as HTMLElement
      } else {
        hoveringEl = e
      }
      hoveringElRect = hoveringEl.getBoundingClientRect() as DOMRect
      positionTooltip(tooltipEl as HTMLElement, stick)
      tooltipEl.style.opacity = '1'
      tooltipEl.style.transform = 'scale(1)'

      if (timeout > 0) {
        setTimeout(() => {
          hideTooltip()
        }, 2000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log('tooltip element HTMLElement | string -- not found', msg)
    }
  }
</script>

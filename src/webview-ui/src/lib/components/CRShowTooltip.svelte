<script lang="ts">
  let hoveringElRect = $state<DOMRect>()
  let tooltipRect = $state<DOMRect>()
  let tooltipEl = $state<HTMLElement>()
  let rectTooltip = $state<HTMLElement | string>()

  function addCloseButton(tooltipEl: HTMLElement, onClose: () => void) {
    // Remove old one if present
    tooltipEl.querySelector('.tooltip-close')?.remove()

    const btn = document.createElement('span')
    btn.className = 'tooltip-close'
    // btn.type = 'button'
    btn.setAttribute('aria-label', 'Close')
    btn.innerText = '❌'
    Object.assign(btn.style, {
      fontSize: '12px',
      display: 'inline-block',
      cursor: 'pointer',
    })

    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    })

    tooltipEl.style.position ||= 'relative'
    tooltipEl.appendChild(btn)
  }
  export function setTooltip(
    tooltip: HTMLElement | string,
    customStyles: Partial<CSSStyleDeclaration> = {},
    timeout: number,
  ) {
    try {
      rectTooltip = tooltip as HTMLElement | string
      if (typeof tooltip === 'string' || tooltip instanceof String) {
        tooltipEl = document.createElement('div') as HTMLDivElement
        const html = tooltip
        .split(',')
        .map((part) => `<p style='padding:0;margin:0;'>${part}</p>`)
        .join('')
        
        tooltipEl.classList.add('tooltip-content')

        console.log('[OrmOne] setTooltip', html)
        // When building the HTML
        tooltipEl.innerHTML = html
        tooltipEl.style.cssText =
          'text-wrap: nowrap; position: fixed; opacity: 1; border: 1px solid gray; border-radius: 4px; padding:0.5rem 1rem; margin: 0; text-align: center;'

        // Object.assign(tooltipEl.style, customStyles)
        document.body.appendChild(tooltipEl)
        tooltipRect = tooltipEl.getBoundingClientRect()
      } else {
        tooltipRect = (tooltip as HTMLElement).getBoundingClientRect()
        tooltipEl = tooltip as HTMLElement
        Object.assign(tooltipEl.style, customStyles)
        tooltipEl.classList.add('tooltip-content')
      }
      console.log('[OrmOne] setTooltip', tooltipEl)
      if (timeout === 0) {
        console.log('[OrmOne] setTooltip timeout', timeout)

        addCloseButton(tooltipEl, hideTooltip)
      }
      console.log('[OrmOne] setTooltip wit x', tooltipEl)
      tooltipEl.style.cssText +=
        'opacity:0;padding:0.5rem 1rem;transform:scale(0); transition: opacity 0.5s ease, transform 0.8s ease;'
      Object.assign(tooltipEl.style, {
        zIndex: '10',
        pointerEvents: 'auto',
        opacity: '1',
        width: 'max-content',
        padding: '0.5rem 1rem',
        textAlign: 'center',
        backgroundColor: 'aliceblue',
        color: 'navy',
        borderRadius: '5px',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log('setTooltip catch', msg)
    }
    return tooltipEl
  }
  function positionTooltip(hoveringRect: DOMRect, stick: TStick) {
    try {
      // top-left position of the hovering element
      let x = window.scrollX + (hoveringRect as DOMRect).left
      let y = window.scrollY + (hoveringRect as DOMRect).top
      let ttRect = tooltipEl?.getBoundingClientRect() as DOMRect
      if (stick === 'left') {
        x -= (hoveringRect as DOMRect).width + 6
      } else if (stick === 'right') {
        x += (hoveringRect as DOMRect).width + 6
      } else if (stick === 'above' || stick === 'over') {
        x += ((hoveringRect as DOMRect).width - ttRect.width) / 2
      } else if (stick === 'above-at-left' || stick === 'over-at-left') {
        x -= tooltipRect!.width / 2
        y -= tooltipRect!.height + 6
      } else if (stick === 'below') {
        x += ((hoveringRect as DOMRect).width - ttRect.width) / 2
        y += (hoveringRect as DOMRect).height + 6
      }

      ;(tooltipEl as HTMLElement).style.cssText +=
        `position:absolute;left:${x}px;top:${y}px;opacity:1;z-index:100`
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log('catch positionTooltip failed', msg)
      return false
    }
    return true
  }

  export function hideTooltip() {
    if (!tooltipEl) {
      return
    }
    ;(tooltipEl as HTMLElement).style.opacity = '0'
    if (typeof rectTooltip === 'string' || rectTooltip instanceof String) {
      console.log('try to delete tooltipEl', tooltipEl)
      document.body.removeChild(tooltipEl as HTMLElement)
    }
    tooltipEl = undefined
  }

  export function showTooltip(
    e: MouseEvent | HTMLElement,
    tooltip: HTMLElement | string,
    stick: TStick,
    timeout: number = 3000,
    customStyles: Partial<CSSStyleDeclaration> = {
      backgroundColor: 'aliceblue',
      color: 'navy',
    },
  ) {
    try {
      if (tooltipEl !== undefined) {
        return
      }
      tooltipEl = setTooltip(tooltip, customStyles, timeout) as HTMLElement
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
      positionTooltip(hoveringElRect, stick)
      tooltipEl.style.opacity = '1'
      tooltipEl.style.transform = 'scale(1)'

      if (timeout > 0) {
        setTimeout(() => {
          hideTooltip()
        }, timeout)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log('tooltip element HTMLElement | string -- not found', msg)
    }
  }
</script>

<style lang="scss">
  :global(.tooltip-content)  {
    color: navy;
    background-color: cornsilk;
    p {
      margin: 0;
      padding: 0.6rem 1rem;
    }
  }
</style>

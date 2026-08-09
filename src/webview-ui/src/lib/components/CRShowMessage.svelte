<script lang="ts">
  // let triggeringEl: HTMLElement
  let msgEl: HTMLDivElement
  let message = $state('')
  let disabled = $state(false)

  export function getHTMLStringWidth(
    htmlString: string,
    customStyles: Partial<CSSStyleDeclaration> = {},
  ) {
    const container = document.createElement('p')
    container.style.whiteSpace = 'nowrap'
    container.style.position = 'fixed'
    container.style.visibility = 'hidden'

    Object.assign(container.style, customStyles)
    container.innerHTML = htmlString
    document.body.appendChild(container)

    const width = container.offsetWidth
    document.body.removeChild(container)
    return width
  }
  function adjustX(
    rect: DOMRect,
    msgWidth: number,
    stick?: TStickMsgToElement,
  ) {
    let x = window.scrollX
    if (stick) {
      switch (stick) {
        case 'StickRights':
          x += rect.right - msgWidth
          break
        case 'StickMiddles':
          x += rect.x + (rect.width - msgWidth) / 2
          break
        case 'MiddleToLeft':
          x += rect.x - msgWidth / 2
          break
        default:
          x = rect.x
          break
      }
    }
    console.log(
      'x',
      x,
      'rect x width right',
      rect.x,
      rect.width,
      rect.right,
      'msg',
      msgWidth,
      window.scrollX,
    )
    return x
  }
  export function showMessage(
    e: MouseEvent | KeyboardEvent | HTMLElement,
    msg: string,
    stick?: TStickMsgToElement,
    customStyles: Partial<CSSStyleDeclaration> = {
      backgroundColor: 'aliceblue',
      color: 'navy',
    },
  ) {
    // console.log('showing message', msg)
    if (!msgEl) {
      // console.warn('msgEl not found')
      return
    }
    // while message is on ignore new requests
    if (disabled) {
      return
    }
    disabled = true
    // turn msg into reactive message variable
    message = msg

    try {
      let x: number = 0 // StickLefts
      let msgWidth = getHTMLStringWidth(msg, { boxSizing: 'border-box' })
      let rect: DOMRect = {} as DOMRect
      if (e instanceof KeyboardEvent && e.type.slice(0, 3) === 'key') {
        rect = (e.target as HTMLElement).getBoundingClientRect() as DOMRect
      }
      if (e instanceof HTMLElement) {
        rect = e.getBoundingClientRect() as DOMRect
      }
      if (e instanceof MouseEvent) {
        const el = document.elementFromPoint(
          e.clientX,
          e.clientY,
        ) as HTMLElement
        rect = el.getBoundingClientRect() as DOMRect
      }
      x = adjustX(rect, msgWidth, stick) - 30
      let y = rect.y + window.scrollY

      // position msgEl above the triggering element
      Object.assign(
        msgEl.style,
        {
          position: 'fixed',
          left: `${x}px`,
          top: `${y - 30}px`,
          zIndex: '10',
          pointerEvents: 'auto',
          opacity: '1',
          width: 'max-content',
          padding: '2px 1rem',
          textAlign: 'center',
          backgroundColor: 'aliceblue',
          borderRadius: '5px',
        },
        customStyles,
      )
      setTimeout(() => {
        msgEl.style.opacity = '0'
        disabled = false
      }, 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log('el not found', msg)
    }
  }
</script>

<div bind:this={msgEl} class="msg">
  {message}
</div>

<style lang="scss">
  .msg {
    transition: opacity 0.5s ease-in;
  }
</style>

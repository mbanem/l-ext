import type {
  TEventType,
  THandler,
  THandlers,
  TDragDropHandlers,
  TMap,
} from './event-handler.types'

export const vscode =
  // @ts-expect-error
  typeof acquireVsCodeApi !== 'undefined'
    ? // @ts-expect-error
      acquireVsCodeApi()
    : {
        postMessage: (msg: any) => {
          console.log(`[DEV] ${msg.command} in progress...`)
          setTimeout(() => {
            console.log(
              `${msg.command} is done`,
              msg.payload ?? 'with no payload',
            )
          }, 3000)
        },
      }

// export const handleTryCatch = (err: unknown, info?: string) => {
//   const msg = err instanceof Error ? err.message : String(err)
//   console.log(info, msg)
// }
// src/webview-ui/src/lib/utils/vscode.ts

export interface ConfirmationOptions {
  message: string
  detail?: string
  confirmText?: string
  cancelText?: string
  title?: string
}

export interface ConfirmationResponse {
  confirmed: boolean
  decision: string
  subject?: string
}

/**
 * Shows a modal confirmation dialog from the webview
 */
export function showConfirmation(
  options: ConfirmationOptions,
): Promise<boolean> {
  console.log('get promise showConfirmation options')
  return new Promise((resolve) => {
    const id = `confirm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // The confirmation would be set to both OrmThree (to ignore it) and to the webview (to handle it)
    // The handler should be registered at windows via addEventListener with the `once` option set to true
    // and upon receiving the message with the correct id should be removed and resolve the promise with the confirmation result
    const messageHandler = (event: MessageEvent) => {
      const msg = event.data
      console.log('event-handler.browser got response', msg)

      if (msg.command === 'confirmationResponse' && msg.payload?.id === id) {
        console.log('command name OK', msg.payload.confirmed)
        // though the emitter window would do it we would be removing the listener
        window.removeEventListener('message', messageHandler)
        resolve(msg.payload.confirmed)
      }
    }

    // window.addEventListener('message', messageHandler)
    window.addEventListener('message', messageHandler, { once: true }) // ← use once: true
    vscode.postMessage({
      command: 'showConfirmation',
      payload: {
        id,
        ...options,
      },
    })
  })
}

export const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // ms here is a dummy but required by
      // resolve to send out some value
      resolve(ms)
    }, ms)
  })
}
export function resolveElement(element: HTMLElement | string): HTMLElement {
  if (typeof element === 'string') {
    if ('.#'.includes(element[0])) {
      return document.querySelector(element) as HTMLElement
    }
    if (document.querySelector(`.${element}`)) {
      return document.querySelector(`.${element}`) as HTMLElement
    }
    return document.querySelector(`#${element}`) as HTMLElement
  }
  return element
}

// ✅ Pure factory function
export const createEventHandler = () => {
  let wrapperListeners = new WeakMap<HTMLElement, TMap>()
  let ehHandlersWM = new WeakMap<HTMLElement, THandlers>()
  const wrappers = new Set<HTMLElement>()
  const dropWrappers = new Set<{
    wrapper: HTMLElement
    handlers: TDragDropHandlers
  }>()
  let wrapperEl: HTMLElement

  function matchesQuerySelector(event: MouseEvent) {
    const el = event.target as HTMLElement
    // if it is a wrapper ignore it
    if (wrappers.has(el)) {
      return
    }
    if (el.dataset.eventList) {
      return el.dataset.eventList.split(' ').includes(event.type)
    }
    return false
  }
  function enableDragReorder(element: HTMLElement) {
    const container = resolveElement(element) as HTMLElement
    let draggedEl: HTMLElement
    for (const child of Array.from(container.children) as HTMLElement[]) {
      child.setAttribute('draggable', 'true')
      for (const c of Array.from(child.children) as HTMLElement[]) {
        c.style.pointerEvents = 'none'
      }
    }

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement
      draggedEl = target
      // Optional: add visual feedback
      target.style.opacity = '0.5'
      e.dataTransfer?.setData('text/plain', '') // required for Firefox
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault() // essential!
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      if (!draggedEl) {
        return
      }
      const parent = draggedEl.parentElement as HTMLElement
      const dropTarget = e.target as HTMLElement
      if (parent && parent.ondrop) {
        parent.ondrop(e)
      }
      if (!dropTarget || dropTarget === draggedEl) {
        resetOpacity()
        return
      }
      // Move dragged element before or after drop target
      if (e.shiftKey) {
        dropTarget.after(draggedEl)
      } else {
        container.insertBefore(draggedEl, dropTarget)
      }
      resetOpacity()
    }

    const handleDragEnd = () => {
      resetOpacity()
      // draggedEl = undefined
    }

    const resetOpacity = () => {
      if (draggedEl) {
        draggedEl.style.opacity = ''
      }
    }

    const handlers: TDragDropHandlers = {
      dragstart: handleDragStart,
      dragover: handleDragOver,
      drop: handleDrop,
      dragend: handleDragEnd,
    }
    // Attach listeners
    for (const [eventType, handler] of Object.entries(handlers)) {
      container.addEventListener(eventType as TEventType, handler as THandler)
    }
    return handlers
  }

  return {
    setup(wrapper: HTMLElement | string, eventHandlers?: THandlers) {
      wrapperEl = resolveElement(wrapper) as HTMLElement
      if (!wrapperEl) {
        throw new Error(`Element not found:`)
      }

      // if it is only drag and drop
      if (!eventHandlers) {
        const handls = enableDragReorder(wrapperEl)
        if (handls) {
          dropWrappers.add({ wrapper: wrapperEl, handlers: handls })
        }
        return
      }
      // save wrappers to ignore events on them; include only its children
      wrappers.add(wrapperEl)
      // save all event handlers that the wrapper wants to be handled
      ehHandlersWM.set(wrapperEl, eventHandlers as THandlers)

      // wrapperEl has no listeners registerd yet -- so open a list for them
      if (!wrapperListeners.has(wrapperEl)) {
        wrapperListeners.set(wrapperEl, new Map())
      }

      const eventMap = wrapperListeners.get(wrapperEl)!
      const handlers = ehHandlersWM.get(wrapperEl) as THandlers
      // without filtering additional element DOMStringMap(0) appears; maybe Svelte hydration inserted new line
      for (const child of Array.from(wrapperEl.children) as HTMLElement[]) {
        if (!(child as HTMLElement).dataset.eventList) {
          // continue
          child.setAttribute('data-event-list', 'click mouseover mouseout')
        }
        const eventList = (child as HTMLElement).dataset.eventList as string
        // children have a list of events thay want to listen on
        for (const eventType of eventList.split(' ')) {
          if (handlers[eventType]) {
            if (!eventMap.has(eventType as TEventType)) {
              // create a new event handler for wrapperEl child and its data-event-list events
              const handler = (ehHandlersWM.get(wrapperEl) as THandlers)[
                eventType
              ] as THandler

              const listener = (event: MouseEvent) => {
                event.preventDefault()
                if (wrappers.has(event.target as HTMLElement)) {
                  return
                }
                // when this event occurs check if element is interested in firing on it
                if (matchesQuerySelector(event)) {
                  handler(event)
                }
              }
              // register this event for the wrapper
              eventMap.set(eventType as TEventType, {
                callback: handler,
                listener,
              })
              // add event listener to DOM on wrapper as event will propagate to
              // it but we fire only if event.target is a child intersted in it
              wrapperEl.addEventListener(eventType as TEventType, listener)
            }
          }
        }
      }
    },

    remove(element: HTMLElement | string, eventType: TEventType) {
      console.log('remove', element, eventType)
      const wrapperEl = resolveElement(element)
      const map = wrapperListeners.get(wrapperEl as HTMLElement)

      if (!map || !map.has(eventType)) {
        return
      }

      const { listener } = map.get(eventType)!
      ;(wrapperEl as HTMLElement).removeEventListener(eventType, listener)
      map.delete(eventType)

      if (map.size === 0) {
        wrapperListeners.delete(wrapperEl as HTMLElement)
      }
    },

    destroy() {
      // let ix = 1, iy = 1
      wrappers.forEach((wrapper) => {
        const eventMap = wrapperListeners.get(wrapper as HTMLElement)
        for (const [
          eventType,
          { callback: _, listener: ls },
        ] of eventMap as TMap) {
          ;(wrapper as HTMLElement).removeEventListener(eventType, ls)
          // if (browser) {
          //   localStorage.setItem(`click-over-out${ix++}`, `${eventType} ${wrapper.innerText.slice(0, 20)}`)
          // }
        }
      })
      dropWrappers.forEach((obj) => {
        for (const [eventType, handler] of Object.entries(obj.handlers)) {
          obj.wrapper.removeEventListener(
            eventType as TEventType,
            handler as THandler,
          )
          // if (browser) {
          //   localStorage.setItem(`drag-drop${iy++}`, `${eventType} ${obj.wrapper.innerText.slice(0, 20)}`)
          // }
        }
      })
      wrappers.clear()
      dropWrappers.clear()
      wrapperListeners = new WeakMap<HTMLElement, TMap>()
      ehHandlersWM = new WeakMap<HTMLElement, THandlers>()
    },
  }
}

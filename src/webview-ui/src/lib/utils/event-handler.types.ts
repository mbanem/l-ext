// ✅ Keep type definitions
export const CEvent = {
  click: 'click',
  mouseover: 'mouseover',
  mouseout: 'mouseout',
  dragstart: 'dragstart',
  dragover: 'dragover',
  dragend: 'dragend',
  drop: 'drop',
} as const
export type THandler = (e: MouseEvent) => void
export type THandlers = Record<string, THandler>
export type TDragDropHandlers = Record<string, ((e: DragEvent) => void)>
export type TEventType = typeof CEvent[keyof typeof CEvent]
export type TMap = Map<TEventType, { callback: (event: MouseEvent) => void; listener: (e: MouseEvent) => void }>

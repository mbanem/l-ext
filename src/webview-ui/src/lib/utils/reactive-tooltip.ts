type TStick = 'left' | 'right' | 'above' | 'below';
type TPosition = { x: number; y: number };
type THovered = MouseEvent | HTMLElement | TPosition;

export default class CRTooltip {
  private tooltipEl: HTMLElement | undefined;
  private anchorRect: DOMRect | TPosition | undefined;
  private preferredStick: TStick = 'above';
  private userStyles: Record<string, string> = {};
  private timeout = 3000;
  private onClose?: () => void;
  private scrollHandler?: () => void;
  private autoCloseTimer?: ReturnType<typeof setTimeout>;

  isActive() {
    return this.tooltipEl !== undefined;
  }

  private async fadeOutAndRemove() {
    if (!this.tooltipEl) return;

    this.tooltipEl.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 300));
    this.tooltipEl.remove();
    this.tooltipEl = undefined;
    this.anchorRect = undefined;

    // cleanup listeners
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      window.removeEventListener('resize', this.scrollHandler);
      this.scrollHandler = undefined;
    }
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }
  }

  private updatePosition() {
    if (!this.tooltipEl || !this.anchorRect) return;

    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const gap = 8;

    let x = 0;
    let y = 0;

    if (!('width' in this.anchorRect)) {
      // pure coordinate
      x = this.anchorRect.x + gap;
      y = this.anchorRect.y + gap;
    } else {
      const rect = this.anchorRect as DOMRect;
      const order: TStick[] = ['left', 'above', 'right', 'below'];
      const start = order.indexOf(this.preferredStick);
      const sequence = start === -1 ? order : [...order.slice(start), ...order.slice(0, start)];

      let chosenX = rect.left;
      let chosenY = rect.bottom + gap;

      for (const dir of sequence) {
        let testX = 0;
        let testY = 0;
        let fits = false;

        switch (dir) {
          case 'right':
            testX = rect.right + gap;
            testY = rect.top;
            fits = viewportWidth - rect.right >= tooltipRect.width + gap;
            break;
          case 'left':
            testX = rect.left - tooltipRect.width - gap;
            testY = rect.top;
            fits = rect.left >= tooltipRect.width + gap;
            break;
          case 'below':
            testX = rect.left + rect.width / 2 - tooltipRect.width / 2;
            testY = rect.bottom + gap;
            fits = viewportHeight - rect.bottom >= tooltipRect.height + gap;
            break;
          case 'above':
            testX = rect.left + rect.width / 2 - tooltipRect.width / 2;
            testY = rect.top - tooltipRect.height - gap;
            fits = rect.top >= tooltipRect.height + gap;
            break;
        }

        if (fits) {
          chosenX = testX;
          chosenY = testY;
          break;
        }
        if (dir === this.preferredStick) {
          chosenX = testX;
          chosenY = testY;
        }
      }
      x = chosenX;
      y = chosenY;
    }

    // keep inside viewport
    x = Math.max(8, Math.min(x, viewportWidth - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, viewportHeight - tooltipRect.height - 8));

    Object.assign(this.tooltipEl.style, {
      position: 'fixed',
      top: `${y}px`,
      left: `${x}px`,
      zIndex: '9999',
      borderRadius: '8px',
      border: '1px solid #ccc',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      width: 'auto',
      padding: this.timeout === 0 ? '12px 32px 8px 12px' : '12px 12px 8px 12px',
      transition: 'opacity 0.3s ease, left 0.2s cubic-bezier(0.25, 1, 0.5, 1), top 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
      ...this.userStyles
    });
  }

  private setupTracking() {
    this.scrollHandler = () => {
      if (this.anchorRect && 'left' in this.anchorRect) {
        // if it was an element, we would need a reference to re-getBoundingClientRect
        // for simplicity we only track pure coordinates or initial rect
      }
      this.updatePosition();
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.scrollHandler, { passive: true });
  }

  async show(
    anchor: THovered,
    content: HTMLElement | string,
    timeout = 3000,
    stick: TStick = 'above',
    customStyles: Record<string, string> = {},
    onClose?: () => void
  ) {
    // If this instance is already showing something, close it first
    if (this.tooltipEl) {
      await this.hide();
    }

    this.timeout = timeout;
    this.preferredStick = stick;
    this.userStyles = customStyles;
    this.onClose = onClose;

    // Create element
    if (typeof content === 'string') {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.innerHTML = content
        .split(/,|\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p style="margin:0;padding:0;line-height:1.4">${p}</p>`)
        .join('');
    } else {
      this.tooltipEl = content;
    }

    this.tooltipEl.classList.add('dynamic-tooltip');
    Object.assign(this.tooltipEl.style, { position: 'fixed', opacity: '0' });

    // Resolve anchor
    if (anchor instanceof HTMLElement) {
      this.anchorRect = anchor.getBoundingClientRect();
    } else if (anchor && 'clientX' in anchor) {
      const el = document.elementFromPoint(anchor.clientX, anchor.clientY);
      this.anchorRect = el?.getBoundingClientRect();
    } else {
      this.anchorRect = anchor as TPosition;
    }

    // Close button
    if (timeout === 0) {
      const btn = document.createElement('button');
      btn.innerHTML = '❌';
      btn.setAttribute('aria-label', 'Close');
      Object.assign(btn.style, {
        position: 'absolute',
        top: '6px',
        right: '8px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        opacity: '0.7'
      });
      btn.onclick = (e) => {
        e.stopPropagation();
        this.hide();
      };
      this.tooltipEl.style.paddingRight = '28px';
      this.tooltipEl.appendChild(btn);
    }

    document.body.appendChild(this.tooltipEl);
    this.setupTracking();
    this.updatePosition();

    // Fade in
    this.tooltipEl.offsetHeight;
    this.tooltipEl.style.opacity = '1';

    if (timeout > 0) {
      this.autoCloseTimer = setTimeout(() => this.hide(), timeout);
    }

    return this.tooltipEl;
  }

  async hide() {
    this.onClose?.();
    await this.fadeOutAndRemove();
  }
}
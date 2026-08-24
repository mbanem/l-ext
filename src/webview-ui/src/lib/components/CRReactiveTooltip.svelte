<script lang="ts">
	import { tick } from 'svelte';

	type TStick = 'left' | 'right' | 'above' | 'below';
	type TPos = { x: number; y: number };
	type THovered = MouseEvent | HTMLElement | TPos;
  type TProps = {
    onClose?: ()=>void
  }

  let {onClose}:TProps = $props()

  console.log('[OrmOne] entry point onClose', onClose)
	// Svelte 5 State Trackers
	let tooltipEl = $state<HTMLElement | undefined>(undefined);
	let anchorRect = $state<DOMRect | TPos | undefined>(undefined);
	let preferredStick = $state<TStick>('above');
	let userStyles = $state<Record<string, string>>({});
	let timeout = $state(3000);

	export function isTooltipActive() {
		return tooltipEl !== undefined;
	}

	async function fadeOutAndRemove() {
    console.log('[OrmOne] fadeOutAndRemove entry point')
		if (!tooltipEl) {
      console.log('[OrmOne] fadeOutAndRemove no elementEl')
      return;}
      
      tooltipEl.style.opacity = '0';
      console.log('[OrmOne] fadeOutAndRemove set opacitz to zero')
		await new Promise((resolve) => setTimeout(resolve, 300));
		await tick();
		tooltipEl.remove();
		await tick();
		tooltipEl = undefined;
		anchorRect = undefined; // Reset tracking
	}

	// 1. Isolated core layout position calculator
	function updatePosition() {
		if (!tooltipEl || !anchorRect) return;

		const tooltipRect = tooltipEl.getBoundingClientRect();
		const viewportWidth = document.documentElement.clientWidth;
		const viewportHeight = document.documentElement.clientHeight;

		let x = 0;
		let y = 0;
		const gap = 8;

		if (!('width' in anchorRect) && 'x' in anchorRect && 'y' in anchorRect) {
			x = anchorRect.x + gap;
			y = anchorRect.y + gap;
		} else {
			const rect = anchorRect as DOMRect;
			const baseOrder: TStick[] = ['left', 'above', 'right', 'below'];
			const startIdx = baseOrder.indexOf(preferredStick);
			const reorderedSequence =
				startIdx === -1 ? baseOrder : [...baseOrder.slice(startIdx), ...baseOrder.slice(0, startIdx)];

			let chosenX = rect.left;
			let chosenY = rect.bottom + gap;

			for (const dir of reorderedSequence) {
				let testX = rect.left;
				let testY = rect.top;
				let fits = false;
				const buttonGap = timeout === 0 ? 16 : 16;
				switch (dir) {
					case 'right':
						testX = rect.right + gap;
						testY = rect.top;
						fits = viewportWidth - rect.right >= tooltipRect.width + gap;
						break;
					case 'left':
						testX = rect.left - tooltipRect.width - gap - 2 * buttonGap;
						testY = rect.top;
						fits = rect.left >= tooltipRect.width + gap + 2 * buttonGap;
						break;
					case 'below':
						testX = rect.left + rect.width / 2 - tooltipRect.width / 2;
						testY = rect.bottom + gap;
						fits = viewportHeight - rect.bottom >= tooltipRect.height + gap;
						break;
					case 'above':
						testX = rect.left + rect.width / 2 - tooltipRect.width / 2;
						testY = rect.top - tooltipRect.height - gap - buttonGap;
						fits = rect.top >= tooltipRect.height + gap + buttonGap;
						console.log('above', testX, testY, fits);
						break;
				}

				if (fits) {
					chosenX = testX;
					chosenY = testY;
					break;
				}
				if (dir === preferredStick) {
					chosenX = testX;
					chosenY = testY;
				}
			}
			x = chosenX;
			y = chosenY;
		}

		// Prevent viewport edge clipping
		x = Math.max(8, Math.min(x, viewportWidth - tooltipRect.width - 8));
		y = Math.max(8, Math.min(y, viewportHeight - tooltipRect.height - 8));

		Object.assign(tooltipEl.style, {
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
			padding: '12px 26px 8px 12px',
			// CRITICAL: Added left/top transitions for smooth tracking movement
			transition: 'opacity 0.3s ease, left 0.2s cubic-bezier(0.25, 1, 0.5, 1), top 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
			...userStyles,
		});
	}

	// 2. Svelte 5 Reactive Scroll Tracker
	$effect(() => {
		// Only listen to scrolling if a tooltip is actively mounted
		if (!tooltipEl || !anchorRect) return;

		const handleScroll = () => {
			// If our anchor is a real DOM Element, we must fetch its fresh bounding values on scroll
			if (anchorRect && 'left' in anchorRect && !(anchorRect instanceof MouseEvent)) {
				// We search the DOM for the active element to pull its updated relative coordinates
				const activeEl = document.querySelector('.dynamic-tooltip');
        console.log('[OrmOne] handleScroll el from dynamic-tooltip ', activeEl)
				if (activeEl) {
					anchorRect = activeEl.getBoundingClientRect();
				}
			}
			updatePosition();
		};

		// Passive listener configuration optimizes browser scroll performance
		window.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('resize', handleScroll, { passive: true });

		// Cleanup prevents memory leaks when the tooltip closes
		return () => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', handleScroll);
		};
	});
	let callback: TCallbackFunc;
	// -------------------- SHOW TOOLTIP --------------------------------------
	export async function showTooltip(
		anchor: THovered,
		tooltip: HTMLElement | string,
		timeout_: number = 3000,
		stick: TStick = 'above',
		customStyles: Record<string, string> = {},
	) {
		try {
      if(onClose){
        onClose()
      }
			console.log('[OrmOne] CRReactiveTooltip showTooltip', onClose ? onClose : 'no callback');
			timeout = timeout_;
			if (tooltipEl !== undefined) return;

			// Store configurations into reactive state blocks
			preferredStick = stick;
			userStyles = customStyles;

			if (typeof tooltip === 'string') {
				tooltipEl = document.createElement('div');
				tooltipEl.innerHTML = tooltip
					.split(/,|\n/)
					.map((part) => part.trim())
					.filter(Boolean)
					.map((part) => `<p style="margin:0;padding:0;line-height:1.4">${part}</p>`)
					.join('');
        } else {
          tooltipEl = tooltip;
        }
        tooltipEl.classList.add('dynamic-tooltip');
        console.log('[OrmPne] tooltip got dynamic-tooltip', tooltipEl)

			Object.assign(tooltipEl.style, {
				position: 'fixed',
				opacity: '0',
			});

			// Resolve & tag the anchor element so the scroll listener can track it
			if (anchor instanceof HTMLElement) {
				anchorRect = anchor.getBoundingClientRect();
			} else if (anchor && 'clientX' in anchor) {
				const el = document.elementFromPoint(anchor.clientX, anchor.clientY) as HTMLElement;
				if (el) {
					anchorRect = el.getBoundingClientRect();
					// }
				}
			} else {
				anchorRect = anchor as TPos;
			}

			if (timeout === 0) {
				const closeBtn = document.createElement('button');
				closeBtn.innerHTML = '❌';
				closeBtn.setAttribute('aria-label', 'Close');
				Object.assign(closeBtn.style, {
					position: 'absolute',
					bottom: '10px',
					right: '5px',
					background: 'transparent',
					border: 'none',
					cursor: 'pointer',
					fontSize: '14px',
					lineHeight: '1',
					opacity: '0.7',
				});

				closeBtn.onclick = (e: MouseEvent) => {
					console.log('[OrmOne] CRReactiveTooltip closeBtn.onclick');
					e.stopPropagation();
					// Cleanup our temporary anchor tag class on close
					const el = document.querySelector('.dynamic-tooltip')
          if(el){
            el?.classList.remove('dynamic-tooltip');
            console.log('[OrmPne] tooltip remove dynamic-tooltip', el)
          }
          
					if (tooltipEl){
            console.log('[OrmOne] CRReactiveTooltip calling close');
            hideTooltip();
          }else{
            console.log('[OrmOne] CRReactiveTooltip no tooltipEl');

          }
				};
				tooltipEl.style.paddingRight = '26px';
				tooltipEl.appendChild(closeBtn);
			}

			document.body.appendChild(tooltipEl);

			// Initial paint calculation
			updatePosition();

			tooltipEl.offsetHeight; // Reflow
			tooltipEl.style.opacity = '1';

			if (timeout > 0) {
				setTimeout(() => {
					const el = document.querySelector('.dynamic-tooltip')
          el?.classList.remove('dynamic-tooltip');
          console.log('[OrmPne] tooltip timeout remove dynamic-tooltip', el)
					if (tooltipEl) {
						hideTooltip();
					}
				}, timeout);
			}

			return tooltipEl;
		} catch (err: unknown) {
			console.error('showTooltip failed:', err);
		}
	}

	export async function hideTooltip() {
    console.log('[OrmOne] hideTooltip entry point')
    await fadeOutAndRemove;
    console.log('[OrmOne] hideTooltip after fadeAndRemove')
    if (callback !== undefined){
      console.log('[OrmOne] hideTooltip callback', callback);
      callback();
    }
	}
</script>

<style lang="scss">
	:global(.dynamic-tooltip) {
		width: max-content;
		p {
			padding: 0.5rem 1rem;
			margin: 0;
		}
	}
</style>

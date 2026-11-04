<script lang="ts">
	import { tick } from 'svelte';

	type TStick = 'left' | 'right' | 'above' | 'below';
	type TPos = { x: number; y: number };
	type THovered = MouseEvent | HTMLElement | TPos;

	// Svelte 5 State Trackers
	let tooltipEl = $state<HTMLElement | undefined>(undefined);
	let anchorRect = $state<DOMRect | TPos | undefined>(undefined);
	let preferredStick = $state<TStick>('above');
	let userStyles = $state<Record<string, string>>({});
	let timeout = $state(3000);

	export function isTooltipActive() {
		return tooltipEl !== undefined;
	}

	export async function fadeOutAndRemove(el: HTMLElement) {
		el.style.opacity = '0';
		await new Promise((resolve) => setTimeout(resolve, 300));
		await tick();
		el.remove();
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
				startIdx === -1
					? baseOrder
					: [...baseOrder.slice(startIdx), ...baseOrder.slice(0, startIdx)];

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
			padding: timeout === 0 ? '12px 26px 8px 12px' : '12px 12px 8px 12px',
			// CRITICAL: Added left/top transitions for smooth tracking movement
			transition:
				'opacity 0.3s ease, left 0.2s cubic-bezier(0.25, 1, 0.5, 1), top 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
			...userStyles
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
				const activeEl = document.querySelector('.dynamic-tooltip-anchor');
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

	export async function showTooltip(
		anchor: THovered,
		tooltip: HTMLElement | string,
		timeout_: number = 3000,
		stick: TStick = 'above',
		userStyles: Record<string, string> = {}
	) {
		try {
			timeout = timeout_;
			if (tooltipEl !== undefined) {
				tooltipEl.style.opacity='1'
				return;
			}

			// Store configurations into reactive state blocks
			preferredStick = stick;
			userStyles = userStyles;

			if (typeof tooltip === 'string') {
				tooltipEl = document.createElement('div');
				tooltipEl.className = 'dynamic-tooltip';
				tooltipEl.innerHTML = tooltip
					.split(',')
					.map((part) => part.trim())
					.filter(Boolean)
					.map((part) => `<p style="margin:0;padding:0;line-height:1.4">${part}</p>`)
					.join('');
			} else {
				tooltipEl = tooltip;
			}

			Object.assign(tooltipEl.style, {
				position: 'fixed',
				opacity: '0'
			});

			// Resolve & tag the anchor element so the scroll listener can track it
			if (anchor instanceof HTMLElement) {
				anchor.classList.add('dynamic-tooltip-anchor');
				anchorRect = anchor.getBoundingClientRect();
			} else if (anchor && 'clientX' in anchor) {
				// if (stick === 'above') {
				// 	anchorRect = { x: anchor.clientX, y: anchor.clientY };
				// } else {
				const el = document.elementFromPoint(anchor.clientX, anchor.clientY) as HTMLElement;
				if (el) {
					el.classList.add('dynamic-tooltip-anchor');
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
					fontSize: '13px',
					padding: '0',
					lineHeight: '1',
					opacity: '0.7'
				});

				closeBtn.onclick = (e: MouseEvent) => {
					e.stopPropagation();
					// Cleanup our temporary anchor tag class on close
					document
						.querySelector('.dynamic-tooltip-anchor')
						?.classList.remove('dynamic-tooltip-anchor');
					if (tooltipEl) fadeOutAndRemove(tooltipEl);
				};
				tooltipEl.offsetHeight; // reflow
				tooltipEl.appendChild(closeBtn);
			}

			document.body.appendChild(tooltipEl);

			// Initial paint calculation
			updatePosition();

			tooltipEl.offsetHeight; // Reflow
			tooltipEl.style.opacity = '1';

			if (timeout > 0) {
				setTimeout(() => {
					document
						.querySelector('.dynamic-tooltip-anchor')
						?.classList.remove('dynamic-tooltip-anchor');
					if (tooltipEl) fadeOutAndRemove(tooltipEl);
				}, timeout);
			}

			return tooltipEl;
		} catch (err: unknown) {
			console.error('showTooltip failed:', err);
		}
	}
	export function hide(){
		if(tooltipEl){
			tooltipEl.style.opacity='0'
		}
	}
</script>

<style lang="scss">
	:global(.dynamic-tooltip) {
		width: max-content;
		/*p{
			padding:0;
			margin:0;
		}*/
	}
</style>

<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	export type CBModels = Record<string, HTMLInputElement>;
	export type TProps = {
		userRoles: string[];
		modelName: string;
		models: Models;
		modelsPermissions: (modelName: string, model: Model) => void;
	};
	let { userRoles, modelName, models = $bindable(), modelsPermissions }: TProps = $props();
	// model holds set of selected roles
	const rolesMap = new SvelteMap<string, SvelteSet<string>>();

	// when dropdown is opened set the current selectedModelName
	let selectedModelName = $state('');
	let dropdownEl: HTMLDivElement;
	let wrapperEl: HTMLElement; // Scoped reference to this specific row wrapper

	export function openRolesSelector(targetModelName: string) {
		console.log('openRolesSelector entry point', modelName);
		if (targetModelName !== modelName) return;

		let el = document.getElementById(modelName) as HTMLElement;
		if (!el) return;
		const span = (el.querySelector('.selectedRoles') as HTMLElement) || el;
		roleSelected(span, targetModelName);
	}

	async function roleSelected(el: HTMLElement, model: string) {
		console.log('role selected', model);
		selectedModelName = model;

		if (dropdownEl && wrapperEl) {
			// Position relative to wrapper container bounds
			Object.assign(dropdownEl.style, {
				top: `${wrapperEl.offsetTop + wrapperEl.offsetHeight + 2}px`,
				left: `${wrapperEl.offsetLeft}px`
			});
			dropdownEl.classList.toggle('hidden');
		}
	}
	function toggleRole(e: MouseEvent, model: string, role: string) {
		e.preventDefault();
		let set = rolesMap.get(model);

		if (!set) {
			set = new SvelteSet<string>();
			rolesMap.set(model, set);
		}

		if (set.has(role)) {
			set.delete(role);
		} else {
			set.add(role);
		}
		if (models[modelName]) {
			models[modelName].permissions = [...set].join(' ') as string;
			modelsPermissions(modelName, models[modelName]);
		}
	}
	function hideDropdown(e: MouseEvent) {
		e.preventDefault();
		(e.target as HTMLElement).classList.add('hidden');
	}
</script>

{#snippet multiSelect(model: string)}
	{@const selected = rolesMap.get(model) ?? new SvelteSet()}

	<!-- Scoped wrapper bound directly to this instance -->
	<section
		id={model}
		bind:this={wrapperEl}
		class="select-wrapper"
		role="presentation"
		onclick={(e: MouseEvent) => {
			e.preventDefault();
			const target = e.target as HTMLElement;
			if (target.classList.contains('selectedRoles') || target.closest('.role-list')) {
				roleSelected(target, modelName);
			}
		}}
		onmouseover={(e) => e.preventDefault()}
		onfocus={() => {}}
	>
		<!-- selected roles block list TODO onmouseleave={dismiss}-->
		<div class="role-list" role="presentation" data-model={modelName}>
			<!-- ERROR {@const selected = rolesMap.get(modelName) ?? new SvelteSet()} -->
			{#if selected.size}
				{#each [...selected] as role (role)}
					<span class="badge">
						{role[0]}
					</span>
				{/each}
			{:else}
				<span class="selectedRoles">permissions</span>
			{/if}
		</div>
	</section>
{/snippet}

<!-- select roles dropdown block list scoped for this instance -->
<div
	bind:this={dropdownEl}
	class="dropdown hidden"
	onclick={(e: MouseEvent) =>
		toggleRole(e, selectedModelName, (e.target as HTMLElement)?.innerText.slice(2))}
	onmouseleave={hideDropdown}
	role="presentation"
>
	{#each userRoles as role (role)}
		<p class:selected={rolesMap.get(selectedModelName)?.has(role)}>
			<span class="letter">
				{role[0]}
			</span>
			{role}
		</p>
	{/each}
</div>
{@render multiSelect(modelName)}

<style lang="scss">
	*,
	*::before {
		box-sizing: border-box;
	}
	.select-wrapper {
		position: relative;
		top: -1rem;
		left: 7rem;
		width: 6rem;
		user-select: none;
		.role-list {
			display: flex;
			gap: 4px;
			width: 100%;
			line-height: 10px;
			height: 1rem;
			color: var(--badge-color);
			background-color: var(--badge-bg-color);
			border: 1px solid gray;
			border-radius: 4px;
			z-index: 20;
			.badge {
				display: inline-block;
				font-size: 11px;
				line-height: 16px;
				color: var(--badge-color);
				background-color: var(--badge-bg-color);
				border: 1px solid gray;
				border-radius: 4px;
				padding: 0 2px;
				pointer-events: none;
			}
			.selectedRoles {
				display: inline-block;
				text-align: center;
				width: 8rem;
				cursor: pointer;
			}
		}
	}
	.selected {
		opacity: 0.5;
	}
	.dropdown {
		position: absolute;
		/*top: 3rem;*/
		left: 14rem !important;
		left: 0;
		width: 7rem;
		padding: 4px 0;
		border: 1px solid gray;
		border-radius: 6px;
		color: var(--candidate-color);
		background-color: var(--candidate-bg-color);
		cursor: pointer;
		user-select: none;
		z-index: 20;
		p {
			padding: 2px 1rem;
			font-size: 10px;
			margin: 0 0 0 4px;
			padding: 1px 0;
			/*color: var(--clickable-label-color);
			background-color: var(--candidate-bg-color);*/
			&:hover {
				width: 93%;
				color: var(--drop-color);
				background-color: var(--drop-bg-color);
			}
		}
		.letter {
			font-size: 11px;
			border: 1px solid gray;
			border-radius: 4px;
			padding: 0 4px;
			pointer-events: none;
		}
	}

	.hidden {
		display: none;
	}
</style>

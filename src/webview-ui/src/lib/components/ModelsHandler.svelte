<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { capitalize, stringToFieldObject } from '$lib/utils';
	// import Tooltip from '$lib/components/CReactiveTooltip.svelte';
	import Tooltip from '$lib/utils/reactive-tooltip-old';
	import ModelPermissions from '$lib/components/CRModelsPermissions.svelte';

	let tooltip: Tooltip = new Tooltip();
	// Track child component references per model name
	// when click on a modelname checkbox call openRolesSelector method on userRolesEls[modelName]
	let userRolesEls = $state<Record<string, ReturnType<typeof ModelPermissions>>>({});
	// export type CBModels = Record<string, HTMLInputElement>;
	export type TProps = {
		models: Models;
		selectedModels: SelectedModels;
		isLoading: boolean;
		userRoles: string[];
		appName: string;
	};

	let {
		models = $bindable({}),
		selectedModels = $bindable({}),
		isLoading = $bindable(false),
		userRoles = [],
		appName
	}: TProps = $props();

	let cbGroup = $state<string[]>([]);
	let rbGroup = $state('');
	let openModelName = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;

	let tooltipBlockEl = $state<HTMLDivElement>();
	let emptyModel: Model = { fields: [], attrs: [] };
	let includeAll = 'All';
	let newModelName = $state('');
	let extraModels = new SvelteSet<string>();
	let extraModelsSize = $derived([...extraModels].length);
	let notDataEntryEl: HTMLDivElement;
	let modelWrapperEl = $state<HTMLDivElement>();
	let hoveredEl = $state<HTMLElement | null>(null);
	let noCopyAllowed = $derived.by(() => {
		if (hoveredEl !== null) {
			return hoveredEl.dataset.entry === 'false' && !/password/i.test(hoveredEl.innerText);
		}
		return false;
	});

	let tooltipMessage = $state('not data entry field');
	const defaultMessage = 'Add/Remove extra model like Login, Admin,...';
	const alreadyDefined = 'Module is already registered';
	const notRegistered = 'Module is not registered yet';
	const noModelName = 'Please enter model name';
	const toBeRenamed = 'to be renamed into password at UI';
	let message = $state(defaultMessage);
	let messageColor = $derived(message === defaultMessage ? '' : 'color:tomato;');
	const nuiRegex = new RegExp(`\\b@id|@defaults|@unique\\b`, 'g');

	// function callback() {
	// 	let perms: string = '';
	// 	if (models) {
	// 		for (const [k, v] of Object.entries(models)) {
	// 			if (v.permissions) {
	// 				perms += `\n ${k}: ${v.permissions}; `;
	// 			}
	// 		}
	// 	}
	// }

	const childCallingParent = (msg: string) => {
		g.innerText = msg;
	};

	export const modelsPermissions = (modelName: string, model: Model) => {
		console.log('ModelHandler.svelte modelsPermissions called', modelName, model.permissions);
		// 	modelName,
		// 	model.permissions,
		// 	cbGroup
		// );
		if (model.permissions) {
			if (!selectedModels.has(modelName)) {
				selectedModels.set(modelName, model);
			}
		} else {
			selectedModels.delete(modelName);
		}
		// if (models[modelName]) {
		// 	models[modelName].permissions = model.permissions;
		// }
		const cb = modelWrapperEl?.querySelector(
			`input[type=checkbox][value=${modelName}]`
		) as HTMLInputElement;
		cb.checked = model.permissions !== '';
	};
	export const exportModels = async (e?: Event) => {
		if (e?.type === 'click') {
			e.preventDefault();
			const cb = e.target as HTMLInputElement;
			const modelName = cb.value;
			let model: Model;
			if ((model = models[modelName] as Model)) {
				// console.log('model found', model, model.permissions);
				if (!model.permissions) {
					await tick();
					cb.checked = false;
					await tick();
					if (userRolesEls[modelName]) {
						// console.log('calling openRolesSelector', userRolesEls[modelName].openRolesSelector);
						userRolesEls[modelName].openRolesSelector(modelName);
					}
				}
			}
			await tick();
			// console.log('click event', cb.checked, modelName);
			return;
		}
		selectedModels = {};
		await tick();
		for (const modelName of cbGroup) {
			// console.log('loop', modelName);
			const routeInput = modelWrapperEl?.querySelector(`#route${modelName}`) as HTMLInputElement;
			const routeName = routeInput?.value ?? modelName.toLowerCase();
			const permissions = models[modelName]?.permissions as string;
			if (!selectedModels[routeName]) {
				selectedModels[routeName] = {};
				(selectedModels[routeName] as SelectedModel)[modelName] = {
					routeName,
					permissions
				};
			}
		}
		// for (const [k, v] of Object.entries(selectedModels)) {
		// 	console.log(k, v);
		// }
	};

	function fieldAttrsClass(field: Field) {
		return nuiRegex.test(field.attrs as string) ? 'attr-id' : '';
	}

	function fieldAttrs(field: Field) {
		return field.attrs ?? 'no attributes';
	}

	function getUIField(modelName: string, fieldName: string) {
		return models[modelName]?.fields.find((field) => field.name === fieldName) as Field;
	}

	let previousEl = $state<HTMLElement>();

	// Declarative hover handler for field copy tooltip
	async function showCopyFieldTooltip(e: MouseEvent, modelName: string) {
		e.preventDefault();
		if (!extraModelsSize) return;

		const el = e.currentTarget as HTMLElement;
		if (!el) return;
		hoveredEl = el;

		const dataset = el.dataset;
		if (dataset.entry === 'false' && !/password/i.test(el.innerText)) {
			if (tooltipBlockEl) tooltipBlockEl.style.opacity = '0';
			return;
		}

		if (previousEl) {
			previousEl.style.color = '';
		}
		el.style.color = 'tomato';
		previousEl = el;

		const rect = el.getBoundingClientRect();
		const x = rect.right - 45;
		const y = rect.top - 12;

		if (!extraModels.has(modelName) && tooltipBlockEl) {
			Object.assign(tooltipBlockEl.style, {
				position: 'fixed',
				top: `${y}px`,
				left: `${x}px`,
				zIndex: '9999',
				pointerEvents: 'auto',
				opacity: '1',
				cursor: 'pointer'
			});
		}
	}

	function hideCopyFieldTooltip() {
		if (previousEl) {
			previousEl.style.color = '';
		}
	}

	function showInputMessage(msg: string, milisec: number = 2000) {
		message = msg;
		setTimeout(() => {
			message = defaultMessage;
		}, milisec);
	}

	async function addNewModel(e: MouseEvent | KeyboardEvent | undefined) {
		if (e) {
			e.preventDefault();
			if (e instanceof KeyboardEvent && e.key !== 'Enter') return;
			if (tooltipBlockEl) tooltipBlockEl.style.opacity = '0';
		}

		const capName = capitalize(newModelName);
		if (!capName) return;

		if (models[capName]) {
			showInputMessage(alreadyDefined);
			return;
		}
		await tick();

		extraModels.add(capName);
		models = {
			...models,
			[capName]: emptyModel
		};

		newModelName = '';
		if (Object.keys(selectedModels).length > 0) {
			exportModels();
		}
	}

	async function deleteModel(e: MouseEvent, targetModelName: string) {
		tooltip.show(e, `Model "${targetModelName}" to be removed.`, 2000, 'above', {
			color: 'crimson',
			backgroundColor: '#fff0f0',
			border: '1px solid crimson'
		});
		const confirmed = true;
		if (confirmed) {
			delete models[targetModelName];
			setTimeout(() => {
				exportModels();
			}, 400);
		}
	}

	async function removeModel(e: MouseEvent) {
		const capName = capitalize(newModelName);
		if (!capName) {
			showInputMessage(noModelName);
			return;
		}
		if (!models[capName]) {
			showInputMessage(notRegistered);
			return;
		}
		await deleteModel(e, capName);
		setTimeout(() => {
			exportModels();
		}, 400);
	}

	function removeExtraModelField(e: MouseEvent, modelName: string) {
		e.preventDefault();
		const el = e.target as HTMLElement;
		if (el.dataset.extra === 'false') return;

		const fieldName = el.innerText;
		const model = models[modelName];
		if (!model || !model.fields) return;

		model.fields = model.fields.filter((field) => field.name !== fieldName);
		if (notDataEntryEl!) notDataEntryEl.style.opacity = '0';
		if (Object.keys(selectedModels).length > 0) {
			exportModels();
		}
	}

	async function addExtraModels() {
		const modelNames = ['login', 'admin', 'customer'];
		for (const model of modelNames) {
			newModelName = model;
			await tick();
			addNewModel(undefined);
			await tick();
		}
	}

	onMount(() => {
		setTimeout(() => {
			addExtraModels();
		}, 500);
	});

	async function handleRadioSelect(e: Event, selectedModel: string, activeModelName: string) {
		if (!selectedModel || !hoveredEl) return;

		const target = e.target as HTMLInputElement;
		rbGroup = selectedModel;

		if (tooltipBlockEl) tooltipBlockEl.style.opacity = '0';
		if (previousEl) previousEl.style.color = '';

		try {
			const fieldName = hoveredEl.innerText.trim();
			const field = getUIField(activeModelName, fieldName);

			if (field) {
				if (/password/i.test(field.name)) {
					if (!field.attrs?.includes(toBeRenamed)) {
						field.attrs += `\n${toBeRenamed}`;
						await tick();
					}
				}
				const targetModels = rbGroup === includeAll ? Array.from(extraModels) : [rbGroup];

				for (const m of targetModels) {
					if (models[m]) {
						const exists = models[m].fields.some((f) => f.name === field.name);
						if (!exists) {
							models[m].fields = [...models[m].fields, { ...field }];
							await tick();
						}
					}
				}
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error('addFieldToModel error:', msg);
		} finally {
			rbGroup = '';
			if (target) target.checked = false;
			if (Object.keys(selectedModels).length > 0) exportModels();
		}
	}

	function willBeRouteName(e: MouseEvent) {
		const val = (e.target as HTMLInputElement).value;
		if (e.type === 'mouseenter') {
			clearTimeout(timer as NodeJS.Timeout);
			timer = setTimeout(() => {
				tooltip.show(e, `Route Name,${appName}/src/routes/<b>${val}</b>`, 3000, 'above', {
					color: 'navy',
					border: '1px solid gray',
					backgroundColor: '#f1f1f1',
					padding: '2px 5px'
				});
			}, 700);
		} else if (e.type === 'mouseleave') {
			tooltip.hide();
		}
	}
</script>

<!-- <button onclick={()=> userRolesEl.openRolesSelector()}>call openRolesSelector</button> -->
{#snippet tooltipBlock(activeModelName: string)}
	<div>
		{#each extraModels as model (model)}
			<label>
				<input
					type="radio"
					name="extraModelRadio"
					value={model}
					onchange={(e) => handleRadioSelect(e, model, activeModelName)}
				/>
				{model}
			</label>
		{/each}
		{#if extraModelsSize >= 2}
			<label>
				<input
					type="radio"
					name="extraModelRadio"
					value={includeAll}
					onchange={(e) => handleRadioSelect(e, includeAll, activeModelName)}
				/>
				{extraModelsSize === 2 ? 'Both' : includeAll}
			</label>
		{/if}
	</div>
{/snippet}

<div bind:this={tooltipBlockEl} class="radio-tooltip">
	{#if openModelName}
		{@render tooltipBlock(openModelName)}
	{/if}
</div>
<div bind:this={notDataEntryEl} class="no-data-entry">
	{tooltipMessage}
</div>

{#snippet permissions(modelName: string)}
	<ModelPermissions
		bind:this={userRolesEls[modelName]}
		{userRoles}
		bind:models
		{modelName}
		{modelsPermissions}
		{childCallingParent}
	/>
{/snippet}

{#snippet summaryDetailsModel(modelName: string, ix: number)}
	{@const modely = models[modelName] as Model}
	<div style="position:relative;">
		<input
			type="text"
			id="route{modelName}"
			value={modelName.toLowerCase()}
			onchange={exportModels}
			onmouseenter={willBeRouteName}
			onmouseleave={() => {
				clearTimeout(timer as NodeJS.Timeout);
				tooltip.hide();
			}}
			style="position:absolute;top:0;left:4px;color:var(--candidate-color);background-color:var(--candidate-bg-color);width:5rem;height:1rem;padding:0 0 0 5px;margin:4px 0 0 0;border:none;font-size:14px;"
		/>
		<input
			type="checkbox"
			style="position:absolute;top:0;left:6rem;"
			value={modelName}
			bind:group={cbGroup}
			class="model-checkboxes"
			onclick={exportModels}
		/>
		<details
			open={openModelName === modelName}
			ontoggle={(e) => {
				const det = e.target as HTMLDetailsElement;
				if (det.open) {
					openModelName = modelName;
				} else if (openModelName === modelName) {
					openModelName = null;
					hideCopyFieldTooltip();
				}
			}}
			class="model-details"
		>
			<summary class="cr-model-name">
				{capitalize(modelName)}
				{@render permissions(modelName)}
			</summary>

			<div
				class="cr-fields-column"
				onclick={(e) => removeExtraModelField(e, modelName)}
				aria-hidden={true}
			>
				{#if extraModels.has(modelName)}
					<p class:remove-field={openModelName === modelName}>click field name to remove</p>
				{/if}
				{#each modely.fields as field (field.name)}
					{@const attrClass = fieldAttrsClass(field)}
					<section
						// style:cursor={noCopyAllowed ? 'not-allowed !important' : 'pointer'}
						class:nui-field={noCopyAllowed}
						data-entry={field.isDataEntry}
						data-extra={extraModels.has(modelName)}
						onmouseenter={(e) => showCopyFieldTooltip(e, modelName)}
						onmouseleave={hideCopyFieldTooltip}
						aria-hidden={true}
					>
						{field.name}
					</section>
					<p style="white-space: pre-line;">
						type:{field.type} <span class={attrClass}>{fieldAttrs(field)}</span>
					</p>
				{/each}
			</div>
			<div>
				{#each modely.attrs as attr (attr)}
					<p class="cr-model-attr">{attr}</p>
				{/each}
			</div>
		</details>
	</div>
{/snippet}

{#snippet summaryDetailsModels()}
	<div bind:this={modelWrapperEl} class="model-wrapper">
		{#each Object.entries(models) as [modelName], ix (modelName)}
			{@render summaryDetailsModel(modelName, ix)}
		{/each}
	</div>
{/snippet}

<div class="container">
	<div class="schema-container">
		<p class="orm-models-caption">ORM Models -- and Route Names</p>
		<!-- <p class="select-all" onclick={toggleSelectAllModels} aria-hidden={true}>(select all)</p> -->
		<div bind:this={modelWrapperEl} class="model-wrapper">
			{#if isLoading}
				<div class="spinner-wrapper">
					<span class="spinner"></span><span>Loading models...</span>
				</div>
			{/if}
			{#if !isLoading && Object.keys(models).length > 0}
				{@render summaryDetailsModels()}
			{/if}
		</div>
	</div>
	<div class="add-extra-model">
		<span class="main-class" style={messageColor}>{message}</span>
		<input
			type="text"
			bind:value={newModelName}
			onkeyup={addNewModel}
			placeholder="Add extra model"
		/>
		<button onclick={addNewModel} disabled={!newModelName}>add</button>
		<button onclick={removeModel} disabled={!newModelName}>remove</button>
	</div>
</div>

<style lang="scss">
	*,
	*::before {
		box-sizing: border-box;
		user-select: none;
	}

	input[type='text'] {
		width: 93%;
		height: 20px;
		padding: 6px 0 8px 1rem;
		outline: none;
		font-size: 16px;
		border: 1px solid gray;
		border-radius: 4px;
		outline: 1rem solid transparent;
		margin-top: 8px;
		margin-bottom: 10px;
		&::placeholder {
			font-size: 13px;
		}
		&:focus {
			outline: 1px solid gray;
		}
	}
	.container {
		width: 23rem;
		margin-top: 1rem;
		height: 39.7rem;
		.schema-container {
			position: relative;
			width: 22.8rem;
			height: 35.9rem;
			border: 1px solid gray;
			border-radius: 6px;
			padding: 1rem 0 0 3px;
			.model-wrapper {
				width: 22rem;
				padding: 0;
				margin: 0;
				height: 34.4rem;
				z-index: 15;
				overflow-y: auto;
				scrollbar-width: none;
				overflow-x: hidden;
			}
		}
	}
	.spinner-wrapper {
		display: grid;
		grid-template-columns: 1em 10rem;
		column-gap: 0.5rem;
	}
	.spinner {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 0.8em;
		height: 0.8em;
		border: 3px solid #a1c1eb;
		border-top-color: #1b4891;
		border-radius: 50%;
		margin: 4px 0 0 0.5rem;
		animation: spin 900ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.add-extra-model {
		width: 100%;
		color: var(--candidate-color);
		background-color: var(--candidate-bg-color);
		margin: 6px 0 0 0;
		opacity: 1;
		input {
			width: 65.5% !important;
			font-size: 14px;
			color: var(--candidate-color);
			background-color: var(--candidate-bg-color);
		}
		button {
			width: 3.5rem;
			padding: 0;
			margin-right: 4px;
			&:last-of-type {
				margin-right: 0;
			}
		}
	}
	.tomato {
		color: tomato;
	}
	.navy {
		color: navy;
	}

	.model-details {
		width: 21.5rem;
	}
	.nui-field {
		cursor: not-allowed !important;
	}
	.orm-models-caption,
	.select-all {
		position: absolute;
		top: -1.6rem;
		left: 1rem;
		z-index: 10;
		padding: 0 5px;
		color: var(--candidate-color);
		background-color: var(--panel-bg-color);
	}
	.select-all {
		left: 16rem;
		width: 5rem;
		cursor: pointer;
		&:hover {
			border: 1px solid var(--candidate-color);
			border-radius: 4px;
		}
	}

	.cr-model-attr {
		grid-column: span 2;
		width: 18rem;
		padding: 0;
		margin: 0 0 0 2rem;
		text-wrap: wrap;
		color: tomato;
		font-size: 13px;
	}
	.cr-model-name {
		color: var(--summary-color);
		background-color: var(--summary-bg-color);
		margin: 3px 9px 0 0;
		width: 21.5rem;
		border-radius: 6px;
		padding-left: 8rem;
		height: 1.6rem;
		cursor: pointer;
	}
	.remove-field {
		position: absolute;
		top: 0;
		left: 12.7rem;
		color: red;
		background-color: cornsilk !important;
		font-size: 13px;
		font-style: italic;
		padding: 0 !important;
		margin: 0 !important;
		height: 0.8rem;
		line-height: 0.8rem;
	}

	.cr-fields-column {
		position: relative;
		display: grid;
		grid-template-columns: 7rem 9.5rem;
		column-gap: 5px;
		width: 21.5rem;
		padding: 6px 0 6px 1rem;
		max-height: 75vh;
		font-size: 14px;
		font-weight: 400;
		color: var(--candidate-color);
		background-color: var(--candidate-bg-color);
		cursor: pointer;
	}

	.cr-fields-column p {
		margin: 4px 0 0 0;
		padding: 1px 0 1px 6px;
		text-wrap: wrap;
	}

	.cr-fields-column p:nth-child(odd) {
		cursor: pointer;
		width: max-content;
		padding: 4px 1rem;
	}

	.cr-fields-column p:nth-child(even) {
		font-weight: 400 !important;
		font-size: 12px !important;
		color: var(--model-name);
		span {
			display: block;
			margin-left: 1rem;
			color: var(--pink-tomato);
		}
	}

	.pink-tomato {
		color: var(--pink-tomato);
	}
	.attr-id {
		color: var(--attr-id);
	}

	.model-checkboxes {
		color: navy;
		padding: 0 1rem 0 0;
		margin-left: 0;
		cursor: default !important;
	}
	details {
		width: 22rem;
	}
	details:last-of-type[open]::details-content {
		width: 21.5rem;
		background-color: #f0f0f0;
		border-bottom-left-radius: 8px;
		border-bottom-right-radius: 8px;
	}
	details:last-of-type[open] summary {
		background-color: var(--summary-bg-color);
	}
	.radio-tooltip {
		opacity: 0;
		position: fixed;
		top: 30rem;
		left: 30rem;
		z-index: 10;
		display: flex;
		column-gap: 2px;
		pointer-events: auto;
		border: 6px solid transparent;
		padding: 4px 0.5rem 1px 5px;
		color: var(--candidate-color);
		background-color: var(--candidate-bg-color);
		label,
		input {
			cursor: pointer !important;
		}
	}
	.no-data-entry {
		position: fixed;
		top: 30rem;
		left: 30rem;
		opacity: 0;
		color: var(--pink-tomato);
		background-color: var(--candidate-bg-color);
		width: max-content;
		padding: 2px 0.5rem;
		border: 1px solid gray;
		border-radius: 5px;
		z-index: 10;
	}
	.main-class {
		color: var(--pre-color);
	}
</style>

<script module lang="ts">
	export const error = (err: string) => {};
</script>

<script lang="ts">
	//  components/CRInput.svelte
	import { browser } from '$app/environment';
	import * as utils from '$lib/utils';
	import { onMount } from 'svelte';
	type TExportValueOn = 'keypress' | 'keypress|blur' | 'enter' | 'blur' | 'enter|blur';
	type TInputType =
		| string
		| number
		| Date
		| boolean
		| 'password'
		| 'time'
		| 'text'
		| 'tel'
		| 'range'
		| 'radio'
		| 'checkbox'
		| 'textarea';
	type PROPS = {
		title: string;
		width?: string;
		height?: string;
		fontsize?: string;
		margin?: string;
		type?: TInputType;
		rows?: string;
		cols?: string;
		value?: string | number;
		required?: boolean;
		capitalize?: boolean;
		err?: string[] | null;
		// onButtonNext?: (() => void) | undefined;
		exportValueOn?: TExportValueOn;
		onInputIsReadyCallback?: () => void; // call parent when onInputIsReadyCallback for 'enter', otherwise on every key
		clearOnInputIsReady?: boolean; // clear input value on onInputIsReadyCallback
	};

	let {
		title,
		width = '16rem',
		height = '2.5rem',
		fontsize = '16px',
		margin = '0',
		type = 'text',
		rows = '6',
		cols = '30',
		value = $bindable(),
		required = false,
		err,
		// onButtonNext = undefined,
		exportValueOn = 'enter',
		onInputIsReadyCallback = undefined,
		capitalize = false,
		clearOnInputIsReady = false,
	}: PROPS = $props();
	function required_() {
		return required;
	}
	function title_() {
		return title;
	}
	let elId = utils.sixHash();
	const labelUp = 'opacity:1;top:3px;z-index:10;';
	const labelDown = 'opacity:0.5;top:25px;z-index:10;';

	// words separated by space or underscore
	export const capitalizes = (str: string) => {
		if (!str) return;
		str = str.replace(/_/gm, ' ').trim();
		let s = (str[0] as string)?.toUpperCase() + str.slice(1);
		return s.replace(/\s+[a-z](?=[a-z]{2})/g, (char: string) => char.toUpperCase());
	};

	// @ts-expect-error this is not defined
	String.prototype.capitalizes = function (this: string) {
		return capitalizes(this);
	};
	// NOTE: enter non breaking unicode space:
	// Press Ctrl+Shift+U, type 00a0, and then press Enter or Space.
	// here we held between apostrophes three non breaking spaces
	title = '  ' + capitalizes(title) + '  ';
	let requiredStr = required_() ? `${title_()} is required` : '';

	(function () {
		// IIFE
		exportValueOn = exportValueOn.toLowerCase() as TExportValueOn;
		// make combination be with 'enter|blur' and 'keypress|blur' if inverted
		const parts = exportValueOn.split('|');
		if (parts.length > 1 && parts[0] === 'blur') {
			exportValueOn = `${parts[1]}|${parts[0]}` as TExportValueOn;
		}
	})();
	const topPosition = `${-1 * Math.floor(parseInt(fontsize) / 3)}px`;

	if (browser) {
		try {
			utils.setCSSValue('--INPUT-BOX-LABEL-TOP-POS', topPosition);
			if (width) utils.setCSSValue('--INPUT-COMRUNNER-WIDTH', width as string);
			if (height) utils.setCSSValue('--INPUT-COMRUNNER-HEIGHT', height as string);
			if (fontsize) utils.setCSSValue('--INPUT-COMRUNNER-FONT-SIZE', fontsize as string);
			width = utils.getCSSValue('--INPUT-COMRUNNER-WIDTH') as string;
		} catch (err) {
			console.log('<InputBox get/setCSSValue', err);
		}
	}

	const onFocusHandler = (event: FocusEvent) => {
		event.preventDefault();
		labelStyle = labelUp;
	};

	const onBlurHandler = (event: FocusEvent) => {
		event.preventDefault();

		// no entry yet so no export is ready buy is dirty -- only handle placeholder if entry is required
		if (value === '') {
			// input is required so warn the user with pink placeholder required message
			if (required) {
				inputEl.placeholder = requiredStr;
				labelStyle = labelUp;
				utils.setPlaceholderColor('pink');
			} else {
				// input is not required so lower down field label inside the input box
				labelStyle = labelDown;
			}
		}
		if (capitalize && value) {
			value = utils.capitalize(value as string) ?? '';
		}
		if (exportValueOn.includes('blur')) {
			if (onInputIsReadyCallback) {
				onInputIsReadyCallback();
			}
		}
	};
	const onKeyUpHandler = (event: KeyboardEvent) => {
		event.preventDefault();
		labelStyle = labelUp;
		if (event.key === 'Tab') return;

		if (value && (value as string).length > 0) {
			if (exportValueOn.includes('keypress') || (exportValueOn.includes('enter') && event.key === 'Enter')) {
				value = capitalizes(value as string) ?? '';
				if (onInputIsReadyCallback) {
					onInputIsReadyCallback();
					if (clearOnInputIsReady) {
						value = '';
					}
				}
			}
		}
	};

	// input box has a label text instead of a placeholder in order to
	// move it up on focus, but the text does not set focus on input
	// element on click -- so we have to set the focus when the label
	// text is selected
	let labelStyle = $state(labelDown);
	let label: HTMLLabelElement;
	let inputEl: HTMLInputElement | HTMLTextAreaElement;
	// in order to compare inputEl with document.activeElement
	// document.getElementById(inputEl.boxId()) gets wrapped input box
	// otherwise idEl is a wrapper reference never equal to doc.activeElement
	export const boxId = () => {
		return inputEl.id;
	};

	export const getInputBoxValue = () => {
		return typeof value === 'number' ? Number(inputEl.value) : String(inputEl.value);
	};
	// parent call to set input box value
	export const setInputBoxValue = (str: string, blur: boolean = false) => {
		if (blur) {
			setTimeout(() => {
				inputEl.blur();
			}, 1000);
		}
		inputEl.focus();
		value = str;
	};

	export const setFocus = () => {
		labelStyle = value && required ? labelUp : labelDown;
	};

	$effect(() => {
		if (required) {
			inputEl.removeAttribute('required');
			// } else {
			//   inputEl.setAttribute('required', 'true');
		}
		labelStyle = value ? labelUp : labelDown;
	});

	onMount(() => {
		label = document.getElementsByTagName('label')[0] as HTMLLabelElement;
		// if (required) {
		//   inputEl.setAttribute('required', 'true');
		// } else {
		inputEl.removeAttribute('required');
		// }
	});
</script>

<div class="input-wrapper" style="margin:{margin};">
	{#if type === 'textarea'}
		<textarea
			id={elId}
			bind:this={inputEl}
			rows={Number(rows)}
			cols={Number(cols)}
			bind:value
			onkeyup={onKeyUpHandler}
			onfocus={onFocusHandler}
			onblur={onBlurHandler}
			disabled={false}
		>
		</textarea>
	{:else}
		<input
			id={elId}
			bind:this={inputEl}
			type={type ? type : 'text'}
			bind:value
			onkeyup={onKeyUpHandler}
			onfocus={onFocusHandler}
			onblur={onBlurHandler}
			disabled={false}
		/>
	{/if}
	<label for={elId} onclick={setFocus} aria-hidden={true} style={`${labelStyle}`}>
		{title}
		<span class="err">
			{err ? ` - ${err}` : ''}
		</span>
	</label>
</div>

<style lang="scss">
	:root {
		--INPUT-COMRUNNER-WIDTH: 16rem;
		--INPUT-BOX-LABEL-TOP-POS: -1px;
		--INPUT-COMRUNNER-HEIGHT: 2rem !important;
		--INPUT-COMRUNNER-FONT-SIZE: 16px;
		// --BACKGROUND-COLOR: white;
	}

	.input-wrapper {
		position: relative;
		width: max-content;
		/* adjust label to look like placeholder */
		padding-top: 0.8rem;
		label {
			position: absolute;
			left: 15px;
			font-size: var(--INPUT-COMRUNNER-FONT-SIZE);
			color: var(--INPUT-COLOR);
			background-color: var(--BACKGROUND-COLOR);
			transition: 0.5s;
		}
		textarea {
			outline: none;
			background-color: var(--BACKGROUND-COLOR);
			border: 1px solid gray;
		}
		input {
			display: inline-block;
			width: var(--INPUT-COMRUNNER-WIDTH);
			height: var(--INPUT-COMRUNNER-HEIGHT);
			font-size: var(--INPUT-COMRUNNER-FONT-SIZE);
			padding: 0 10px;
			margin: 0;
			outline: none;
			color: var(--TEXT-COLOR);
			border: 1px solid gray;
			background-color: var(--BACKGROUND-COLOR);
			&:focus {
				color: var(--INPUT-FOCUS-COLOR);
			}
			&:focus ~ label,
			&:valid ~ label {
				top: var(--INPUT-BOX-LABEL-TOP-POS);
				font-size: var(--INPUT-COMRUNNER-FONT-SIZE);
				opacity: 1;
			}
		}
	}

	.err {
		color: pink;
		/* when placeholder moves on top it makes space on the right of 0.2rem*/
		padding: 1px 0.2rem;
	}
</style>

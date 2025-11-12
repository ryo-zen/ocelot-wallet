/**
 * MCP Utility Functions
 * Shared utilities for framework detection and smart DOM interactions
 */

/**
 * Detect which frontend framework is being used
 */
export function detectFramework(): 'svelte' | 'react' | 'vue' | 'vanilla' {
	// Check for Svelte
	if (window.__SVELTE__ || document.querySelector('[data-svelte-h]')) {
		return 'svelte';
	}

	// Check for React
	const reactRoot = document.querySelector('[data-reactroot], #root, #__next');
	if (reactRoot && (reactRoot as any)._reactRootContainer) {
		return 'react';
	}

	// Check for Vue
	if ((window as any).__VUE__ || document.querySelector('[data-v-]')) {
		return 'vue';
	}

	return 'vanilla';
}

/**
 * Find element using multiple selector strategies
 */
export function findElement(params: {
	selector?: string;
	text?: string;
	role?: string;
	id?: string;
	className?: string;
	tag?: string;
	xpath?: string;
}): Element | null {
	const { selector, text, role, id, className, tag, xpath } = params;

	// Try direct selector first
	if (selector) {
		return document.querySelector(selector);
	}

	// Try ID
	if (id) {
		return document.getElementById(id);
	}

	// Try class name
	if (className) {
		return document.getElementsByClassName(className)[0] || null;
	}

	// Try tag name
	if (tag) {
		return document.getElementsByTagName(tag)[0] || null;
	}

	// Try role
	if (role) {
		return document.querySelector(`[role="${role}"]`);
	}

	// Try XPath
	if (xpath) {
		const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
		return result.singleNodeValue as Element | null;
	}

	// Try text content
	if (text) {
		const escapedText = text.replace(/'/g, "\\'");
		const xpathQuery = `//*[contains(text(), '${escapedText}')]`;
		const result = document.evaluate(xpathQuery, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
		return result.singleNodeValue as Element | null;
	}

	return null;
}

/**
 * Dispatch a smart click with full event chain for framework compatibility
 */
export function dispatchSmartClick(element: Element, framework?: 'svelte' | 'react' | 'vue' | 'vanilla'): void {
	const detectedFramework = framework || detectFramework();

	if (!(element instanceof HTMLElement)) {
		throw new Error('Element must be an HTMLElement');
	}

	// Focus the element first
	element.focus();

	// Get element bounds for realistic coordinates
	const rect = element.getBoundingClientRect();
	const x = rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;

	const eventOptions = {
		bubbles: true,
		cancelable: true,
		view: window,
		clientX: x,
		clientY: y,
		screenX: x,
		screenY: y,
		button: 0,
		buttons: 1
	};

	// For Svelte and React, dispatch full event chain
	if (detectedFramework === 'svelte' || detectedFramework === 'react') {
		element.dispatchEvent(new PointerEvent('pointerover', eventOptions));
		element.dispatchEvent(new PointerEvent('pointerenter', { ...eventOptions, bubbles: false }));
		element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
		element.dispatchEvent(new MouseEvent('mouseenter', { ...eventOptions, bubbles: false }));
		element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
		element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
		element.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
		element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		element.dispatchEvent(new PointerEvent('pointerup', eventOptions));
		element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
		element.dispatchEvent(new MouseEvent('click', eventOptions));
		element.dispatchEvent(new PointerEvent('pointerout', eventOptions));
		element.dispatchEvent(new PointerEvent('pointerleave', { ...eventOptions, bubbles: false }));
		element.dispatchEvent(new MouseEvent('mouseout', eventOptions));
		element.dispatchEvent(new MouseEvent('mouseleave', { ...eventOptions, bubbles: false }));
	} else {
		// For vanilla JS and Vue, simple click is usually enough
		element.click();
	}
}

/**
 * Set input value with proper event dispatching for framework reactivity
 */
export function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string, framework?: 'svelte' | 'react' | 'vue' | 'vanilla'): void {
	const detectedFramework = framework || detectFramework();

	// Focus the element
	element.focus();

	// For React, we need to use the native setter to trigger reactivity
	if (detectedFramework === 'react') {
		const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			'value'
		)?.set;

		if (nativeInputValueSetter) {
			nativeInputValueSetter.call(element, value);
		} else {
			element.value = value;
		}
	} else {
		element.value = value;
	}

	// Dispatch events
	element.dispatchEvent(new Event('input', { bubbles: true }));
	element.dispatchEvent(new Event('change', { bubbles: true }));
	element.dispatchEvent(new Event('blur', { bubbles: false }));
}

/**
 * Wait for an element to appear in the DOM
 */
export async function waitForElement(
	selector: string | (() => Element | null),
	timeout = 5000
): Promise<Element> {
	const startTime = Date.now();

	return new Promise((resolve, reject) => {
		const checkElement = () => {
			const element =
				typeof selector === 'string' ? document.querySelector(selector) : selector();

			if (element) {
				resolve(element);
				return;
			}

			if (Date.now() - startTime > timeout) {
				reject(new Error(`Element not found within ${timeout}ms`));
				return;
			}

			requestAnimationFrame(checkElement);
		};

		checkElement();
	});
}

/**
 * Fill a form field intelligently based on field type
 */
export function fillFormField(element: Element, value: string | boolean): void {
	const framework = detectFramework();

	if (element instanceof HTMLInputElement) {
		if (element.type === 'checkbox' || element.type === 'radio') {
			if (typeof value === 'boolean') {
				element.checked = value;
			} else {
				element.checked = value === 'true' || value === '1';
			}
			element.dispatchEvent(new Event('change', { bubbles: true }));
		} else {
			setInputValue(element, String(value), framework);
		}
	} else if (element instanceof HTMLTextAreaElement) {
		setInputValue(element, String(value), framework);
	} else if (element instanceof HTMLSelectElement) {
		element.value = String(value);
		element.dispatchEvent(new Event('change', { bubbles: true }));
	} else {
		// For custom components (like Svelte Select), try to find the input inside
		const input = element.querySelector('input, textarea');
		if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
			setInputValue(input, String(value), framework);
		} else {
			// Try setting text content or clicking with value
			console.warn('Unknown form field type, attempting text content set');
		}
	}
}

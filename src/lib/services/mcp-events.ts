// SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
// SPDX-License-Identifier: GPL-3.0-only

/**
 * MCP Event Handlers for Tauri Plugin MCP
 *
 * This module sets up event listeners to handle commands from the MCP plugin.
 * The plugin communicates with the frontend via Tauri events.
 */

import { listen, emit } from '@tauri-apps/api/event';
import {
	detectFramework,
	findElement,
	dispatchSmartClick,
	setInputValue,
	waitForElement,
	fillFormField
} from './mcp-utils';

/**
 * Clean DOM to reduce size while preserving structure
 * Removes scripts, styles, SVGs, data attributes, and normalizes whitespace
 */
function cleanDOM(element: HTMLElement): void {
	// Remove all script tags
	element.querySelectorAll('script').forEach((el) => el.remove());

	// Remove all style tags
	element.querySelectorAll('style').forEach((el) => el.remove());

	// Remove all SVG elements (can be huge and not useful for understanding structure)
	element.querySelectorAll('svg').forEach((el) => el.remove());

	// Remove all comments
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT);
	const comments: Node[] = [];
	let node: Node | null;
	while ((node = walker.nextNode())) {
		comments.push(node);
	}
	comments.forEach((comment) => comment.parentNode?.removeChild(comment));

	// Remove inline styles and data-* attributes from all elements
	element.querySelectorAll('*').forEach((el) => {
		// Remove style attribute
		el.removeAttribute('style');

		// Remove all data-* attributes
		Array.from(el.attributes).forEach((attr) => {
			if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) {
				el.removeAttribute(attr.name);
			}
		});

		// Remove class attributes to reduce size (IDs are kept for navigation)
		el.removeAttribute('class');
	});
}

/**
 * Initialize MCP event listeners
 * Call this once when the app starts (in the root layout)
 */
export function initializeMcpEvents() {
	// Only run in Tauri environment
	if (typeof window === 'undefined' || !window.__TAURI__) {
		console.log('[MCP] Not running in Tauri environment, skipping MCP event setup');
		return;
	}

	console.log('[MCP] Initializing MCP event listeners');

	// Handler for get_dom command
	listen('got-dom-content', async () => {
		try {
			// Clone the document to avoid modifying the live DOM
			const clone = document.documentElement.cloneNode(true) as HTMLElement;

			// Clean the DOM to reduce size
			cleanDOM(clone);

			// Get the cleaned HTML
			const domHtml = clone.outerHTML;

			// Emit response back to Rust
			await emit('got-dom-content-response', domHtml);
			console.log('[MCP] Sent cleaned DOM content response');
		} catch (error) {
			console.error('[MCP] Error getting DOM:', error);
			await emit('got-dom-content-response', '');
		}
	});

	// Handler for execute_js command
	listen<string>('execute-js', async (event) => {
		try {
			const code = event.payload;
			console.log('[MCP] Executing JavaScript:', code.substring(0, 100) + '...');

			// Execute the JavaScript code
			// Use Function constructor instead of eval for better compatibility with build tools
			// This is needed for MCP development/testing features
			const result = new Function(`return (${code})`)();

			// Serialize the result
			let serializedResult: string;
			let resultType: string;

			if (result === undefined) {
				serializedResult = 'undefined';
				resultType = 'undefined';
			} else if (result === null) {
				serializedResult = 'null';
				resultType = 'null';
			} else if (typeof result === 'function') {
				serializedResult = result.toString();
				resultType = 'function';
			} else if (typeof result === 'object') {
				try {
					serializedResult = JSON.stringify(result, null, 2);
				} catch (e) {
					// Handle circular references or non-serializable objects
					serializedResult = String(result);
				}
				resultType = 'object';
			} else {
				serializedResult = String(result);
				resultType = typeof result;
			}

			// Emit response
			await emit('execute-js-response', {
				result: serializedResult,
				type: resultType
			});
			console.log('[MCP] JavaScript execution completed successfully');
		} catch (error) {
			console.error('[MCP] Error executing JavaScript:', error);
			await emit('execute-js-response', {
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	// Handler for get_element_position command
	listen<{
		selectorType: string;
		selectorValue: string;
		shouldClick: boolean;
		rawCoordinates: boolean;
	}>('get-element-position', async (event) => {
		try {
			const { selectorType, selectorValue, shouldClick, rawCoordinates } = event.payload;

			let element: Element | null = null;

			// Find element based on selector type
			if (selectorType === 'css') {
				element = document.querySelector(selectorValue);
			} else if (selectorType === 'id') {
				element = document.getElementById(selectorValue);
			} else if (selectorType === 'class') {
				element = document.getElementsByClassName(selectorValue)[0] || null;
			} else if (selectorType === 'name') {
				const elements = document.getElementsByName(selectorValue);
				element = elements.length > 0 ? elements[0] : null;
			} else if (selectorType === 'tag') {
				element = document.getElementsByTagName(selectorValue)[0] || null;
			} else if (selectorType === 'xpath') {
				const result = document.evaluate(
					selectorValue,
					document,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
				element = result.singleNodeValue as Element | null;
			} else if (selectorType === 'text') {
				// Find element containing text
				const xpath = `//*[contains(text(), '${selectorValue.replace(/'/g, "\\'")}')]`;
				const result = document.evaluate(
					xpath,
					document,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
				element = result.singleNodeValue as Element | null;
			}

			if (!element) {
				await emit('get-element-position-response', {
					success: false,
					error: `Element not found with ${selectorType}: ${selectorValue}`
				});
				return;
			}

			// Get element position
			const rect = element.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;

			// Click if requested
			if (shouldClick && element instanceof HTMLElement) {
				element.click();
			}

			// Emit response
			await emit('get-element-position-response', {
				success: true,
				data: {
					x: Math.round(centerX),
					y: Math.round(centerY),
					width: rect.width,
					height: rect.height,
					top: rect.top,
					left: rect.left,
					clicked: shouldClick
				}
			});
			console.log('[MCP] Element position sent successfully');
		} catch (error) {
			console.error('[MCP] Error getting element position:', error);
			await emit('get-element-position-response', {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	// Handler for send_text_to_element command
	listen<{
		selectorType: string;
		selectorValue: string;
		text: string;
		delayMs: number;
	}>('send-text-to-element', async (event) => {
		try {
			const { selectorType, selectorValue, text, delayMs } = event.payload;

			let element: Element | null = null;

			// Find element based on selector type
			if (selectorType === 'css') {
				element = document.querySelector(selectorValue);
			} else if (selectorType === 'id') {
				element = document.getElementById(selectorValue);
			} else if (selectorType === 'class') {
				element = document.getElementsByClassName(selectorValue)[0] || null;
			} else if (selectorType === 'name') {
				const elements = document.getElementsByName(selectorValue);
				element = elements.length > 0 ? elements[0] : null;
			} else if (selectorType === 'tag') {
				element = document.getElementsByTagName(selectorValue)[0] || null;
			} else if (selectorType === 'xpath') {
				const result = document.evaluate(
					selectorValue,
					document,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
				element = result.singleNodeValue as Element | null;
			} else if (selectorType === 'text') {
				// Find element containing text
				const xpath = `//*[contains(text(), '${selectorValue.replace(/'/g, "\\'")}')]`;
				const result = document.evaluate(
					xpath,
					document,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
				element = result.singleNodeValue as Element | null;
			}

			if (!element) {
				await emit('send-text-to-element-response', {
					success: false,
					error: `Element not found with ${selectorType}: ${selectorValue}`
				});
				return;
			}

			// Check if element is an input or textarea
			if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
				await emit('send-text-to-element-response', {
					success: false,
					error: 'Element is not an input or textarea'
				});
				return;
			}

			// Focus the element
			element.focus();

			// Type text with delay if specified
			if (delayMs > 0) {
				for (let i = 0; i < text.length; i++) {
					element.value = element.value + text[i];
					element.dispatchEvent(new Event('input', { bubbles: true }));
					if (i < text.length - 1) {
						await new Promise(resolve => setTimeout(resolve, delayMs));
					}
				}
			} else {
				element.value = text;
				element.dispatchEvent(new Event('input', { bubbles: true }));
			}

			// Dispatch change event
			element.dispatchEvent(new Event('change', { bubbles: true }));

			// Emit response
			await emit('send-text-to-element-response', {
				success: true,
				data: {
					charsTyped: text.length
				}
			});
			console.log('[MCP] Text sent to element successfully');
		} catch (error) {
			console.error('[MCP] Error sending text to element:', error);
			await emit('send-text-to-element-response', {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	// Handler for localStorage operations (listens to "get-local-storage" event from Rust)
	listen<{
		action: string;
		window_label?: string;
		key?: string;
		value?: string;
	}>('get-local-storage', async (event) => {
		try {
			const { action, key, value } = event.payload;
			console.log('[MCP] LocalStorage action:', action, key);

			let result: any = {};

			switch (action) {
				case 'get':
					if (key) {
						// Get specific key
						result = {
							action: 'get',
							key,
							value: localStorage.getItem(key)
						};
					} else {
						// Get all localStorage as object
						const allData: Record<string, string | null> = {};
						for (let i = 0; i < localStorage.length; i++) {
							const storageKey = localStorage.key(i);
							if (storageKey) {
								allData[storageKey] = localStorage.getItem(storageKey);
							}
						}
						result = {
							action: 'get',
							data: allData
						};
					}
					break;

				case 'set':
					if (!key || value === undefined) {
						throw new Error('Key and value are required for set action');
					}
					localStorage.setItem(key, value);
					result = {
						action: 'set',
						key,
						success: true
					};
					break;

				case 'remove':
					if (!key) {
						throw new Error('Key is required for remove action');
					}
					localStorage.removeItem(key);
					result = {
						action: 'remove',
						key,
						success: true
					};
					break;

				case 'clear':
					localStorage.clear();
					result = {
						action: 'clear',
						success: true
					};
					break;

				case 'keys':
					const keys: string[] = [];
					for (let i = 0; i < localStorage.length; i++) {
						const key = localStorage.key(i);
						if (key) keys.push(key);
					}
					result = {
						action: 'keys',
						keys
					};
					break;

				default:
					throw new Error(`Unknown localStorage action: ${action}`);
			}

			// Emit response
			await emit('get-local-storage-response', {
				success: true,
				data: result
			});
			console.log('[MCP] LocalStorage action completed successfully');
		} catch (error) {
			console.error('[MCP] Error with localStorage action:', error);
			await emit('get-local-storage-response', {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	// Handler for smart_click command
	listen<{
		selector?: string;
		text?: string;
		role?: string;
		id?: string;
		className?: string;
		tag?: string;
		xpath?: string;
		waitFor?: boolean;
		timeout?: number;
	}>('smart-click', async (event) => {
		try {
			const { waitFor, timeout, ...findParams } = event.payload;
			console.log('[MCP] Smart click:', findParams);

			let element: Element | null = null;

			if (waitFor) {
				// Wait for element to appear
				element = await waitForElement(
					() => findElement(findParams),
					timeout || 5000
				);
			} else {
				element = findElement(findParams);
			}

			if (!element) {
				await emit('smart-click-response', {
					success: false,
					error: 'Element not found'
				});
				return;
			}

			// Dispatch smart click
			dispatchSmartClick(element);

			await emit('smart-click-response', {
				success: true,
				data: {
					clicked: true,
					framework: detectFramework()
				}
			});
			console.log('[MCP] Smart click successful');
		} catch (error) {
			console.error('[MCP] Error with smart click:', error);
			await emit('smart-click-response', {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	// Handler for fill_form command
	listen<{
		formSelector?: string;
		fields: Record<string, string | boolean>;
		submit?: boolean;
	}>('fill-form', async (event) => {
		try {
			const { formSelector, fields, submit } = event.payload;
			console.log('[MCP] Fill form:', { formSelector, fields, submit });

			const framework = detectFramework();
			const filledFields: string[] = [];
			const errors: string[] = [];

			// Process each field
			for (const [fieldSelector, value] of Object.entries(fields)) {
				try {
					// Try to find the field
					let element = findElement({ selector: fieldSelector });

					// If not found by selector, try by name attribute
					if (!element) {
						element = document.querySelector(`[name="${fieldSelector}"]`);
					}

					// If still not found, try by ID
					if (!element) {
						element = document.getElementById(fieldSelector);
					}

					if (!element) {
						errors.push(`Field not found: ${fieldSelector}`);
						continue;
					}

					// Fill the field
					fillFormField(element, value);
					filledFields.push(fieldSelector);
				} catch (error) {
					errors.push(`Error filling ${fieldSelector}: ${error}`);
				}
			}

			// Submit the form if requested
			let submitted = false;
			if (submit) {
				const form = formSelector
					? (document.querySelector(formSelector) as HTMLFormElement)
					: (document.querySelector('form') as HTMLFormElement);

				if (form) {
					form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
					submitted = true;
				} else {
					errors.push('Form not found for submission');
				}
			}

			await emit('fill-form-response', {
				success: errors.length === 0,
				data: {
					filledFields,
					submitted,
					framework,
					errors: errors.length > 0 ? errors : undefined
				}
			});
			console.log('[MCP] Fill form completed');
		} catch (error) {
			console.error('[MCP] Error filling form:', error);
			await emit('fill-form-response', {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	// Handler for find_and_click command
	listen<{
		selector?: string;
		text?: string;
		role?: string;
		id?: string;
		className?: string;
		tag?: string;
		xpath?: string;
		waitFor?: boolean;
		timeout?: number;
		clickType?: 'smart' | 'simple';
	}>('find-and-click', async (event) => {
		try {
			const { waitFor, timeout, clickType, ...findParams } = event.payload;
			console.log('[MCP] Find and click:', findParams);

			let element: Element | null = null;

			if (waitFor) {
				element = await waitForElement(
					() => findElement(findParams),
					timeout || 5000
				);
			} else {
				element = findElement(findParams);
			}

			if (!element) {
				await emit('find-and-click-response', {
					success: false,
					error: 'Element not found'
				});
				return;
			}

			// Click the element
			if (clickType === 'smart' || clickType === undefined) {
				dispatchSmartClick(element);
			} else if (element instanceof HTMLElement) {
				element.click();
			}

			await emit('find-and-click-response', {
				success: true,
				data: {
					clicked: true,
					clickType: clickType || 'smart',
					framework: detectFramework()
				}
			});
			console.log('[MCP] Find and click successful');
		} catch (error) {
			console.error('[MCP] Error with find and click:', error);
			await emit('find-and-click-response', {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	// Handler for execute_sequence command
	listen<{
		actions: Array<{
			action: 'click' | 'fill' | 'wait' | 'submit' | 'smart_click';
			selector?: string;
			text?: string;
			value?: string | boolean;
			timeout?: number;
		}>;
	}>('execute-sequence', async (event) => {
		try {
			const { actions } = event.payload;
			console.log('[MCP] Execute sequence:', actions.length, 'actions');

			const results: Array<{ action: string; success: boolean; error?: string }> = [];

			for (const [index, actionItem] of actions.entries()) {
				try {
					console.log(`[MCP] Executing action ${index + 1}/${actions.length}:`, actionItem.action);

					switch (actionItem.action) {
						case 'click':
						case 'smart_click': {
							const element = findElement({
								selector: actionItem.selector,
								text: actionItem.text
							});
							if (!element) {
								throw new Error(`Element not found: ${actionItem.selector || actionItem.text}`);
							}
							if (actionItem.action === 'smart_click') {
								dispatchSmartClick(element);
							} else if (element instanceof HTMLElement) {
								element.click();
							}
							results.push({ action: actionItem.action, success: true });
							break;
						}

						case 'fill': {
							if (!actionItem.selector || actionItem.value === undefined) {
								throw new Error('Fill action requires selector and value');
							}
							const element = findElement({ selector: actionItem.selector });
							if (!element) {
								throw new Error(`Element not found: ${actionItem.selector}`);
							}
							fillFormField(element, actionItem.value);
							results.push({ action: 'fill', success: true });
							break;
						}

						case 'wait': {
							if (actionItem.selector) {
								await waitForElement(actionItem.selector, actionItem.timeout || 5000);
							} else if (actionItem.timeout) {
								await new Promise(resolve => setTimeout(resolve, actionItem.timeout));
							}
							results.push({ action: 'wait', success: true });
							break;
						}

						case 'submit': {
							const form = actionItem.selector
								? (document.querySelector(actionItem.selector) as HTMLFormElement)
								: (document.querySelector('form') as HTMLFormElement);
							if (!form) {
								throw new Error('Form not found');
							}
							form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
							results.push({ action: 'submit', success: true });
							break;
						}

						default:
							throw new Error(`Unknown action: ${(actionItem as any).action}`);
					}
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					console.error(`[MCP] Action ${index + 1} failed:`, errorMsg);
					results.push({
						action: actionItem.action,
						success: false,
						error: errorMsg
					});
					// Stop execution on first error
					break;
				}
			}

			const allSuccess = results.every(r => r.success);
			await emit('execute-sequence-response', {
				success: allSuccess,
				data: {
					results,
					completed: results.length,
					total: actions.length
				}
			});
			console.log('[MCP] Execute sequence completed');
		} catch (error) {
			console.error('[MCP] Error executing sequence:', error);
			await emit('execute-sequence-response', {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});

	console.log('[MCP] All MCP event listeners initialized');
}

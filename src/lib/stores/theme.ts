import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'default' | 'geist' | 'nature' | 'cyberpunk';
export type Mode = 'light' | 'dark';

interface ThemeState {
	theme: Theme;
	mode: Mode;
}

// Load theme from localStorage or default values
const defaultState: ThemeState = { theme: 'geist', mode: 'dark' };

function loadInitialState(): ThemeState {
	if (!browser) return defaultState;
	
	try {
		const savedTheme = localStorage.getItem('wallet-theme');
		const savedMode = localStorage.getItem('wallet-mode');
		
		console.log('Loading from localStorage - theme:', savedTheme, 'mode:', savedMode);
		
		// Check if we have corrupted data and clean it up
		if (savedTheme && (savedTheme === '[object Object]' || (!['default', 'geist', 'nature', 'cyberpunk'].includes(savedTheme)))) {
			console.log('Clearing corrupted theme data');
			localStorage.removeItem('wallet-theme');
		}
		
		if (savedMode && (savedMode === '[object Object]' || (!['light', 'dark'].includes(savedMode)))) {
			console.log('Clearing corrupted mode data');  
			localStorage.removeItem('wallet-mode');
		}
		
		return {
			theme: (savedTheme === 'default' || savedTheme === 'geist' || savedTheme === 'nature' || savedTheme === 'cyberpunk') ? savedTheme as Theme : defaultState.theme,
			mode: (savedMode === 'light' || savedMode === 'dark') ? savedMode as Mode : defaultState.mode
		};
	} catch (e) {
		console.error('Error loading theme from localStorage:', e);
		return defaultState;
	}
}

const initialState = loadInitialState();

function createThemeStore() {
	const store = writable<ThemeState>(initialState);
	const { subscribe, set, update } = store;

	function applyTheme(state: ThemeState) {
		if (!browser) return;
		
		console.log('Applying theme:', state);
		
		// Validate state
		if (!state || typeof state.theme !== 'string' || typeof state.mode !== 'string') {
			console.error('Invalid theme state:', state);
			return;
		}
		
		// Remove all theme and mode classes
		document.documentElement.classList.remove('default', 'geist', 'nature', 'cyberpunk', 'light', 'dark');
		
		// Apply theme class (only if valid)
		if (state.theme === 'default' || state.theme === 'geist' || state.theme === 'nature' || state.theme === 'cyberpunk') {
			document.documentElement.classList.add(state.theme);
		}
		
		// Apply mode class (only if valid)
		if (state.mode === 'light' || state.mode === 'dark') {
			document.documentElement.classList.add(state.mode);
		}
		
		console.log('Document classes now:', document.documentElement.className);
	}

	// Apply initial theme immediately
	if (browser) {
		console.log('Initializing theme with state:', initialState);
		applyTheme(initialState);
	}

	return {
		subscribe,
		setTheme: (theme: Theme) => {
			console.log('Setting theme to:', theme);
			update(state => {
				const newState = { ...state, theme };
				if (browser) {
					localStorage.setItem('wallet-theme', theme);
					applyTheme(newState);
				}
				return newState;
			});
		},
		setMode: (mode: Mode) => {
			console.log('Setting mode to:', mode);
			update(state => {
				const newState = { ...state, mode };
				if (browser) {
					localStorage.setItem('wallet-mode', mode);
					applyTheme(newState);
				}
				return newState;
			});
		},
		toggleMode: () => {
			update(state => {
				const newMode: Mode = state.mode === 'light' ? 'dark' : 'light';
				const newState = { ...state, mode: newMode };
				if (browser) {
					localStorage.setItem('wallet-mode', newMode);
					applyTheme(newState);
				}
				return newState;
			});
		},
		getTheme: () => {
			const currentState = get(store);
			return currentState.theme;
		},
		getMode: () => {
			const currentState = get(store);
			return currentState.mode;
		}
	};
}

export const themeStore = createThemeStore();

// Apply initial theme on load
if (browser) {
	themeStore.subscribe(state => {
		document.documentElement.classList.remove('default', 'geist', 'nature', 'cyberpunk', 'light', 'dark');
		document.documentElement.classList.add(state.theme, state.mode);
	});
}
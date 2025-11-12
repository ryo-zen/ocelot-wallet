// wallet-creation.ts - Secure wallet creation flow state management
// Implements crypto industry best practices with memory clearing and timeouts

import { writable } from 'svelte/store';
import { goto } from '$app/navigation';

export interface WalletCreationState {
  // Flow state
  currentStep: 'name' | 'password' | 'recovery' | 'confirm' | null;
  isComplete: boolean;
  
  // Wallet data (cleared after completion)
  walletName: string;
  password: string;
  mnemonic: string[];
  firstAddress: string;
  creationDate: Date;
  
  // Error handling
  error: string;
  isLoading: boolean;
}

const initialState: WalletCreationState = {
  currentStep: null,
  isComplete: false,
  walletName: '',
  password: '',
  mnemonic: [],
  firstAddress: '',
  creationDate: new Date(),
  error: '',
  isLoading: false,
};

// Create the store
const { subscribe, set, update } = writable<WalletCreationState>(initialState);

// Security: Timeout and cleanup mechanisms
let cleanupTimer: number | null = null;
let maxFlowDurationMs = 15 * 60 * 1000; // 15 minutes maximum flow duration

// Memory clearing utility
function clearSensitiveData(state: WalletCreationState) {
  // Overwrite password with random data
  if (state.password) {
    const randomChars = Array.from({length: state.password.length}, 
      () => String.fromCharCode(Math.floor(Math.random() * 256)));
    state.password = randomChars.join('');
    state.password = '';
  }
  
  // Overwrite mnemonic array
  if (state.mnemonic.length > 0) {
    state.mnemonic.forEach((word, index) => {
      const randomWord = Array.from({length: word.length}, 
        () => String.fromCharCode(Math.floor(Math.random() * 26) + 97)).join('');
      state.mnemonic[index] = randomWord;
    });
    state.mnemonic = [];
  }
  
  // Clear other sensitive fields
  state.firstAddress = '';
}

// Start cleanup timer
function startCleanupTimer() {
  if (cleanupTimer) clearTimeout(cleanupTimer);

  cleanupTimer = setTimeout(() => {
    console.warn('🔒 Wallet creation flow timeout - cleaning up sensitive data');
    walletCreationStore.cleanup();
    goto('/login');
  }, maxFlowDurationMs) as unknown as number;
}

// Reset cleanup timer (called on activity)
function resetCleanupTimer() {
  startCleanupTimer();
}

export const walletCreationStore = {
  subscribe,
  
  // Initialize wallet creation flow
  startFlow() {
    update(state => {
      // Clear any existing data first
      clearSensitiveData(state);
      
      return {
        ...initialState,
        currentStep: 'name',
        creationDate: new Date(),
      };
    });
    
    startCleanupTimer();
    console.log('🚀 Started wallet creation flow');
  },
  
  // Set wallet name (Step 1)
  setWalletName(name: string) {
    update(state => ({
      ...state,
      walletName: name,
      error: '',
    }));
    resetCleanupTimer();
  },
  
  // Set password (Step 2) 
  setPassword(password: string) {
    update(state => ({
      ...state,
      password,
      error: '',
    }));
    resetCleanupTimer();
  },
  
  // Set wallet creation result (Step 3)
  setWalletCreated(mnemonic: string, firstAddress: string) {
    update(state => ({
      ...state,
      mnemonic: mnemonic.split(' '),
      firstAddress,
      currentStep: 'recovery',
      error: '',
    }));
    resetCleanupTimer();
  },
  
  // Proceed to next step
  nextStep() {
    update(state => {
      const stepOrder: (typeof state.currentStep)[] = ['name', 'password', 'recovery', 'confirm'];
      const currentIndex = stepOrder.indexOf(state.currentStep);
      const nextStep = stepOrder[currentIndex + 1] || null;
      
      return {
        ...state,
        currentStep: nextStep,
        error: '',
      };
    });
    resetCleanupTimer();
  },
  
  // Go to previous step
  previousStep() {
    update(state => {
      const stepOrder: (typeof state.currentStep)[] = ['name', 'password', 'recovery', 'confirm'];
      const currentIndex = stepOrder.indexOf(state.currentStep);
      const prevStep = stepOrder[currentIndex - 1] || 'name';
      
      return {
        ...state,
        currentStep: prevStep,
        error: '',
      };
    });
    resetCleanupTimer();
  },
  
  // Set loading state
  setLoading(isLoading: boolean) {
    update(state => ({
      ...state,
      isLoading,
    }));
    if (isLoading) resetCleanupTimer();
  },
  
  // Set error
  setError(error: string) {
    update(state => ({
      ...state,
      error,
      isLoading: false,
    }));
    resetCleanupTimer();
  },
  
  // Complete the wallet creation flow
  complete() {
    update(state => {
      // Clear sensitive data before completion
      const clearedState = { ...state };
      clearSensitiveData(clearedState);
      
      return {
        ...clearedState,
        currentStep: null,
        isComplete: true,
        isLoading: false,
      };
    });
    
    // Clear timer
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
    
    console.log('✅ Wallet creation flow completed - sensitive data cleared');
  },
  
  // Emergency cleanup (timeout, error, page unload)
  cleanup() {
    update(state => {
      clearSensitiveData(state);
      return initialState;
    });
    
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
    
    console.log('🔒 Emergency cleanup - all sensitive data cleared');
  },
  
  // Reset to initial state
  reset() {
    this.cleanup();
    console.log('🔄 Wallet creation store reset');
  },
};

// Security: Page unload cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    walletCreationStore.cleanup();
  });
  
  // Browser tab visibility change cleanup (5 minute timer when hidden)
  let hiddenTimer: number | null = null;
  
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Start 5-minute timer when tab becomes hidden
      hiddenTimer = setTimeout(() => {
        console.warn('🔒 Tab hidden for 5 minutes - cleaning up wallet creation');
        walletCreationStore.cleanup();
      }, 5 * 60 * 1000) as unknown as number;
    } else {
      // Clear timer when tab becomes visible again
      if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    }
  });
}

export default walletCreationStore;
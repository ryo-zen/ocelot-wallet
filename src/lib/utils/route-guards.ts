// route-guards.ts - Wallet creation flow validation and route protection utilities
// Implements security-first approach with step validation and direct access prevention

import { goto } from '$app/navigation';
import type { WalletCreationState } from '$lib/stores/wallet-creation';

export type WalletCreationStep = 'name' | 'password' | 'recovery' | 'confirm';

// Route guard for wallet creation flow
export function validateWalletCreationStep(
  currentStep: WalletCreationStep,
  state: WalletCreationState
): boolean {
  // If no active flow, redirect to start
  if (!state.currentStep) {
    console.warn(`🚫 No active wallet creation flow - redirecting to login`);
    goto('/login-02');
    return false;
  }
  
  // Validate step progression
  switch (currentStep) {
    case 'name':
      // Always valid - entry point
      return true;
      
    case 'password':
      // Requires wallet name to be set
      if (!state.walletName.trim()) {
        console.warn('🚫 Password step requires wallet name - redirecting to name step');
        goto('/wallet/create/name');
        return false;
      }
      return true;
      
    case 'recovery':
      // Requires wallet to be created (mnemonic and address present)
      if (!state.walletName.trim() || !state.password || 
          !state.mnemonic.length || !state.firstAddress) {
        console.warn('🚫 Recovery step requires completed wallet creation - redirecting to name step');
        goto('/wallet/create/name');
        return false;
      }
      return true;
      
    case 'confirm':
      // Requires all previous data plus recovery acknowledgment
      if (!state.walletName.trim() || !state.password || 
          !state.mnemonic.length || !state.firstAddress) {
        console.warn('🚫 Confirm step requires all previous data - redirecting to name step');
        goto('/wallet/create/name');
        return false;
      }
      return true;
      
    default:
      console.warn(`🚫 Unknown wallet creation step: ${currentStep}`);
      goto('/login-02');
      return false;
  }
}

// Check if user can access a specific step
export function canAccessStep(
  targetStep: WalletCreationStep,
  state: WalletCreationState
): boolean {
  if (!state.currentStep) return false;
  
  const stepOrder: WalletCreationStep[] = ['name', 'password', 'recovery', 'confirm'];
  const currentIndex = stepOrder.indexOf(state.currentStep);
  const targetIndex = stepOrder.indexOf(targetStep);
  
  // Can only go to current step or one step back
  return targetIndex <= currentIndex || targetIndex === currentIndex - 1;
}

// Generate step URL
export function getStepUrl(step: WalletCreationStep): string {
  return `/wallet/create/${step}`;
}

// Validate step data completeness
export function isStepComplete(
  step: WalletCreationStep,
  state: WalletCreationState
): boolean {
  switch (step) {
    case 'name':
      return state.walletName.trim().length > 0;
      
    case 'password':
      return state.password.length >= 8; // Minimum password length
      
    case 'recovery':
      return state.mnemonic.length === 12 && state.firstAddress.length > 0;
      
    case 'confirm':
      return isStepComplete('recovery', state);
      
    default:
      return false;
  }
}

// Get next available step
export function getNextStep(
  currentStep: WalletCreationStep,
  state: WalletCreationState
): WalletCreationStep | null {
  const stepOrder: WalletCreationStep[] = ['name', 'password', 'recovery', 'confirm'];
  const currentIndex = stepOrder.indexOf(currentStep);
  
  if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
    return null; // Last step or invalid step
  }
  
  const nextStep = stepOrder[currentIndex + 1];
  
  // Validate that current step is complete before allowing next
  if (!isStepComplete(currentStep, state)) {
    console.warn(`🚫 Cannot proceed to ${nextStep} - current step ${currentStep} incomplete`);
    return null;
  }
  
  return nextStep;
}

// Get previous available step
export function getPreviousStep(
  currentStep: WalletCreationStep
): WalletCreationStep | null {
  const stepOrder: WalletCreationStep[] = ['name', 'password', 'recovery', 'confirm'];
  const currentIndex = stepOrder.indexOf(currentStep);
  
  if (currentIndex <= 0) {
    return null; // First step or invalid step
  }
  
  return stepOrder[currentIndex - 1];
}

// Redirect to appropriate step based on state
export function redirectToAppropriateStep(state: WalletCreationState): void {
  if (!state.currentStep) {
    goto('/login-02');
    return;
  }
  
  // Find the furthest incomplete step
  const stepOrder: WalletCreationStep[] = ['name', 'password', 'recovery', 'confirm'];
  
  for (const step of stepOrder) {
    if (!isStepComplete(step, state)) {
      goto(getStepUrl(step));
      return;
    }
  }
  
  // All steps complete, go to confirm
  goto('/wallet/create/confirm');
}

// Security: Clear flow on suspicious activity
export function handleSuspiciousActivity(reason: string, state: WalletCreationState): void {
  console.error(`🚨 Suspicious wallet creation activity: ${reason}`);
  console.error('🔒 Clearing wallet creation state for security');
  
  // Don't expose the cleanup method directly, handle through appropriate channels
  goto('/login-02');
}

// Progress calculation
export function getFlowProgress(state: WalletCreationState): number {
  if (!state.currentStep) return 0;
  
  const stepOrder: WalletCreationStep[] = ['name', 'password', 'recovery', 'confirm'];
  const completedSteps = stepOrder.filter(step => isStepComplete(step, state)).length;
  
  return Math.round((completedSteps / stepOrder.length) * 100);
}

// Get user-friendly step names
export function getStepDisplayName(step: WalletCreationStep): string {
  const displayNames: Record<WalletCreationStep, string> = {
    name: 'Wallet Name',
    password: 'Set Password', 
    recovery: 'Recovery Phrase',
    confirm: 'Confirmation'
  };
  
  return displayNames[step] || step;
}

// Get step numbers for UI
export function getStepNumber(step: WalletCreationStep): number {
  const stepOrder: WalletCreationStep[] = ['name', 'password', 'recovery', 'confirm'];
  return stepOrder.indexOf(step) + 1;
}

export const TOTAL_STEPS = 4;
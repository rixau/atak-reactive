import { useState, useEffect } from 'react';
import type { NavigationState } from '../types';
import { getNavigationState, onNavigationStateChanged } from '../routes';

export function useNavigationState(): NavigationState {
  const [state, setState] = useState<NavigationState>(getNavigationState);

  useEffect(() => onNavigationStateChanged(setState), []);

  return state;
}

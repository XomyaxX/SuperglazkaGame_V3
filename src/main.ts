import './styles/app.css';

import { ThemeManager } from './core/theme-manager';
import { DeviceDetector } from './core/device-detector';
import { AppSettings } from './core/app-settings';
import { MoodDetector } from './core/mood-detector';
import { ApiClient } from './services/api-client';
import { AuthService } from './services/auth';
import { PlayerProfile } from './services/player-profile';
import { ErrorReporter } from './services/error-reporter';

// Determine API base URL
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:3000/api' : '/api';

// Initialize services
const apiClient = new ApiClient({
  baseUrl: API_BASE,
  getAuthState: () => auth.getState(),
});

const auth = new AuthService(apiClient);
const errorReporter = new ErrorReporter(`${API_BASE}/errors`);

// Initialize core
ThemeManager.init();
DeviceDetector.onResize();
AppSettings.load();
AppSettings.apply();

// Initialize legacy app (will be gradually refactored into modules)
// For now, the existing js/app.js handles the main application logic
// Once UI components are ported, this will be replaced

// Expose globals for legacy scripts that depend on them
(window as any).Auth = auth;
(window as any).PlayerProfile = PlayerProfile;
(window as any).ThemeManager = ThemeManager;
(window as any).DeviceDetector = DeviceDetector;
(window as any).AppSettings = AppSettings;
(window as any).MoodDetector = MoodDetector;

console.log('[Superglazka] Core initialized', {
  theme: ThemeManager.getCurrent(),
  device: DeviceDetector.type,
  auth: auth.isLoggedIn() ? (auth.isGuest() ? 'guest' : 'user') : 'none',
});

// Show auth modal if not logged in
if (!auth.isLoggedIn()) {
  const authModal = document.getElementById('auth-modal');
  if (authModal) authModal.classList.add('visible');
}

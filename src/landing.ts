import './styles/app.css';
import { ThemeManager } from './core/theme-manager';
import { CookieBanner } from './ui/cookie-banner';

ThemeManager.init();
CookieBanner.init();

// Landing page specific logic
console.log('[Superglazka] Landing page initialized');

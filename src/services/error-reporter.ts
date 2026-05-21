const STORAGE_KEY = 'superglazka_errors';
const MAX_ERRORS = 50;

export interface ErrorRecord {
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  col?: number;
  time: string;
  userAgent: string;
  url: string;
}

export class ErrorReporter {
  private apiUrl?: string;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl;
    this.installHandlers();
  }

  private installHandlers(): void {
    window.addEventListener('error', (e) => {
      this.report({
        message: e.message,
        stack: e.error?.stack,
        source: e.filename,
        line: e.lineno,
        col: e.colno,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: location.href,
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.report({
        message: e.reason?.message || String(e.reason),
        stack: e.reason?.stack,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: location.href,
      });
    });
  }

  report(err: ErrorRecord): void {
    try {
      const stored = this.getStored();
      stored.push(err);
      if (stored.length > MAX_ERRORS) stored.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      if (this.apiUrl) {
        fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(err),
          keepalive: true,
        }).catch(() => {
          /* ignore network errors */
        });
      }
    } catch {
      /* ignore */
    }
  }

  getStored(): ErrorRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

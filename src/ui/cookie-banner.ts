export class CookieBanner {
  static init(): void {
    if (localStorage.getItem('cookie_consent')) return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.id = 'cookieBanner';
    banner.innerHTML = `
      <div class="cookie-banner-text">
        Мы используем localStorage и серверное хранилище для сохранения прогресса и настроек.
        <a href="privacy.html">Политика конфиденциальности</a>
      </div>
      <button class="cookie-banner-btn" id="cookieAccept">Принять</button>
    `;
    document.body.appendChild(banner);

    // Add styles if not present
    if (!document.getElementById('cookie-banner-styles')) {
      const style = document.createElement('style');
      style.id = 'cookie-banner-styles';
      style.textContent = `
        .cookie-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(10, 6, 24, 0.95);
          border-top: 1px solid rgba(255,255,255,0.1);
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          z-index: 9999;
          transform: translateY(100%);
          transition: transform 0.3s ease;
        }
        .cookie-banner.visible { transform: translateY(0); }
        .cookie-banner-text { font-size: 13px; color: rgba(255,255,255,0.8); }
        .cookie-banner-text a { color: #c084fc; text-decoration: underline; }
        .cookie-banner-btn {
          background: linear-gradient(135deg, #c084fc, #e879f9);
          color: #fff;
          border: none;
          border-radius: 50px;
          padding: 8px 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }
        @media (max-width: 768px) {
          .cookie-banner { flex-direction: column; text-align: center; padding: 12px 16px; }
        }
      `;
      document.head.appendChild(style);
    }

    requestAnimationFrame(() => banner.classList.add('visible'));

    banner.querySelector('#cookieAccept')?.addEventListener('click', () => {
      localStorage.setItem('cookie_consent', 'true');
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 300);
    });
  }
}

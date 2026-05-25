// Analytics placeholders — IDs will be injected by build/deploy
(function() {
  'use strict';

  const GA4_ID = 'G-RGNEEV29CZ'; // GA4 Stream ID
  const YM_ID = '109403755';      // Yandex Metrika ID

  // Google Analytics 4
  if (GA4_ID && !GA4_ID.includes('XXXX')) {
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(gtagScript);

    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', GA4_ID, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });
    window.gtag = gtag;
  }

  // Yandex Metrika
  if (YM_ID && !YM_ID.includes('XXXX')) {
    (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      k=e.createElement(t),a=e.getElementsByTagName(t)[0];
      k.async=1;k.src=r;a.parentNode.insertBefore(k,a);
    })(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');

    window.ym(YM_ID, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
      trackHash: true
    });
  }
})();

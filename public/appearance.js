(() => {
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const favicon = document.querySelector('link[rel="icon"]');
      const faviconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#7c5ce7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z\"/></svg>";
      const updateFavicon = () => {
        const accent = document.documentElement.style.getPropertyValue('--accent').trim() || '#7c5ce7';
        const href = 'data:image/svg+xml,' + encodeURIComponent(faviconSvg.replace('#7c5ce7', accent));
        if (favicon && favicon.getAttribute('href') !== href) favicon.setAttribute('href', href);
      };
      updateFavicon();
      new MutationObserver(updateFavicon).observe(document.documentElement, {attributes:true,attributeFilter:['style']});
    })();

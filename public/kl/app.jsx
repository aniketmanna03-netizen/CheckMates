// Kissan Drishti — root
function App() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const h = () => { const r = parseHash(); setRoute((prev) => { if (prev.path !== r.path || !r.query.has('section')) window.scrollTo(0, 0); return r; }); };
    window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h);
  }, []);
  const { parts, path } = route;
  useEffect(() => {
    const titles = {
      '/': ['Kissan Drishti — Understand pesticide labels', 'Scan pesticide labels in your browser, review extracted text, and compare label details with linked sources. Original wording stays visible.'],
      '/scan': ['Scan a pesticide label — Kissan Drishti', 'Extract label text on this device, review the OCR, and keep the original label wording visible.'],
      '/products': ['Product research — Kissan Drishti', 'Search real web sources and compare pesticide label fields. Search results are leads, not proof of product identity or registration.'],
      '/history': ['Private scan history — Kissan Drishti', 'Your saved label scans remain in this browser on this device.'],
      '/safety': ['Safety guide — Kissan Drishti', 'Learn how Kissan Drishti displays pesticide label text and its limitations.'],
      '/about': ['About Kissan Drishti', 'A browser-based reading aid for pesticide labels, with OCR review and linked source research.'],
    };
    const [title, description] = titles[path] || (parts[0] === 'results'
      ? ['Private label report — Kissan Drishti', 'A saved, device-local pesticide label report.']
      : ['Page not found — Kissan Drishti', 'The requested Kissan Drishti page could not be found.']);
    document.title = title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag) descriptionTag.setAttribute('content', description);
    const robotsTag = document.querySelector('meta[name="robots"]');
    if (robotsTag) robotsTag.setAttribute('content', ['/scan', '/products', '/history'].includes(path) || parts[0] === 'results' ? 'noindex,nofollow' : 'index,follow');
  }, [path, parts]);
  useEffect(() => {
    const section = route.query.get('section');
    if (!section) return;
    const timer = setTimeout(() => {
      const target = document.getElementById(section);
      if (target) target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }, path === '/' ? 80 : 140);
    return () => clearTimeout(timer);
  }, [route]);
  let page;
  if (path === '/') page = <HomePage />;
  else if (parts[0] === 'scan') page = <ScanPage key={location.hash} />;
  else if (parts[0] === 'products') page = <ProductSearchPage key={location.hash} />;
  else if (parts[0] === 'results' && parts[1]) page = <ResultsPage key={parts[1]} />;
  else if (parts[0] === 'history') page = <HistoryPage />;
  else if (parts[0] === 'safety') page = <SafetyPage />;
  else if (parts[0] === 'about') page = <AboutPage />;
  else page = <NotFound />;
  return (
    <RouterCtx.Provider value={route}>
      <Nav />
      <main>{page}</main>
      <Footer />
    </RouterCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <LangProvider><ToastProvider><App /></ToastProvider></LangProvider>
);

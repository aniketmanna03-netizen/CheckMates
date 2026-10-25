// Kissan Drishti — app shell: routing, language, icons, nav, footer, shared UI.
const { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext } = React;

/* ---------------- Icons (Lucide node data → React) ---------------- */
function Icon({ name, size, className, style, strokeWidth }) {
  const node = window.lucide && window.lucide.icons && window.lucide.icons[name];
  const kids = !node ? [] : (typeof node[0] === 'string' && node[0] === 'svg' ? node[2] : node);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth || 1.8} strokeLinecap="round" strokeLinejoin="round" className={'icon ' + (className || '')} style={style} aria-hidden="true">
      {(kids || []).map(([tag, attrs], i) => {
        const a = {}; Object.keys(attrs || {}).forEach((k) => { if (k !== 'key') a[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = attrs[k]; });
        return React.createElement(tag, { key: i, ...a });
      })}
    </svg>
  );
}

/* ---------------- Router (hash-based so it works as a static file) ---------------- */
function parseHash() {
  const h = (location.hash || '#/').slice(1) || '/';
  const [path, q] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts, query: new URLSearchParams(q || '') };
}
const RouterCtx = createContext(null);
function useRouter() { return useContext(RouterCtx); }
function navigate(to) {
  if (to.startsWith('#')) to = to.slice(1);
  if (('#' + to) === location.hash) { window.scrollTo(0, 0); return; }
  location.hash = to;
}
function Link({ to, children, className, onClick, ...rest }) {
  return <a href={'#' + to} className={className} onClick={(e) => { onClick && onClick(e); }} {...rest}>{children}</a>;
}
function setPointerTilt(event) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const el = event.currentTarget, rect = el.getBoundingClientRect();
  const amount = Number(el.dataset.tiltStrength || 1.2);
  const x = (event.clientX - rect.left) / Math.max(1, rect.width) - .5;
  const y = (event.clientY - rect.top) / Math.max(1, rect.height) - .5;
  el.style.setProperty('--tilt-x', (x * amount).toFixed(2) + 'deg');
  el.style.setProperty('--tilt-y', (-y * amount).toFixed(2) + 'deg');
}
function resetPointerTilt(event) {
  event.currentTarget.style.removeProperty('--tilt-x');
  event.currentTarget.style.removeProperty('--tilt-y');
}

/* ---------------- Language ---------------- */
const LangCtx = createContext(null);
function useLang() { return useContext(LangCtx); }
function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('kl.lang') || 'en'; } catch (e) { return 'en'; }
  });
  const setLang = useCallback((l) => { setLangState(l); try { localStorage.setItem('kl.lang', l); } catch (e) {} }, []);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dataset.lang = lang; }, [lang]);
  const t = useCallback((k) => window.KL_I18N.t(lang, k), [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

function LangSelect({ compact }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('pointerdown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  const cur = window.KL_I18N.langInfo(lang);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="lang-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={t('lang_label') + ': ' + cur.name}>
        <Icon name="Languages" size={18} />
        {!compact && <span>{cur.native}</span>}
        <Icon name="ChevronDown" size={14} />
      </button>
      {open && (
        <div className="lang-pop" role="listbox" aria-label={t('lang_label')}>
          {window.KL_I18N.LANGS.map((l) => (
            <button key={l.code} role="option" aria-checked={l.code === lang} onClick={() => { setLang(l.code); setOpen(false); }}>
              <span lang={l.code}>{l.native}</span>
              <span className="mono muted" style={{ fontSize: 11 }}>{l.name}</span>
            </button>
          ))}
          <p className="note">Common interface controls are translated; some guidance and supporting pages are still in English. OCR and explanation quality depend on the selected language and may vary — always compare with the original label.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Nav ---------------- */
const NAV_GROUPS = [
  { id: 'explore', title: 'Explore', items: [
    ['Home', '/', 'House', 'The Kissan Drishti home page'], ['How It Works', '/?section=how', 'Workflow', 'See the scan and review steps'],
    ['Features', '/?section=features', 'Sparkles', 'What the tool can do today'], ['AI Research', '/products', 'Search', 'Search live web sources'],
  ] },
  { id: 'about', title: 'Learn About Us', items: [
    ['About Kissan Drishti', '/about', 'Info', 'What this project does'], ['Why We Built It', '/about?section=why', 'HeartHandshake', 'The problem it aims to address'],
    ['Who It Helps', '/about?section=audience', 'Users', 'People who may find it useful'], ['Our Mission', '/about?section=mission', 'Compass', 'The project mission'],
    ['Our Vision', '/about?section=vision', 'Eye', 'Possible future direction'], ['Team / Project Story', '/about?section=story', 'BookOpen', 'Project context and current status'],
  ] },
  { id: 'resources', title: 'Resources', items: [
    ['Pesticide Label Guide', '/safety?section=photo', 'BookOpenCheck', 'Photographing a label clearly'], ['OCR Help', '/safety?section=ocr', 'ScanText', 'Reviewing text extraction'],
    ['Understanding Label Information', '/safety?section=physical', 'FileText', 'Keep the physical label in view'], ['Frequently Asked Questions', '/safety?section=faq', 'CircleHelp', 'Uploads, privacy, languages and sources'],
    ['Safety and Limitations', '/safety?section=limits', 'ShieldCheck', 'What the tool cannot verify'],
  ] },
  { id: 'support', title: 'Support Us', items: [
    ['Funding Priorities', '/about?section=support', 'HandCoins', 'Potential areas for project support'], ['Sponsor This Project', '/about?section=sponsor', 'BadgeIndianRupee', 'Current sponsorship setup'],
    ['Partner With Us', '/about?section=partners', 'Handshake', 'Current partnership setup'], ['Volunteer / Contribute', '/about?section=contribute', 'HandHeart', 'Current contribution setup'],
    ['Contact', '/about?section=contact', 'Mail', 'Current contact options'],
  ] },
];
function BrandMark({ className = 'brand-mark', style }) {
  return <svg className={className} style={style} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <rect width="48" height="48" rx="14" fill="#1f3b2d" />
    <circle cx="24" cy="14" r="4.5" fill="#e8bd59" />
    <path d="M7 25c5.2-6.2 10.9-9.2 17-9.2s11.8 3 17 9.2c-5.2 6.2-10.9 9.2-17 9.2S12.2 31.2 7 25Z" fill="none" stroke="#f6f2e8" strokeWidth="2" strokeLinejoin="round" />
    <path d="M24 23v11m-8 1c5.4-3.2 10.6-3.2 16 0m-19 4c7.4-3.5 14.6-3.5 22 0" fill="none" stroke="#8fd16a" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
function Logo() {
  return <Link to="/" className="logo" aria-label="Kissan Drishti home"><BrandMark /><span>Kissan Drishti</span></Link>;
}
function Nav() {
  const { path } = useRouter();
  const { t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [mobileGroup, setMobileGroup] = useState('explore');
  const navRef = useRef(null);
  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const isHome = path === '/';
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > (isHome ? window.innerHeight * 0.7 : 10));
    h(); window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h);
  }, [isHome]);
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement;
    const focusables = () => Array.from(drawerRef.current?.querySelectorAll('a[href], button:not([disabled])') || []).filter((item) => item.offsetParent !== null);
    focusables()[0]?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setDrawer(false); menuButtonRef.current?.focus(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [drawer]);
  useEffect(() => {
    if (!openMenu) return;
    const onPointer = (event) => { if (navRef.current && !navRef.current.contains(event.target)) setOpenMenu(null); };
    const onKey = (event) => { if (event.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [openMenu]);
  useEffect(() => setOpenMenu(null), [path]);
  const over = isHome && !scrolled;
  return (
    <>
      <header className={'nav ' + (over ? 'over' : 'solid')}>
        <div className="nav-inner" ref={navRef}>
          <Logo />
          <nav className="nav-links" aria-label="Main">
            {NAV_GROUPS.map((group) => <div className="nav-dropdown" key={group.id}>
              <button type="button" className="nav-dropdown-trigger" id={'nav-trigger-' + group.id} aria-haspopup="true" aria-expanded={openMenu === group.id} aria-controls={'nav-menu-' + group.id} onClick={() => setOpenMenu((current) => current === group.id ? null : group.id)}>
                {group.title}<Icon name="ChevronDown" size={14} />
              </button>
              {openMenu === group.id && <div className="nav-dropdown-menu" id={'nav-menu-' + group.id} aria-labelledby={'nav-trigger-' + group.id}>
                {group.items.map(([label, to, icon, description], index) => <Link key={label} to={to} className="nav-menu-link" style={{ '--menu-index': index }} onClick={() => setOpenMenu(null)}>
                  <Icon name={icon} size={18} /><span><b>{label}</b><small>{description}</small></span>
                </Link>)}
              </div>}
            </div>)}
          </nav>
          <div className="nav-right">
            <LangSelect />
            <Link to="/scan" className="btn btn-primary btn-sm nav-scan-btn"><Icon name="ScanLine" size={18} />{t('scan_now')}</Link>
            <button ref={menuButtonRef} className="burger" aria-label="Open menu" aria-expanded={drawer} aria-controls="site-menu-drawer" onClick={() => setDrawer(true)}><Icon name="Menu" size={24} /></button>
          </div>
        </div>
      </header>
      {drawer && (
        <>
          <div className="drawer-bg" onClick={() => setDrawer(false)} />
          <aside id="site-menu-drawer" ref={drawerRef} className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Logo />
              <button className="burger" style={{ display: 'grid' }} aria-label="Close menu" onClick={() => setDrawer(false)}><Icon name="X" size={24} /></button>
            </div>
            {NAV_GROUPS.map((group) => <section className="drawer-group" key={group.id}>
              <button type="button" className="drawer-group-trigger" aria-expanded={mobileGroup === group.id} aria-controls={'drawer-group-' + group.id} onClick={() => setMobileGroup((current) => current === group.id ? null : group.id)}>
                {group.title}<Icon name="ChevronDown" size={17} />
              </button>
              {mobileGroup === group.id && <div className="drawer-group-links" id={'drawer-group-' + group.id}>
                {group.items.map(([label, to, icon]) => <Link key={label} to={to} onClick={() => setDrawer(false)}><Icon name={icon} size={19} />{label}</Link>)}
              </div>}
            </section>)}
            <Link to="/scan" className="btn btn-primary" style={{ marginTop: 16, fontSize: 17 }}><Icon name="ScanLine" />{t('scan_now')}</Link>
          </aside>
        </>
      )}
    </>
  );
}
function goHow() {
  const scroll = () => { const el = document.getElementById('how'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' }); };
  if (parseHash().path !== '/') { navigate('/'); setTimeout(scroll, 350); } else scroll();
}

/* ---------------- Footer ---------------- */
function Footer() {
  const { t } = useLang();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="cols">
          <div>
            <div style={{ color: 'var(--ivory)' }}><Logo /></div>
            <p style={{ marginTop: 16, maxWidth: 380, fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1.3, color: 'var(--ivory)' }}>Scan the label. Understand the information. Farm with confidence.</p>
          </div>
          <div>
            <div className="mono" style={{ marginBottom: 12, opacity: .6 }}>Product</div>
            <Link to="/scan">{t('nav_scan')}</Link>
            <a href="#/" onClick={(e) => { e.preventDefault(); goHow(); }}>{t('nav_how')}</a>
            <Link to="/history">{t('nav_history')}</Link>
            <Link to="/products">Product Search</Link>
          </div>
          <div>
            <div className="mono" style={{ marginBottom: 12, opacity: .6 }}>Trust</div>
            <Link to="/safety">{t('nav_safety')}</Link>
            <Link to="/about">{t('nav_about')}</Link>
          </div>
        </div>
        <p className="disc">{t('disclaimer')} Scans are stored only on this device. Farm photography: public-domain / CC sources.</p>
      </div>
    </footer>
  );
}

/* ---------------- Shared bits ---------------- */
function useReveal(deps) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.in)');
    const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, deps || []);
}

const ToastCtx = createContext(() => {});
function useToast() { return useContext(ToastCtx); }
function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const tm = useRef(0);
  const show = useCallback((m) => { setMsg(m); clearTimeout(tm.current); tm.current = setTimeout(() => setMsg(null), 3200); }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}

function Modal({ onClose, children, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const prev = document.activeElement; ref.current && ref.current.focus();
    return () => { document.removeEventListener('keydown', k); prev && prev.focus && prev.focus(); };
  }, []);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close"><Icon name="X" /></button>
        {children}
      </div>
    </div>
  );
}

function Tip({ text, children }) {
  return <span className="tip" tabIndex={0}>{children}<span className="tip-b" role="tooltip">{text}</span></span>;
}

function Alert({ tone, icon, children }) {
  const ic = icon || { amber: 'TriangleAlert', red: 'OctagonAlert', info: 'Info', neutral: 'Info' }[tone || 'neutral'];
  return <div className={'alert alert-' + (tone || 'neutral')} role={tone === 'red' ? 'alert' : undefined}><Icon name={ic} />{<div>{children}</div>}</div>;
}

function Disclaimer({ style }) {
  const { t } = useLang();
  return <Alert tone="neutral" icon="Scale"><span style={style}>{t('disclaimer')}</span></Alert>;
}

Object.assign(window, { Icon, RouterCtx, useRouter, navigate, Link, parseHash, LangProvider, useLang, LangSelect, Nav, Footer, Logo, useReveal, ToastProvider, useToast, Modal, Tip, Alert, Disclaimer, goHow, setPointerTilt, resetPointerTilt });

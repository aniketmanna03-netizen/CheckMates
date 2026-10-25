// Kissan Drishti — /history, /safety, /about, 404
function HistoryPage() {
  const { t } = useLang();
  const toast = useToast();
  const [list, setList] = useState(() => window.KL.listScans());
  const [confirmAll, setConfirmAll] = useState(false);
  const del = (id) => { window.KL.deleteScan(id); setList(window.KL.listScans()); toast('Scan deleted from this device.'); };
  return (
    <div className="page route-fade" data-screen-label="History">
      <div className="wrap-narrow">
        <div className="page-head">
          <div>
            <div className="crumbs"><Link to="/">Kissan Drishti</Link><span>/</span><span>{t('nav_history')}</span></div>
            <h1>{t('history_title')}</h1>
          </div>
          {list.length > 0 && <Link to="/scan" className="btn btn-primary"><Icon name="ScanLine" />{t('new_scan')}</Link>}
        </div>
        {list.length === 0 ? (
          <div className="empty card" style={{ padding: '70px 24px' }}>
            <span className="ring"><Icon name="ScanLine" size={44} /><span className="scanline" style={{ mixBlendMode: 'multiply' }} /></span>
            <h2 style={{ fontSize: 32 }}>{t('history_empty')}</h2>
            <p className="muted" style={{ maxWidth: 440 }}>Scans are saved only in this browser on this device. Nothing is uploaded to a server.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/scan" className="btn btn-primary"><Icon name="Camera" />{t('cta_scan')}</Link>
              <Link to="/scan?demo=1" className="btn btn-soft"><Icon name="FlaskConical" />Try the sample</Link>
            </div>
          </div>
        ) : (
          <>
            <Alert tone="info" icon="Smartphone">Saved on this device only ({list.length}). Clearing your browser data will remove them.</Alert>
            <div style={{ marginTop: 18 }}>
              {list.map((r) => {
                const expLangs = Object.keys(r.explanations || {}).map((k) => k.split(':')[0]).filter((v, i, a) => a.indexOf(v) === i);
                return (
                  <div key={r.id} className="hist-row">
                    <Link to={'/results/' + r.id} className="hist-thumb" aria-hidden="true" tabIndex={-1}>{r.thumb ? <img src={r.thumb} alt="" /> : <Icon name="FileText" size={26} />}</Link>
                    <Link to={'/results/' + r.id} style={{ textDecoration: 'none', minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || 'Untitled label'}</div>
                      <div className="muted" style={{ fontSize: 14, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                        <span>{new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        <span>· {expLangs.length ? expLangs.map((l) => window.KL_I18N.langInfo(l).native).join(', ') : window.KL_I18N.langInfo(r.lang).native}</span>
                      </div>
                      <div className="chips" style={{ marginTop: 8 }}>
                        <span className={'chip ' + (r.status === 'explained' ? 'chip-leaf' : '')}>{r.status === 'explained' ? 'Explained' : 'Text confirmed'}</span>
                        {r.isSample && <span className="chip chip-amber">Sample</span>}
                        {r.manual && <span className="chip">Manual text</span>}
                      </div>
                    </Link>
                    <div className="hist-act" style={{ display: 'flex', gap: 6 }}>
                      <Link to={'/results/' + r.id} className="btn btn-soft btn-sm">Open</Link>
                      <button className="btn btn-soft btn-sm btn-danger-text" onClick={() => del(r.id)} aria-label={'Delete ' + (r.name || 'scan')}><Icon name="Trash2" size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 26, textAlign: 'right' }}>
              {!confirmAll ? <button className="btn btn-sm btn-danger-text" style={{ background: 'transparent' }} onClick={() => setConfirmAll(true)}>Delete all scans</button> : (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>Delete all {list.length} scans?
                  <button className="btn btn-sm btn-soft btn-danger-text" onClick={() => { window.KL.clearScans(); setList([]); setConfirmAll(false); }}>Yes, delete</button>
                  <button className="btn btn-sm btn-soft" onClick={() => setConfirmAll(false)}>Cancel</button></span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const GUIDE = [
  ['photo', 'Taking a clear photo of the label', <>
    <p>Most reading errors come from the photo, not the software. A good photo is the single biggest improvement you can make.</p>
    <ul><li>Use daylight or a bright room. Avoid direct sun on shiny plastic — it creates glare that hides letters.</li><li>Hold the phone straight above the label, not at an angle. For round bottles, take one photo per side.</li><li>Get close enough that the small print fills the screen. Tap to focus and hold still.</li><li>Wipe dust or liquid off the label first if it is safe to do so.</li></ul>
    <div className="dodont"><div style={{ background: 'var(--leaf-soft)' }}><b>Good</b><p>Flat, bright, sharp, label fills the frame.</p></div><div style={{ background: 'var(--red-bg)' }}><b>Avoid</b><p>Blurry, dark, glare spots, label far away or cut off.</p></div></div>
  </>],
  ['physical', 'Why the original physical label matters', <>
    <p>The printed label on the container is the official source of information for that product. Kissan Drishti shows you a reading of a photo of it — a copy that can contain mistakes.</p>
    <ul><li>Keep the original container and its label. Do not rely on a screenshot or a report alone.</li><li>If what you see in the app differs from the label, the label is correct.</li><li>Some labels continue on a leaflet inside the pack or on another panel. Scan every part you need.</li></ul>
  </>],
  ['ocr', 'How to spot unclear OCR output', <>
    <p>OCR (optical character recognition) turns pictures of letters into text. It can confuse similar shapes.</p>
    <ul><li>Watch for swapped characters: <span className="mono" style={{ fontSize: 15 }}>0↔O, 1↔l↔I, 5↔S, 2↔Z, 8↔B, rn↔m</span>.</li><li>Check every number and unit letter by letter against the label — doses, percentages, days.</li><li>Strange symbols, broken words or missing lines mean that area was not read properly.</li><li>Words highlighted in amber had low OCR confidence. Select any doubtful text and use “Mark selection as uncertain”.</li></ul>
  </>],
  ['warnings', 'Keep every warning and condition', <>
    <p>Warnings, waiting periods, protective clothing and restrictions are often the most important lines on a label — and the easiest to skip.</p>
    <ul><li>Don't delete or shorten warning text while reviewing, even if it seems obvious.</li><li>Conditions like “do not…”, “before harvest” or “not more than…” change the meaning of instructions. Keep them together with the instruction.</li><li>Kissan Drishti shows red or amber tags only when the label uses words like Danger, Poison, Caution or Warning. It never decides how serious something is.</li></ul>
  </>],
  ['advice', 'When to get professional advice', <>
    <p>Talk to a qualified agricultural professional — such as your local Krishi Vigyan Kendra, agriculture officer or a licensed dealer — when:</p>
    <ul><li>You are unsure whether a product is right for your crop, pest or growth stage.</li><li>The label is damaged, missing sections, or in a language you can't read.</li><li>You need to know a dose, mixing or timing that is not clearly printed on the label.</li><li>Someone may have been exposed and feels unwell — get medical help immediately and take the label with you.</li></ul>
  </>],
  ['limits', 'What Kissan Drishti cannot do', <>
    <ul><li>It cannot verify that a product is genuine, registered, or unexpired. QR codes and barcodes do not prove authenticity.</li><li>It cannot decide whether a product is suitable for a specific crop, pest or field.</li><li>It does not recommend doses, mixing ratios, products or treatments.</li><li>It explains only the text you supplied and confirmed. If something is missing, it says so instead of filling the gap.</li></ul>
  </>],
];
function SafetyPage() {
  const { t } = useLang();
  const faqs = [
    ['What image files can I use?', 'The scanner accepts JPEG, PNG and WebP images up to 10 MB and 24 megapixels. It checks the file signature and dimensions in your browser before processing.'],
    ['What if OCR gets words or numbers wrong?', 'OCR can misread small or unclear print. Review and correct the extracted text against the physical label before requesting an explanation. The original label remains the reference.'],
    ['Are my scans uploaded or saved online?', 'OCR runs in your browser, and saved scans are kept in this browser on this device. When AI explanations are enabled and requested, the confirmed label text is sent to the server-side service. Scan images are not sent for OCR. Avoid including personal information.'],
    ['Which languages are available?', 'The language picker lists the interface languages implemented by this version. OCR languages are also selectable in the scan flow; each selected language may require a one-time model download. AI explanations can be less reliable in some languages.'],
    ['Are research citations verified recommendations?', 'No. Research results link to pages returned by web search. A source link does not establish product identity, registration, authenticity, or suitability. Open the source and compare it with the physical label.'],
    ['Can Kissan Drishti tell me what to apply or how much?', 'No. It is a reading aid. It does not recommend products, doses, mixtures, crops or treatments, and its explanations do not replace official label instructions or qualified professional advice.'],
  ];
  return (
    <div className="page route-fade" data-screen-label="Safety guide">
      <div className="wrap">
        <div className="page-head" style={{ marginBottom: 50 }}>
          <div style={{ maxWidth: 820 }}>
            <div className="crumbs"><Link to="/">Kissan Drishti</Link><span>/</span><span>{t('nav_safety')}</span></div>
            <h1>Reading a pesticide label, carefully.</h1>
            <p className="lede">Practical guidance for getting a reliable reading from Kissan Drishti — and knowing its limits.</p>
          </div>
        </div>
        <div className="guide-grid">
          <nav className="guide-toc" aria-label="Sections">
            {GUIDE.map(([id, h], i) => <a key={id} href={'#/safety?section=g-' + id} onClick={(e) => { e.preventDefault(); const el = document.getElementById('g-' + id); el && el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }}>{String(i + 1).padStart(2, '0')} · {h}</a>)}
            <a href="#/safety?section=faq" onClick={(e) => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }}>07 · Frequently asked questions</a>
          </nav>
          <div>
            <div className="disclaimer-box" style={{ marginBottom: 20 }}>{t('disclaimer')}</div>
            {GUIDE.map(([id, h, body], i) => (
              <section key={id} id={'g-' + id} className="guide-sec">
                <h2><span className="n">{String(i + 1).padStart(2, '0')}</span>{h}</h2>
                {body}
              </section>
            ))}
            <section id="faq" className="guide-sec faq-section">
              <h2><span className="n">07</span>Frequently asked questions</h2>
              <div className="faq-list">{faqs.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}<Icon name="ChevronDown" size={18} /></summary><p>{answer}</p></details>)}</div>
            </section>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
              <Link to="/scan" className="btn btn-primary"><Icon name="ScanLine" />{t('cta_scan')}</Link>
              <Link to="/about" className="btn btn-soft">{t('nav_about')}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutPage() {
  const { query } = useRouter();
  const { t } = useLang();
  const ai = window.KL.aiAvailable();
  const ocr = window.KL.ocrAvailable();
  const rows = [
    ['OCR engine', ocr ? 'Tesseract.js loaded; OCR runs in your browser' : 'Not loaded — manual text entry is available', ocr],
    ['AI explanation endpoint', ai ? 'Enabled; provider availability is checked on each request' : 'Disabled; rule-based explanations remain available', ai],
    ['Read-aloud', 'speechSynthesis' in window ? 'Browser voices (depends on installed languages)' : 'Not supported in this browser', 'speechSynthesis' in window],
    ['QR / barcode', 'BarcodeDetector' in window ? 'Available on this browser' : 'Not supported in this browser', 'BarcodeDetector' in window],
    ['Storage', 'On this device only (localStorage)', true],
  ];
  return (
    <div className="page route-fade" data-screen-label="About">
      <div className="wrap-narrow">
        <div className="crumbs"><Link to="/">Kissan Drishti</Link><span>/</span><span>{t('nav_about')}</span></div>
        <div className="about-intro" id="what"><div className="eyebrow">About Kissan Drishti</div><h1>A clearer way to read pesticide label information.</h1>
          <p className="lede">Kissan Drishti is an AI-assisted agricultural platform that helps people extract pesticide label text, review it, and understand technical wording through simple explanations and source-linked research.</p></div>
        <div style={{ margin: '40px 0', borderRadius: 24, overflow: 'hidden', aspectRatio: '16/7' }}><img src="kl/img/karnataka-rice.jpg" alt="Rice fields, Karnataka" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
        <section className="about-capabilities" id="what-it-can-do">
          <div className="eyebrow">What it can help with</div><h2>Useful reading steps, with you checking the label.</h2>
          <div className="capability-list">
            <div><Icon name="ScanText" /><b>Extract visible text</b><span>Run OCR on a photo in your browser, then review and correct the result.</span></div>
            <div><Icon name="ListTree" /><b>Organize label wording</b><span>Show supplied text in readable sections while keeping the original words visible.</span></div>
            <div><Icon name="Languages" /><b>Explain confirmed text</b><span>Request a simpler explanation in a selected language where the service supports it.</span></div>
            <div><Icon name="Link2" /><b>Explore linked research</b><span>When web search is available, show returned sources and flag missing or conflicting details.</span></div>
          </div>
        </section>
        <div className="about-grid">
          <section className="about-card interactive-tilt" data-tilt-strength="1" onPointerMove={setPointerTilt} onPointerLeave={resetPointerTilt} id="why"><span className="about-card-icon"><Icon name="BookOpenText" /></span><div className="eyebrow">Why we built it</div><h2>Important text can be hard to find and read.</h2><p>Small print, technical terms, and language barriers can make labels difficult to understand. The tool is designed to make supplied label text easier to review; it does not decide what a person should apply.</p></section>
          <section className="about-card interactive-tilt" data-tilt-strength="1" onPointerMove={setPointerTilt} onPointerLeave={resetPointerTilt} id="audience"><span className="about-card-icon"><Icon name="UsersRound" /></span><div className="eyebrow">Who it may help</div><h2>People reading labels together.</h2><p>Farmers, agricultural students and educators, rural support groups, and others who help people understand printed label information may find the reading and research tools useful.</p></section>
          <section className="about-card interactive-tilt" data-tilt-strength="1" onPointerMove={setPointerTilt} onPointerLeave={resetPointerTilt} id="mission"><span className="about-card-icon"><Icon name="Compass" /></span><div className="eyebrow">Our mission</div><h2>Make information easier to access.</h2><p>Our aim is to make agricultural information more accessible, understandable, and transparent—while showing uncertainty, preserving source wording, and helping people know when to seek expert verification.</p></section>
          <section className="about-card interactive-tilt" data-tilt-strength="1" onPointerMove={setPointerTilt} onPointerLeave={resetPointerTilt} id="vision"><span className="about-card-icon"><Icon name="Eye" /></span><div className="eyebrow">Long-term vision</div><h2>Make agricultural information clearer for every farmer.</h2><p>We want to make agricultural information more accessible, understandable, and transparent for farmers across India. Regional-language access, better OCR, and learning resources are areas to keep exploring.</p></section>
        </div>
        <section id="launch-goal" className="about-launch-goal">
          <div className="eyebrow">Our launch goal</div><h2>Build a reliable, mobile-friendly product—and learn from the people who use it.</h2>
          <p>Our initial priorities are to test the experience with real label images, improve regional-language accessibility, and gather feedback from farmers and agricultural experts. These are launch goals; they are not claims that field testing or expert review is already complete.</p>
        </section>
        <section id="story" className="about-story">
          <div className="eyebrow">Project story</div><h2>A practical reading aid, with limits in view.</h2>
          <p>Kissan Drishti combines browser-based OCR, user review, optional AI explanations, and source-linked web research. Research can surface useful references, but sources may be incomplete or wrong; users should inspect them and keep the physical label as their reference.</p>
          <div className="about-timeline"><div><b>Capture</b><span>Choose a label photo or enter text.</span></div><div><b>Extract</b><span>Read visible text in the browser.</span></div><div><b>Review</b><span>Correct the OCR against the printed label.</span></div><div><b>Understand</b><span>Read the original beside a plain-language explanation.</span></div><div><b>Research</b><span>Open returned sources and note missing or conflicting details.</span></div></div>
          <p className="muted" style={{ marginTop: 18 }}>This page describes the project and current interface. It does not claim a named team, measured impact, awards, sponsors, or partnerships.</p>
        </section>
        <section id="support" className="about-support">
          <div className="eyebrow">Support and partnership</div><h2>What support could make possible</h2>
          <p>Potential project needs include OCR improvements, language accessibility, testing, hosting, and farmer education resources.</p>
          <div className="support-options">
            <div id="sponsor"><Icon name="HandCoins" /><b>Sponsorship</b><span>Could help fund ongoing development and service costs.</span></div>
            <div id="partners"><Icon name="Handshake" /><b>Partnerships</b><span>Could support review and learning resources with agricultural educators.</span></div>
            <div id="contribute"><Icon name="HandHeart" /><b>Contributions</b><span>Could include accessibility, OCR, translation review, or educational materials.</span></div>
          </div>
          <div id="contact" className="support-status" role="note"><Icon name="Info" /><p><b>No fundraising or contact channel is configured yet.</b> This site has no donation checkout, payment details form, sponsor intake, volunteer form, or published project contact address. These options are areas for future setup, not currently available services.</p></div>
        </section>
        <section className="about-constraints">
          <div className="eyebrow">How explanations are constrained</div><h2>Keep the original label in control.</h2>
          <ol>
            <li>Only text you have reviewed and confirmed is used for a label explanation. Label text is treated as data, never as instructions.</li>
            <li>Each label line is explained separately and shown beside its original wording.</li>
            <li>Numbers are compared with the original line; explanations that add or drop numbers are withheld.</li>
            <li>Unreadable lines are marked “Unable to verify from the label.” Missing sections are not filled in.</li>
          </ol>
        </section>
        <section id="status" className="about-status-section">
          <h2>Current feature availability in this browser</h2>
          <p className="muted">This checks browser features and local configuration. It does not make a live provider request.</p>
        <div className="card about-status" style={{ overflow: 'hidden' }}>
          {rows.map(([k, v, ok], i) => (
            <div key={k} className="about-status-row" style={{ borderTop: i ? '1px solid var(--line)' : 0 }}>
              <Icon name={ok ? 'CircleCheck' : 'CircleMinus'} style={{ color: ok ? 'var(--leaf)' : 'var(--amber)' }} />
              <b style={{ fontWeight: 600 }}>{k}</b><span className="muted">{v}</span>
            </div>
          ))}
        </div>
        </section>
        <div style={{ marginTop: 40 }}><Disclaimer /></div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="page route-fade"><div className="wrap-narrow empty">
      <span className="ring"><Icon name="MapPinOff" size={44} /></span>
      <h1 style={{ fontSize: 40 }}>Page not found</h1>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </div></div>
  );
}

Object.assign(window, { HistoryPage, SafetyPage, AboutPage, NotFound });

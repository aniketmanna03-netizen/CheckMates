// Kissan Drishti — landing page
function Hero() {
  const { t } = useLang();
  const secRef = useRef(null);
  const canvasRef = useRef(null);
  const [prog, setProg] = useState(0);
  const [has3D, setHas3D] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoAllowed] = useState(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !conn?.saveData && !/^slow-2g|2g$/.test(conn?.effectiveType || '') && (navigator.hardwareConcurrency || 8) > 4;
  });
  const [videoRequested, setVideoRequested] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef(null);
  const progRef = useRef(0);
  const scrollFrame = useRef(0);

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) { setVideoRequested(true); return; }
    if (video.paused) video.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
    else { video.pause(); setVideoPlaying(false); }
  };

  useEffect(() => {
    const update = () => {
      scrollFrame.current = 0;
      const el = secRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.max(0, Math.min(1, -r.top / total)) : 0;
      progRef.current = p;
      setProg((previous) => Math.abs(previous - p) > 0.003 ? p : previous);
    };
    const onScroll = () => { if (!scrollFrame.current) scrollFrame.current = requestAnimationFrame(update); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current); };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !window.KLHero || !window.KLHero.webglOK()) { setHas3D(false); return; }
    let dispose = null;
    try {
      dispose = window.KLHero.mount(canvasRef.current, {
        getProgress: () => (window.innerWidth <= 900 ? 0.7 * ((performance.now() / 9000) % 1.3) : progRef.current),
      });
    } catch (e) { console.warn('3D hero unavailable', e); }
    if (!dispose) setHas3D(false);
    return () => dispose && dispose();
  }, []);

  const stages = [['01 Capture', 0, 0.3], ['02 Extract', 0.28, 0.62], ['03 Understand', 0.6, 0.92]];
  const copyFade = Math.max(0, 1 - Math.max(0, prog - 0.62) * 4);

  return (
    <section className="hero" ref={secRef} data-screen-label="Home hero">
      <div className="hero-sticky">
        <div className={'hero-bg' + (videoFailed ? ' video-fallback' : '')} style={{ backgroundImage: 'url(kl/img/paddy-sunset.jpg)', transform: `scale(${1.08 + prog * 0.06}) translateY(${prog * -3}%)`, }} />
        {videoAllowed && videoRequested && !videoFailed && <video ref={videoRef} className={'hero-video' + (videoReady ? ' ready' : '')} autoPlay muted loop playsInline preload="none" poster="kl/img/paddy-sunset.jpg" onLoadedData={() => setVideoReady(true)} onError={() => setVideoFailed(true)} onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} aria-hidden="true">
          <source src="videos/kisanlens-farm.mp4?v=2" type="video/mp4" />
        </video>}
        <div className="hero-grade" />
        <div className="hero-canvas" ref={canvasRef} aria-hidden="true">
          {!has3D && <StaticHeroArt />}
        </div>
        <div className="hero-copy" style={{ opacity: window.innerWidth > 900 ? copyFade : 1 }}>
          <div className="wrap">
            <div className="hero-badge"><b>BETA</b>On-device OCR · 9 Indian languages</div>
            <h1>{t('hero_title')}</h1>
            <p className="sub">{t('hero_sub')}</p>
            <div className="hero-ctas">
              <Link to="/scan" className="btn btn-leaf"><Icon name="ScanLine" />{t('cta_scan')}</Link>
              <a href="#/" className="btn btn-ghost" onClick={(e) => { e.preventDefault(); goHow(); }}>{t('cta_how')}<Icon name="ArrowDown" size={18} /></a>
            </div>
          </div>
        </div>
        {videoAllowed && <div className="hero-media-controls" aria-label="Background media controls">
          <button type="button" className="hero-media-button" onClick={toggleVideo} aria-label={videoPlaying ? 'Pause background video' : 'Play background video'} title={videoPlaying ? 'Pause background video' : 'Play background video'}>
            <Icon name={videoPlaying ? 'Pause' : 'Play'} size={16} /> <span>Video</span>
          </button>
        </div>}
        {prog > 0.62 && window.innerWidth > 900 && (
          <div className="hero-copy" style={{ opacity: Math.min(1, (prog - 0.62) * 4) }}>
            <div className="wrap" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ maxWidth: 420, marginRight: '3vw' }}>
                <div className="mono" style={{ color: 'var(--leaf-bright)', marginBottom: 14 }}>From dense print → clear card</div>
                <h2 style={{ fontSize: 'clamp(32px,3.4vw,50px)', lineHeight: 1.05, fontWeight: 400 }}>Every number stays exactly as printed.</h2>
                <p style={{ marginTop: 16, color: 'rgba(246,242,232,.8)' }}>The explanation sits beside the original wording — never instead of it. Sample label shown is fictional.</p>
              </div>
            </div>
          </div>
        )}
        <div className="hero-steps" aria-hidden="true">
          <div className="wrap">
            {stages.map(([n, a, b]) => (
              <div className="hero-step" key={n}>
                <span>{n}</span>
                <div className="bar"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, (prog - a) / (b - a)))})` }} /></div>
              </div>
            ))}
            <span className="mono" style={{ marginLeft: 'auto', opacity: .6, fontSize: 11 }}>Scroll</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function StaticHeroArt() {
  const src = useMemo(() => { try { return window.KL.drawSampleLabel().toDataURL('image/jpeg', 0.85); } catch (e) { return null; } }, []);
  return (
    <div className="hero-static">
      {src && <img src={src} alt="" style={{ borderRadius: 14, boxShadow: '0 40px 80px -20px rgba(0,0,0,.6)', transform: 'rotate(-4deg)', width: '78%' }} />}
      <div className="hero-static-card" style={{ right: 0, top: '22%' }}>
        <div className="mono" style={{ color: 'var(--leaf)', fontSize: 10.5 }}>Directions · original</div>
        <div style={{ fontWeight: 600 }}>Dilute 2 ml in 1 litre</div>
      </div>
      <div className="hero-static-card" style={{ right: '8%', top: '52%', background: 'var(--amber-bg)' }}>
        <div className="mono" style={{ color: 'var(--amber)', fontSize: 10.5 }}>Caution · on label</div>
        <div style={{ fontWeight: 600 }}>Harmful if swallowed</div>
      </div>
    </div>
  );
}

function Problem() {
  const pains = [
    ['Dense technical terms', 'Formulation codes, chemical names and regulatory wording are written for compliance, not for quick reading in the field.'],
    ['Instructions are hard to follow', 'Directions can be long, printed small, and split across panels of the container.'],
    ['Warnings get overlooked', 'Restrictions, waiting periods and protective wear are easy to miss when everything is the same size.'],
    ['Language barriers', 'The label may not be in the language a farmer reads most comfortably.'],
  ];
  return (
    <section className="section" data-screen-label="Problem">
      <div className="wrap">
        <div className="reveal" style={{ maxWidth: 900 }}>
          <div className="eyebrow">The problem</div>
          <h2 className="h2">The information is on the label. <em>Reading it</em> is the hard part.</h2>
        </div>
        <div className="problem-grid">
          <div className="photo-stack reveal">
            <div className="ph a"><img src="kl/img/karnataka-rice.jpg" alt="Rice fields in Gangavati, Karnataka" /><span className="tag">Gangavati, Karnataka</span></div>
            <div className="ph b"><img src="kl/img/groundnut.jpg" alt="Groundnut crop in a field" /></div>
          </div>
          <div className="pains">
            {pains.map(([h, p], i) => (
              <div className="pain reveal" key={h} style={{ transitionDelay: i * 80 + 'ms' }}>
                <span className="n">{i + 1}</span>
                <div><h3>{h}</h3><p>{p}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="solution reveal">
          <BrandMark style={{ width: 56, height: 56 }} />
          <div>
            <p className="big">Kissan Drishti reads the label you supply and lays out what it says — in clear sections, in your language, with the original wording always beside it.</p>
            <p className="muted" style={{ marginTop: 14 }}>It is a reading aid. It does not decide whether a product is right for your crop, does not check authenticity, and does not replace the official label or a qualified agricultural professional.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const HOW_STEPS = [
  ['Capture', 'Upload or take a clear photograph of the pesticide label.', 'Camera'],
  ['Extract', 'OCR detects the visible text, directly in your browser.', 'ScanText'],
  ['Review', 'You check the text against the label and correct any mistakes.', 'PencilLine'],
  ['Understand', 'The app explains the verified text in your selected language.', 'Languages'],
  ['Research', 'Search for linked sources and review missing or conflicting details.', 'Search'],
];
function HowItWorks() {
  const [on, setOn] = useState(0);
  const [auto, setAuto] = useState(true);
  const [key, setKey] = useState(0);
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVis(e.isIntersecting), { threshold: 0.3 });
    ref.current && io.observe(ref.current); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!auto || !vis) return;
    const tm = setTimeout(() => { setOn((o) => (o + 1) % HOW_STEPS.length); setKey((k) => k + 1); }, 5000);
    return () => clearTimeout(tm);
  }, [on, auto, vis, key]);
  const pick = (i) => { setOn(i); setAuto(false); setKey((k) => k + 1); };
  return (
    <section className="section dark" id="how" ref={ref} data-screen-label="How it works">
      <div className="wrap">
        <div className="reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 760 }}>
            <div className="eyebrow">How it works</div>
            <h2 className="h2">Five steps. <em>You</em> stay in control of the text.</h2>
          </div>
          <Link to="/scan" className="btn btn-leaf"><Icon name="ScanLine" />Start a scan</Link>
        </div>
        <div className="how">
          <div className="how-list" role="tablist" aria-label="Steps">
            {HOW_STEPS.map(([h, p], i) => (
              <button key={h} role="tab" aria-selected={on === i} className={'how-item' + (on === i ? ' on' : '')} onClick={() => pick(i)}>
                <span className="num">0{i + 1}</span>
                <div><h3>{h}</h3><p>{p}</p></div>
                {on === i && auto && vis && <div className="prog"><i key={key} /></div>}
              </button>
            ))}
          </div>
          <div className="how-stage scan-dark" role="tabpanel">
            <div key={on}>{[<HowCapture />, <HowExtract />, <HowReview />, <HowUnderstand />, <HowResearch />][on]}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
function MiniLabel({ scanning }) {
  const src = useMemo(() => { try { return window.KL.drawSampleLabel().toDataURL('image/jpeg', 0.8); } catch (e) { return null; } }, []);
  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
      {src && <img src={src} alt="Fictional sample label" style={{ width: '100%' }} />}
      {scanning && <div className="scanline" />}
    </div>
  );
}
function HowCapture() {
  return (
    <div className="mphone"><div className="mphone-screen" style={{ background: '#0e1611' }}>
      <div className="mphone-bar">Scan label</div>
      <div style={{ flex: 1, padding: 22, display: 'grid', placeItems: 'center', position: 'relative' }}>
        <div style={{ width: '100%', transform: 'rotate(-3deg)' }}><MiniLabel scanning /></div>
        {[[14, 14], [14, 'r'], ['b', 14], ['b', 'r']].map(([a, b], i) => (
          <span key={i} style={{ position: 'absolute', width: 28, height: 28, border: '3px solid var(--leaf-bright)', borderRadius: 4, [a === 'b' ? 'bottom' : 'top']: 14, [b === 'r' ? 'right' : 'left']: 14, borderWidth: `${a === 'b' ? 0 : 3}px ${b === 'r' ? 3 : 0}px ${a === 'b' ? 3 : 0}px ${b === 'r' ? 0 : 3}px` }} />
        ))}
      </div>
      <div style={{ padding: 16, display: 'grid', placeItems: 'center' }}><span style={{ width: 62, height: 62, borderRadius: '50%', border: '4px solid var(--ivory)', display: 'grid', placeItems: 'center' }}><span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--ivory)' }} /></span></div>
    </div></div>
  );
}
function HowExtract() {
  const lines = window.KL.SAMPLE_TEXT.split('\n').slice(1, 9);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, width: '100%', maxWidth: 620, alignItems: 'center' }}>
      <MiniLabel scanning />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ background: 'rgba(246,242,232,.08)', borderRadius: 10, padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ivory)', animation: `stagein .5s ${i * 0.18}s both`, boxShadow: i === 3 ? 'inset 0 0 0 1.5px var(--amber)' : 'none' }}>
            {l.length > 44 ? l.slice(0, 44) + '…' : l}
            {i === 3 && <span style={{ display: 'block', color: '#f0c25e', fontSize: 10, marginTop: 3 }}>LOW CONFIDENCE · CHECK</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
function HowReview() {
  return (
    <div className="mphone"><div className="mphone-screen">
      <div className="mphone-bar">Review text</div>
      <div style={{ padding: 16, fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8, flex: 1 }}>
        <div>Product name: DEMOGUARD 25 EC</div>
        <div>Active ingredient: Examplofen 25% w/w EC</div>
        <div>Directions for use: Dilute <span style={{ background: 'var(--amber-bg)', borderBottom: '2px dotted var(--amber)', animation: 'fade 1s 1s both reverse' }}>Z ml</span><span style={{ background: 'var(--leaf-soft)', animation: 'stagein .4s 1.8s both' }}> 2 ml</span> in 1 litre of water.</div>
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--amber-bg)', fontFamily: 'var(--sans)', fontSize: 12.5, color: '#5a3c05' }}>OCR read “Z ml”. Check against your physical label and correct it.</div>
      </div>
      <div style={{ padding: 14 }}><div className="btn btn-primary" style={{ width: '100%', minHeight: 46, fontSize: 14 }}>Confirm & Explain</div></div>
    </div></div>
  );
}
function HowUnderstand() {
  return (
    <div className="mphone"><div className="mphone-screen">
      <div className="mphone-bar">परिणाम · Result</div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
        {[['मूल शब्द · ORIGINAL', 'Dilute 2 ml in 1 litre of water.', '#fff', 'var(--mono)'], ['सरल व्याख्या', 'लेबल के अनुसार 2 ml को 1 litre पानी में घोलें।', 'var(--leaf-soft)', 'var(--sans)'], ['सावधानी (लेबल पर लिखा)', 'Harmful if swallowed.', 'var(--amber-bg)', 'var(--mono)']].map(([k, v, bg, f], i) => (
          <div key={i} style={{ background: bg, borderRadius: 14, padding: 12, boxShadow: '0 0 0 1px var(--line)', animation: `stagein .5s ${i * 0.25}s both` }}>
            <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>{k}</div>
            <div style={{ fontFamily: f, fontSize: 13, marginTop: 4, fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: 14 }}><div className="btn btn-primary" style={{ width: '100%', minHeight: 46, fontSize: 14 }}><Icon name="Volume2" size={16} />सुनें · Listen</div></div>
    </div></div>
  );
}
function HowResearch() {
  return (
    <div className="how-research-stage">
      <span className="about-card-icon"><Icon name="SearchCheck" size={26} /></span>
      <div className="eyebrow">Optional source research</div>
      <h3>Review links, missing details, and conflicts.</h3>
      <p>Search results come from live web sources when the research service is available. Open the linked pages yourself; a source match does not authenticate a product or establish that it is right for a particular use.</p>
      <Link to="/products" className="btn btn-leaf"><Icon name="Search" />Open AI Research</Link>
    </div>
  );
}

function Demo() {
  const [state, setState] = useState('idle');
  const [prog, setProg] = useState({ stage: '', progress: 0 });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const labelSrc = useMemo(() => { try { return window.KL.drawSampleLabel().toDataURL('image/jpeg', 0.85); } catch (e) { return null; } }, []);
  const run = async () => {
    setState('running'); setErr(''); setRes(null);
    try {
      const canvas = window.KL.drawSampleLabel();
      const r = await window.KL.runOCR(canvas, ['eng'], setProg);
      if (!r.text || r.text.length < 20) throw new Error('OCR returned almost no text.');
      setRes(r); setState('done');
      try { sessionStorage.setItem('kl.demoOCR', JSON.stringify(r)); } catch (e) {}
    } catch (e) { setErr(e.message || String(e)); setState('error'); }
  };
  return (
    <section className="section" id="demo" data-screen-label="Demo">
      <div className="wrap">
        <div className="reveal" style={{ maxWidth: 820 }}>
          <div className="eyebrow">Interactive demo</div>
          <h2 className="h2">Try it on a <em>sample</em> label.</h2>
          <p className="lede">This runs real OCR in your browser on a fictional demonstration label. Nothing here describes a real product.</p>
        </div>
        <div className="demo">
          <div className="demo-card reveal">
            <div className="demo-label-img">
              <span className="sample-stamp">SAMPLE · FICTIONAL</span>
              {labelSrc && <img src={labelSrc} alt="Fictional sample pesticide label for demonstration" />}
              {state === 'running' && <div className="scanline" />}
            </div>
          </div>
          <div className="demo-card reveal" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="mono muted">Extracted text · sample data</div>
              {res && <span className="chip chip-leaf">OCR confidence {res.confidence}%</span>}
            </div>
            {state === 'idle' && (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '40px 10px', gap: 14 }}>
                <div>
                  <p style={{ fontFamily: 'var(--serif)', fontSize: 26, lineHeight: 1.2, maxWidth: 360, margin: '0 auto 22px' }}>See what OCR reads from the label on the left.</p>
                  <button className="btn btn-primary" onClick={run}><Icon name="Play" size={18} />Try Demo</button>
                  <p className="muted" style={{ fontSize: 14, marginTop: 12 }}>First run downloads ~10 MB of English OCR data.</p>
                </div>
              </div>
            )}
            {state === 'running' && (
              <div className="processing" style={{ padding: '30px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="spinner" style={{ color: 'var(--leaf)' }} /><b>{prog.stage || 'Starting'}…</b></div>
                <div className={'pbar' + (prog.recognizing ? '' : ' indet')}><i style={{ width: Math.round((prog.progress || 0) * 100) + '%' }} /></div>
              </div>
            )}
            {state === 'error' && <Alert tone="red"><b>OCR could not run.</b> {err} No result is shown because none was produced.</Alert>}
            {state === 'done' && res && (
              <>
                <div className="ocr-out">{res.text}</div>
                <p className="muted" style={{ fontSize: 14 }}>This is the raw OCR output, unedited. Continue to review it, then see the plain-language explanation.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link to="/scan?demo=1" className="btn btn-primary"><Icon name="ArrowRight" size={18} />Review & explain sample</Link>
                  <button className="btn btn-soft" onClick={run}><Icon name="RotateCcw" size={18} />Run again</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const SAFEGUARDS = [
  ['Quote', 'Original text preserved', 'The label wording is always shown, unchanged, next to any explanation.'],
  ['Hash', 'Numbers kept exactly', 'Every explanation is checked: if it adds or drops a number, it is withheld.'],
  ['ScanEye', 'Uncertain OCR highlighted', 'Low-confidence words are flagged so you can check them on the physical label.'],
  ['CircleOff', 'Nothing invented', 'Missing information is reported as “Not found in the supplied label text.”'],
  ['Columns2', 'Original vs. simplified', 'Plain-language explanations are clearly separated from the label’s own words.'],
  ['PackageSearch', 'Check the physical label', 'Unclear text is marked “Unable to verify from the label.”'],
];
function Trust() {
  return (
    <section className="section dark" id="features" data-screen-label="Features and safety">
      <div className="wrap">
        <div className="reveal" style={{ maxWidth: 860 }}>
          <div className="eyebrow">Trust & safety</div>
          <h2 className="h2">Built to <em>explain</em> a label — never to rewrite it.</h2>
        </div>
        <div className="trust-grid reveal">
          {SAFEGUARDS.map(([ic, h, p]) => (
            <div className="trust-cell interactive-tilt" data-tilt-strength="1" onPointerMove={setPointerTilt} onPointerLeave={resetPointerTilt} key={h}><span className="ic"><Icon name={ic} /></span><h3>{h}</h3><p>{p}</p></div>
          ))}
          <div className="trust-cell wide">
            <p className="q">Kissan Drishti never recommends a new dose, mixing ratio, crop, or treatment.</p>
            <p>If you need advice on what to use or how much, ask a qualified agricultural professional or your local Krishi Vigyan Kendra.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTABand() {
  const { t } = useLang();
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="cta-band reveal">
          <img src="kl/img/terraces.jpg" alt="Terraced paddy fields in India" />
          <div className="in">
            <h2 className="h2" style={{ maxWidth: 640 }}>Have a label in front of you?</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/scan" className="btn btn-leaf"><Icon name="Camera" />{t('cta_scan')}</Link>
              <Link to="/safety" className="btn btn-ghost" style={{ color: 'var(--ivory)' }}>{t('nav_safety')}</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomePage() {
  useReveal([]);
  return (<><Hero /><Problem /><HowItWorks /><Demo /><Trust /><CTABand /></>);
}

Object.assign(window, { HomePage });

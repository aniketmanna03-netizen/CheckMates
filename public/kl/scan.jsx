// Kissan Drishti — /scan : capture → adjust → OCR → review
function Stepper({ step }) {
  const steps = ['Capture', 'Extract', 'Review', 'Understand'];
  return (
    <div className="stepper" aria-label={'Step ' + (step + 1) + ' of 4'}>
      {steps.map((s, i) => <div key={s} className={'st' + (i < step ? ' done' : i === step ? ' on' : '')}><i /><span>{i + 1}. {s}</span></div>)}
    </div>
  );
}

function CropPreview({ img, rotation, crop, setCrop, cropping, scanning }) {
  const cvRef = useRef(null);
  const wrapRef = useRef(null);
  const [box, setBox] = useState(null);
  useEffect(() => {
    if (!img) return;
    const c = window.KL.renderTransformed(img, rotation, null, 1400);
    const cv = cvRef.current; cv.width = c.width; cv.height = c.height;
    cv.getContext('2d').drawImage(c, 0, 0);
    requestAnimationFrame(() => { const r = cv.getBoundingClientRect(); setBox({ w: r.width, h: r.height, l: cv.offsetLeft, t: cv.offsetTop }); });
  }, [img, rotation]);
  useEffect(() => {
    const h = () => { const cv = cvRef.current; if (!cv) return; const r = cv.getBoundingClientRect(); setBox({ w: r.width, h: r.height, l: cv.offsetLeft, t: cv.offsetTop }); };
    window.addEventListener('resize', h); return () => window.removeEventListener('resize', h);
  }, []);
  const drag = (mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, c0 = { ...crop };
    const move = (ev) => {
      const dx = (ev.clientX - sx) / box.w, dy = (ev.clientY - sy) / box.h;
      let { x, y, w, h } = c0; const min = 0.12;
      if (mode === 'move') { x = Math.min(1 - w, Math.max(0, x + dx)); y = Math.min(1 - h, Math.max(0, y + dy)); }
      if (mode.includes('l')) { const nx = Math.min(x + w - min, Math.max(0, x + dx)); w = w + (x - nx); x = nx; }
      if (mode.includes('r')) { w = Math.min(1 - x, Math.max(min, w + dx)); }
      if (mode.includes('t')) { const ny = Math.min(y + h - min, Math.max(0, y + dy)); h = h + (y - ny); y = ny; }
      if (mode.includes('b')) { h = Math.min(1 - y, Math.max(min, h + dy)); }
      setCrop({ x, y, w, h });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <div className="preview" ref={wrapRef}>
      <canvas ref={cvRef} aria-label="Label photo preview" role="img" />
      {cropping && box && (
        <div className="crop-box" onPointerDown={drag('move')} style={{ left: box.l + crop.x * box.w, top: box.t + crop.y * box.h, width: crop.w * box.w, height: crop.h * box.h }}>
          {['tl', 'tr', 'bl', 'br'].map((k) => <span key={k} className={'h ' + k} onPointerDown={drag(k)} />)}
        </div>
      )}
      {!cropping && box && (crop.w < 1 || crop.h < 1) && (
        <div style={{ position: 'absolute', left: box.l + crop.x * box.w, top: box.t + crop.y * box.h, width: crop.w * box.w, height: crop.h * box.h, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)', border: '2px solid var(--leaf-bright)', pointerEvents: 'none' }} />
      )}
      {scanning && box && <div style={{ position: 'absolute', left: box.l, top: box.t, width: box.w, height: box.h, overflow: 'hidden', pointerEvents: 'none' }}><div className="scanline" style={{ mixBlendMode: 'screen' }} /></div>}
    </div>
  );
}

function QualityPanel({ q }) {
  if (!q) return null;
  const col = { good: 'var(--leaf)', fair: 'var(--amber)', poor: 'var(--red)' }[q.level];
  const txt = { good: 'Photo looks clear', fair: 'Photo may be hard to read', poor: 'Photo is likely too unclear' }[q.level];
  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <b style={{ fontSize: 17 }}>{txt}</b>
        <Tip text="Measured from the image itself (size, brightness, contrast, edge sharpness). It says nothing about whether the text or product is correct."><span className="chip"><Icon name="Info" size={14} />Photo quality</span></Tip>
      </div>
      <div className="q-meter" style={{ marginBottom: 16 }}><i style={{ width: Math.round(q.score * 100) + '%', background: col }} /></div>
      <div className="quality">
        {q.checks.map((c) => (
          <div className="q-row" key={c.key}><span className={'q-dot g' + c.ok} /><div><b style={{ fontWeight: 600 }}>{c.label}</b> <span className="muted">— {c.tip}</span></div><span className="mono muted" style={{ fontSize: 11 }}>{c.value}</span></div>
        ))}
      </div>
    </div>
  );
}

function ScanPage() {
  const { t, lang } = useLang();
  const { query } = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState('capture'); // capture | adjust | ocr | review
  const [src, setSrc] = useState(null);
  const [img, setImg] = useState(null);
  const [isSample, setIsSample] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [cropping, setCropping] = useState(false);
  const [quality, setQuality] = useState(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [ocrLangs, setOcrLangs] = useState(() => { const l = window.KL_I18N.langInfo(lang); return l.code === 'en' ? ['eng'] : ['eng', l.ocr]; });
  const [prog, setProg] = useState({ stage: '', progress: 0 });
  const [ocr, setOcr] = useState(null);
  const [ocrFailed, setOcrFailed] = useState('');
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [codes, setCodes] = useState(null);
  const [showImg, setShowImg] = useState(false);
  const [manual, setManual] = useState(false);
  const fileRef = useRef(null), camRef = useRef(null), taRef = useRef(null);
  const editId = query.get('edit');

  // Load edit target / demo
  useEffect(() => {
    if (editId) {
      const rec = window.KL.getScan(editId);
      if (rec) {
        setText(rec.text); setName(rec.name || ''); setIsSample(!!rec.isSample);
        setOcr(rec.ocr || null); setPhase('review');
        if (rec.thumb) { setSrc(rec.thumb); window.KL.loadImage(rec.thumb).then(setImg).catch(() => {}); }
      } else setError('That saved scan could not be found on this device.');
      return;
    }
    if (query.get('demo')) loadSample();
    if (query.get('manual')) { setManual(true); setPhase('review'); }
  }, [editId]);

  const loadSample = async () => {
    const c = window.KL.drawSampleLabel();
    const url = c.toDataURL('image/jpeg', 0.88);
    const im = await window.KL.loadImage(url);
    setSrc(url); setImg(im); setIsSample(true); setName('DEMOGUARD 25 EC (sample)'); setRotation(0); setCrop({ x: 0, y: 0, w: 1, h: 1 });
    setQuality(window.KL.assessQuality(c));
    let cached = null; try { cached = JSON.parse(sessionStorage.getItem('kl.demoOCR') || 'null'); } catch (e) {}
    if (cached && cached.text) { setOcr(cached); setText(cached.text); setPhase('review'); toast('Loaded the sample OCR result from the demo.'); }
    else setPhase('adjust');
  };

  const acceptFile = async (file) => {
    setError('');
    const v = window.KL.validateFile(file);
    if (v) { setError(v); return; }
    try {
      const signatureError = window.KL.validateImageSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type);
      if (signatureError) { setError(signatureError); return; }
      const url = await window.KL.fileToDataURL(file);
      const im = await window.KL.loadImage(url);
      const dimensionError = window.KL.validateImageDimensions(im.naturalWidth, im.naturalHeight);
      if (dimensionError) { setError(dimensionError); return; }
      setSrc(url); setImg(im); setIsSample(false); setRotation(0); setCrop({ x: 0, y: 0, w: 1, h: 1 }); setOcr(null); setText(''); setOcrFailed(''); setCodes(null);
      setName((file.name || '').replace(/\.[^.]+$/, '').replace(/^(IMG|PXL|DSC)[-_]?\d+.*/i, ''));
      setPhase('adjust');
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    if (!img || phase !== 'adjust') return;
    const c = window.KL.renderTransformed(img, rotation, crop, 1200);
    setQuality(window.KL.assessQuality(c));
  }, [img, rotation, cropping, phase]);

  const removeImage = () => { setSrc(null); setImg(null); setPhase('capture'); setQuality(null); setOcr(null); setText(''); setOcrFailed(''); setCropping(false); setIsSample(false); };

  const runOCR = async () => {
    setPhase('ocr'); setOcrFailed(''); setProg({ stage: 'Preparing image', progress: 0 });
    try {
      const c = window.KL.renderTransformed(img, rotation, crop, 2400);
      window.KL.detectCodes(c).then(setCodes);
      const pre = window.KL.preprocessForOCR(c);
      const r = await window.KL.runOCR(pre, ocrLangs, setProg);
      setOcr(r);
      if (!r.text || r.text.replace(/\s/g, '').length < 12) {
        setOcrFailed('Very little text was detected. The photo may be blurry, too dark, too far away, or the text may be in a language not selected below.');
        setText(r.text || '');
      } else setText(r.text);
      setPhase('review');
    } catch (e) {
      setOcrFailed((e && e.message) || 'OCR failed.');
      setOcr(null); setPhase('review');
    }
  };

  const markUncertain = () => {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { toast('Select a word or phrase in the text first.'); return; }
    const sel = text.slice(s, e);
    if (/^\[\?[\s\S]*\?\]$/.test(sel)) { setText(text.slice(0, s) + sel.slice(2, -2) + text.slice(e)); return; }
    setText(text.slice(0, s) + '[?' + sel + '?]' + text.slice(e));
  };
  const findWord = (w) => {
    const ta = taRef.current; if (!ta) return;
    const i = text.indexOf(w); if (i < 0) return;
    ta.focus(); ta.setSelectionRange(i, i + w.length);
    const before = text.slice(0, i).split('\n').length; ta.scrollTop = Math.max(0, (before - 4) * 25);
  };

  const confirm = () => {
    if (text.trim().length < 10) { toast('Please add the label text before continuing.'); return; }
    const id = editId || window.KL.newId();
    const prev = editId ? window.KL.getScan(editId) : null;
    let thumb = null;
    if (img) { try { thumb = window.KL.renderTransformed(img, rotation, crop, 900).toDataURL('image/jpeg', 0.72); } catch (e) {} }
    else if (prev) thumb = prev.thumb;
    const parsed = window.KL.parseLabel(text, ocr ? ocr.lowConf : []);
    const rec = {
      id, createdAt: prev ? prev.createdAt : Date.now(), updatedAt: Date.now(),
      name: name.trim() || (parsed.product.product ? parsed.product.product.value : ''),
      lang, text, parsed, isSample, thumb,
      ocr: ocr ? { confidence: ocr.confidence, lowConf: ocr.lowConf, langs: ocrLangs, hasConfidence: ocr.hasConfidence } : null,
      manual: !ocr, codes: codes && codes.codes.length ? codes.codes : null,
      status: 'confirmed', explanations: {},
    };
    const res = window.KL.saveScan(rec);
    if (!res.ok) { setError(res.error); return; }
    if (res.droppedImages) toast('Saved without the photo — device storage is nearly full.');
    navigate('/results/' + id);
  };

  const stepIdx = { capture: 0, adjust: 0, ocr: 1, review: 2 }[phase];
  const markedCount = (text.match(/\[\?[\s\S]*?\?\]/g) || []).length;
  const lowConf = ocr && ocr.lowConf ? ocr.lowConf.filter((w, i, a) => a.indexOf(w) === i && w.length > 1 && text.includes(w)).slice(0, 30) : [];

  return (
    <div className="page route-fade" data-screen-label="Scan">
      <div className="wrap">
        <div className="page-head">
          <div>
            <div className="crumbs"><Link to="/">Kissan Drishti</Link><span>/</span><span>{editId ? 'Edit scan' : t('nav_scan')}</span></div>
            <h1>{phase === 'review' ? t('review_title') : t('upload_title')}</h1>
          </div>
          {isSample && <span className="chip chip-amber" style={{ fontSize: 14, padding: '8px 14px' }}><Icon name="FlaskConical" size={16} />Sample data · fictional label</span>}
        </div>
        <Stepper step={stepIdx} />
        {error && <div style={{ marginBottom: 20 }}><Alert tone="red"><b>Can't use this image.</b> {error}</Alert></div>}

        {phase === 'capture' && (
          <>
            <div className={'drop' + (over ? ' over' : '')}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files && e.dataTransfer.files[0]; f && acceptFile(f); }}>
              <span className="big-ic"><Icon name="ScanLine" size={38} /></span>
              <h2>{t('upload_title')}</h2>
              <p className="muted" style={{ maxWidth: 460 }}>{t('upload_hint')}</p>
              <p className="upload-limit-note">24 megapixels maximum · the photo is processed in this browser and is not uploaded.</p>
              <div className="drop-actions">
                <button className="btn btn-primary" onClick={() => camRef.current.click()}><Icon name="Camera" />{t('take_photo')}</button>
                <button className="btn btn-soft" onClick={() => fileRef.current.click()}><Icon name="ImageUp" />{t('choose_file')}</button>
              </div>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { e.target.files[0] && acceptFile(e.target.files[0]); e.target.value = ''; }} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { e.target.files[0] && acceptFile(e.target.files[0]); e.target.value = ''; }} />
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-sm" style={{ background: 'transparent', textDecoration: 'underline' }} onClick={loadSample}><Icon name="FlaskConical" size={16} />Use sample label</button>
                <button className="btn btn-sm" style={{ background: 'transparent', textDecoration: 'underline' }} onClick={() => { setManual(true); setPhase('review'); }}><Icon name="Keyboard" size={16} />{t('manual_entry')}</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 20 }}>
              {[['Sun', 'Use daylight', 'Avoid shadows and shiny glare.'], ['Maximize', 'Fill the frame', 'Get close so small print is large.'], ['Focus', 'Hold steady', 'Tap the screen to focus before taking.'], ['ShieldCheck', 'Stays on your phone', 'OCR runs in your browser. Photos are not uploaded.']].map(([ic, h, p]) => (
                <div key={h} className="card card-pad" style={{ display: 'flex', gap: 14 }}><Icon name={ic} style={{ color: 'var(--leaf)', marginTop: 2 }} /><div><b>{h}</b><p className="muted" style={{ fontSize: 15 }}>{p}</p></div></div>
              ))}
            </div>
          </>
        )}

        {(phase === 'adjust' || phase === 'ocr') && img && (
          <div className="scan-grid">
            <div>
              <CropPreview img={img} rotation={rotation} crop={crop} setCrop={setCrop} cropping={cropping} scanning={phase === 'ocr'} />
              {phase === 'adjust' && (
                <div className="tool-row">
                  <button className="btn btn-soft btn-sm" onClick={() => { setRotation((r) => (r + 90) % 360); setCrop({ x: 0, y: 0, w: 1, h: 1 }); }}><Icon name="RotateCw" size={18} />{t('rotate')}</button>
                  <button className={'btn btn-sm ' + (cropping ? 'btn-primary' : 'btn-soft')} onClick={() => setCropping(!cropping)}><Icon name="Crop" size={18} />{cropping ? 'Done cropping' : 'Crop'}</button>
                  {(crop.w < 1 || crop.h < 1) && <button className="btn btn-soft btn-sm" onClick={() => setCrop({ x: 0, y: 0, w: 1, h: 1 })}>Reset crop</button>}
                  <span style={{ flex: 1 }} />
                  {!isSample && <button className="btn btn-soft btn-sm" onClick={() => camRef.current.click()}><Icon name="Camera" size={18} />{t('retake')}</button>}
                  <button className="btn btn-soft btn-sm btn-danger-text" onClick={removeImage}><Icon name="Trash2" size={18} />{t('remove')}</button>
                  <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { e.target.files[0] && acceptFile(e.target.files[0]); e.target.value = ''; }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {phase === 'adjust' && (
                <>
                  <QualityPanel q={quality} />
                  {quality && quality.level === 'poor' && <Alert tone="amber"><b>This photo may give poor results.</b> You can still try, but retaking it in better light, closer to the label, usually helps a lot.</Alert>}
                  <div className="card card-pad">
                    <b style={{ display: 'block', marginBottom: 4 }}>Which languages are printed on the label?</b>
                    <p className="muted" style={{ fontSize: 14.5, marginBottom: 12 }}>OCR reads only the scripts you select. Each extra language downloads more data (5–15 MB, once).</p>
                    <div className="chips">
                      {window.KL_I18N.LANGS.map((l) => {
                        const on = ocrLangs.includes(l.ocr);
                        return <button key={l.ocr} className={'chip ' + (on ? 'chip-leaf' : '')} aria-pressed={on} style={{ fontFamily: 'var(--sans)', fontSize: 14.5, minHeight: 40, padding: '6px 14px' }}
                          onClick={() => setOcrLangs(on ? (ocrLangs.length > 1 ? ocrLangs.filter((x) => x !== l.ocr) : ocrLangs) : [...ocrLangs, l.ocr])}>{on && <Icon name="Check" size={14} />}{l.native}</button>;
                      })}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ minHeight: 60, fontSize: 18 }} onClick={runOCR}><Icon name="ScanText" />{t('extract')}</button>
                  <p className="muted" style={{ fontSize: 14 }}>OCR may misread small, blurry, damaged, curved or multilingual text. You will review everything before any explanation.</p>
                </>
              )}
              {phase === 'ocr' && (
                <div className="card processing">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="spinner" style={{ color: 'var(--leaf)' }} /><b style={{ fontSize: 18 }}>{prog.stage || 'Working'}…</b></div>
                  <div className={'pbar' + (prog.recognizing ? '' : ' indet')}><i style={{ width: Math.round((prog.progress || 0) * 100) + '%' }} /></div>
                  <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', display: 'grid', gap: 6 }}>
                    <li style={{ opacity: 1 }}>Image prepared (grayscale + contrast)</li>
                    <li style={{ opacity: prog.stage && prog.stage !== 'Preparing image' ? 1 : .4 }}>OCR engine & language data ({ocrLangs.join(' + ')})</li>
                    <li style={{ opacity: prog.recognizing ? 1 : .4 }}>Reading text {prog.recognizing ? Math.round(prog.progress * 100) + '%' : ''}</li>
                  </ol>
                  <p className="muted" style={{ fontSize: 14 }}>Runs on this device. On slower phones this can take up to a minute.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="scan-grid" style={{ gridTemplateColumns: src ? '0.9fr 1.1fr' : '1fr' }}>
            {src && (
              <div style={{ position: 'sticky', top: 'calc(var(--nav-h) + 16px)' }} className="card card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="mono muted">Original photo</span>
                  <button className="btn btn-soft btn-sm" onClick={() => setShowImg(true)}><Icon name="ZoomIn" size={16} />Enlarge</button>
                </div>
                <div style={{ maxHeight: '62vh', overflow: 'auto', borderRadius: 12, background: 'var(--beige)' }}>
                  <img src={img && !editId ? window.KL.renderTransformed(img, rotation, crop, 1200).toDataURL('image/jpeg', 0.85) : src} alt="Label photo for comparison" style={{ width: '100%' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ocrFailed && <Alert tone="red"><b>Text extraction did not succeed.</b> {ocrFailed} You can retry with a better photo, or type the label text yourself below.</Alert>}
              {(manual || (!ocr && !ocrFailed)) && !editId && <Alert tone="info"><b>Manual entry.</b> Type or paste the text exactly as printed on the label — including all numbers, units and warnings.</Alert>}
              {ocr && !ocrFailed && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={'chip ' + (ocr.confidence >= 80 ? 'chip-leaf' : 'chip-amber')}>OCR confidence {ocr.confidence}%</span>
                  <Tip text="Average confidence reported by the OCR engine. It is a hint about readability — not proof that the text is correct."><Icon name="Info" size={16} className="muted" /></Tip>
                  {codes && codes.codes.length > 0 && <span className="chip"><Icon name="QrCode" size={14} />{codes.codes.length} code(s) detected</span>}
                </div>
              )}
              <p className="muted">{t('review_hint')}</p>
              <label className="sr" htmlFor="ocrtext">Label text</label>
              <textarea id="ocrtext" ref={taRef} className="ocr-edit" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
                placeholder={'Product name: …\nActive ingredient: …\nDirections for use: …\nCaution: …'} />
              <div className="tool-row" style={{ marginTop: 0 }}>
                <button className="btn btn-soft btn-sm" onClick={markUncertain}><Icon name="CircleHelp" size={16} />Mark selection as uncertain</button>
                {img && !editId && <button className="btn btn-soft btn-sm" onClick={() => setPhase('adjust')}><Icon name="RotateCcw" size={16} />{t('retry_ocr')}</button>}
                {!img && <button className="btn btn-soft btn-sm" onClick={removeImage}><Icon name="Camera" size={16} />Scan a photo instead</button>}
                <span className="muted" style={{ fontSize: 13.5, alignSelf: 'center' }}>{markedCount} marked uncertain</span>
              </div>
              {lowConf.length > 0 && (
                <div className="card card-pad">
                  <b style={{ display: 'block', marginBottom: 4 }}>Words the OCR was unsure about</b>
                  <p className="muted" style={{ fontSize: 14.5, marginBottom: 12 }}>Tap a word to find it in the text, then check it against the physical label.</p>
                  <div className="chips">{lowConf.map((w) => <button key={w} className="chip chip-amber" onClick={() => findWord(w)}>{w}</button>)}</div>
                </div>
              )}
              {codes && codes.codes.length > 0 && (
                <Alert tone="neutral" icon="QrCode"><b>Code detected:</b> {codes.codes.map((c) => c.format + ': ' + c.value).join(' · ')}. A QR code or barcode does not prove the product is authentic or that the label is correct.</Alert>
              )}
              <div className="card card-pad" style={{ display: 'grid', gap: 8 }}>
                <label htmlFor="pname"><b>Name for your history</b> <span className="muted">(optional)</span></label>
                <input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cotton spray, shop in Jalna" style={{ minHeight: 50, borderRadius: 12, border: 0, boxShadow: 'inset 0 0 0 1.5px var(--beige-2)', padding: '0 14px', fontSize: 16, fontFamily: 'inherit', background: '#fff' }} />
              </div>
              <Alert tone="amber" icon="BadgeCheck">By continuing you confirm this text matches the physical label as closely as you can tell. Explanations will use <b>only</b> this text.</Alert>
              <button className="btn btn-primary" style={{ minHeight: 60, fontSize: 18 }} disabled={text.trim().length < 10} onClick={confirm}><Icon name="Check" />{t('continue_explain')}</button>
            </div>
          </div>
        )}
        {showImg && src && <Modal onClose={() => setShowImg(false)} label="Original label"><img src={src} alt="Original label photo" style={{ width: '100%', borderRadius: 12, marginTop: 30 }} /></Modal>}
      </div>
    </div>
  );
}

Object.assign(window, { ScanPage });

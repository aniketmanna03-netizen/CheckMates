// Kissan Drishti — engine: image quality, OCR, label parsing, constrained explanations, storage, reports.
// UI-free. Exposed on window.KL.
(function () {
  const KL = {};

  /* ------------------------------------------------------------------ */
  /* Files + images                                                      */
  /* ------------------------------------------------------------------ */
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_BYTES = 10 * 1024 * 1024;
  const MAX_PIXELS = 24_000_000;

  KL.validateFile = function (file) {
    if (!file) return 'No file selected.';
    const name = (file.name || '').toLowerCase();
    if (/\.(heic|heif)$/.test(name) || /heic|heif/.test(file.type))
      return 'HEIC photos are not supported in the browser. Please change your camera setting to JPG, or take a screenshot of the photo and upload that.';
    if (!OK_TYPES.includes(file.type)) return 'Unsupported file type. Please use a JPG, PNG or WebP image.';
    if (file.size > MAX_BYTES) return 'This image is larger than 10 MB. Please choose a smaller photo.';
    if (file.size < 8 * 1024) return 'This file is very small and is probably too low-resolution to read. Please use a clearer photo.';
    return null;
  };

  KL.validateImageSignature = function (bytes, type) {
    if (!bytes || bytes.length < 12) return 'The image file is incomplete or damaged.';
    const b = Array.from(bytes);
    const matches = type === 'image/jpeg' ? b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
      : type === 'image/png' ? b.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
      : type === 'image/webp' ? String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP'
      : false;
    return matches ? null : 'This file does not match its image type. Please choose a valid JPG, PNG or WebP photo.';
  };

  KL.validateImageDimensions = function (width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return 'The image dimensions could not be read.';
    if (width * height > MAX_PIXELS) return 'This image has more than 24 megapixels. Please choose a smaller photo to avoid slowing down your device.';
    if (Math.min(width, height) < 200) return 'This image is too small to read label text. Please use a closer, higher-resolution photo.';
    return null;
  };

  KL.loadImage = function (src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('The image could not be opened. It may be damaged.'));
      img.src = src;
    });
  };

  KL.fileToDataURL = function (file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Could not read the file.'));
      r.readAsDataURL(file);
    });
  };

  // Draw image with rotation (deg, multiples of 90) and optional crop (fractions 0..1 of rotated image)
  KL.renderTransformed = function (img, rotation, crop, maxSide) {
    const r = ((rotation % 360) + 360) % 360;
    const sw = img.naturalWidth, sh = img.naturalHeight;
    const rw = r % 180 === 0 ? sw : sh, rh = r % 180 === 0 ? sh : sw;
    const full = document.createElement('canvas');
    full.width = rw; full.height = rh;
    const fc = full.getContext('2d');
    fc.translate(rw / 2, rh / 2);
    fc.rotate((r * Math.PI) / 180);
    fc.drawImage(img, -sw / 2, -sh / 2);
    const c = crop || { x: 0, y: 0, w: 1, h: 1 };
    const cx = Math.round(c.x * rw), cy = Math.round(c.y * rh);
    const cw = Math.max(1, Math.round(c.w * rw)), ch = Math.max(1, Math.round(c.h * rh));
    let scale = 1;
    if (maxSide && Math.max(cw, ch) > maxSide) scale = maxSide / Math.max(cw, ch);
    const out = document.createElement('canvas');
    out.width = Math.round(cw * scale); out.height = Math.round(ch * scale);
    out.getContext('2d').drawImage(full, cx, cy, cw, ch, 0, 0, out.width, out.height);
    return out;
  };

  // Image-property quality check. This describes the photo only — not the correctness of any text.
  KL.assessQuality = function (canvas) {
    const W = 360;
    const s = Math.min(1, W / canvas.width);
    const w = Math.max(1, Math.round(canvas.width * s)), h = Math.max(1, Math.round(canvas.height * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.drawImage(canvas, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const g = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) { g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; sum += g[j]; }
    const mean = sum / g.length;
    let v = 0; for (let j = 0; j < g.length; j++) v += (g[j] - mean) ** 2;
    const contrast = Math.sqrt(v / g.length);
    let lsum = 0, lsq = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      const L = 4 * g[k] - g[k - 1] - g[k + 1] - g[k - w] - g[k + w];
      lsum += L; lsq += L * L; n++;
    }
    const lm = lsum / n; const sharp = lsq / n - lm * lm;
    const minSide = Math.min(canvas.width, canvas.height);
    const checks = [
      { key: 'resolution', label: 'Resolution', value: `${canvas.width}×${canvas.height}px`, ok: minSide >= 900 ? 2 : minSide >= 500 ? 1 : 0,
        tip: minSide >= 900 ? 'Enough pixels for small print.' : 'Move closer so the label fills the frame.' },
      { key: 'light', label: 'Lighting', value: Math.round(mean), ok: mean > 70 && mean < 215 ? 2 : mean > 45 && mean < 235 ? 1 : 0,
        tip: mean <= 70 ? 'Photo looks dark — try daylight.' : mean >= 215 ? 'Photo looks washed out — avoid direct glare.' : 'Lighting looks even.' },
      { key: 'contrast', label: 'Contrast', value: Math.round(contrast), ok: contrast > 45 ? 2 : contrast > 25 ? 1 : 0,
        tip: contrast > 45 ? 'Text stands out from the background.' : 'Low contrast — avoid shadows and reflections.' },
      { key: 'sharp', label: 'Sharpness', value: Math.round(sharp), ok: sharp > 320 ? 2 : sharp > 110 ? 1 : 0,
        tip: sharp > 320 ? 'Edges look crisp.' : 'Photo may be blurry — hold steady and tap to focus.' },
    ];
    const score = checks.reduce((a, c) => a + c.ok, 0) / (checks.length * 2);
    return { checks, score, level: score >= 0.75 ? 'good' : score >= 0.45 ? 'fair' : 'poor' };
  };

  // Grayscale + contrast stretch + upscale small images — helps Tesseract.
  KL.preprocessForOCR = function (canvas) {
    const up = Math.min(canvas.width, canvas.height) < 1000 ? 2 : 1;
    const c = document.createElement('canvas');
    c.width = canvas.width * up; c.height = canvas.height * up;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    const id = ctx.getImageData(0, 0, c.width, c.height); const d = id.data;
    let lo = 255, hi = 0; const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) { const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0; hist[y]++; }
    const total = d.length / 4; let acc = 0;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.01) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.01) { hi = i; break; } }
    const rng = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      let y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      y = Math.max(0, Math.min(255, ((y - lo) / rng) * 255));
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  };

  KL.detectCodes = async function (canvas) {
    if (!('BarcodeDetector' in window)) return { supported: false, codes: [] };
    try {
      const det = new window.BarcodeDetector();
      const found = await det.detect(canvas);
      return { supported: true, codes: found.map((f) => ({ format: f.format, value: f.rawValue })) };
    } catch (e) { return { supported: false, codes: [] }; }
  };

  /* ------------------------------------------------------------------ */
  /* OCR (Tesseract.js)                                                  */
  /* ------------------------------------------------------------------ */
  KL.ocrAvailable = () => typeof window.Tesseract !== 'undefined';

  KL.runOCR = async function (canvas, langs, onProgress) {
    if (!KL.ocrAvailable()) throw new Error('OCR engine could not be loaded. Check your internet connection, or type the label text manually.');
    const langStr = (langs && langs.length ? langs : ['eng']).join('+');
    let worker;
    try {
      worker = await window.Tesseract.createWorker(langStr, 1, {
        logger: (m) => {
          if (!onProgress) return;
          const map = { 'loading tesseract core': 'Loading OCR engine', 'initializing tesseract': 'Starting OCR engine', 'loading language traineddata': 'Downloading language data', 'initializing api': 'Preparing', 'recognizing text': 'Reading text' };
          onProgress({ stage: map[m.status] || m.status, progress: m.progress || 0, recognizing: m.status === 'recognizing text' });
        },
      });
      const { data } = await worker.recognize(canvas);
      const words = (data.words || []).map((w) => ({ text: w.text, conf: Math.round(w.confidence) }));
      const text = (data.text || '').replace(/\n{3,}/g, '\n\n').trim();
      return {
        text,
        confidence: Math.round(data.confidence || 0),
        words,
        lowConf: words.filter((w) => w.conf < 65 && /[\p{L}\p{N}]/u.test(w.text)).map((w) => w.text),
        hasConfidence: words.length > 0,
      };
    } finally {
      if (worker) { try { await worker.terminate(); } catch (e) {} }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Parsing (rule-based, source-preserving)                             */
  /* ------------------------------------------------------------------ */
  const FIELD_RX = {
    product: /^(?:product(?:\s*name)?|brand(?:\s*name)?|trade\s*name|उत्पाद(?:\s*का)?\s*नाम|ब्रांड)\s*[:\-–]\s*(.+)$/i,
    ingredient: /^(?:active\s*ingredients?|a\.\s?i\.|technical\s*name|composition|सक्रिय\s*(?:तत्व|घटक)|रचना)\s*[:\-–]\s*(.+)$/i,
    manufacturer: /^(?:manufactured\s*by|mfd\.?\s*by|mfg\.?\s*by|marketed\s*by|manufacturer|निर्माता|द्वारा\s*निर्मित)\s*[:\-–]?\s*(.+)$/i,
    registration: /^(?:reg(?:istration)?\.?\s*no\.?|cir\s*(?:reg\.?)?\s*no\.?|registration\s*number|पंजीकरण\s*(?:सं\.?|संख्या))\s*[:\-–]?\s*(.+)$/i,
  };
  const CONC_RX = /\b\d+(?:\.\d+)?\s?%\s?(?:w\/w|w\/v|ec|sc|wp|sl|wg|wdg|gr|cs|ew|od|fs)?\b|\b\d+(?:\.\d+)?\s?(?:g\/l|g\/kg|gm\/l)\b/i;

  const CAT_RX = {
    condition: /waiting\s*period|pre[-\s]?harvest|\bphi\b|before\s*harvest|re-?entry|\bstore\b|storage|stored|dispos|container|wear|gloves|mask|goggles|protective|full\s*sleeve|against\s*the\s*wind|wind|more\s*than|per\s*season|do\s*not\s*(?:apply|spray|mix|use)|प्रतीक्षा\s*अवधि|कटाई|भंडारण|दस्ताने|मास्क|हवा/i,
    warning: /caution|warning|danger|poison|toxic|harmful|fatal|avoid|keep\s*(?:away|out)|first\s*aid|antidote|swallow|inhal|eyes?\b|skin|irritat|doctor|physician|medical|do\s*not|सावधान|चेतावनी|जहर|विष|ज़हर|खतरा|प्राथमिक\s*उपचार/i,
    instruction: /dose|dosage|dilut|\bmix|spray|apply|application|per\s*(?:acre|hectare|ha)|\bml\b|\blit(?:re|er)s?\b|\bl\b|water|directions?|method|खुराक|मात्रा|छिड़काव|पानी|घोल|प्रयोग/i,
  };

  const DANGER_RX = /\bdanger\b|\bpoison(?:ous)?\b|highly\s*toxic|extremely\s*toxic|\bfatal\b|खतरा|विषैला|जहरीला/i;
  const CAUTION_RX = /\bcaution\b|\bwarning\b|\bharmful\b|सावधान|चेतावनी|हानिकारक/i;

  const CHECKLIST = [
    { key: 'directions', label: 'Directions for use', rx: /directions?|dose|dosage|dilut|apply|spray|खुराक|मात्रा|छिड़काव/i },
    { key: 'waiting', label: 'Waiting period before harvest', rx: /waiting\s*period|pre[-\s]?harvest|\bphi\b|before\s*harvest|प्रतीक्षा\s*अवधि/i },
    { key: 'ppe', label: 'Protective clothing', rx: /gloves|mask|goggles|protective|full\s*sleeve|दस्ताने|मास्क/i },
    { key: 'firstaid', label: 'First aid / antidote', rx: /first\s*aid|antidote|प्राथमिक\s*उपचार|प्रतिविष/i },
    { key: 'storage', label: 'Storage and disposal', rx: /store|storage|dispos|भंडारण/i },
  ];

  const GLOSSARY = [
    { rx: /\bEC\b/, term: 'EC', en: 'Emulsifiable Concentrate — a liquid formulation type.', hi: 'इमल्सीफ़ायबल कंसन्ट्रेट — एक तरल फ़ॉर्मूलेशन का प्रकार।' },
    { rx: /\bSC\b/, term: 'SC', en: 'Suspension Concentrate — a liquid formulation type with suspended solid particles.', hi: 'सस्पेंशन कंसन्ट्रेट — ठोस कणों वाला तरल फ़ॉर्मूलेशन।' },
    { rx: /\bWP\b/, term: 'WP', en: 'Wettable Powder — a powder formulation type.', hi: 'वेटेबल पाउडर — पाउडर फ़ॉर्मूलेशन का प्रकार।' },
    { rx: /\bSL\b/, term: 'SL', en: 'Soluble Liquid — a liquid formulation type.', hi: 'सॉल्यूबल लिक्विड — घुलनशील तरल फ़ॉर्मूलेशन।' },
    { rx: /\bWDG\b|\bWG\b/, term: 'WG / WDG', en: 'Water Dispersible Granules — a granule formulation type.', hi: 'वॉटर डिस्पर्सिबल ग्रैन्यूल — दानेदार फ़ॉर्मूलेशन।' },
    { rx: /w\/w/i, term: 'w/w', en: 'Weight by weight — the percentage is measured by weight.', hi: 'वज़न के अनुसार — प्रतिशत वज़न से मापा गया है।' },
    { rx: /w\/v/i, term: 'w/v', en: 'Weight by volume.', hi: 'आयतन के अनुसार वज़न।' },
    { rx: /\ba\.\s?i\.?/i, term: 'a.i.', en: 'Active ingredient — the chemical named as the active part of the product.', hi: 'सक्रिय तत्व — उत्पाद का सक्रिय रासायनिक भाग।' },
    { rx: /waiting\s*period|\bphi\b|pre[-\s]?harvest/i, term: 'Waiting period / PHI', en: 'The time the label says must pass between the last application and harvest. Use only the figure printed on your label.', hi: 'अंतिम छिड़काव और कटाई के बीच लेबल में बताया गया समय। केवल अपने लेबल पर छपा आंकड़ा ही मानें।' },
    { rx: /antidote/i, term: 'Antidote', en: 'A treatment named on the label for poisoning. Show the label to the doctor.', hi: 'विषाक्तता के लिए लेबल पर बताया गया उपचार। डॉक्टर को लेबल दिखाएँ।' },
  ];

  function splitSegments(text) {
    const lines = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const merged = [];
    lines.forEach((l) => {
      const prev = merged[merged.length - 1];
      if (prev && !/[.:;!?।)]$/.test(prev) && /^[a-z(]/.test(l) && !/[:]/.test(l.slice(0, 24))) merged[merged.length - 1] = prev + ' ' + l;
      else merged.push(l);
    });
    const out = [];
    merged.forEach((l) => {
      if (/^[^:]{2,40}:\s/.test(l) && Object.values(FIELD_RX).some((rx) => rx.test(l))) { out.push(l); return; }
      l.split(/(?<=[.!?।])\s+(?=[A-Z\u0900-\u0DFF\[])/).forEach((s) => s.trim() && out.push(s.trim()));
    });
    return out;
  }

  function garbageRatio(s) {
    const clean = s.replace(/\s/g, '');
    if (!clean) return 1;
    const bad = clean.replace(/[\p{L}\p{N}\p{M}.,:;%/()\-–+'"!?।]/gu, '').length;
    return bad / clean.length;
  }

  KL.numbersIn = function (s) {
    const western = toWesternDigits(s);
    return (western.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.'));
  };
  function toWesternDigits(s) {
    // Devanagari, Bengali, Gurmukhi, Gujarati, Tamil, Telugu, Kannada digit blocks
    return s.replace(/[\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF]/g, (ch) => String((ch.charCodeAt(0) - 0x0966) % 16 % 10));
  }

  KL.parseLabel = function (text, lowConfWords) {
    const segs = splitSegments(text || '');
    const product = {};
    const items = [];
    segs.forEach((s, i) => {
      for (const [k, rx] of Object.entries(FIELD_RX)) {
        const m = s.match(rx);
        if (m && !product[k]) { product[k] = { value: m[1].trim(), source: s, unclear: /\[\?/.test(s) }; return; }
      }
      const unclear = /\[\?[\s\S]*?\?\]/.test(s) || garbageRatio(s) > 0.3 || s.length < 4;
      let cat = 'other';
      if (CAT_RX.condition.test(s)) cat = 'condition';
      else if (CAT_RX.warning.test(s)) cat = 'warning';
      else if (CAT_RX.instruction.test(s)) cat = 'instruction';
      let severity = null;
      if (cat === 'warning' || cat === 'condition') {
        severity = DANGER_RX.test(s) ? 'danger' : CAUTION_RX.test(s) ? 'caution' : (cat === 'warning' ? 'note' : null);
      }
      items.push({ id: 's' + (i + 1), cat, source: s, unclear, severity, numbers: KL.numbersIn(s) });
    });
    // concentration: from ingredient line if present, else first matching segment
    const concSrc = (product.ingredient && product.ingredient.value.match(CONC_RX)) ? product.ingredient.source : segs.find((s) => CONC_RX.test(s));
    if (concSrc) product.concentration = { value: concSrc.match(CONC_RX)[0], source: concSrc };

    const checklist = CHECKLIST.map((c) => ({ key: c.key, label: c.label, found: segs.some((s) => c.rx.test(s)) }));
    const glossary = GLOSSARY.filter((g) => g.rx.test(text || '')).map((g) => ({ term: g.term, en: g.en, hi: g.hi }));
    const stillLow = (lowConfWords || []).filter((w, i, a) => a.indexOf(w) === i && w.length > 1 && (text || '').includes(w)).slice(0, 24);
    const marked = ((text || '').match(/\[\?([\s\S]*?)\?\]/g) || []).map((m) => m.slice(2, -2).trim());
    return { product, items, checklist, glossary, lowConf: stillLow, marked, segmentCount: segs.length };
  };

  /* ------------------------------------------------------------------ */
  /* Explanations                                                        */
  /* ------------------------------------------------------------------ */
  const RB = {
    en: ['This is a usage instruction from the label. Figures and units are copied exactly:', 'This is a warning printed on the label. Follow it exactly as written:', 'This is a condition or restriction stated on the label:', 'Rule-based demo mode — not an AI translation. Each line is classified and the original wording is kept unchanged.', 'Danger (stated on label)', 'Caution (stated on label)', 'Warning statement — severity not stated'],
    hi: ['यह लेबल पर दिया गया उपयोग निर्देश है। अंक और इकाइयाँ बिल्कुल वैसी ही रखी गई हैं:', 'यह लेबल पर छपी चेतावनी है। इसे ठीक वैसे ही मानें जैसा लिखा है:', 'यह लेबल पर लिखी शर्त या प्रतिबंध है:', 'नियम-आधारित डेमो मोड — यह AI अनुवाद नहीं है। हर पंक्ति को वर्गीकृत किया गया है और मूल शब्द बिना बदले रखे गए हैं।', 'खतरा (लेबल पर लिखा)', 'सावधानी (लेबल पर लिखा)', 'चेतावनी कथन — गंभीरता नहीं बताई गई'],
    mr: ['ही लेबलवरील वापराची सूचना आहे. आकडे आणि एकके जशीच्या तशी ठेवली आहेत:', 'हा लेबलवर छापलेला इशारा आहे. जसा लिहिला आहे तसाच पाळा:', 'ही लेबलवर नमूद केलेली अट किंवा निर्बंध आहे:', 'नियम-आधारित डेमो मोड — हे AI भाषांतर नाही. प्रत्येक ओळ वर्गीकृत केली आहे आणि मूळ शब्द न बदलता ठेवले आहेत.', 'धोका (लेबलवर नमूद)', 'सावधगिरी (लेबलवर नमूद)', 'इशारा विधान — तीव्रता नमूद नाही'],
    bn: ['এটি লেবেলে দেওয়া ব্যবহারের নির্দেশনা। সংখ্যা ও একক হুবহু রাখা হয়েছে:', 'এটি লেবেলে ছাপা সতর্কতা। যেমন লেখা আছে ঠিক তেমনই মেনে চলুন:', 'এটি লেবেলে উল্লিখিত শর্ত বা নিষেধাজ্ঞা:', 'নিয়ম-ভিত্তিক ডেমো মোড — এটি AI অনুবাদ নয়। প্রতিটি লাইন শ্রেণিবদ্ধ করা হয়েছে এবং মূল শব্দ অপরিবর্তিত রাখা হয়েছে।', 'বিপদ (লেবেলে উল্লিখিত)', 'সাবধানতা (লেবেলে উল্লিখিত)', 'সতর্কতা বিবৃতি — তীব্রতা উল্লেখ নেই'],
    te: ['ఇది లేబుల్‌లోని వినియోగ సూచన. సంఖ్యలు, యూనిట్లు యథాతథంగా ఉంచబడ్డాయి:', 'ఇది లేబుల్‌పై ముద్రించిన హెచ్చరిక. రాసినట్లే పాటించండి:', 'ఇది లేబుల్‌లో పేర్కొన్న షరతు లేదా పరిమితి:', 'నియమ-ఆధారిత డెమో మోడ్ — ఇది AI అనువాదం కాదు. ప్రతి పంక్తి వర్గీకరించబడింది, అసలు పదాలు మార్చకుండా ఉంచబడ్డాయి.', 'ప్రమాదం (లేబుల్‌లో పేర్కొన్నది)', 'జాగ్రత్త (లేబుల్‌లో పేర్కొన్నది)', 'హెచ్చరిక ప్రకటన — తీవ్రత పేర్కొనబడలేదు'],
    ta: ['இது லேபிளில் உள்ள பயன்பாட்டு வழிமுறை. எண்களும் அலகுகளும் அப்படியே வைக்கப்பட்டுள்ளன:', 'இது லேபிளில் அச்சிடப்பட்ட எச்சரிக்கை. எழுதியபடியே பின்பற்றவும்:', 'இது லேபிளில் குறிப்பிடப்பட்ட நிபந்தனை அல்லது கட்டுப்பாடு:', 'விதி அடிப்படையிலான டெமோ முறை — இது AI மொழிபெயர்ப்பு அல்ல. ஒவ்வொரு வரியும் வகைப்படுத்தப்பட்டு, அசல் வாசகம் மாற்றமின்றி வைக்கப்பட்டுள்ளது.', 'ஆபத்து (லேபிளில் குறிப்பிடப்பட்டது)', 'எச்சரிக்கை (லேபிளில் குறிப்பிடப்பட்டது)', 'எச்சரிக்கை வாசகம் — தீவிரம் குறிப்பிடப்படவில்லை'],
    kn: ['ಇದು ಲೇಬಲ್‌ನಲ್ಲಿರುವ ಬಳಕೆಯ ಸೂಚನೆ. ಸಂಖ್ಯೆಗಳು ಮತ್ತು ಘಟಕಗಳನ್ನು ಹಾಗೆಯೇ ಇರಿಸಲಾಗಿದೆ:', 'ಇದು ಲೇಬಲ್‌ನಲ್ಲಿ ಮುದ್ರಿಸಿದ ಎಚ್ಚರಿಕೆ. ಬರೆದಂತೆಯೇ ಪಾಲಿಸಿ:', 'ಇದು ಲೇಬಲ್‌ನಲ್ಲಿ ಹೇಳಿರುವ ಷರತ್ತು ಅಥವಾ ನಿರ್ಬಂಧ:', 'ನಿಯಮ-ಆಧಾರಿತ ಡೆಮೊ ಮೋಡ್ — ಇದು AI ಅನುವಾದವಲ್ಲ. ಪ್ರತಿ ಸಾಲನ್ನು ವರ್ಗೀಕರಿಸಲಾಗಿದೆ ಮತ್ತು ಮೂಲ ಪದಗಳನ್ನು ಬದಲಾಯಿಸದೆ ಇರಿಸಲಾಗಿದೆ.', 'ಅಪಾಯ (ಲೇಬಲ್‌ನಲ್ಲಿ ಹೇಳಿದೆ)', 'ಎಚ್ಚರಿಕೆ (ಲೇಬಲ್‌ನಲ್ಲಿ ಹೇಳಿದೆ)', 'ಎಚ್ಚರಿಕೆ ಹೇಳಿಕೆ — ತೀವ್ರತೆ ಹೇಳಿಲ್ಲ'],
    gu: ['આ લેબલ પરની ઉપયોગ સૂચના છે. આંકડા અને એકમો જેમના તેમ રાખ્યા છે:', 'આ લેબલ પર છાપેલી ચેતવણી છે. લખ્યું છે તેમ જ પાળો:', 'આ લેબલ પર જણાવેલ શરત અથવા પ્રતિબંધ છે:', 'નિયમ-આધારિત ડેમો મોડ — આ AI અનુવાદ નથી. દરેક લીટીનું વર્ગીકરણ કર્યું છે અને મૂળ શબ્દો બદલ્યા વિના રાખ્યા છે.', 'જોખમ (લેબલ પર જણાવેલ)', 'સાવચેતી (લેબલ પર જણાવેલ)', 'ચેતવણી વિધાન — તીવ્રતા જણાવી નથી'],
    pa: ['ਇਹ ਲੇਬਲ ਉੱਤੇ ਦਿੱਤੀ ਵਰਤੋਂ ਦੀ ਹਦਾਇਤ ਹੈ। ਅੰਕ ਅਤੇ ਇਕਾਈਆਂ ਜਿਉਂ ਦੀਆਂ ਤਿਉਂ ਰੱਖੀਆਂ ਗਈਆਂ ਹਨ:', 'ਇਹ ਲੇਬਲ ਉੱਤੇ ਛਪੀ ਚੇਤਾਵਨੀ ਹੈ। ਜਿਵੇਂ ਲਿਖੀ ਹੈ ਉਵੇਂ ਹੀ ਮੰਨੋ:', 'ਇਹ ਲੇਬਲ ਉੱਤੇ ਦੱਸੀ ਸ਼ਰਤ ਜਾਂ ਪਾਬੰਦੀ ਹੈ:', 'ਨਿਯਮ-ਆਧਾਰਿਤ ਡੈਮੋ ਮੋਡ — ਇਹ AI ਅਨੁਵਾਦ ਨਹੀਂ ਹੈ। ਹਰ ਲਾਈਨ ਨੂੰ ਸ਼੍ਰੇਣੀਬੱਧ ਕੀਤਾ ਗਿਆ ਹੈ ਅਤੇ ਅਸਲ ਸ਼ਬਦ ਬਿਨਾਂ ਬਦਲੇ ਰੱਖੇ ਗਏ ਹਨ।', 'ਖ਼ਤਰਾ (ਲੇਬਲ ਉੱਤੇ ਦੱਸਿਆ)', 'ਸਾਵਧਾਨੀ (ਲੇਬਲ ਉੱਤੇ ਦੱਸਿਆ)', 'ਚੇਤਾਵਨੀ ਕਥਨ — ਗੰਭੀਰਤਾ ਨਹੀਂ ਦੱਸੀ'],
  };
  KL.rb = (lang, i) => (RB[lang] || RB.en)[i];
  KL.severityLabel = (lang, sev) => sev === 'danger' ? KL.rb(lang, 4) : sev === 'caution' ? KL.rb(lang, 5) : KL.rb(lang, 6);

  function ruleExplain(item, lang) {
    const idx = item.cat === 'instruction' ? 0 : item.cat === 'warning' ? 1 : 2;
    return { plain: KL.rb(lang, idx), quote: item.source, mode: 'rules' };
  }

  KL.aiAvailable = () => !!window.KL_BACKEND_AI_ENABLED;

  // Grounding check: the explanation may not add or drop any number present in the source segment.
  KL.checkGrounding = function (source, plain) {
    const src = KL.numbersIn(source), out = KL.numbersIn(plain);
    const added = out.filter((n) => !src.includes(n));
    const dropped = src.filter((n) => !out.includes(n));
    return { ok: added.length === 0 && dropped.length === 0, added, dropped };
  };

  async function aiExplainBatch(batch, langCode) {
    const segments = batch.map((item) => ({ id: item.id, category: item.cat, text: item.source }));
    const response = await fetch('/api/explain-label', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ labelText: segments.map((item) => item.text).join('\n'), language: langCode, segments }) });
    let data;
    try { data = await response.json(); } catch (e) { throw new Error('The explanation service returned an unreadable response.'); }
    if (!response.ok) throw new Error((data.error && data.error.message) || 'The explanation service is unavailable.');
    return (data.lineExplanations || []).map((item) => ({ id: item.id, plain: item.explanation }));
  }

  // Produces { mode, lang, items: {id: {plain, quote, mode, grounding?, note?}}, notice, errors[] }
  KL.explain = async function (parsed, lang, opts) {
    const o = opts || {};
    const targets = parsed.items.filter((it) => it.cat !== 'other');
    const result = { lang, createdAt: Date.now(), items: {}, errors: [], mode: 'rules' };
    targets.forEach((it) => {
      if (it.unclear) result.items[it.id] = { plain: null, unclear: true, quote: it.source, mode: 'none' };
    });
    const todo = targets.filter((it) => !it.unclear);
    const useAI = o.mode !== 'rules' && KL.aiAvailable();
    if (!useAI) {
      todo.forEach((it) => (result.items[it.id] = ruleExplain(it, lang)));
      result.notice = KL.aiAvailable() ? 'rules-selected' : 'ai-unconfigured';
      return result;
    }
    result.mode = 'ai';
    const size = lang === 'en' ? 6 : 3;
    for (let i = 0; i < todo.length; i += size) {
      const batch = todo.slice(i, i + size);
      o.onProgress && o.onProgress(Math.min(1, i / Math.max(1, todo.length)));
      let rows = null;
      try { rows = await aiExplainBatch(batch, lang); }
      catch (e) {
        result.errors.push('The AI service did not return a usable answer for ' + batch.length + ' line(s). Showing rule-based labels for those lines instead.');
      }
      batch.forEach((it) => {
        const row = rows && rows.find((r) => r && r.id === it.id);
        const plain = row && typeof row.plain === 'string' ? row.plain.trim() : '';
        if (!plain) { result.items[it.id] = { ...ruleExplain(it, lang), note: rows ? 'AI skipped this line.' : undefined }; return; }
        if (/unable to verify from the label/i.test(plain)) { result.items[it.id] = { plain: null, unclear: true, quote: it.source, mode: 'ai' }; return; }
        const g = KL.checkGrounding(it.source, plain);
        if (!g.ok) {
          result.items[it.id] = { ...ruleExplain(it, lang), withheld: true, grounding: g,
            note: 'AI explanation withheld — it ' + [g.added.length ? 'added ' + g.added.join(', ') : '', g.dropped.length ? 'dropped ' + g.dropped.join(', ') : ''].filter(Boolean).join(' and ') + '. Showing the original wording only.' };
          return;
        }
        result.items[it.id] = { plain, quote: it.source, mode: 'ai', grounding: g };
      });
    }
    o.onProgress && o.onProgress(1);
    const hasAiExplanation = Object.values(result.items).some((item) => item.mode === 'ai');
    result.mode = hasAiExplanation ? 'ai' : 'rules';
    if (!hasAiExplanation && result.errors.length) result.notice = 'ai-unavailable';
    return result;
  };

  /* ------------------------------------------------------------------ */
  /* Storage (on-device only)                                            */
  /* ------------------------------------------------------------------ */
  const KEY = 'kl.scans.v1';
  KL.listScans = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  KL.getScan = (id) => KL.listScans().find((s) => s.id === id) || null;
  KL.saveScan = function (rec) {
    const all = KL.listScans().filter((s) => s.id !== rec.id);
    all.unshift(rec);
    try { localStorage.setItem(KEY, JSON.stringify(all.slice(0, 60))); return { ok: true }; }
    catch (e) {
      // Storage full: retry without image thumbnails
      const slim = all.map((s, i) => (i === 0 ? { ...s, thumb: null, thumbDropped: !!s.thumb } : { ...s, thumb: null }));
      try { localStorage.setItem(KEY, JSON.stringify(slim.slice(0, 60))); return { ok: true, droppedImages: true }; }
      catch (e2) { return { ok: false, error: 'Device storage is full. Delete some saved scans and try again.' }; }
    }
  };
  KL.deleteScan = function (id) { localStorage.setItem(KEY, JSON.stringify(KL.listScans().filter((s) => s.id !== id))); };
  KL.clearScans = () => localStorage.removeItem(KEY);
  KL.newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ------------------------------------------------------------------ */
  /* Sample label (fictional — for demonstration only)                   */
  /* ------------------------------------------------------------------ */
  KL.SAMPLE_TEXT = `SAMPLE LABEL - FOR DEMONSTRATION ONLY - NOT A REAL PRODUCT
Product name: DEMOGUARD 25 EC
Active ingredient: Examplofen 25% w/w EC
Manufactured by: Sample Agro Pvt. Ltd. (fictional)
Registration No.: SAMPLE-0000
Directions for use: Dilute 2 ml in 1 litre of water. Spray evenly on affected leaves.
Do not apply more than 2 sprays per season.
Waiting period: 7 days before harvest.
CAUTION: Harmful if swallowed. Avoid contact with skin and eyes.
Wear gloves, mask and full sleeves while spraying.
Do not spray against the wind.
Keep away from children, food and animal feed.
First aid: If swallowed, get medical help immediately and show this label.
Store in a cool, dry place in the original container.`;

  // Renders the fictional label to a canvas so the demo runs through real OCR.
  KL.drawSampleLabel = function () {
    const W = 1400, H = 1900;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fbf8ef'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1f3b2d'; x.fillRect(0, 0, W, 210);
    x.fillStyle = '#f6f2e8'; x.font = '700 40px Arial, sans-serif'; x.fillText('SAMPLE LABEL - FOR DEMONSTRATION ONLY', 70, 90);
    x.font = '400 32px Arial, sans-serif'; x.fillText('NOT A REAL PRODUCT', 70, 150);
    const lines = KL.SAMPLE_TEXT.split('\n').slice(1);
    let y = 300;
    x.fillStyle = '#1a1c18';
    const wrap = (txt, font, lh) => {
      x.font = font; const words = txt.split(' '); let line = '';
      words.forEach((w) => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > W - 140) { x.fillText(line, 70, y); y += lh; line = w; } else line = t; });
      if (line) { x.fillText(line, 70, y); y += lh; }
    };
    lines.forEach((l, i) => {
      if (i === 0) { wrap(l, '700 58px Arial, sans-serif', 76); y += 10; return; }
      if (/^CAUTION/.test(l)) {
        y += 16; x.fillStyle = '#f3e3b8'; x.fillRect(50, y - 52, W - 100, 150); x.fillStyle = '#1a1c18';
        y += 6; wrap(l, '700 40px Arial, sans-serif', 56); y += 40; return;
      }
      wrap(l, '400 40px Arial, sans-serif', 58); y += 18;
    });
    x.strokeStyle = '#1f3b2d'; x.lineWidth = 6; x.strokeRect(20, 20, W - 40, H - 40);
    return c;
  };

  /* ------------------------------------------------------------------ */
  /* Report                                                              */
  /* ------------------------------------------------------------------ */
  KL.buildReport = function (rec, exp) {
    const L = [];
    const p = rec.parsed;
    L.push('Kissan Drishti — Label Reading Report');
    L.push('Created: ' + new Date(rec.createdAt).toLocaleString());
    if (rec.isSample) L.push('*** SAMPLE DATA — fictional demonstration label, not a real product ***');
    L.push('Explanation language: ' + window.KL_I18N.langInfo(exp ? exp.lang : rec.lang).name);
    L.push('Explanation mode: ' + (exp && exp.mode === 'ai' ? 'AI (numbers checked against source)' : 'Rule-based demo (no AI translation)'));
    L.push('');
    L.push('== PRODUCT INFORMATION (as detected in supplied text) ==');
    [['product', 'Product name'], ['ingredient', 'Active ingredient'], ['concentration', 'Concentration'], ['manufacturer', 'Manufacturer'], ['registration', 'Registration']].forEach(([k, n]) => {
      L.push(n + ': ' + (p.product[k] ? p.product[k].value : 'Not found in the supplied label text.'));
    });
    ['instruction', 'warning', 'condition'].forEach((cat) => {
      const its = p.items.filter((i) => i.cat === cat);
      L.push('');
      L.push('== ' + { instruction: 'LABEL INSTRUCTIONS', warning: 'SAFETY WARNINGS', condition: 'IMPORTANT CONDITIONS' }[cat] + ' ==');
      if (!its.length) L.push('Not found in the supplied label text.');
      its.forEach((it) => {
        const e = exp && exp.items[it.id];
        L.push('- ORIGINAL: ' + it.source);
        if (it.unclear || (e && e.unclear)) L.push('  EXPLANATION: Unable to verify from the label.');
        else if (e && e.mode === 'ai') L.push('  EXPLANATION: ' + e.plain);
        if (e && e.note) L.push('  NOTE: ' + e.note);
      });
    });
    L.push('');
    L.push('== NOT FOUND IN SUPPLIED TEXT ==');
    const nf = p.checklist.filter((c) => !c.found);
    L.push(nf.length ? nf.map((c) => '- ' + c.label).join('\n') : '- (all common sections were detected)');
    if (p.lowConf.length) { L.push(''); L.push('OCR was unsure about: ' + p.lowConf.join(', ')); }
    L.push('');
    L.push('----');
    L.push('Kissan Drishti helps explain supplied label information. It does not replace the official product label, product registration information, or advice from a qualified agricultural professional. Always check against the physical label.');
    return L.join('\n');
  };

  window.KL = KL;
})();

// Kissan Drishti — live pesticide product lookup and label comparison.
function ProductSearchPage() {
  const { query: routeQuery } = useRouter();
  const { lang } = useLang();
  const [query, setQuery] = useState(() => routeQuery.get('q') || '');
  const [labelText, setLabelText] = useState(() => routeQuery.get('labelText') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('search');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const searchControlRef = useRef(null);

  useEffect(() => {
    setQuery(routeQuery.get('q') || '');
    setLabelText(routeQuery.get('labelText') || '');
  }, [routeQuery]);

  async function request(path, options) {
    let response;
    try { response = await fetch(path, options); }
    catch (error) {
      if (!navigator.onLine || error instanceof TypeError) throw new Error('You appear to be offline or the server could not be reached. Reconnect and retry.');
      throw error;
    }
    let body;
    try { body = await response.json(); } catch (e) { throw new Error('The server returned an unreadable response.'); }
    if (!response.ok) throw new Error((body.error && body.error.message) || 'The request could not be completed.');
    return body;
  }

  async function runSearch(event) {
    event && event.preventDefault();
    setSuggestionsOpen(false);
    const q = query.trim();
    if (q.length < 2) { setError('Enter a product name or active ingredient (at least 2 characters).'); return; }
    if (q.length > 200) { setError('Keep the search under 200 characters.'); return; }
    setMode('search'); setBusy(true); setError(''); setResult(null);
    try { setResult(await request('/api/search-products?q=' + encodeURIComponent(q))); }
    catch (e) { setError(e.message || 'Search failed. Please try again.'); }
    finally { setBusy(false); }
  }

  async function runAnalysis(event) {
    event && event.preventDefault();
    const text = labelText.trim();
    if (text.length < 10) { setError('Paste at least 10 characters of reviewed label text.'); return; }
    if (text.length > 12000) { setError('Keep label text under 12,000 characters.'); return; }
    setMode('analysis'); setBusy(true); setError(''); setResult(null);
    try {
      setResult(await request('/api/analyze-label', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelText: text, language: lang }),
      }));
    } catch (e) { setError(e.message || 'Label comparison failed. Please try again.'); }
    finally { setBusy(false); }
  }

  const products = result && (result.products || result.matches || []);
  return (
    <div className="page route-fade products-page" data-screen-label="Product search">
      <div className="wrap-narrow">
        <div className="page-head">
          <div><div className="eyebrow">Live source search</div><h1>Find pesticide product information</h1>
            <p className="lede">Search real web results for product names or active ingredients, or compare reviewed label text with linked sources.</p></div>
        </div>
        <div className="card product-search-card">
          <form onSubmit={runSearch}>
            <label htmlFor="product-query">Product name or active ingredient</label>
            <div ref={searchControlRef} className="product-search-control" onFocus={() => { if (query.trim().length >= 2) setSuggestionsOpen(true); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false); }}>
              <div className="product-query-row">
                <input id="product-query" role="combobox" aria-autocomplete="list" aria-controls="product-query-suggestions" aria-expanded={suggestionsOpen && query.trim().length >= 2 && !busy} aria-activedescendant={suggestionsOpen && query.trim().length >= 2 && !busy ? 'product-query-option' : undefined} value={query} onChange={(e) => { setQuery(e.target.value); setSuggestionsOpen(true); }} onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && query.trim().length >= 2) { event.preventDefault(); setSuggestionsOpen(true); }
                  else if (event.key === 'Enter' && suggestionsOpen && query.trim().length >= 2) { event.preventDefault(); runSearch(); }
                  else if (event.key === 'Escape') setSuggestionsOpen(false);
                }} maxLength="200" placeholder="e.g. product name or active ingredient" autoComplete="off" />
                <button className="btn btn-primary" type="submit" disabled={busy}><Icon name="Search" />Search products</button>
              </div>
              {suggestionsOpen && query.trim().length >= 2 && !busy && <div id="product-query-suggestions" className="product-query-suggestions" role="listbox" aria-label="Search suggestion">
                <button id="product-query-option" type="button" role="option" aria-selected="true" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSuggestionsOpen(false); runSearch(); }}><Icon name="Search" size={16} /><span>Search all sources for <b>“{query.trim()}”</b></span><span className="product-suggestion-key" aria-hidden="true">↵</span></button>
              </div>}
            </div>
          </form>
          <div className="product-or"><span>Or compare reviewed OCR text</span></div>
          <form onSubmit={runAnalysis}>
            <label htmlFor="label-text">Confirmed label text</label>
            <textarea id="label-text" rows="7" maxLength="12000" value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="Paste the text you reviewed against the physical pesticide label." />
            <div className="product-form-foot"><span className="muted">{labelText.length}/12,000 characters · reviewed text is sent to the server for comparison</span>
              <button className="btn btn-leaf" type="submit" disabled={busy}><Icon name="ScanSearch" />Analyze and compare</button>
            </div>
          </form>
        </div>

        {busy && <div className="product-state" role="status" aria-live="polite"><div className="card processing"><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><div className="spinner" style={{ color: 'var(--leaf)' }} /><b>{mode === 'analysis' ? 'Searching sources and comparing label fields…' : 'Searching product sources…'}</b></div><p className="muted" style={{ marginTop: 10 }}>This uses live provider results. It does not authenticate a product.</p></div><div className="product-skeletons" aria-hidden="true"><div className="product-skeleton" /><div className="product-skeleton" /></div></div>}
        {error && <div className="product-state"><Alert tone="red"><b>Could not complete the request.</b> {error}</Alert><button className="btn btn-soft btn-sm" style={{ marginTop: 12 }} onClick={mode === 'analysis' ? runAnalysis : runSearch}><Icon name="RefreshCw" size={16} />Retry</button></div>}
        {!busy && result && products.length === 0 && <div className="card product-state"><h2>No reliable match found</h2><p>{result.message || 'The search provider returned no relevant sources. Try another product or ingredient name.'}</p></div>}
        {!busy && result && products.length > 0 && (
          <section className="product-results" aria-live="polite">
            {result.summary && <div className="card product-summary"><div className="eyebrow">Gemini source summary · not independently verified</div><p>{renderSourceCitations(result.summary, products)}</p></div>}
            {result.aiStatus === 'unavailable' && <div className="product-state"><Alert tone="neutral">{result.aiError || 'Gemini summary is unavailable. Search results and source links are still shown.'}</Alert></div>}
            {result.extractedFields && <div className="card product-fields"><h2>Fields read from your label</h2><FieldList fields={result.extractedFields} empty="No named product fields could be read from the supplied text." /></div>}
            {result.comparisons && <div className="card product-fields"><h2>Label and source comparison</h2>
              {result.comparisons.map((c) => <div key={c.productId} className="comparison-block"><h3>{c.title}</h3><p className="muted">{c.identityStatus === 'sufficient-match' ? 'Several product details match these search results.' : 'Possible source only; the available details are insufficient to identify this as the same product.'}</p>
                {c.fields.length ? <div className="comparison-list">{c.fields.map((f) => <div className={'comparison-row ' + f.status} key={f.key}><b>{f.label}</b><span>Label: {f.labelValue}</span><span>Source: {f.sourceValue}</span><strong>{f.status === 'match' ? 'Matches' : 'Conflicts'}</strong></div>)}</div> : <p className="muted">Unable to verify from available sources; no comparable fields were found in the retrieved pages.</p>}
              </div>)}
              {result.unverifiedFields && result.unverifiedFields.length > 0 && <p className="muted">Unable to verify from available sources: {result.unverifiedFields.join(', ')}.</p>}
            </div>}
            <h2 className="product-results-title">{mode === 'analysis' ? 'Potential source matches' : 'Search results'} <span className="muted">({products.length})</span></h2>
            {products.map((p) => <ProductResultCard key={p.id} product={p} />)}
          </section>
        )}
        <div className="product-safety"><Disclaimer style={{ fontSize: 14 }} /><p>Search results are leads, not proof of product identity, registration, authenticity, or suitability. Check the official physical label and consult a qualified agricultural professional when needed.</p></div>
      </div>
    </div>
  );
}

function renderSourceCitations(summary, products) {
  return String(summary).split(/(\[S\d+\])/g).map((part, index) => {
    const match = /^\[S(\d+)\]$/.exec(part);
    if (!match) return part;
    const product = products[Number(match[1]) - 1];
    return product ? <a key={index} href={product.url} target="_blank" rel="noopener noreferrer" title={`Open source: ${product.title}`}>{part}</a> : part;
  });
}

function FieldList({ fields, empty }) {
  const rows = Object.entries(fields || {}).filter(([, v]) => v && typeof v.value === 'string');
  if (!rows.length) return <p className="muted">{empty}</p>;
  return <dl className="product-field-list">{rows.map(([key, v]) => <React.Fragment key={key}><dt>{v.label || key}</dt><dd>{v.value}</dd></React.Fragment>)}</dl>;
}

function ProductResultCard({ product }) {
  return (
    <article className="card product-result-card interactive-tilt tilt-card" data-tilt-strength="2.2" onPointerMove={setPointerTilt} onPointerLeave={resetPointerTilt}>
      <div className="product-result-head"><div><span className="chip">{product.sourceClass === 'government-domain' ? 'Government domain' : 'Web search result'}</span><h3>{product.title}</h3></div>
        <span className="product-score">{Math.round((product.score || 0) * 100)}% relevance</span></div>
      <p className="product-unverified">{product.verificationStatus === 'source-linked-unverified' ? 'Source-linked information · not independently verified' : 'Unverified source data'}</p>
      <FieldList fields={product.fields} empty="No product attributes were explicitly found in this result." />
      <p className="product-snippet">{product.snippet}</p>
      <a href={product.url} target="_blank" rel="noopener noreferrer">Open source: {product.domain} <Icon name="ExternalLink" size={15} /></a>
      <small>Retrieved {new Date(product.retrievedAt).toLocaleString()}</small>
    </article>
  );
}

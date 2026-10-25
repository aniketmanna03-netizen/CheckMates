# Kissan Drishti

Kissan Drishti is a static React application served from `public/`, with Netlify Functions under `netlify/functions/`. The frontend is compiled from the existing JSX at build time. The OCR engine runs in the user's browser; uploaded images are never sent to the AI backend. The backend retrieves web results with Tavily and asks Gemini to analyze only those retrieved sources or user-confirmed label text.

## AI research and pesticide safety

- `GET /api/search-products?q=...` retrieves live Tavily results and returns source URLs for clickable citations. Gemini summarizes only the returned evidence. Search pages and snippets are untrusted input.
- `POST /api/analyze-label` extracts fields from reviewed label text, compares them with retrieved sources, and reports matches, conflicts, and missing or unverified fields. A match does not prove identity, registration, authenticity, or suitability.
- `POST /api/explain-label` explains user-confirmed label text. Original wording stays alongside explanations. Safety-critical lines are preserved, and missing details are stated as unverified.
- The system must not invent or recommend pesticide dosage, mixing ratios, application instructions, waiting periods, registration status, or safety directions. Check all numbers against the container label and consult a qualified agriculture professional when information is missing or unclear.
- API credentials are read only by Netlify Functions from server-side environment variables. Never place them in HTML, frontend JavaScript, browser storage, or build-time public variables.

## Requirements and setup

Requires Node.js 20 or newer and pnpm. Create Google AI Studio and Tavily accounts and provision API keys. Google lists [`gemini-3.5-flash-lite` as a stable model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite); the project uses Google's official [`@google/genai` JavaScript SDK](https://github.com/googleapis/js-genai).

```sh
pnpm install
cp .env.example .env
```

Put your real `GEMINI_API_KEY` and `TAVILY_API_KEY` into the ignored `.env` file. Set `GEMINI_MODEL=gemini-3.5-flash-lite`. `.env.example` contains placeholders only. Never commit `.env` or put these values in a `VITE_`, `NEXT_PUBLIC_`, or other browser-exposed variable.

## Local development

```sh
pnpm dev
```

This is the recommended command. Netlify Dev runs the static site and the same Functions routes locally. Open the URL printed by the CLI. If Netlify Dev cannot start in a restricted environment, run `pnpm dev:local`; that compiles the JSX and starts the included local API server.

The scanner accepts JPG, PNG, and WebP images up to 10 MB and 24 megapixels. It checks the image signature and decoded dimensions before OCR. OCR and its language data may need internet access the first time. When offline, use manual text entry or reconnect and retry. The user reviews and corrects extracted text before analysis.

## Tests and production build

```sh
pnpm test
pnpm build
```

The tests use provider mocks and cover endpoint validation, evidence handling, provider failures, local storage, scanner file checks, and Netlify rate-limit declarations. They do not validate live provider credentials. `pnpm build` runs `netlify build --offline`, compiles the frontend and bundles Functions. A successful build does not confirm that provider keys work; run a local Product Search and label comparison with valid credentials to verify live integration.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Google Gemini server-side API credential |
| `GEMINI_MODEL` | Yes for deployment | `gemini-3.5-flash-lite` |
| `TAVILY_API_KEY` | Yes | Tavily server-side search credential |
| `KISANLENS_DEV_STORAGE` | No | Set to `1` only for the local optional product index; leave off in production |

The backend applies request timeouts and request-size checks. The four existing API paths share one Netlify rate-limit rule: 15 total requests per minute per IP and site. This keeps the hosted project within the two-rule code-based limit on Netlify Free/Starter ([current plan limits](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)); the local fallback server does not enforce this platform limit. Review provider quotas and tune the shared limit to actual traffic before launch.

## Netlify deployment

1. Push the project to a Git provider and create a Netlify site linked to that repository. For CLI deployment, run `pnpm exec netlify link` from this directory and choose the site.
2. In Netlify **Project configuration → Environment variables**, create `GEMINI_API_KEY`, `GEMINI_MODEL`, and `TAVILY_API_KEY`. Set the first and third to your provider keys and model to `gemini-3.5-flash-lite`. Grant the variables to **Functions** (or all scopes if the interface only offers that choice). Do not add secret values to public build variables.
3. Confirm the site uses `netlify.toml`, Node 20, publish directory `public`, and Functions directory `netlify/functions`.
4. Run `pnpm build` locally. For a draft deployment, run `pnpm exec netlify deploy` and verify the preview. Publish with `pnpm exec netlify deploy --prod`. Netlify CLI builds by default. For Git-based deploys, push the reviewed commit and inspect the deploy log.
5. Test `/api/search-products` through the Product Search page and test scanner OCR, reviewed text, analysis citations, missing fields, and conflicts. Changing Netlify environment variables requires a new deploy before Functions receive the change.

Rollback through Netlify's **Deploys** page by publishing the last known-good deploy. For CLI deployments, select the prior successful deploy in the dashboard; avoid changing provider keys as a rollback substitute. After rollback, verify a source search and check Function logs for errors.

## Privacy, backups, and recovery

There are no user accounts or server database. Saved scans (confirmed text, explanations, and optional thumbnails) live in browser local storage on that device only. Clearing site data, changing browsers/devices, or browser storage eviction can remove them. Do not store private or identifying information in a label.

Use each result page's **Download** action to save a plain-text copy of an important report outside the browser. Keep the original container and label as the authoritative record. The current app does not provide bulk export/import or a cloud restore service, so browser-local history cannot be recovered after it is cleared. To recover a report, reopen the saved text file; to rebuild a scan, photograph the physical label again and review OCR. Do not enable `KISANLENS_DEV_STORAGE` on a public site; its optional JSON index has no production backup or recovery guarantees.

## Monitoring and incident response

- Review Netlify deploy/build status and Function logs after each release and when users report failures. Provider logs include provider name, status/code, duration, token counts, or result counts; they deliberately omit queries, label text, source content, API keys, and user identifiers.
- Set Netlify notifications for failed deploys and monitor the public landing page and a non-sensitive health check from an external uptime service. A basic HTTP check confirms site availability only, not AI provider health. Use provider dashboards to review quotas and billing.
- On provider errors, check Functions-scoped variables, provider quota/status, and the Netlify Function log code. Never paste keys or pesticide label text into tickets or logs. Rotate a credential immediately if exposed, update the server-side variable, redeploy, and verify a safe test query.
- On a faulty release, publish the last known-good Netlify deploy, then inspect logs and reproduce using non-sensitive sample label text before preparing a fix. Preserve the affected deployment ID and sanitized error code for investigation.

## Maintenance

- Renovate dependencies deliberately: review official SDK and Netlify release notes, update one dependency group at a time, then run `pnpm install`, `pnpm test`, and `pnpm build`. Verify the active Gemini model ID in Google's model catalog before changing it.
- The 37 MB hero video is opt-in: it is fetched only after the visitor selects Play, and is unavailable when reduced motion, data saver, slow 2G, or low-core device preferences are detected.
- There is no repository CI configuration in this project. Run the commands above before deployment; add CI in the hosting repository if automated checks are required.
- No canonical URL or sitemap is configured because a production hostname has not been supplied. Once the final domain is chosen, add a canonical URL and sitemap for public pages only. Scanner, history, product search, and result pages are marked `noindex`; `/api/` is disallowed in `robots.txt`. Do not index private research or user-supplied labels.
- Update `.env.example` only with variable names and placeholders. Confirm `.gitignore` continues to exclude `.env*` secrets, `.netlify/`, local data, build output, and dependency folders.

## Troubleshooting

- **Search says provider is not configured:** check that `TAVILY_API_KEY` is set for Netlify Functions and redeploy.
- **Gemini explanation unavailable:** check `GEMINI_API_KEY`, `GEMINI_MODEL`, provider quota, and sanitized Function error codes. Search sources remain available when Gemini summary fails.
- **OCR engine/language data fails:** reconnect and retry, allow the browser to load Tesseract and language files, or type the label text manually.
- **Upload rejected:** use a real JPG, PNG, or WebP file under 10 MB; avoid HEIC, renamed files, and tiny or blurry images.
- **Build fails:** use Node 20+, run `pnpm install`, then `pnpm test` and `pnpm build`; inspect the first failing diagnostic.

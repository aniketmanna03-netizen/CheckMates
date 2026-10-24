import { createHandlers } from './handlers.mjs';
import { explainLabelWithGemini, summarizeSearchWithGemini, tavilySearch } from './providers.mjs';
import { LocalProductStore } from './store.mjs';

const handlers = createHandlers({
  searchProvider: (query) => tavilySearch(query),
  explainWithGemini: (input) => explainLabelWithGemini(input),
  summarizeWithGemini: (input) => summarizeSearchWithGemini(input),
  store: new LocalProductStore(),
});

export default handlers;

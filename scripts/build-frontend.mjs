import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const root = process.cwd();
const sourceDir = path.join(root, 'public/kl');
const outputDir = path.join(sourceDir, 'build');
const entries = ['ui-shell.jsx', 'home.jsx', 'scan.jsx', 'results.jsx', 'pages.jsx', 'products.jsx', 'app.jsx'];

await mkdir(outputDir, { recursive: true });
for (const file of entries) {
  const source = await readFile(path.join(sourceDir, file), 'utf8');
  const compiled = await transform(source, {
    loader: 'jsx', target: 'es2020', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
    minifySyntax: true, minifyWhitespace: true, legalComments: 'none', sourcefile: file,
  });
  await writeFile(path.join(outputDir, file.replace(/\.jsx$/, '.js')), compiled.code);
}
console.info(`Compiled ${entries.length} existing React JSX pages for production.`);

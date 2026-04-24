import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  target: ['es2017'],
};

await Promise.all([
  rm('dist/ascii-bg.esm.js', { force: true }),
  rm('dist/ascii-bg.cjs', { force: true }),
  rm('dist/ascii-arter.esm.js', { force: true }),
  rm('dist/ascii-arter.cjs', { force: true }),
]);

await build({ ...shared, format: 'esm', outfile: 'dist/ascii-arter.esm.js' });
await build({ ...shared, format: 'cjs', outfile: 'dist/ascii-arter.cjs' });
console.log('Built dist/ascii-arter.esm.js and dist/ascii-arter.cjs');

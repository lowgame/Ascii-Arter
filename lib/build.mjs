import { build } from 'esbuild';

const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  target: ['es2017'],
};

await build({ ...shared, format: 'esm', outfile: 'dist/ascii-bg.esm.js' });
await build({ ...shared, format: 'cjs', outfile: 'dist/ascii-bg.cjs' });
console.log('Built dist/ascii-bg.esm.js and dist/ascii-bg.cjs');

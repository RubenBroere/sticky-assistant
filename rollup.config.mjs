import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import gas from 'rollup-plugin-gas';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'esm', // rollup-plugin-gas expects ES module format to parse exports
  },
  plugins: [
    resolve(),
    typescript(),
    gas(),
  ],
};

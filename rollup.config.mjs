import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import gasPlugin from '@gas-plugin/unplugin/rollup';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm', 
  },
  plugins: [
    json(),
    resolve(),
    typescript(),
    gasPlugin()
  ],
};
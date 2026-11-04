// src/webview-ui/vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { sveltePreprocess } from 'svelte-preprocess'
import { resolve } from 'path'
// import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        scss: {
          prependData: `
            @use "${resolve(__dirname, 'src/lib/styles/variables.scss')}" as *;
            @use "${resolve(__dirname, 'src/lib/styles/mixins.scss')}" as *;
          `,
        },
      }),
      onwarn: (warning, handler) => {
        if (
          warning.code === 'tsconfig.json' &&
          warning.message.includes('Cannot find base config file')
        ) {
          return
        }
        handler(warning)
      },
    }),
    // visualizer({
    //   emitFile: false,
    //   filename: 'stats.html', // pravi HTML fajl sa grafikonom
    //   open: true // automatski otvara grafikon u browseru nakon build-a
    // })
  ],

  base: './',

  resolve: {
    alias: {
      '$lib': resolve(__dirname, 'src/lib'),
      '@': resolve(__dirname, './src'),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "${resolve(__dirname, 'src/lib/styles/variables.scss')}" as *;
          @use "${resolve(__dirname, 'src/lib/styles/mixins.scss')}" as *;
        `,
        charset: false,
      },
    },
  },

  build: {
    outDir: resolve(__dirname, '../../out/webview-assets'),
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    // When you ship the extension you can switch to sourcemap: false or 'hidden' for the final package.
    manifest: true,

    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  server: {
    port: 5174,
    strictPort: true,
    sourcemapIgnoreList: false,
  },
})

// src/webview-ui/vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { sveltePreprocess } from 'svelte-preprocess'
import { resolve } from 'path'
// import { visualizer } from 'rollup-plugin-visualizer'

// Helper to normalize slashes for Sass @use paths across WSL/Linux/Windows
const toPosixPath = (p: string) => p.replace(/\\/g, '/')

const variablesPath = toPosixPath(resolve(import.meta.dirname, 'src/lib/styles/variables.scss'))
const mixinsPath = toPosixPath(resolve(import.meta.dirname, 'src/lib/styles/mixins.scss'))

const scssPrepend = `
  @use "${variablesPath}" as *;
  @use "${mixinsPath}" as *;
`

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        scss: {
          prependData: scssPrepend,
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
      '$lib': resolve(import.meta.dirname, 'src/lib'),
      '@': resolve(import.meta.dirname, 'src'),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: scssPrepend,
        charset: false,
      },
    },
  },

  build: {
    outDir: resolve(import.meta.dirname, '../../out/webview-assets'),
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    manifest: true,

    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
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

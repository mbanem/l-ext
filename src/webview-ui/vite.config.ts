// src/webview-ui/vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { sveltePreprocess } from 'svelte-preprocess'
import { resolve } from 'path'

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
  ],

  base: './',

  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
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
    sourcemap: true,
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
  },
})

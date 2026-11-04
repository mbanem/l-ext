<script lang="ts">
  import { onMount } from 'svelte'
  import '$lib/styles/themes.scss'
  // change based on AI, see /Fwonloads/WebPages/App.svelte&configs.htm

  import {
    applyTheme,
    getIcon,
    getInitialTheme,
    type Theme,
  } from '$lib/utils/toggle-theme'

  // type PageKey = 'OrmOne' |  'OrmThree'
  type TImports = typeof import('./OrmOne.svelte') | typeof import('./OrmThree.svelte')


  const pages = {
    OrmOne: () => import('./OrmOne.svelte'),
    OrmThree: () => import('./OrmThree.svelte'),
  } as const satisfies Record<PageKey, () => Promise<TImports>>

  // The single source of truth is just the current active page key
  let key = $state<PageKey>('OrmOne')
  let theme = $state<Theme>('light')
  let togglePageInfo = $state<TCallbackFunc>()

  function triggerPageInfo() {
    togglePageInfo?.()
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(theme)
  }

  // Trigger initial load
  function getInitialPage(): PageKey {
    let initialPage: PageKey = 'OrmOne' // default
    // Global variable (injected by HTML Webview/assets/ index.js loader)
    if ((window as any).__INITIAL_PAGE) {
      initialPage = (window as any).__INITIAL_PAGE as PageKey
      console.log(`[App] Found window.__INITIAL_PAGE = ${initialPage}`)

      // Clean up
      delete (window as any).__INITIAL_PAGE
    } // Fallback
    else {
      const appDiv = document.getElementById('app')
      initialPage = (appDiv?.dataset.initialPage as PageKey) || 'OrmOne'
    }
    return initialPage
  }
  onMount(() => {
    theme = getInitialTheme()
    applyTheme(theme)

    key = getInitialPage()

    // listener for server-side messages
    const handler = (event: MessageEvent) => {
      try {
        const msg = event.data
        switch (msg.command) {
          case 'showPage':
            const page = msg.page as PageKey
            if (page in pages) {
              key = page
            }
            break
          case 'prismaInitDone':
            key = 'OrmThree'
            break
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log('[App] message handler err',msg)
      }
    }
    window.addEventListener('message', handler)
  
    return () => {
      window.removeEventListener('message', handler)
    }
  })
</script>

<!-- extension send message 'showPage' of name = msg.page
we get Current = $derived(pages[key]) and render it
NOTE: the variable component  must be with capital so
Current is OK while Svelte will treat as a tag a name
<current></current> and will left it as is in the markup
so no page would be rendered
-->

<nav>
  <span class="toggle-info-page" onclick={triggerPageInfo} role='presentation'
    >About This {key} Page
  </span>
  <span
    class="toggle-info-page"
    onclick={() => key = 'OrmOne'}
    role='presentation'
    >OrmOne
  </span>
  <span
    class="toggle-info-page"
    onclick={() => key = 'OrmThree'}
    role='presentation'
    >OrmThree
  </span>
  <p onclick={toggleTheme} role='presentation'>
    <span class="icon">{getIcon(theme)}</span>
  </p>
</nav>

<div class="main">
  {#await pages[key]()}
    <div>Loading page...</div>
  {:then module}
    <!-- Svelte 5 renders the dynamic constructor out of the default export -->
    <module.default bind:pageInfo={togglePageInfo} />
  {:catch error}
    <div>Error: {error.message || String(error)}</div>
  {/await}
</div>

<style lang="scss">
  nav {
    position: static;
    top: 0;
    left: 0;
    display: flex;
    gap: 10px;
    justify-content: flex-start;
    align-items: center;
    width: 100vw;
    height: 1.9rem;
    padding: 0;
    margin: 0;
    font-size: 13px !important;
    color: var(--cr-text);
    background-color: var(--bg);
    span {
      display: inline-block;
      border: 1px solid gray;
      border-radius: 4px;
      width: max-content;
      padding: 0 6px !important;
    }
    p {
      margin-left: auto;
      display: inline-block;
      outline: none;
      background-color: var(--tab-bg);
      z-index: 100;
      span.icon {
        display: inline-block;
        padding: 0;
        margin: 0;
        margin-right: 1rem;
        font-size: 12px;
        outline: none;
        background-color: var(--icon-bg);
        cursor: pointer;
        & > * {
          display: inline-block;
        }
      }
    }
  }

  .toggle-info-page {
    display: inline-block;
    width: max-content;
    padding: 0;
    margin: 0;
    color: var(--cr-text);
    background-color: var(--bg);
    cursor: pointer;
    &:hover {
      color: var(--hover-button);
    }
  }
  .main {
    position: relative;
    width: 100vw;
    height: calc(100vh - 1.9rem);
    padding: 0;
    margin: 0;
    color: var(--cr-text);
    background-color: var(--bg);
  }
</style>

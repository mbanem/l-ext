import * as vscode from 'vscode'

function getNonce(): string {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible[Math.floor(Math.random() * possible.length)]
  }
  return text
}

export async function displayWebview(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  initialPage: 'OrmOne' | 'OrmThree',
): Promise<TResult> {
  console.log('[Webview] displayWebview with initialPage:', initialPage)
  try {
    const html = await loadMainMarkup(context, panel.webview, initialPage)
    panel.webview.html = html

    setTimeout(() => {
      panel.webview.postMessage({
        command: 'showPage',
        page: initialPage,
      })
    }, 500)

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Webview] CRITICAL ERROR in displayWebview:', msg)
    return { success: false, error: msg }
  }
}

async function loadMainMarkup(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  initialPage: string,
): Promise<string> {
  // Always resolve compiled webview assets from context.extensionUri (never workspaceFolders)
  const webviewAssetsUri = vscode.Uri.joinPath(
    context.extensionUri,
    'out',
    'webview-assets',
  )
  const htmlUri = vscode.Uri.joinPath(webviewAssetsUri, 'index.html')

  let html = ''
  try {
    const fileBytes = await vscode.workspace.fs.readFile(htmlUri)
    html = Buffer.from(fileBytes).toString('utf-8')
  } catch {
    console.warn(
      `[Webview] index.html not found at ${htmlUri.toString()}, falling back to Vite dev server`,
    )
    return getDevHtml(webview, initialPage)
  }

  // 1. Setup CSP and safe initial page injection
  const nonce = getNonce()
  const safeInitialPage = JSON.stringify(initialPage).replace(/</g, '\\u003c')

  const csp = [
    `default-src 'none';`,
    `img-src ${webview.cspSource} https: data: blob:;`,
    `style-src ${webview.cspSource} 'unsafe-inline';`,
    `script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval';`,
    `font-src ${webview.cspSource} data:;`,
    `connect-src ${webview.cspSource} https: blob:;`,
    `media-src ${webview.cspSource};`,
  ].join(' ')

  // 2. Inject CSP Meta Tag
  html = html.replace(
    /<\/head>/i,
    `  <meta http-equiv="Content-Security-Policy" content="${csp}">\n</head>`,
  )

  // 3. Inject initial page data attribute on root div
  html = html.replace(
    '<div id="app"></div>',
    `<div id="app" data-initial-page="${initialPage}"></div>`,
  )

  // 4. Rewrite all relative asset paths (./assets/... and ./favicon.png) to webview URIs
  // Handles stylesheets, module scripts, modulepreload links, and favicons regardless of attribute order
  html = html.replace(
    /\b(href|src)="\.\/([^"]+)"/gi,
    (_match, attr: string, relPath: string) => {
      const segments = relPath.split('/')
      const assetUri = vscode.Uri.joinPath(webviewAssetsUri, ...segments)
      const webviewUri = webview.asWebviewUri(assetUri)
      return `${attr}="${webviewUri}"`
    },
  )

  // 5. Add nonce to all <script> tags and inject window.__INITIAL_PAGE before the first script
  let injectedGlobal = false
  html = html.replace(/<script\b([^>]*)>/gi, (_match, attrs: string) => {
    const withNonce = attrs.includes('nonce=')
      ? `<script${attrs}>`
      : `<script nonce="${nonce}"${attrs}>`

    if (!injectedGlobal) {
      injectedGlobal = true
      return `<script nonce="${nonce}">window.__INITIAL_PAGE = ${safeInitialPage};</script>\n  ${withNonce}`
    }
    return withNonce
  })

  return html
}

function getDevHtml(webview: vscode.Webview, initialPage: string): string {
  const devUrl = `http://localhost:5174/${initialPage}.html`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline' http://localhost:5174; connect-src http://localhost:5174 ws://localhost:5174;">
  <title>CRUD DEV — ${initialPage}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="${devUrl}"></script>
</body>
</html>
`
}
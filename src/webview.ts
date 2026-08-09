import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

function getNonce(): string {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible[Math.floor(Math.random() * possible.length)]
  }
  return text
}

export function displayWebview(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  initialPage: 'OrmOne' | 'OrmTwo' | 'OrmThree',
): TResult {
  // initialPage = 'index'
  console.log('[Webview] displayWebview with initialPage', initialPage)
  try {
    const html = loadMainMarkup(context, panel.webview, initialPage)
    console.log(`[Webview] Setting panel.webview.html (length: ${html.length})`)
    panel.webview.html = html
    console.log(
      '[Webview] displayWebview: HTML loaded into panel.webview.html successfully',
    )
    setTimeout(() => {
      panel.webview.postMessage({
        command: 'showPage',
        page: initialPage,
      })
    }, 500)
    console.log(`[Webview] displayWebview FINISHED successfully`)
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Webview] CRITICAL ERROR in displayWebview:`, msg)
    return { success: false, error: msg }
  }
}

function loadMainMarkup(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  initialPage: string,
): string {
  console.log(
    `[webview] loadMainMarkup: Injecting data-initial-page or window.__INITIAL_PAGE = ${initialPage}`,
  )
  const nonce = getNonce()

  // Locate the HTML file
  const root =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
    context.extensionUri.fsPath
  if (!root) {
    throw new Error('No workspace folder or extension root found.')
  }

  const htmlPath = path.join(root, 'out', 'webview-assets', `index.html`)

  if (!htmlPath || !fs.existsSync(htmlPath)) {
    console.log(
      `[Webview] ⚠️ HTML not found for index.html, falling back to dev mode`,
    )
    return getDevHtml(webview, 'index')
  }
  console.log(`[Webview] ✅ Using HTML: ${htmlPath}`)
  let html = fs.readFileSync(htmlPath, 'utf-8')

  // === BEST FIX: Rebuild all asset URLs using asWebviewUri ===
  const assetsFolder = vscode.Uri.joinPath(
    context.extensionUri,
    'out',
    'webview-assets',
  )

  html = html.replace(
    /(src|href)=["'](\.\/)?([^"']+)["']/gi,
    (fullMatch, attr, dotSlash, relativePath) => {
      // Skip external or already-processed URLs
      if (
        relativePath.startsWith('http') ||
        relativePath.startsWith('data:') ||
        relativePath.startsWith('#')
      ) {
        return fullMatch
      }

      try {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(assetsFolder, relativePath),
        )
        return `${attr}="${assetUri}"`
      } catch (err) {
        console.log(`Failed to convert asset: ${relativePath}`)
        return fullMatch
      }
    },
  )

  console.log(`[webview] raw ${initialPage}html length: ${html.length}`)
  // Inject CSP
  const csp = [
    `default-src 'none';`,
    `img-src ${webview.cspSource} https: data: blob:;`,
    `style-src ${webview.cspSource} 'unsafe-inline';`,
    `script-src ${webview.cspSource} 'nonce-${nonce}';`,
    `font-src ${webview.cspSource} data:;`,
    `connect-src ${webview.cspSource};`, // Allows source maps
  ].join(' ')

  html = html.replace(
    /<\/head>/i,
    `<meta http-equiv="Content-Security-Policy" content="${csp}">\n</head>`,
  )
  html = html.replace(
    '<div id="app"></div>',
    `<div id="app" data-initial-page="${initialPage}"></div>`,
  )
  // Inject initial page as global variable
  html = html.replace(
    '<script type="module"',
    `<script>
      window.__INITIAL_PAGE = "${initialPage}";
    </script>
    <script type="module"`,
  )
  console.log(`[Webview] Final HTML length: ${html.length}`)
  console.log(
    `[Webview] HTML contains __INITIAL_PAGE:`,
    html.includes(initialPage),
  )
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
  <!-- this src as a prop for <script is new for me -->
  <script type="module" src="${devUrl}"></script>
</body>
</html>
`
}

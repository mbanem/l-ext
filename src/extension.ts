import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { inspect } from 'util'
import { displayWebview } from './webview.js'
import { parsePrismaSchema } from './webview-ui/src/lib/utils/parse-prisma-schema.js'
import { setupOrmOneMessageHandler } from './ormOne.js'


export let paths: TPaths = {}
let appName = ''    // set inside getWorkspaceRootUri func

let panel: vscode.WebviewPanel | undefined = undefined
let wView: vscode.Webview | undefined = undefined

const videoNames = [
  'CRActivity', 'CRInput', 'CRModelPermissions', 'CRSpinner', 'CRSummaryDetails', 'CRTooltip'
]

export const channel = vscode.window.createOutputChannel('CRUD Support')
export const show = (msg: string | string[], chShow: boolean = false) => {
  channel.appendLine(Array.isArray(msg) ? msg.join('\n') : msg)
  // if (chShow) {
  channel.show()
  // }
}
export const error = (msg: string) => {
  vscode.window.showErrorMessage(msg)
  channel.appendLine(`ERROR: ${msg}`)
}
export const info = (msg: string) => {
  vscode.window.showInformationMessage(msg)
}
export async function isFile(targetUri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(targetUri);
    // Use bitwise AND (&) because symbolic links combine FileType flags
    return (stat.type & vscode.FileType.File) !== 0
  } catch { }
  return false;
}
export async function isFolder(targetUri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(targetUri);
    // Use bitwise AND (&) because symbolic links combine FileType flags
    return (stat.type & vscode.FileType.Directory) !== 0
  } catch { }
  return false;
}
export function getVideoUris(context: vscode.ExtensionContext, videoNames: string[]): Record<string, string> {
  const videoUris: Record<string, string> = {}

  for (const name of videoNames) {
    // Target the compiled out/webview-assets directory directly
    const diskUri = vscode.Uri.joinPath(
      context.extensionUri,
      'out',
      'webview-assets',
      `${name}Video.mp4`
    )

    const webviewUri = (wView as vscode.Webview).asWebviewUri(diskUri)
    videoUris[`${name}Video`] = webviewUri.toString()
  }
  return videoUris;
}
export const sleep = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // ms here is a dummy but required by
      // resolve to send out some value
      resolve(ms)
    }, ms)
  })
}
// Factory function
export class CommandResultTracker<
  TF extends boolean = false,
> implements TCommandResult<TF> {
  // 🚀 Native private field declaration
  success: TF
  code = -1
  stdout = ''
  stderr = ''
  command = ''
  args: string[] = []
  error?: Error

  constructor(initialSuccess: TF) {
    this.success = initialSuccess
  }

  setSuccess(value: TF) {
    this.success = value
    if (value === (true as unknown as TF)) {
      this.stderr = ''
      this.error = undefined
    }
    return this
  }

  *[Symbol.iterator](): Generator<TCommandResult<TF>, void, unknown> {
    yield {
      success: this.success, // Calls the public getter safely
      code: this.code,
      stdout: this.stdout,
      stderr: this.stderr,
      command: this.command,
      args: this.args,
      error: this.error,
    }
  }
  [inspect.custom](depth: number, options: any, inspectFn: typeof inspect) {
    return {
      success: this.success, // Explicitly pull the getter value
      code: this.code,
      stdout: this.stdout,
      stderr: this.stderr,
      command: this.command,
      args: this.args,
      error: this.error,
    }
  }
}
export const waitForNewFile = async (
  filePath: string,
  timeoutMs: number,
): Promise<boolean> => {
  const uri = vscode.Uri.file(filePath)

  // 1. Initial check using await: if file already exists, return true immediately
  try {
    await vscode.workspace.fs.stat(uri)
    return true
  } catch {
    // File does not exist yet; proceed to setup the watcher
  }

  // 2. Setup the FileSystemWatcher using a Promise wrapper
  return new Promise<boolean>((resolve) => {
    const relativePattern = new vscode.RelativePattern(
      path.dirname(filePath),
      path.basename(filePath),
    )

    const watcher = vscode.workspace.createFileSystemWatcher(relativePattern)

    // Safety timeout to prevent the promise from hanging forever
    const timer = setTimeout(() => {
      watcher.dispose()
      resolve(false)
    }, timeoutMs)

    // Watcher event triggers instantly when the file is created
    watcher.onDidCreate(() => {
      clearTimeout(timer)
      watcher.dispose()
      resolve(true)
    })
  })
}

async function getWorkspaceRootUri(): Promise<vscode.Uri | undefined> {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage(
      'Please open a workspace folder before running CRUD Support.'
    );
    return undefined;
  }

  // A single-folder workspace is unambiguous.
  if (folders.length === 1) {
    appName = folders[0].name;
    return folders[0].uri;
  }

  // In a multi-root workspace, prefer the folder containing
  // the currently active editor.
  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(
      activeEditor.document.uri
    );

    if (activeFolder) {
      appName = activeFolder.name;
      return activeFolder.uri;
    }
  }

  // No active editor, or the editor is not inside a workspace:
  // let the user choose the intended application folder.
  const selected = await vscode.window.showQuickPick(
    folders.map(folder => ({
      label: folder.name,
      description: folder.uri.fsPath,
      uri: folder.uri
    })),
    {
      placeHolder: 'Select the application workspace folder'
    }
  );

  if (!selected) { return undefined; }

  appName = selected.label;
  return selected.uri;
}


export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log(`CRUD l-ext -- activated`)
    // inDevelopmentMode = context.extensionMode === ExtensionMode.Development
    if (panel) {
      context.subscriptions.push(panel)
    }
    context.subscriptions.push(
      vscode.commands.registerCommand('l-ext.crudTest', async () => {
        console.log('l-ext.crudTest REGISTERED')
        // reuse an existing panel
        if (panel) {
          console.log('[CRUD] Existing panel found');
          panel.reveal(vscode.ViewColumn.One)
          return
        }
        console.log('[CRUD] Before getWorkspaceRootUri');

        const root = await getWorkspaceRootUri();

        console.log('[CRUD] Root returned:', root?.fsPath ?? 'UNDEFINED');

        if (!root) {
          console.log('[CRUD] Returning because root is undefined');
          return;
        }
        console.log(`Selected application root: ${root.fsPath}`);

        panel = vscode.window.createWebviewPanel(
          'crCrudSupport', // Internal unique identifier string
          'CRUD Support', // Title visible to the user on the tab
          vscode.ViewColumn.One, // Target editor column position
          {
            enableScripts: true, // Allows JS execution inside HTML
            retainContextWhenHidden: true, // Preserves state when tab loses focus

            localResourceRoots: [
              // Restricts local file loading areas
              // Allow the extension's entire compiled output folder (Scripts + CSS + Videos)
              vscode.Uri.joinPath(context.extensionUri, 'out'),
              vscode.Uri.joinPath(
                context.extensionUri,
                'src',
                'webview-ui',
                'public',
              ),
              // Critically allow the end-user's opened workspace directory so webview can parse their schema
              ...(vscode.workspace.workspaceFolders
                ? vscode.workspace.workspaceFolders.map((f) => f.uri)
                : []),
            ],
            portMapping: [{ webviewPort: 5174, extensionHostPort: 5174 }],
          },
        )

        console.log(`after createWebviewPanel`)
        wView = panel.webview
        console.log(`wView is null? ${wView === null}`)
        // Register lifecycle immediately after creation
        panel.onDidDispose(() => {
          console.log('[extension] panel disposed, set panel = undefined')
          panel = undefined // Safely clears the reference so it can be re-created later
        })

        paths = {
          root: root,
          env: vscode.Uri.joinPath(root, '.env'),
          pending: vscode.Uri.joinPath(root, 'prisma', 'installORMPartTwoPending.txt'),
          schema: vscode.Uri.joinPath(root, 'prisma', 'schema.prisma'),
          notVerified: vscode.Uri.joinPath(root, 'prisma', 'pendingSchemaVerification.txt'),
          components: vscode.Uri.joinPath(root, 'src', 'lib', 'components'),
        } as TPaths

        console.log(`after paths? ${paths}`)
        // set initial page based on progression state
        let initialpage = 'OrmThree'
        if (paths.schema && !(await isFile(paths.schema)) ||
          (await isFile(paths.pending)) ||
          (await isFile(paths.notVerified))
        ) {
          console.log('[ext] no schema or some pending exists')
          initialpage = 'OrmOne' as PageKey
        }

        if (!(await displayWebview(context, panel!, initialpage as PageKey)).success) {
          console.log(
            '[extension] closing displayWebview OrmOne return result.success false',
          )
          return
        }

        show(`before setupOrmOneMessageHandler`)

        let res = await setupOrmOneMessageHandler(context, panel!, paths)
        show(`[extension] setupOrmOneMessageHandler result ${res.success}`)
        if (!res.success) {
          show(`[extension] setupOrmOneMessageHandler failed, ${res.success}`)
          return
        } else {
          show(`[extension] setupOrmOneMessageHandler succeeded, ${res.success}`)
        }

        panel!.onDidDispose(() => {
          console.log('[extension] panel disposed, set panel to undefined')
          panel = undefined
        })

        const messageHandler = panel!.webview.onDidReceiveMessage(
          async (msg) => {
            switch (msg.command) {
              case 'ready':
                console.log(
                  '[extension] OrmThree is waiting for "sendingModels"',
                )

                // when OrmThree.html is ready it sends 'ready' command and we respond
                // by sending prisma models and field strips
                let schema = '' // NOTE to set it to an empty string after parsing is done
                try {
                  console.log('[extension] reading schema.prisma')
                  schema = fs.readFileSync(paths.schema, 'utf-8')
                  if (!schema) {
                    console.log('[extension] cannot read schema.prisma')
                    vscode.window.showInformationMessage(
                      `${paths.schema} not found, cannot continue`,
                    )
                    panel!.dispose()
                  } else {
                    console.log(
                      '[extension] schema.prisma read length is',
                      schema.length,
                    )
                  }
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err)
                  console.log(`[extension] reading schema.prisma err ${msg}`)
                }
                try {
                  console.log('[extension] calling parsePrismaSchema')
                  const { models, enums } = await parsePrismaSchema(schema)
                  console.log(
                    '[extension] models.lebgth?',
                    Object.keys(models).length,
                  )
                  console.log(
                    '[extension] postMessage "sendingModels" stringified',
                  )
                  const videoUris = getVideoUris(context, videoNames)
                  console.log('[ext] post videoUris', videoUris)
                  panel!.webview.postMessage({
                    command: 'sendingModels',
                    payload: JSON.stringify({
                      models,
                      enums,
                      appName,
                      videoUris: videoUris,
                    }),
                  })
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err)
                  console.log('[extension] parsePrismaSchema err', msg)
                }

                schema = '' // free up memory by clearing schema string after parsing
                break

              case 'close':
                console.log(
                  '[extension]  extension is closing, panel!.dispose()',
                )
                messageHandler.dispose()
                panel!.dispose()
                break
            }
          },
        )
      }),
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log('Extension failed to activate. Check output logs.')
  }
}
export function deactivate() { }

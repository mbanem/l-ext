import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { Client } from 'pg'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runCommandStream } from './run-command-stream'
import { CommandResultTracker, sleep, waitForNewFile } from './extension'
import { parsePrismaSchema } from './webview-ui/src/lib/utils/parse-prisma-schema.js'
import { anyMissing } from './webview-ui/src/lib/utils'
import { setDefaultHighWaterMark } from 'stream'
import { setDefaultResultOrder } from 'dns'
// ====================== Types ======================
interface DbParams {
  name: string
  owner: string
  password: string
  host?: string
  port?: number | string
  adminName?: string
  adminPwd?: string
}
interface DatabaseConfig {
  provider: string
  user: string
  password: string
  host: string
  port: string
  database: string
}
let paths: TPaths
let webview: vscode.Webview

// does db admin credentials are OK if Role and Db are specified at UI
async function getDbParamsStatus(
  db: DbParams,
): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)

  let isThree = 0
  if (!db.adminName || !db.adminPwd) {
    result.setSuccess(false)
    result.error = new Error('Admin credentials are required')
    return result
  }
  result.stdout = (isThree++, `Admin credentials are OK`)

  const client = new Client({
    host: db.host || 'localhost',
    port: Number(db.port) || 5432,
    user: db.adminName,
    password: db.adminPwd,
    database: 'postgres',
  })

  try {
    await client.connect()

    // Create role
    const roleCheck = await client.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [db.owner],
    )
    result.stdout +=
      `\nRole ${db.owner} ` +
      (roleCheck.rowCount === 0
        ? (isThree++, `can be created`)
        : ` already exists`)

    // Create database
    const dbCheck = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [db.name],
    )
    result.stdout +=
      `\nDatabase ${db.name} ` +
      (dbCheck.rowCount === 0
        ? (isThree++, `can be created`)
        : `already exists`)

    await client.end()
    if (isThree === 3) {
      result.stdout += '\nParams are Valid'
    }
    // result.setSuccess(true)
  } catch (err: any) {
    result.setSuccess(false)
    result.error = err
  }

  return result
}
// ====================== Main Entry ======================
export async function setupOrmOneMessageHandler(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  paths_: TPaths,
): Promise<CommandResultTracker<boolean>> {
  paths = paths_
  webview = panel.webview
  const result = new CommandResultTracker<boolean>(true)

  // ---------- Save listener (schema + .env) ----------
  const savedFiles = new Set<string>()
  const closeListener = vscode.workspace.onDidCloseTextDocument(
    async (document) => {
      const { modelsOK, connOK } = await areSchemaAndEnvOK()
      const fileName = path.basename(document.fileName)
      let message = ''
      if (fileName === 'schema.prisma') {
        if (!modelsOK) {
          message = 'schema.prisma is invalid.'
        } else {
          savedFiles.add(fileName)
        }
      }
      if (fileName === '.env') {
        if (!connOK) {
          message = '.env DATABASE_URL is invalid.'
        } else {
          savedFiles.add(fileName)
        }
      }
      if (savedFiles.has('schema.prisma') && savedFiles.has('.env')) {
        const { modelsOK, connOK } = await areSchemaAndEnvOK()
        if (modelsOK && connOK) {
          console.log('[ormOne] calling showPage OrmThree')
          webview.postMessage({
            command: 'showPage',
            page: 'OrmThree',
            from: 'ormOne',
          })
          deletePendingFile()
          closeListener.dispose()
          saveListener.dispose()
        }
      } else {
        const answer = await vscode.window.showWarningMessage(
          message,
          {
            modal: true,
            detail: 'Would you like to open it to fix?.',
          },
          'Open It',
          'Cancel',
        )
        if (answer === 'Open It') {
          const filePath = message.includes('schema.prisma')
            ? paths.schema
            : paths.env
          let result = await openFilesInEditorTabs([filePath])
          if (!result.success) {
            console.log('[ormOne] openFilesInEditorTabs failed', result)
          }
        }
      }
    },
  )

  const saveListener = vscode.workspace.onDidSaveTextDocument(
    async (document) => {
      const fileName = path.basename(document.fileName)
      savedFiles.add(fileName)

      if (savedFiles.has('schema.prisma') && savedFiles.has('.env')) {
        const { modelsOK, connOK } = await areSchemaAndEnvOK()

        if (modelsOK && connOK) {
          let result = await prismaMigrateAndGenarate()
          if (!result.success) {
            console.log('[ormOne] prismaMigrateAndGenarate failed', result)
          } else {
            webview.postMessage({
              command: 'SwitchToModelsHandler',
              message: 'Switching to Models Handler page..',
            })
            console.log('[OrmThree] calling showPage OrmThree')
            webview.postMessage({
              command: 'showPage',
              page: 'OrmThree',
              from: 'ormOne',
            })
            deletePendingFile()
            closeListener.dispose()
            saveListener.dispose()
          }
        } else {
          let message = ''
          let fUri: vscode.Uri
          if (fileName === 'schema.prisma' && !modelsOK) {
            message = 'schema.prisma is invalid.'
            fUri = vscode.Uri.file(paths.schema)
          }
          if (fileName === '.env' && !connOK) {
            message += ' .env DATABASE_URL is invalid.'
            fUri = vscode.Uri.file(paths.env)
          }
          const answer = await vscode.window.showWarningMessage(
            message,
            {
              modal: true,
              detail: 'Would you like to fix?.',
            },
            'Close',
          )
          // if document is not closed get it by file name
          // if closed and incorrect onDidCloseTextDocument will handle it
          let document = vscode.workspace.textDocuments.find(
            (doc) => doc.uri.toString() === fUri.toString(),
          )

          if (document) {
            // 4. Edit the document using a WorkspaceEdit
            const edit = new vscode.WorkspaceEdit()

            // Example: Insert space at the very beginning of the document
            const position = new vscode.Position(0, 0)
            edit.insert(document.uri, position, ' ')

            // Apply the edit to the document
            await vscode.workspace.applyEdit(edit)
          }
        }
      }
    },
  )

  context.subscriptions.push(saveListener, closeListener)

  // ---------- Message listener ----------
  const messageListener = webview.onDidReceiveMessage(async (msg) => {
    switch (msg.command) {
      case 'checkOnPendingFile':
        await handleCheckOnPendingFile()
        break

      case 'prismaPartOne':
        console.log('[ormOne] Received prismaPartOne message:', msg)
        await handlePrismaPartOne(msg)

        break

      case 'checkDbParams':
        const dbParams = JSON.parse(msg.dbParams)
        const result = await getDbParamsStatus(dbParams)
        console.log('[ormOne] dbparamsStatus', result.stdout)
        webview.postMessage({
          command: 'dbParamsStatus',
          dbParamsStatus: result.stdout,
        })
        break
      case 'approveBuildPackage':
        await runCommandStream('pnpm', ['approve-builds', msg.package], {
          cwd: paths.root,
        })
        break

      case 'approveAllBuildPackages':
        await runCommandStream('pnpm', ['approve-builds'], {
          cwd: paths.root,
        })
        break

      case 'close':
        saveListener.dispose()
        messageListener.dispose()
        panel.dispose()
        break
    }
  })

  return result
}

// ====================== Handlers ======================

async function handleCheckOnPendingFile() {
  if (fs.existsSync(paths.pending)) {
    const result = await openFilesInEditorTabs([paths.schema, paths.env])
    if (!result.success) {
      console.log('[ormOne] openFilesInEditorTabs failed', result)
    }
    webview.postMessage({ command: 'pending-found-editor-loaded=schema-env' })
  }
}

async function handlePrismaPartOne(
  msg: any,
): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)

  try {
    const dbParams = msg.dbParams ? JSON.parse(msg.dbParams) : null
    // if (
    //   !dbParams?.name ||
    //   !dbParams?.owner ||
    //   !dbParams?.password ||
    //   !dbParams?.adminName ||
    //   !dbParams?.adminPwd
    // ) {
    if (anyMissing(dbParams)) {
      throw new Error('Missing required database parameters')
    }
    dbParams.port = (dbParams.dbPort as number) || 5432

    // 1. Install packages
    webview.postMessage({
      command: 'prismaInstallStart',
      message: 'Installing packages...',
    })

    const installResult = await installPackages()
    if (!installResult.success) {
      throw new Error(
        installResult.error?.message || 'Package installation failed',
      )
    }

    webview.postMessage({
      command: 'prismaInit',
      message: 'Initiating Prisma ORM...',
    })
    // 2. Run prisma init
    const initResult = await runPrismaInit()
    if (!initResult.success) {
      throw new Error(initResult.error?.message || 'prisma init failed')
    }

    // 3. Configure .env
    await configureEnvFile(dbParams)

    // 4. Create Role + Database (optional)
    if (dbParams.adminName && dbParams.adminPwd) {
      const dbResult = await createRoleAndDatabase(dbParams)
      if (!dbResult.success) {
        webview.postMessage({
          command: 'prismaInstallError',
          message: 'Failed to create PostgreSQL role/database',
          error: dbResult.error?.message,
        })
      }
    }

    webview.postMessage({
      command: 'openFilesInEditor',
      message: 'Opening schem.prisma and .env DATABASE_URL in Editor...',
    })

    // 5. Open files + create pending flag
    const result = await openFilesInEditorTabs([paths.schema, paths.env])
    if (!result.success) {
      console.log('[ormOne] openFilesInEditorTabs failed', result)
    }
    createPendingFile()

    webview.postMessage({
      command: 'prismaInstallSuccess',
      message: 'Prisma initialized. Please review schema.prisma and .env',
    })

    result.setSuccess(true)
  } catch (err: any) {
    const message = err.message || String(err)
    console.error('[ormOne] handlePrismaPartOne error:', message)

    webview.postMessage({
      command: 'prismaInstallError',
      message: 'Installation failed',
      error: message,
    })

    result.setSuccess(false)
    result.error = err
  }

  return result
}
async function prismaMigrateAndGenarate() {
  try {
    const args = getPrismaComandArgs() // args.init, agrs.migrate, args.generate
    webview.postMessage({
      command: 'prismaMigrate',
      message: 'schems.prisma is valid. Migrating schema modles to database...',
    })
    let result = await executeCommand(args.migrate)

    webview.postMessage({
      command: 'prismaGenerate',
      message: 'schems.prisma is valid. Generating supporting modules...',
    })
    if (result.success) {
      result = await executeCommand(args.generate)
    }
    if (!result.success) {
      console.log('[ormOne] prisma migrate and genarate failed')
    }
    return result
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log('[ormOne] getPrismaComandArgs', msg)
  }
  return new CommandResultTracker(false)
}
// ====================== Helpers ======================
type TPrismaCommandArgs = {
  init: string[]
  migrate: string[]
  generate: string[]
}
function getPrismaComandArgs(): TPrismaCommandArgs {
  // if (pm === 'pnpm') {
  return {
    init: ['prisma', 'init', '--datasource-provider', 'postgresql'],
    migrate: ['prisma', 'migrate', 'dev', '--name', 'init'],
    generate: ['prisma', 'generate'],
  }
  // }
}
async function installPackages(): Promise<CommandResultTracker<boolean>> {
  const devPackages = [
    '@eslint/compat',
    '@eslint/js',
    '@prisma/adapter-pg',
    '@prisma/config',
    '@prisma/internals',
    '@sveltejs/vite-plugin-svelte',
    '@tsconfig/svelte',
    '@types/bcrypt',
    '@types/eslint',
    '@types/node',
    '@types/pg',
    '@types/vscode',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
    'concurrently',
    'esbuild',
    'eslint',
    'eslint-config-prettier',
    'eslint-plugin-svelte',
    'globals',
    'postcss',
    'postcss-load-config',
    'prettier',
    'prettier-plugin-svelte',
    'prisma',
    'sass',
    'sass-embedded',
    'svelte',
    'svelte-check',
    'svelte-preprocess',
    'ts-node',
    'tslib',
    'typescript',
    'typescript-eslint',
    'vite',
    'vite-plugin-sass-dts',
    'tslib',
  ]
  const packages = [
    '@prisma/adapter-pg',
    '@prisma/client',
    '@prisma/internals',
    'bcrypt',
    'dotenv',
    'pg',
  ]

  return await runCommandStream('pnpm', ['add', '-D', ...devPackages], {
    cwd: paths.root,
    timeoutMs: 10 * 60 * 1000,
    onProgress: (p) => {
      webview.postMessage({
        command: 'prismaProgress',
        percent: p.percent ?? 0,
        message: p.done ? 'Finalizing...' : 'Installing packages...',
        rawLine: p.rawLine,
      })
    },
    onStdout: (text) => {
      webview.postMessage({ command: 'prismaLog', type: 'stdout', text })
    },
    onStderr: (text) => {
      webview.postMessage({ command: 'prismaLog', type: 'stderr', text })
    },
  })
}
const execFileAsync = promisify(execFile)
async function executeCommand(
  args: string[],
): Promise<CommandResultTracker<boolean>> {
  let result = new CommandResultTracker<boolean>(true)
  console.log('[ormOne] executecommand args', args)
  try {
    const { stdout, stderr } = await execFileAsync('pnpm', args, {
      cwd: paths.root,
      timeout: 30000, // 🚀 Raised to 30 seconds for absolute safety
    })

    if (stdout) {
      console.log('[ormOne] prisma stdout', stdout)
    }
    if (stderr) {
      if (!stderr.startsWith('Loaded Prisma config ')) {
        console.log('[ormOne] prisma command stderr', stderr)
        webview.postMessage({
          command: 'prismaInstallError',
          message: '❌ prisma init --datasource-provider postgresql failed',
        })
        result.setSuccess(false)
        result.stderr = stderr || 'Prisma init failed'
        // console.error('[prisma stderr]', stderr)
        return result
      }
    }

    webview.postMessage({
      command: 'prismaLog',
      text: stdout || stderr || 'Done',
    })

    result.setSuccess(true)
  } catch (error: any) {
    console.error('Prisma init error:', error)
    result.setSuccess(false)
    result.stderr = error.message || 'Prisma init failed'
  }
  return result
}
async function runPrismaInit(): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)
  const args = getPrismaComandArgs()
  console.log('[ormOne] prisma commnd args', args)
  if (!(await executeCommand(args.init))) {
    console.log('[ormOne] prisma init failed')
    result.setSuccess(false)
    result.error = new Error('Prisma init failed')
  }
  return result
}

async function configureEnvFile(db: DbParams) {
  const connectionString = `DATABASE_URL="postgresql://${db.owner}:${db.password}@${db.host || 'localhost'}:${db.port || 5432}/${db.name}?schema=public"`

  let content = fs.existsSync(paths.env)
    ? fs.readFileSync(paths.env, 'utf-8')
    : ''

  if (content.includes('DATABASE_URL')) {
    content = content.replace(/DATABASE_URL=.*$/m, connectionString)
  } else {
    content += `\n${connectionString}\n`
  }

  fs.writeFileSync(paths.env, content, 'utf-8')
}

async function createRoleAndDatabase(
  db: DbParams,
): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)

  if (!db.adminName || !db.adminPwd) {
    result.setSuccess(false)
    result.error = new Error('Admin credentials are required')
    return result
  }

  webview.postMessage({
    command: 'createRoleAndDb',
    message: `Creating role ${db.owner} and database ${db.name}`,
  })
  const client = new Client({
    host: db.host || 'localhost',
    port: Number(db.port) || 5432,
    user: db.adminName,
    password: db.adminPwd,
    database: 'postgres',
  })

  try {
    await client.connect()

    // Create role
    const roleCheck = await client.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [db.owner],
    )
    if (roleCheck.rowCount === 0) {
      await client.query(
        `CREATE ROLE "${db.owner}" LOGIN PASSWORD '${db.password}' CREATEDB`,
      )
    }

    // Create database
    const dbCheck = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [db.name],
    )
    if (dbCheck.rowCount === 0) {
      await client.query(`CREATE DATABASE "${db.name}" OWNER "${db.owner}"`)
    }

    await client.end()
    // result.setSuccess(true)
  } catch (err: any) {
    result.setSuccess(false)
    result.error = err
  }

  return result
}

function createPendingFile() {
  const text = `This file indicates that the second part of Prisma ORM installation is pending.
Delete this file after finishing the installation manually if needed.`
  fs.writeFileSync(paths.pending, text, 'utf-8')
}

function deletePendingFile() {
  if (fs.existsSync(paths.pending)) {
    fs.unlinkSync(paths.pending)
  }
}

async function openFilesInEditorTabs(
  filePaths: string[],
): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)
  for (const p of filePaths) {
    const uri = vscode.Uri.file(p)
    let editor = await vscode.window.showTextDocument(uri, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside,
    })
    if (!editor) {
      result.setSuccess(false)
      result.command = p
      return result
    }

    await editor.edit((eb) => eb.insert(new vscode.Position(0, 0), ' '), {
      undoStopBefore: false,
      undoStopAfter: false,
    })

    await new Promise((r) => setTimeout(r, 100))
    await editor.edit((eb) => eb.delete(new vscode.Range(0, 0, 0, 1)), {
      undoStopBefore: false,
      undoStopAfter: true,
    })
    await new Promise((r) => setTimeout(r, 30))
    editor.revealRange(
      new vscode.Range(0, 0, 0, 0),
      vscode.TextEditorRevealType.AtTop,
    )
  }
  // result.setSuccess(true)
  result.command = JSON.stringify(filePaths)
  return result
}
function isConnectionStringOK(url: string): boolean {
  let result = true
  // NOTE in connection string schema is optional
  const regex =
    /^\s*DATABASE_URL=(?<provider>[^:]+):\/\/(?<user>[^:]+):(?<password>[^@]+)@(?<host>[^:]+):(?<port>[^/]+)\/(?<database>[^?]+)/m

  const match = url.match(regex)
  if (!match || !match.groups) {
    return false
  }
  for (const v of Object.values(
    match.groups as Partial<DatabaseConfig>,
  ) as string[]) {
    if ((v as string).trim() === '') {
      result = false
    }
  }
  return result
}

// You still need to implement or keep your existing areSchemaAndEnvOK function
async function areSchemaAndEnvOK() {
  const { models } = parsePrismaSchema(fs.readFileSync(paths.schema, 'utf-8'))
  const envContent = fs.readFileSync(paths.env, 'utf-8')
  const connOK = isConnectionStringOK(envContent)
  const modelsOK = Object.keys(models).length > 0
  return { modelsOK, connOK: connOK }
}

import * as vscode from 'vscode'
import { Client } from 'pg'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runCommandStream } from './run-command-stream.js'
import { CommandResultTracker, isFile } from './extension.js'
import { parsePrismaSchema } from './webview-ui/src/lib/utils/parse-prisma-schema.js'
import { anyMissing } from './webview-ui/src/lib/utils/index.js'

const execFileAsync = promisify(execFile)

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

interface DropTarget {
  admin: string
  password: string
  db?: string
  role?: string
  host?: string
  port?: number
}

type TPrismaCommandArgs = {
  init: string[]
  migrate: string[]
  generate: string[]
}

// Module-scoped state initialized when setupOrmOneMessageHandler runs
let paths: TPaths
let webview: vscode.Webview

// ====================== Uri File Helpers ======================
async function readUriText(uri: vscode.Uri): Promise<string> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri)
    return Buffer.from(bytes).toString('utf-8')
  } catch {
    return ''
  }
}
setupOrmOneMessageHandler

async function writeUriText(uri: vscode.Uri, text: string): Promise<void> {
  // Ensure parent directory exists (e.g., prisma/ before prisma init finishes)
  const parentDir = vscode.Uri.joinPath(uri, '..')
  await vscode.workspace.fs.createDirectory(parentDir)
  await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf-8'))
}

async function deleteUriIfExists(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.delete(uri, { useTrash: false })
  } catch {
    // Ignore if file was already deleted
  }
}

// ====================== Main Entry ======================
export async function setupOrmOneMessageHandler(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  paths_: TPaths,
): Promise<CommandResultTracker<boolean>> {
  console.log(`[ormOne] setupOrmOneMessageHandler entry point`)
  paths = paths_
  webview = panel.webview
  const result = new CommandResultTracker<boolean>(true)

  // Track exact URI strings ('schema' | 'env') saved by the user
  const savedTargets = new Set<'schema' | 'env'>()
  const schemaUriStr = paths.schema.toString()
  const envUriStr = paths.env.toString()

  // Helper to dispose all wizard listeners cleanly in one place
  const disposeWizardListeners = () => {
    saveListener.dispose()
    closeListener.dispose()
    messageListener.dispose()
  }

  // ---------- 1. Save Listener (schema.prisma + .env) ----------
  const saveListener = vscode.workspace.onDidSaveTextDocument(
    async (document) => {
      const docUriStr = document.uri.toString()

      // Ignore saves to unrelated files in the workspace
      if (docUriStr !== schemaUriStr && docUriStr !== envUriStr) {
        return
      }

      if (docUriStr === schemaUriStr) { savedTargets.add('schema') }
      if (docUriStr === envUriStr) { savedTargets.add('env') }

      // Wait until the user has saved BOTH schema.prisma and .env at least once
      if (!savedTargets.has('schema') || !savedTargets.has('env')) {
        return
      }

      const { modelsOK, connOK } = await areSchemaAndEnvOK()

      if (modelsOK && connOK) {
        const migrateRes = await prismaMigrateAndGenerate()
        if (!migrateRes.success) {
          console.error('[ormOne] prismaMigrateAndGenerate failed', migrateRes)
          webview.postMessage({
            command: 'prismaInstallError',
            message: 'Prisma migrate/generate failed. Check your schema and database connection.',
            error: migrateRes.stderr || migrateRes.error?.message,
          })
          return
        }

        webview.postMessage({
          command: 'SwitchToModelsHandler',
          message: 'Switching to Models Handler page...',
        })

        await new Promise((resolve) => setTimeout(resolve, 300))

        webview.postMessage({
          command: 'showPage',
          page: 'OrmThree',
          from: 'ormOne',
        })

        await deleteUriIfExists(paths.pending)
        await deleteUriIfExists(paths.notVerified)
        disposeWizardListeners()
      } else {
        // Build an accurate warning pointing to whichever file(s) failed validation
        const problems: string[] = []
        let targetUriToFix: vscode.Uri = paths.schema

        if (!connOK) {
          problems.push('.env DATABASE_URL is invalid.')
          targetUriToFix = paths.env
        }
        if (!modelsOK) {
          problems.push('schema.prisma has no valid models.')
          targetUriToFix = paths.schema
        }

        await vscode.window.showWarningMessage(
          problems.join(' '),
          {
            modal: true,
            detail: 'Please fix the highlighted file and save again (Ctrl+S).',
          },
          'OK',
        )

        // Mark the invalid document dirty with a harmless space so VS Code lets them re-save
        const openDoc = vscode.workspace.textDocuments.find(
          (doc) => doc.uri.toString() === targetUriToFix.toString(),
        )
        if (openDoc) {
          const edit = new vscode.WorkspaceEdit()
          edit.insert(openDoc.uri, new vscode.Position(0, 0), ' ')
          await vscode.workspace.applyEdit(edit)
        }
      }
    },
  )

  // ---------- 2. Close Listener (catches user closing tab before fixing) ----------
  const closeListener = vscode.workspace.onDidCloseTextDocument(
    async (document) => {
      const docUriStr = document.uri.toString()
      if (docUriStr !== schemaUriStr && docUriStr !== envUriStr) {
        return
      }

      const { modelsOK, connOK } = await areSchemaAndEnvOK()
      const isSchema = docUriStr === schemaUriStr
      const isFileValid = isSchema ? modelsOK : connOK

      if (isFileValid) {
        savedTargets.add(isSchema ? 'schema' : 'env')
      }

      if (savedTargets.has('schema') && savedTargets.has('env') && modelsOK && connOK) {
        webview.postMessage({
          command: 'showPage',
          page: 'OrmThree',
          from: 'ormOne',
        })
        await deleteUriIfExists(paths.pending)
        await deleteUriIfExists(paths.notVerified)
        disposeWizardListeners()
        return
      }

      // If the user closed schema.prisma or .env while it is still invalid, offer to reopen it
      if (!isFileValid) {
        const label = isSchema ? 'schema.prisma' : '.env DATABASE_URL'
        const answer = await vscode.window.showWarningMessage(
          `${label} is not valid yet.`,
          {
            modal: true,
            detail: 'Would you like to reopen it to finish configuration?',
          },
          'Open It',
          'Cancel',
        )

        if (answer === 'Open It') {
          const targetUri = isSchema ? paths.schema : paths.env
          const openRes = await openFilesInEditorTabs([targetUri])
          if (!openRes.success) {
            console.error('[ormOne] openFilesInEditorTabs failed', openRes)
          }
        } else {
          await createPendingSchemaVerified()
        }
      }
    },
  )

  // ---------- 3. Webview Message Listener ----------
  const messageListener = webview.onDidReceiveMessage(async (msg) => {
    switch (msg.command) {
      case 'checkOnPendingFile':
        await handleCheckOnPendingFile()
        break

      case 'installPrisma': {
        console.log('[ormOne] Received installPrisma message:', msg)
        const installRes = await handleInstallPrisma(msg)
        webview.postMessage({
          command: 'prismaInstallStatus',
          result: installRes,
        })
        break
      }

      case 'checkDbParams': {
        const dbParams: DbParams = JSON.parse(msg.dbParams)
        const res = await getDbParamsStatus(dbParams)
        webview.postMessage({
          command: 'dbParamsStatus',
          dbParamsStatus: res.stdout || res.error?.message || '',
        })
        break
      }

      case 'dropDbObjects': {
        const db_: DbParams = JSON.parse(msg.dbParams)
        const answer = await vscode.window.showWarningMessage(
          `You are about to drop ${msg.dropSelected}`,
          {
            modal: true,
            detail: 'This action is not recoverable.',
          },
          'Yes',
        )

        let returnMsg = 'Operation cancelled.'
        if (answer === 'Yes') {
          returnMsg = await dropDatabaseAndRole({
            admin: db_.adminName || '',
            password: db_.adminPwd || '',
            db: msg.dropSelected.includes('Database') ? db_.name : undefined,
            role: msg.dropSelected.includes('Role') ? db_.owner : undefined,
            host: db_.host,
            port: Number(db_.port) || 5432,
          })
        }

        webview.postMessage({
          command: 'deleteDbObjectsResult',
          message: returnMsg,
        })
        break
      }

      case 'approveBuildPackage':
        await runCommandStream('pnpm', ['approve-builds', msg.package], {
          cwd: paths.root.fsPath,
        })
        break

      case 'approveAllBuildPackages':
        await runCommandStream('pnpm', ['approve-builds'], {
          cwd: paths.root.fsPath,
        })
        break

      case 'close':
        disposeWizardListeners()
        panel.dispose()
        break
    }
  })

  // Ensure all listeners are cleaned up if the user closes the Webview tab via the 'X' button
  panel.onDidDispose(() => {
    disposeWizardListeners()
  })

  context.subscriptions.push(saveListener, closeListener, messageListener)
  return result
}

// ====================== Handlers ======================

async function handleCheckOnPendingFile() {
  const hasPending = (await isFile(paths.pending)) || (await isFile(paths.notVerified))
  if (hasPending) {
    const result = await openFilesInEditorTabs([paths.schema, paths.env])
    if (!result.success) {
      console.error('[ormOne] openFilesInEditorTabs failed', result)
    }
    webview.postMessage({ command: 'pending-found-editor-loaded=schema-env' })
  }
}

async function handleInstallPrisma(
  msg: any,
): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)

  try {
    const dbParams: DbParams | null = msg.dbParams ? JSON.parse(msg.dbParams) : null

    if (!dbParams || anyMissing(dbParams)) {
      throw new Error('Missing required database parameters')
    }
    dbParams.port = Number((dbParams as any).dbPort || dbParams.port) || 5432

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

    // 2. Run prisma init
    webview.postMessage({
      command: 'prismaInit',
      message: 'Initiating Prisma ORM...',
    })
    const initResult = await runPrismaInit()
    if (!initResult.success) {
      throw new Error(initResult.error?.message || 'prisma init failed')
    }

    // Clean up Prisma CLI generated AI skill folders so they don't clutter the user's repo
    await cleanupPrismaSkillFolders()

    // 3. Configure .env
    await configureEnvFile(dbParams)

    // 4. Create Role + Database (if admin credentials provided)
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

    // 5. Open schema.prisma and .env in Editor tabs & write pending marker
    webview.postMessage({
      command: 'openFilesInEditor',
      message: 'Opening schema.prisma and .env DATABASE_URL in Editor...',
    })

    const openResult = await openFilesInEditorTabs([paths.schema, paths.env])
    if (!openResult.success) {
      console.error('[ormOne] openFilesInEditorTabs failed', openResult)
    }
    await createPendingFile()

    webview.postMessage({
      command: 'prismaInstallSuccess',
      message: 'Prisma ORM initialized. Please review schema.prisma and .env',
    })

    result.setSuccess(true)
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ormOne] handleInstallPrisma error:', message)

    webview.postMessage({
      command: 'prismaInstallError',
      message: 'Installation failed',
      error: message,
    })

    result.setSuccess(false)
    result.error = err instanceof Error ? err : new Error(message)
  }

  return result
}

async function prismaMigrateAndGenerate(): Promise<CommandResultTracker<boolean>> {
  try {
    const args = getPrismaCommandArgs()
    webview.postMessage({
      command: 'prismaMigrate',
      message: 'schema.prisma is valid. Migrating schema models to database...',
    })

    let result = await executeCommand('pnpm', args.migrate)

    if (result.success) {
      webview.postMessage({
        command: 'prismaGenerate',
        message: 'schema.prisma is valid. Generating supporting modules...',
      })
      result = await executeCommand('pnpm', args.generate)
    }

    if (!result.success) {
      console.error('[ormOne] prisma migrate and generate failed', result)
    }
    return result
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ormOne] prismaMigrateAndGenerate error:', msg)
    const fail = new CommandResultTracker<boolean>(false)
    fail.error = err instanceof Error ? err : new Error(msg)
    return fail
  }
}

// ====================== CLI & Package Helpers ======================

function getPrismaCommandArgs(): TPrismaCommandArgs {
  return {
    init: ['prisma', 'init', '--datasource-provider', 'postgresql'],
    migrate: ['prisma', 'migrate', 'dev', '--name', 'init'],
    generate: ['prisma', 'generate'],
  }
}

async function installPackages(): Promise<CommandResultTracker<boolean>> {
  // Deduplicated devDependencies list
  const devPackages = Array.from(
    new Set([
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
    ]),
  )

  const packages = [
    '@prisma/adapter-pg',
    '@prisma/client',
    '@prisma/internals',
    'bcrypt',
    'dotenv',
    'pg',
  ]

  return await runCommandStream('pnpm', ['add', '-D', ...devPackages], {
    // IMPORTANT: Child processes require a native OS string path, not a vscode.Uri
    cwd: paths.root.fsPath,
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

async function executeCommand(
  engine: string,
  args: string[],
): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)
  try {
    const { stdout, stderr } = await execFileAsync(engine, args, {
      cwd: paths.root.fsPath,
      timeout: 30000,
    })

    if (stdout) {
      console.log('[ormOne] prisma stdout', stdout)
    }

    if (stderr && !stderr.startsWith('Loaded Prisma config ')) {
      console.warn('[ormOne] prisma command stderr', stderr)
      result.setSuccess(false)
      result.stderr = stderr
      return result
    }

    webview.postMessage({
      command: 'prismaLog',
      text: stdout || stderr || 'Done',
    })

    result.setSuccess(true)
  } catch (error: any) {
    console.error('[ormOne] executeCommand error:', error)
    result.setSuccess(false)
    result.stderr = error.message || 'Command execution failed'
    result.error = error instanceof Error ? error : new Error(result.stderr)
  }
  return result
}

async function runPrismaInit(): Promise<CommandResultTracker<boolean>> {
  const args = getPrismaCommandArgs()
  const cmdRes = await executeCommand('pnpm', args.init)
  if (!cmdRes.success) {
    cmdRes.error = new Error(cmdRes.stderr || 'Prisma init failed')
  }
  return cmdRes
}

async function cleanupPrismaSkillFolders(): Promise<void> {
  const unwanted = ['.agents', '.claude', '.windsurf', 'skills-lock.json']
  for (const name of unwanted) {
    const target = vscode.Uri.joinPath(paths.root, name)
    try {
      await vscode.workspace.fs.delete(target, { recursive: true, useTrash: false })
    } catch {
      // Ignore if Prisma did not generate that folder
    }
  }
}

// ====================== PostgreSQL Helpers ======================

async function getDbParamsStatus(
  db: DbParams,
): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)

  let validCount = 0
  if (!db.adminName || !db.adminPwd) {
    result.setSuccess(false)
    result.error = new Error('Admin credentials are required')
    return result
  }
  validCount++
  result.stdout = 'Admin credentials are OK'

  const client = new Client({
    host: db.host || 'localhost',
    port: Number(db.port) || 5432,
    user: db.adminName,
    password: db.adminPwd,
    database: 'postgres',
  })

  try {
    await client.connect()

    const roleCheck = await client.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      [db.owner],
    )
    result.stdout +=
      `\nRole ${db.owner} ` +
      (roleCheck.rowCount === 0
        ? (validCount++, 'can be created')
        : 'already exists')

    const dbCheck = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [db.name],
    )
    result.stdout +=
      `\nDatabase ${db.name} ` +
      (dbCheck.rowCount === 0
        ? (validCount++, 'can be created')
        : 'already exists')

    await client.end()
    if (validCount === 3) {
      result.stdout += '\nParams are Valid'
    }
  } catch (err: any) {
    result.setSuccess(false)
    result.error = err instanceof Error ? err : new Error(String(err))
  }

  return result
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

  // Validate identifiers to prevent SQL injection in DDL statements
  const safeIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  if (!safeIdent.test(db.owner) || !safeIdent.test(db.name)) {
    result.setSuccess(false)
    result.error = new Error('Role and database names must be valid SQL identifiers.')
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

    const roleCheck = await client.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      [db.owner],
    )
    if (roleCheck.rowCount === 0) {
      // Escape single quotes in password literal safely
      const escapedPwd = db.password.replace(/'/g, "''")
      await client.query(
        `CREATE ROLE "${db.owner}" LOGIN PASSWORD '${escapedPwd}' CREATEDB`,
      )
    }

    const dbCheck = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [db.name],
    )
    if (dbCheck.rowCount === 0) {
      await client.query(`CREATE DATABASE "${db.name}" OWNER "${db.owner}"`)
    }

    await client.end()
  } catch (err: any) {
    result.setSuccess(false)
    result.error = err instanceof Error ? err : new Error(String(err))
  }

  return result
}

async function dropDatabaseAndRole(target: DropTarget): Promise<string> {
  const { db, role, admin, password, host = 'localhost', port = 5432 } = target

  const safeName = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  if ((db && !safeName.test(db)) || (role && !safeName.test(role))) {
    throw new Error('Invalid database or role name')
  }

  const env = {
    ...process.env,
    PGPASSWORD: password,
  }

  const commonArgs = [
    '-h',
    host,
    '-p',
    String(port),
    '-U',
    admin,
    '-d',
    'postgres',
  ]

  let returnMsg = 'Successfully dropped '
  try {
    if (db) {
      await execFileAsync(
        'psql',
        [
          ...commonArgs,
          '-c',
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();`,
        ],
        { env },
      )

      await execFileAsync(
        'dropdb',
        ['--if-exists', '-h', host, '-p', String(port), '-U', admin, db],
        { env },
      )
      returnMsg += `Database ${db}`
    }

    if (role) {
      await execFileAsync(
        'psql',
        [...commonArgs, '-c', `DROP ROLE IF EXISTS "${role}";`],
        { env },
      )
      returnMsg += (db ? ' and ' : '') + `role ${role}`
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ormOne] Failed to drop database/role:', msg)
    returnMsg = `Failed to drop database/role: ${msg}`
  }

  return returnMsg
}

// ====================== .env, Editor Tabs & Validation ======================

async function configureEnvFile(db: DbParams): Promise<void> {
  const connectionString = `DATABASE_URL="postgresql://${db.owner}:${db.password}@${db.host || 'localhost'}:${db.port || 5432}/${db.name}?schema=public"`

  let content = await readUriText(paths.env)

  if (/^DATABASE_URL=/m.test(content)) {
    content = content.replace(/^DATABASE_URL=.*$/m, connectionString)
  } else {
    content += `${content.endsWith('\n') || content === '' ? '' : '\n'}${connectionString}\n`
  }

  await writeUriText(paths.env, content)
}

async function createPendingFile(): Promise<void> {
  const text = `This file indicates that the second part of Prisma ORM installation is pending.
Delete this file after finishing the installation manually if needed.`
  await writeUriText(paths.pending, text)
}

async function createPendingSchemaVerified(): Promise<void> {
  const text = `Verification is pending until next extension start.
schema.prisma and/or DATABASE_URL from .env file are not verified.
User did not prepare schema.prisma yet and cancelled installation.`
  await writeUriText(paths.notVerified, text)
}

async function openFilesInEditorTabs(
  fileUris: vscode.Uri[],
): Promise<CommandResultTracker<boolean>> {
  const result = new CommandResultTracker<boolean>(true)

  for (const uri of fileUris) {
    const editor = await vscode.window.showTextDocument(uri, {
      preview: false,
      viewColumn: vscode.ViewColumn.Beside,
    })
    if (!editor) {
      result.setSuccess(false)
      result.command = uri.toString()
      return result
    }

    // Nudge the editor buffer slightly so VS Code marks it ready for user edits/saves
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

  result.command = JSON.stringify(fileUris.map((u) => u.toString()))
  return result
}

function isConnectionStringOK(url: string): boolean {
  // Supports optional single or double quotes around the connection URL
  const regex =
    /^\s*DATABASE_URL=["']?(?<provider>[^:]+):\/\/(?<user>[^:]+):(?<password>[^@]+)@(?<host>[^:]+):(?<port>[^/]+)\/(?<database>[^?"'\s]+)/m

  const match = url.match(regex)
  if (!match || !match.groups) {
    return false
  }

  for (const v of Object.values(
    match.groups as Partial<DatabaseConfig>,
  ) as string[]) {
    if (!v || v.trim() === '') {
      return false
    }
  }
  return true
}

async function areSchemaAndEnvOK(): Promise<{ modelsOK: boolean; connOK: boolean }> {
  const schemaContent = await readUriText(paths.schema)
  const envContent = await readUriText(paths.env)

  const { models } = await parsePrismaSchema(schemaContent)
  const connOK = isConnectionStringOK(envContent)
  const modelsOK = Object.keys(models).length > 0

  return { modelsOK, connOK }
}
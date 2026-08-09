<script lang="ts">
  import { vscode } from '$lib/utils/event-handler.browser'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import HoveringDetails from '$lib/components/HoverableDetails.svelte'
  import ConfigurationRequired from '$lib/components/ConfigurationRequired.svelte'
  import CRShowTooltip from '$lib/components/CRShowTooltip.svelte'
  import { anyMissing, sixHash } from '$lib/utils'

  let crShowTooltip: CRShowTooltip
  let mandatoryEntriesEl: HTMLDivElement
  let validateDbParams: HTMLDivElement
  let currentTask = $state('')
  // Vite will bundle/copy this asset automatically at build time

  const RX =
    /^Progress:|\.\.\.\/node_modules\/|dependencies:|devDependencies:|\+ /
  // let currentDetailsEl: HTMLDetailsElement | undefined = $state()
  let rlCounter = $state(0)
  let dbParamsValid = $state(false)
  // let rawLinesEl: HTMLDetailsElement
  // let depEl: HTMLDetailsElement
  // let devDepEl: HTMLDetailsElement
  // let follow = $state('') // dependencies | devDependencies
  let useOnlyBuiltDependencies = $state(true) // Default: safe for most users
  let approvalPackages = $state<string[]>([])
  let progressPercents = $state(0)
  let statusMessage = $state('Ready to install Prisma')
  let isInstalling = $state(false)
  let isOpen = $state(false)
  let dbStatusAvailable = $state(false)
  let logs: { type: 'stdout' | 'stderr'; text: string }[] = $state([])
  // let progressLineEl: HTMLParagraphElement
  // let nodeModulesEl: HTMLDetailsElement
  // let checkThisEl: HTMLDetailsElement
  // let otherLinesEl: HTMLDetailsElement
  // let dbParamsBlockEl: HTMLDivElement

  let installPrismaButton = $state<HTMLButtonElement>()
  let progressCollector = $state<Record<string, string[]>>({})
  // let continueButton: HTMLButtonElement

  type DbEls = Record<string, HTMLInputElement | null>
  const dbState = $state<{ db: DbParams; els: DbEls }>({
    db: {
      name: 'dbrony',
      owner: 'rony',
      password: 'rony',
      host: 'localhost',
      port: 5432,
      adminName: 'mili',
      adminPwd: 'kiki',
    },
    els: {
      name: null,
      owner: null,
      password: null,
      host: null,
      port: null,
      adminName: null,
      adminPwd: null,
    },
  })
  const inputBoxes = {
    name: ['Database Name', 'text'],
    owner: ['Database Owner', 'text'],
    password: ["Owner's Password", 'password'],
    host: ['Host Name', 'text'],
    port: ['Communication Port', 'number'],
    adminName: ['Database Role (Admin Name)', 'text'],
    adminPwd: ['Database Role Password', 'password'],
  }
  let configRequired = $state(false)
  // Calls the predicate function. Svelte tracks all properties read inside anyMissing!
  let dbParamsMissing = $derived(anyMissing(dbState.db))

  // let pEl: HTMLParagraphElement
  // begin of parsing progress rawLine for kind ot output
  // what does this page do handler
  type TProps = {
    pageInfo: TToggleFunc
  }
  let { pageInfo = $bindable() }: TProps = $props()
  let isActive = $state(false)

  function handlePageInfo() {
    isActive = isActive ? false : true
  }
  pageInfo = handlePageInfo as TToggleFunc
  // end of what does this page do handler

  const inputStyle = `
    display: block;
    width: 18rem;
    height: 1.5rem !important;
    margin: 8px 1rem 10px 0;
    padding: 6px 0.5rem 8px 1rem;
    border-radius: 4px;
    outline: none;
    `
  function startPrismaInstall() {
    if (dbParamsMissing) {
      isOpen = true
      return
    }
    isInstalling = true
    if (isOpen) {
      isOpen = false
    }

    progressPercents = 0
    logs = []
    statusMessage = 'Starting installation...'
    const db_: DbParams = {
      name: dbState.db.name,
      owner: dbState.db.owner,
      password: dbState.db.password,
      host: dbState.db.host ?? 'localhost',
      adminName: dbState.db.adminName,
      adminPwd: dbState.db.adminPwd,
      port: dbState.db.port ?? 5432, // JSON.parse abandone the rest if this is a number
    }
    // console.log('[OrmOne] postCommand prismaPartOne', db_)
    vscode.postMessage({
      command: 'prismaPartOne',
      useOnlyBuiltDependencies,
      dbParams: JSON.stringify(db_),
    })
  }

  function approvePackage(e: MouseEvent, pkg: string) {
    let button = e.target as HTMLButtonElement
    button.disabled = true
    button.style.cursor = 'not-allowed'
    vscode.postMessage({ command: 'approveBuildPackage', package: pkg })
  }

  function approveAll() {
    const container = document.querySelector(
      '.approval-section',
    ) as HTMLDivElement

    if (container) {
      // 1. Get the buttons directly with the correct TypeScript type
      const buttons = container.getElementsByTagName('button')

      // 2. Loop through the collection using Array.from()
      Array.from(buttons).forEach((button) => {
        button.disabled = true
        button.style.cursor = 'not-allowed'
      })
    }
    vscode.postMessage({ command: 'approveAllBuildPackages' })
  }
  function verifyDbParamsWithPostgres() {
    const db_: DbParams = {
      name: dbState.db.name,
      owner: dbState.db.owner,
      password: dbState.db.password,
      host: dbState.db.host ?? 'localhost',
      adminName: dbState.db.adminName,
      adminPwd: dbState.db.adminPwd,
      port: dbState.db.port ?? 5432, // JSON.parse abandone the rest if this is a number
    }
    // console.log({
    //   command: 'checkDbParams',
    //   dbParams: JSON.stringify(db_),
    // })
    vscode.postMessage({
      command: 'checkDbParams',
      dbParams: JSON.stringify(db_),
    })
  }
  // function appendLine(el: HTMLDetailsElement, line: string) {
  //   if (currentDetailsEl) {
  //     currentDetailsEl.open = false
  //   }
  //   el.open = true
  //   // if (rawLinesEl.open) {
  //   //   rawLinesEl.open = false
  //   // }
  //   const pel = document.createElement('p')
  //   el.appendChild(pel)
  //   Object.assign(pel.style, { padding: 0, margin: 0 })
  //   pel.textContent = line
  // }

  function closetheApp() {
    //// console.log(
    //   '[OrmOne] closetheApp',
    //   vscode ? 'vscode is defined' : 'vscode is undefined',
    // )
    vscode.postMessage({
      command: 'close',
      payload: 'close the extension',
    })
  }
  let dbStatusMsg = $state('')
  onMount(() => {
    //// console.log('[OrmOne] to ormOne checkOnPendingFile')
    vscode.postMessage({
      command: 'checkOnPendingFile',
    })
    const handler = (event: MessageEvent) => {
      const msg = event.data
      switch (msg.command) {
        case 'prismaInstallStart':
          //// console.log('[OrmOne] got message prismaInistallStart')
          currentTask = 'installing PNPM packages and initiating Prisma ORM...'
          break
        case 'pending-found-editor-loaded=schema-env':
          configRequired = true
          break

        case 'dbParamsStatus':
          dbStatusMsg = msg.dbParamsStatus
          dbStatusAvailable = true
          console.log('[OrmOne] endsWith', msg.dbParamsStatus)
          dbParamsValid = dbStatusMsg.includes('Params are Valid')
          console.log('dbParamsValid', dbParamsValid)
          break
        case 'prismaPartOneDone':
          //// console.log('[OrmOne] got message', msg.command, msg.payloads)
          //// console.log('[OrmOne] postMessage prismaPartTwo')
          // vscode.postMessage({
          //   command: 'prismaPartTwo',
          //   payload: 'sent from OrmOne after receviing prismaPartOneDone',
          // })
          break
        case 'notValidSchemaOrEnv':
          //// console.log('[OrmOne] invalid models or env', msg)
          break
        case 'prismaProgress':
          progressPercents = Number(msg.percent)
          statusMessage = msg.message
          const rl = msg.rawLine
          // pEl = document.createElement('p')
          // rawLinesEl.appendChild(pEl)
          // if (rl.includes('[WARN] Issues with peer dependencies found.')) {
          //   appendLine(checkThisEl, rl)
          // }
          ++rlCounter
          // if (rlCounter === 1) {
          //   rawLinesEl.open = true
          // }
          // Object.assign(pEl.style, { padding: 0, margin: 0 })
          // pEl.textContent = rl
          const m = RX.exec(rl)
          if (m) {
            //// console.log('M[0] RAW LINE', m[0] ?? 'NULL', rl)
            if (m[0] && !progressCollector[m[0]]) {
              $inspect('create empty progressCollector for', m[0])
              progressCollector[m[0]] = []
            }
            progressCollector[m[0]].push(msg.rawLine.slice(10).trim())
            $inspect('progressCollector[m[0]]', progressCollector[m[0]])
            // p[m[0]] = rl.trim()
            // switch (m[0]) {
            //   case 'Progress:':
            //     progressLineEl.innerText = rl
            //     break
            //   case '.../node_modules/':
            //     appendLine(nodeModulesEl, rl.slice(17))
            //     break
            //   case 'dependencies:':
            //     follow = 'dependencies'
            //     // depEl.innerText = 'dependencies'
            //     break
            //   case 'devDependencies:':
            //     follow = 'devDependencies'
            //     // devDepEl.innerText = 'devDependencies'
            //     break
            //   case '+ ':
            //     if (follow === 'dependencies') {
            //       appendLine(depEl, rl)
            //     }
            //     if (follow === 'devDependencies') {
            //       appendLine(devDepEl, rl)
            //     }
            //     break
            //   default:
            //     if (follow) {
            //       follow = ''
            //     }
            //     if (rl.includes('check')) {
            //       appendLine(checkThisEl, rl)
            //       checkThisEl.classList.remove('hidden')
            //     } else {
            //       appendLine(otherLinesEl, rl)
            //     }
            //     break
            // }
          }
          break
        case 'prismaLog':
          logs = [...logs, { type: msg.type, text: msg.text }]
          // Optional: auto-scroll to bottom
          break
        case 'prismaInstallError':
          isInstalling = false
          statusMessage = msg.message + ' - ' + msg.error
          //// console.log('[OrmOne] prismaInstallError msg', msg)
          break
        case 'prismaBuildApprovalNeeded':
          approvalPackages = msg.packages || []
          break

        case 'prismaInstallSuccess':
          isInstalling = false
          progressPercents = 100
          statusMessage = msg.message
          //// console.log('[OrmOne] got prismaInstallSuccess msg', msg)
          currentTask = msg.message
          break

        case 'prismaInit':
        case 'createRoleAndDb':
        case 'openFilesInEditor':
        case 'prismaMigrate':
        case 'prismaGenerate':
        case 'SwitchToModelsHandler':
          currentTask = msg.message
          break

        case 'prismaPartOneFailed':
          //// console.log('[OrmOne] got prismaPartOne failed')
          break
      }
    }
    window.addEventListener('message', handler)

    // Return cleanup function run on destroy
    return () => {
      window.removeEventListener('message', handler)
    }
  })
  function markEmptyDbParamFields() {
    console.log('markEmptyDbParamFields')
    for (const key of Object.keys(dbState.els)) {
      const el = dbState.els[`${key}El`] as HTMLInputElement
      if (el) {
        if (String(el.value).trim() === '') {
          el.style.backgroundColor = 'rgb(244, 205, 205)'
        } else {
          el.style.backgroundColor = ''
        }
      }
    }
  }
  function showMandatoryEntries(e: MouseEvent) {
    if (e.type === 'mouseenter') {
      if (dbParamsMissing) {
        crShowTooltip.showTooltip(e, mandatoryEntriesEl, 'below')

        markEmptyDbParamFields()
        // open db parameters block for user for db admin credentials
        isOpen = true
      } else {
        if (!dbParamsValid) {
          crShowTooltip.showTooltip(e, validateDbParams, 'below')
          isOpen = true
        } else {
          isOpen = false
        }
      }
    } else if (e.type === 'mouseleave') {
      e.preventDefault()
      crShowTooltip.hideTooltip()
    }
  }
</script>

<div
  class="mandatory-entries"
  bind:this={mandatoryEntriesEl}
  style="opacity:0;"
>
  <p>Without Credentials for Managing DB</p>
  <p>Role and DB cannot be created and</p>
  <p>Prisma ORM will be left inoperational</p>
</div>
<div class="mandatory-entries" bind:this={validateDbParams} style="opacity:0;">
  <p>All DB Params are specified</p>
  <p>Click 'Verify Params with Postgres'</p>
  <p>to see if that can be done and if not</p>
  <p>modify some of DB Params and repeat</p>
</div>
<CRShowTooltip bind:this={crShowTooltip} />
{#snippet pagePurpose()}
  <pre>
    
This page is shown as the Prisma ORM is not installed in this app.
You can proceed with the installation or close the extension and
do the installation yourself.

<span>In the screen First Part</span>

When clicking 'Create database' summary button it opens a panel
for getting the following parameters
  - database name
  - role name as a database owner
  - role's password for connecting and handling database
  - optional server name (default is localhost)
  - optional communication port (default is 5432)

<span>In the screen Second Part</span> 

The 'Install Prisma & Dependencies' button starts the process for
installing Prisma ORM, creating database with given parameters and 
installing the other necessary software packages utilizing current
Package Manager e.g. pnpm.

  </pre>
{/snippet}
{#if isActive}
  <div class="page-info" style="position:absolute;top:5px;left:0;z-index:200;">
    {@render pagePurpose()}
  </div>
{/if}

{#snippet dbParamsStatus()}
  <div class="db-params-status">
    {#each dbStatusMsg.split('\n') as line (sixHash())}
      <p>{line}</p>
    {/each}
  </div>
{/snippet}

{#if configRequired}
  <ConfigurationRequired></ConfigurationRequired>
  <button
    onclick={() => {
      configRequired = false
    }}>will work on it</button
  >
  <button onclick={closetheApp}>Close and will restar later</button>
{:else}
  <div class="db-params-block">
    <details
      bind:open={isOpen}
      style="position:relative;z-index:2;cursor:pointer;"
    >
      <summary class="summary">Parameters for Creating Database </summary>
      <div
        class="dbname-block"
        style="border: 1px solid gray;width:19.4rem;padding:0.5rem;
			border-radius: 6px;margin-top:0.1rem;
			color: var(--candidate-color);
			background-color: var(--candidate-bg-color);"
      >
        {#each Object.entries(inputBoxes) as [k, v] (k)}
          <label>
            {v[0]}
            <input
              type={v[1]}
              bind:value={dbState.db[`${k}`]}
              bind:this={dbState.els[`${k}El`]}
              onblur={markEmptyDbParamFields}
              style={inputStyle}
            />
          </label>
        {/each}
        <div class="button-wrapper">
          {#if dbStatusAvailable}
            {@render dbParamsStatus()}
          {/if}

          <button
            class="toggle-status-button"
            disabled={!dbStatusAvailable}
            onclick={() => (dbStatusAvailable = !dbStatusAvailable)}
            style="padding:6px 0.6rem;text-align:center;color:sienna;style:cursor;"
          >
            Toggle Status
          </button>
          <button
            onclick={verifyDbParamsWithPostgres}
            style="position:relative;padding:6px 0.5rem;text-align:center;color:sienna"
          >
            Verify Params with Postgres
          </button>
        </div>
      </div>
    </details>

    {#if isInstalling || progressPercents}
      <div class="message-container">
        <p style="padding:0;margin:0;grid-column:span 3;">
          {progressPercents}% — {statusMessage}
          <progress value={progressPercents} max="100" style="width: 100%;"
          ></progress>
        </p>
      </div>
      {#key currentTask}
        <div class="current-task">
          <span class:spinner={currentTask !== ''}></span>
          {currentTask}
        </div>
      {/key}
    {/if}
  </div>
  <!-- <div style="border:1px solid red;height:36rem;"> -->
  <div class="grid-container">
    <div class="left-column">
      <label class="dependencies-label">
        <input
          type="checkbox"
          bind:checked={useOnlyBuiltDependencies}
          style="display:inline-block;"
        />
        Pre-approve common build dependencies (recommended)
      </label>
      <div class="progress-line">
        <span class="progress-title" style="margin-left:0.5rem;width:93.3%;"
          >Progress</span
        >
        <!-- <p bind:this={progressLineEl}></p> -->
      </div>
      {#each Object.entries(progressCollector) as [summary, details]}
        <HoveringDetails {summary} {details} />
      {/each}
    </div>
    <div class="buttons-row">
      <button
        bind:this={installPrismaButton}
        cLass="button-install"
        onclick={startPrismaInstall}
        onmouseenter={showMandatoryEntries}
        onmouseleave={showMandatoryEntries}
        disabled={dbParamsMissing}
      >
        <span class:spinner={isInstalling}></span>
        Install Packages
      </button>
      <button onclick={closetheApp} class="button-close">close</button>
    </div>
  </div>

  {#if approvalPackages.length > 0}
    <div class="approval-section">
      <p>
        <strong>Some packages require approval to run build scripts:</strong>
      </p>
      <ul>
        {#each approvalPackages as pkg (pkg)}
          <li>
            <button onclick={(e: MouseEvent) => approvePackage(e, pkg)}
              >{pkg}</button
            >
          </li>
        {/each}
      </ul>
      <button onclick={approveAll}>Approve All</button>
    </div>
  {/if}
{/if}

<style lang="scss">
  .page-info {
    @include page-info();
    margin-top: 1.5rem;
    z-index: 2027;
  }
  div,
  ul,
  p {
    background: var(--bg);
    color: var(--cr-text);
  }
  .message-container {
    margin: 5px 0 8px 1rem;
    grid-column: span 3;
    width: 39rem;
    p {
      font-size: 14px;
      color: var(--candidate-color);
    }
  }
  .logs {
    margin-top: 20px;
    height: clamp(2rem, 5rem, 12rem);
    overflow-y: auto;
    background: #1e1e1e;
    padding: 10px;
    z-index: 4000;
  }
  pre {
    margin: 2px 0;
    font-size: 0.9em;
    white-space: pre-wrap;
    color: var(--pre-color);
    // color: var(--candidate-color);
    background-color: var(--candidate-bg-color);
  }
  .stderr {
    color: #ff6666;
  }
  button {
    @include button();
  }
  .spinner,
  .spinner {
    display: inline-block;
    width: 1em;
    height: 1em;
    border: 3px solid #a1c1eb;
    border-top-color: #1b4891;
    border-radius: 50%;
    animation: spin 900ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .db-params-block {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    grid-template-columns: 26rem 13.2rem 5rem;
    grid-auto-rows: 0.6rem;
    align-items: self-start;
    background-color: transparent;
    padding: 0;
    gap: 1rem;
  }
  .buttons-row {
    display: flex;
    flex: 1;
    // grid-template-columns: 16rem 4rem;
    // gap: 1rem;
    // position: absolute;
    // top: 24rem;
    // left: 5rem;
    .button-install {
      display: flex;
      display: inline-block;
      outline: none;
      margin-left: 10rem;
      border: 1px solid gray;
      border-radius: 5px;
      padding: 3px 1rem;
      font-size: 14px !important;
      font-weight: 400;
      color: var(--candidate-color);
      background-color: var(--candidate-bg-color);
      width: max-content;
      cursor: pointer;
      outline: 1px solid transparent;
      /*transition: color 0.4s ease;*/
      &:hover {
        outline: var(--candidate-color) solid 1px;
      }
    }

    .button-close {
      display: inline-block;
      outline: none;
      border: 1px solid gray;
      padding: 3px 1rem;
      border-radius: 5px;
      font-weight: 400;
      color: var(--candidate-color);
      background-color: var(--candidate-bg-color);
      width: max-content;
      cursor: pointer;
    }
  }
  .toggle-status-button:disabled {
    cursor: not-allowed;
    opacity: 0.6; /* Optional visual feedback for disabled state */
  }
  .dependencies-label {
    display: inline-block;
    grid-column: span 3;
    margin-left: 0.5rem;
    color: var(--candidate-color);
    background-color: var(--candidate-bg-color);
  }
  .node-modules {
    @include progress-field();
  }
  .raw-lines {
    position: relative;
    @include progress-field();
  }
  .other-progress-lines {
    @include progress-field();
  }
  .check-this {
    @include progress-field();
    :global(p) {
      color: var(--tomato-violet);
    }
  }
  .grid-container {
    position: absolute;
    top: 0.5rem;
    left: 0;
    display: grid;
    grid-template-columns: repeat(2, 40vw);
    gap: 1rem;
    margin-top: 4rem;
    .left-column {
      border: 1px solid gray;
      border-radius: 8px;
      font-size: 14px;
      color: var(--candidate-color);
      background-color: var(--candidate-bg-color);
      width: 39vw;
    }
    // .left_column {
    //   .progress-line {
    //     @include progress-field();
    //     margin-top: 0.5rem;
    //   }
    // }
    .right-column {
      width: 39vw;
      .dependencies-list {
        @include progress-field();
        height: clamp(2rem, 5rem, 10rem);
      }
      // .dev-dependencies-list {
      //   @include progress-field();
      //   height: clamp(2rem, 4rem, 6rem);
      // }
    }

    .progress-title {
      display: inline-block;
      color: var(--candidate-color);
      background-color: var(--candidate-bg-title-color);
      font-weight: 600;
      width: 95%;
      & ~ p {
        padding-left: 0.5rem;
        font-weight: 400;
      }
    }
    .overflow-y {
      overflow-y: auto;
    }
    // .theme-container {
    //   height: 98vh;
    //   width: 98vw;
    //   // background-color: var(--bg);
    //   color: var(--text);
    //   margin: 0;
    //   padding: 0;
    //   transition: background 0.4s ease color 0.4s ease;
    // }
    .hidden {
      display: none;
    }

    // NOTE many css classes do not work so inline styles are often used
    .dbname-block {
      position: absolute;
      top: 2rem;
      left: 0;
      @include container($head: 'Database Parameters', $head-color: navy);
      margin: 0;
      padding: 1rem;
      label {
        width: 10rem;
        padding: 0;
        margin: 0 1rem 6px 0;
        color: var(--candidate-color);
      }

      input[type='text'],
      input[type='number'] {
        display: block;
        width: 18rem;
        height: 1.5rem !important;
        margin: 8px 0 10px 0;
        padding: 6px 1rem 8px 1rem;
        border-radius: 4px;
        outline: none;
      }
    }
  }
  input,
  label {
    display: block;
    // height: 1rem !important;
    // margin-bottom: 10px;
  }
  .summary {
    position: relative;
    /* list-style: none; */
    width: 19.5rem;
    border: 1px solid gray;
    color: var(--candidate-color);
    background-color: var(--candidate-bg-color);
    border-radius: 6px;
    height: 1.6rem;
    padding-left: 0.5rem;
    line-height: 1.5rem;
    cursor: pointer;
    z-index: 1;
  }
  .details {
    position: relative;
    z-index: 1;
    border: 1px solid gray;
    width: 19rem;
    font-size: 13px;
    font-weight: 400;
    border-radius: 6px;
    padding: 0 0.5rem;
    overflow: hidden;
    transition: all 0.2s ease;
  }
  .mandatory-entries {
    position: absolute;
    top: 0;
    left: 0;
    @include container($head: 'Database Params', $head-color: navy);
    height: auto;
    color: var(--candidate-color);
    background-color: var(--candidate-bg-color);
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 13px;
    z-index: 3000;
    p {
      color: inherit;
      background-color: inherit;
      padding: 3px 0;
      margin: 0;
    }
  }
  // .disabled{
  //     opacity: 0.5;
  //     cursor: not-allowed;
  // }
  .button-wrapper {
    position: relative;
    // display: inline-block;
    .db-params-status {
      @include container(
        $head: 'Database Parameters Status',
        $head-color: navy,
        $border: 2px solid gray
      );
      position: absolute;
      left: 0;
      bottom: 100%;
      margin-bottom: 8px;
      font-size: 14px;
      // color: var(--candidate-color);
      background-color: var(--candidate-bg-color);
      p {
        margin: 0;
        color: var(--candidate-color);
      }
    }
  }

  .db-params-status {
    @include container($head: 'Database Parameters Status', $head-color: navy);
    position: absolute;
    left: 0;
    bottom: 100%; /* Align bottom edge of container to top edge of button */
    margin-bottom: 8px; /* Spacing above button */
    width: max-content;
    padding: 0.5rem 1rem;
    font-size: 12px;
    background-color: navy;
    color: lightgreen;
    white-space: nowrap;
    z-index: 10;
  }
  .current-task {
    grid-column: span 3;
    display: flex;
    align-items: center;
    color: var(--green-type);
    font-size: 13px;
    margin-left: 1rem;
    span {
      margin-right: 7px;
    }
  }
</style>

<script lang="ts">
  import { vscode } from '$lib/utils/event-handler.browser'
  import { onMount } from 'svelte'
  import CRModelPermissionHandler from '$lib/components/CRModelPermissionHandler.svelte'

  type TProps = {
    pageInfo: TToggleFunc
  }
  let { pageInfo = $bindable() }: TProps = $props()
  let isActive = $state(false)
  function handlePageInfo() {
    isActive = isActive ? false : true
  }
  pageInfo = handlePageInfo as TToggleFunc

  let videoUris = $state<Record<string, string>>({})
  let videoName = $state('')
  let dialogEl = $state<HTMLDialogElement | null>(null)
  function setVideoName(name: string) {
    videoName = `${name}Video`
    // Open modal once video name is set
    dialogEl?.showModal()
  }
  function closeModal() {
    dialogEl?.close()
    videoName = ''
  }
  function handleDialogClick(e: MouseEvent) {
    if (!dialogEl) return

    // Get the inner bounding rectangle of the dialog
    const rect = dialogEl.getBoundingClientRect()

    // Check if the click occurred OUTSIDE the dialog's visible boundaries (on the backdrop)
    const isOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom

    if (isOutside) {
      closeModal()
    }
  }
  //  console.log('[App] top point after $props()')
  let appName = $state('')
  let isLoading = $state(true)
  // // const vscode = acquireVsCodeApi()
  let models: Models = $state<Models>({}) as Models
  let inAction = $state(false)
  // NOTE selectedModels are maintained by CRModelPermissionHandler
  // when any checkbox on a component model list is selected
  // the component keeps this selectedModels in sync
  // it is Record<ModelName,{routeName, permissions?}>
  let selectedModels = $state<SelectedModels>({})
  let userRoles = $state<string[]>([])
  // // what components users want to include in newnly generated pages
  let crComponents: string[] = $state([
    'CRInput',
    'CRSpinner',
    'CRActivity',
    'CRTooltip',
    'CRSummaryDetails',
  ])

  // what authentication/authorization to implement should be optional?
  let appFeatures: string[] = $state([])

  // function getPayload() {
  //   if (Object.keys(selectedModels).length === 0) {
  //     return selectedModels
  //   }

  //   let payload: Payload = {}
  //   if (crComponents.length) {
  //     payload['crComponents'] = $state.snapshot(crComponents)
  //   }
  //   for (const key of ['authorization', 'authentication']) {
  //     const el = document.querySelector(
  //       `input[name=${key}]:checked`,
  //     ) as HTMLInputElement
  //     if (el) {
  //       payload[key] = el.value
  //     }
  //   }
  //   if (appFeatures.length) {
  //     payload['features'] = $state.snapshot(appFeatures)
  //   }

  //   payload['selectedModels'] = $state.snapshot(selectedModels)

  //   return payload
  // }

  // Webview sends message to the extension
  function createCRUDSupport(e: MouseEvent) {
    if (buttonNotAllowed) {
      return
    }
    inAction = true
    const el = e.target as HTMLDivElement
    el.style.cursor = 'none'
    let payload = JSON.stringify(getPayload())
    vscode.postMessage({
      command: 'CreateCrudSupport',
      payload: payload,
    })
  }
  function closetheApp() {
    vscode.postMessage({
      command: 'close',
    })
  }

  let buttonNotAllowed = $derived(
    Object.keys(selectedModels).length === 0,
  ) as boolean

  onMount(() => {
    try {
      console.log('[OrmThree] postMessage "ready" to extension')
      isLoading = true
      vscode.postMessage({
        command: 'ready',
        payload: 'wait for sendingModels from extension',
      })

      const handler = (event: MessageEvent) => {
        const msg = event.data
        //        console.log('[OrmThree] got message', msg.command)
        switch (msg.command) {
          case 'sendingModels':
            const pload = $state.snapshot(JSON.parse(msg.payload))
            models = pload.models
            userRoles = Object.keys(
              Object.values(pload.enums)[0] as TEnum,
            ).filter(Boolean)
            appName = pload.appName
            // videoUris = pload.videoUris
            isLoading = false
            break

          case 'crudSuportDone':
            console.log('[OrmThree] crudSuportDone')
            const crudButton = document.getElementById(
              'createBtnId',
            ) as HTMLDivElement
            inAction = false
            crudButton.style.cursor = 'pointer'
            break
          default:
            console.log('[App] not handled', msg.command, msg)
        }
        isLoading = false
      }
      window.addEventListener('message', handler)
      console.log('[OrmThree] mounted event listener for "message"')

      return () => {
        window.removeEventListener('message', handler)
      }
    } catch (err: unknown) {
      //      console.log('[App] onMount try/catch', err)
    }
  })
</script>

<svelte:head>
  <title>CRUD Support</title>
</svelte:head>
<!-- Modal Dialog Component -->
<dialog
  bind:this={dialogEl}
  onclick={handleDialogClick}
  onclose={() => {
    videoName = ''
  }}
>
  {#if videoUris[videoName]}
    <div class="modal-content">
      <button class="close-btn" onclick={closeModal} aria-label="Close modal"
        >✕</button
      >

      <video autoplay loop muted playsinline src={videoUris[videoName]}>
        <track kind="captions" />
      </video>
    </div>
  {/if}
</dialog>

{#snippet playVideo()}
  <video autoplay loop muted playsinline src={videoUris[videoName]}>
    <track kind="captions" />
  </video>
{/snippet}

{#if videoUris[videoName]}
  {@render playVideo()}
{/if}
{#snippet pagePurpose()}
  <pre>
  The main part of this page is on the right.

  1) ORM Models -- table names,
    a list of models/table-names from /prisma/schema.prisma parsed file.
    Every model is presented in a row that can be expanded to show list
      of fields/table-columns -- where some could be UI data-entry fields
      and the others like userAuthToken, passwordHash, createdAt... are
      not to be displayed to the users.
      Rows contain:
    - input box for naming routes, e.g. for model
      {Object.keys(models)}[0]  route would be a folder under
      /{appName}/routes/{Object.keys(models)[0]} if model is selected
    - a checkbox to signal that model is selected for generating a route
    - Model name
    - Permissions -- when clicked opens a dropdown with UserKind from
      enums found in schema.prisma, or if enums are not found the extension
      uses the default enums: USER ADMIN MODERATOR VISITOR.
  2) Extra Models
    Some pages could be based on partial models that include only several
    fields/columns like Login that includes only say email and password.
    Extra model are added entering extra model name in the input box with
    placeholder 'Add extra model' and selecting the 'add' button.
    Model can be removed from the list by entering its name and selecting
    remove and answering the Confirmation Box to allow the action.
  3) Adding Fields to Extra Model(s)
    When extra model(s) are defined then opening any ORM Model will show
    tooltip like a radio-button group with Model Name beside when some
    data-entry field is hovered allowing users to select the model and the
    hovered field will be copied into selected extra model.
    When more than on extra model is defined tooltip radio-button group
    includes label 'Both' or 'All' if more then two extra models exist.
  4)Create CRUD Support button is enabled when some or all models are
    selected, and when clicked it sends selected page attributes for
    page-by-page decoration selecting some additional attributes and/or
    specific behavior offered by the extension, like what Components to
    include in the given page.
    </pre>
{/snippet}
{#snippet appIncludes()}
  <label for="Navbar" class="app-labels">
    <input
      type="checkbox"
      id="Navbar"
      value="NavBar"
      bind:group={appFeatures}
    />
    Include navbar in app root +layout.svelte</label
  >
  <label for="ThemeIcon" class="app-labels">
    <input
      type="checkbox"
      id="ThemeIcon"
      value="ThemeIcon"
      bind:group={appFeatures}
    />
    Include dark/light/system theme icon
  </label>

  <div class="authentication-authorization">
    <div class="authentication">
      {#each ['pasword-based', 'multi-factor MFA', 'certificate-based', 'token-based JWT', 'Exlude'] as auth (auth.slice(0, 4))}
        <label>
          <input
            type="radio"
            name="authentication"
            value={auth}
            checked={auth === 'token-based JWT'}
          />
          {auth}
        </label>
      {/each}
    </div>
    <div class="authorization">
      {#each ['JSON Web Tokens JWT', 'API Keys', 'Bearer Tokens', 'Digest Authentication', 'Mutual TLS', 'Exclude'] as auth (auth.slice(0, 4))}
        <label>
          <input
            type="radio"
            name="authorization"
            value={auth}
            checked={auth === 'Bearer Tokens'}
          />
          {auth}
        </label>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet pageByPageMiddleColumn()}
  <div class="cr-left-column">
    {@render appIncludes()}
    <div class="embellishments" aria-hidden={true}>
      {#each ['CRInput', 'CRSpinner', 'CRActivity', 'CRTooltip', 'CRSummaryDetails'] as comp (comp)}
        <div class="checkbox-item">
          <label for={comp}
            ><input
              id={comp}
              type="checkbox"
              value={comp}
              bind:group={crComponents}
            />
            {comp} component
          </label>
        </div>
        <p
          onclick={() => setVideoName(comp)}
          onkeyup={() => setVideoName(comp)}
          aria-hidden={true}
        >
          show in action
        </p>
      {/each}
    </div>
    <div class="buttons-row">
      <button
        id="createBtnId"
        onclick={createCRUDSupport}
        style="font-size: 14px !important;cursor:pointer;margin:0'"
        disabled={buttonNotAllowed}
        class:notallowed={buttonNotAllowed}
        aria-hidden={true}
      >
        <span class:spinner={inAction}></span>
        Create CRUD Support
      </button>
      <button onclick={closetheApp} class="button-close">close</button>
    </div>
  </div>
{/snippet}
{#if isActive}
  <div class="page-info">
    {@render pagePurpose()}
  </div>
{/if}
<div id="crudUIBlockId" class="cr-main-grid">
  <div class="application-settings">
    {@render pageByPageMiddleColumn()}
  </div>
  <CRModelPermissionHandler
    {models}
    bind:selectedModels
    bind:isLoading
    {userRoles}
  ></CRModelPermissionHandler>
</div>

<style lang="scss">
  .spinner {
    display: inine-block;
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
  .buttons-row {
    display: grid;
    grid-template-columns: 10rem 4rem;
    gap: 1rem;
    position: absolute;
    top: 28rem;
    left: 5rem;
    #createBtnId {
      display: flex;
      display: inline-block;
      outline: none;
      border: 1px solid gray;
      border-radius: 5px;
      font-weight: 400;
      color: var(--candidate-color);
      background-color: var(--candidate-bg-color);
      width: max-content;
      padding: 2px 1rem 2px 1rem;
      cursor: pointer;
    }
    .button-close {
      display: inline-block;
      outline: none;
      border: 1px solid gray;
      border-radius: 5px;
      font-weight: 400;
      color: var(--candidate-color);
      background-color: var(--candidate-bg-color);
      width: max-content;
      padding: 2px 1rem 2px 1rem;
      cursor: pointer;
    }
  }
  .cr-main-grid {
    border: 1ps solid tomato;
    position: relative;
    display: grid;
    grid-template-columns: 30rem 23rem;
    column-gap: 1rem;
    margin: 0 0 0 1rem;
    width: max-content;
    height: auto;
    align-items: start;
    opacity: 1;
  }
  .application-settings {
    width: 30rem;
    align-items: start;
    height: 100%;
  }
  .cr-left-column {
    @include container($head: 'Application Settings', $head-color: navy);
    position: relative;
    border: 1px solid gray;
    border-radius: 8px;
    height: 40.2rem;
    width: 30rem;
    padding: 1rem 0 0 0.7rem;
    background-color: var(--panel-bg-color);

    label {
      display: block;
      color: var(--candidate-color);
      cursor: pointer;
    }
    div {
      display: block;
    }
  }

  .embellishments {
    @include container($head: 'Include Components', $head-color: navy);
    background-color: var(--panel-bg-color);

    position: relative;
    display: grid;
    grid-template-columns: minmax(2em, auto) 7rem;
    align-items: center;
    width: 97.2%;
    column-gap: 0.5rem;
    row-gap: 0.1rem;
    align-items: center;
    padding: 8px 1rem;
    border: 1px solid gray;
    border-radius: 6px;
    user-select: none;
    .checkbox-item {
      display: inline-block;
      margin: 0;
      padding: 0;
      width: 13rem;
    }
    p {
      display: inline-block;
      margin: 0;
      padding: 0;
      color: gray;
      opacity: 0.8;
    }
  }
  .notallowed {
    opacity: 0.3;
    cursor: not-allowed !important;
  }
  .app-labels {
    color: var(--checkbox-label-color);
    margin: 3px 0 3px 1rem;

    &:last-of-type {
      margin-bottom: 1rem;
    }
  }

  .authentication,
  .authorization {
    @include container(
      $head: 'Authentication',
      $head-color: navy,
      $padding: 0.5rem 1rem,
      $left: 1rem,
      $width: max-content
    );
    label {
      cursor: pointer;
    }
    margin: 0.5rem 0 1rem 0;
  }
  .authorization {
    @include container($head: 'Authorization', $left: 0.5rem);
    width: 16rem;
  }
  .authentication-authorization {
    display: grid !important;
    grid-template-columns: 11rem 14rem;
    column-gap: 0.5rem;
  }

  .page-info {
    @include page-info();
  }
  dialog {
    border: 1px solid var(--vscode-widget-border, #454545);
    border-radius: 8px;
    background: var(--vscode-editor-background, #1e1e1e);
    padding: 0;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);

    /* Corner resize enabled */
    resize: both;
    overflow: auto;

    /* Initial size limits */
    width: 550px;
    height: auto;
    min-width: 300px;
    min-height: 200px;
    max-width: 90vw;
    max-height: 90vh;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
  }

  .modal-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .modal-content video {
    width: 100%;
    height: 100%;
    object-fit: contain; /* Keeps aspect ratio clean when resized */
    display: block;
  }

  .close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>

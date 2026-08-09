<!--
@component
Ctrl+Shift+P   Local History: Find Entry to Restore
-->

<script lang="ts">
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  export type TProps = {
    userRoles: string[]
    modelName: string
    models: Models
    exportModels: (modelName: string) => void
  }
  let {
    userRoles,
    modelName,
    models = $bindable(),
    exportModels,
  }: TProps = $props()
  // model holds set of selected roles
  const rolesMap = new SvelteMap<string, SvelteSet<string>>()

  // when dropdown is opened set the current selectedModel
  let selectedModel = $state('')
  let dropdownEl: HTMLDivElement

  function roleSelected(e: MouseEvent, model: string) {
    e.preventDefault()
    const el = e.target as HTMLElement
    if (!el.classList[0]) {
      return
    }
    // TODO cannot allow dupplicate roles in the list
    switch (el.classList[0]) {
      case 'selectedRoles': {
        selectedModel = (el.parentElement as HTMLElement)?.dataset
          .model as string
        //// console.log('switch selectedRoles', selectedModel);
        // in order to position drop down find rect of currently selected role-list
        // const { x, y } = el.getBoundingClientRect();
        Object.assign(dropdownEl.style, {
          top: `${el.offsetHeight + 7}px`,
          left: '13rem',
        })
        dropdownEl.classList.toggle('hidden')
        break
      }
      case 'role-list':
        dropdownEl.classList.toggle('hidden')
        break
      default: {
        // Svelte cryptic class name
        const role = el.innerText.match(/(\w+)\s*$/)?.[0]
        if (role && !el.classList.contains('role-list')) {
          toggleRole(e, model as string, role)
        }
      }
    }
  }
  function toggleRole(e: MouseEvent, model: string, role: string) {
    e.preventDefault()
    //console.log('toggleRole', model, role);
    let set = rolesMap.get(model)

    if (!set) {
      set = new SvelteSet<string>()
      rolesMap.set(model, set)
    }

    if (set.has(role)) {
      set.delete(role)
    } else {
      set.add(role)
    }
    models[modelName].permissions = [...set].join(' ')
    exportModels(modelName)
  }
  function dismiss(e: MouseEvent) {
    ;(e.target as HTMLElement)
      .querySelector('.dropdown')
      ?.classList.add('hidden')
  }
</script>

{#snippet multiSelect(model: string)}
  {@const selected = rolesMap.get(model) ?? new SvelteSet()}

  <section
    class="select-wrapper"
    aria-hidden={true}
    onclick={(e: MouseEvent) => roleSelected(e, model)}
    onmouseleave={dismiss}
  >
    <!-- selected roles -->
    <div class="role-list" aria-hidden={true} data-model={model}>
      {#if selected.size}
        {#each [...selected] as role (role)}
          <span class="badge">
            {role[0]}
          </span>
        {/each}
      {:else}
        <span class="selectedRoles">permissions</span>
      {/if}
    </div>
  </section>
{/snippet}
<!-- dropdown -->
<div
  bind:this={dropdownEl}
  class="dropdown hidden"
  onclick={(e: MouseEvent) =>
    toggleRole(e, selectedModel, (e.target as HTMLElement)?.innerText.slice(2))}
  onkeyup={undefined}
  onmouseleave={(e: MouseEvent) => {
    ;(e.currentTarget as HTMLElement).classList.add('hidden')
  }}
  aria-hidden={true}
>
  {#each userRoles as role (role)}
    <p class:selected={rolesMap.get(selectedModel)?.has(role)}>
      <span class="letter">
        {role[0]}
      </span>
      {role}
    </p>
  {/each}
</div>
{@render multiSelect(modelName)}

<style lang="scss">
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .select-wrapper {
    position: absolute;
    top: 3px;
    left: 13rem;
    width: 6rem;
    margin-left: 2rem;
    user-select: none;
    .role-list {
      display: flex;
      gap: 4px;

      width: 100%;
      line-height: 10px;
      height: 1rem;
      border-radius: 4px;
      color: var(--candidate-color);
      border: 1px solid gray;
      border-radius: 4px;
      z-index: 20;
      .badge {
        display: inline-block;
        font-size: 11px;
        border: 1px solid gray;
        border-radius: 4px;
        padding: 0 2px;
        pointer-events: none;
      }
      .selectedRoles {
        display: inline-block;
        text-align: center;
        width: 8rem;
        cursor: pointer;
      }
    }
  }
  .selected {
    opacity: 0.5;
  }
  .dropdown {
    position: absolute;
    top: 3rem;
    left: 5rem;
    width: 8rem;
    padding: 2px 1rem;
    border: 1px solid gray;
    border-radius: 6px;
    background-color: var(--candidate-bg-color);
    cursor: pointer;
    user-select: none;
    z-index: 20;
    p {
      font-size: 10px;
      margin: 0;
      padding: 1px 0;
      &:hover {
        width: 100%;
        background-color: cornsilk;
      }
    }
    .letter {
      font-size: 11px;
      border: 1px solid gray;
      border-radius: 4px;
      padding: 0 4px;
      pointer-events: none;
    }
  }

  .hidden {
    display: none;
  }
</style>

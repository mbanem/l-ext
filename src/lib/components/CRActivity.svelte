<script lang="ts">
  // CRActivity
  import { onMount } from 'svelte';
  import * as utils from '$lib/utils';
  type ARGS = {
    PageName: string;
    result: string;
    selectedUserId: string;
    user: UserPartial;
    users: UserPartial[] | [];
  };
  let {
    PageName,
    result = $bindable(),
    selectedUserId = $bindable(),
    user,
    users,
  }: ARGS = $props();

  if (users?.length === 0) {
    users[0] = user as UserPartial;
  }
  const selectedUserId_ = () => {
    return selectedUserId;
  };

  const getSelectedUserRole = () => {
    if (!users) return '';
    return users.filter((user) => user.id === selectedUserId)[0]?.role as Role;
  };
  // svelte-ignore non_reactive_update
  // let msgEl: HTMLSpanElement;
  // svelte-ignore non_reactive_update
  let msgEl: HTMLSpanElement;
  let selectBox: HTMLSelectElement;
  let timer: NodeJS.Timeout | string | number | undefined; //ReturnValue<typeof setTimeout>;
  const killTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  const scheduleClearMessage = () => {
    killTimer();
    timer = setTimeout(() => {
      result = '';
      if (msgEl) {
        msgEl.innerText = '';
      }
    }, 2000);
  };
  const showResult = () => {
    scheduleClearMessage();
    return result;
  };
  let [userName, role] = $derived.by(() => {
    let user = users?.filter((u) => u.id === selectedUserId)[0] as UserPartial;
    if (user) {
      return [`${user?.firstName} ${user?.lastName}`, user.role];
    } else {
      return ['not available', 'VISITOR'];
    }
  });

  onMount(() => {
    selectedUserId = user.id as string;
  });
</script>

<svelte:head>
  <title>{utils.capitalize(PageName)}</title>
</svelte:head>
<div class="activity">
  <span style="color:gray;font-size:24px;"
    >{utils.capitalize(PageName)} Page</span
  >
  {#if user?.role === 'ADMIN' && users && users.length > 1}
    <select bind:this={selectBox} bind:value={selectedUserId}>
      {#each users as the_user}
        <option value={the_user.id}>
          {the_user.firstName}
          {the_user.lastName}
        </option>
      {/each}
    </select>
    <span style="font-size:11px;padding:0;margin:0;"
      >{getSelectedUserRole()}</span
    >
    <span class="user_name"
      >(logged-in {user?.firstName}
      {user?.lastName}--<span style="font-size:11px;">{user?.role})</span></span
    >
  {/if}
  <!-- <span class="user-name"
    >{userName} <span style="font-size:11px;">{user?.role}</span></span
  > -->
  {#key result}
    {#if result !== ''}
      <span bind:this={msgEl} class="message">{showResult()}</span>
    {/if}
  {/key}
</div>

<style lang="scss">
  .activity {
    display: flex;
    gap: 1rem;
    align-items: baseline;
    margin-left: 1rem;
    .message,
    .user-name,
    .user_name {
      display: inline-block;
      font-size: 14px;
      font-weight: 100;
      color: lightgreen;
      margin-left: 1rem;
    }
    .user_name {
      color: skyblue;
    }
  }
  select {
    margin-right: -0.7rem !important;
    padding: 1px 1rem;
    margin: 0;
    font-size: 14px;
    line-height: 14px;
  }
</style>

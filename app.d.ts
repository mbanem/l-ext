// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
// import * as Types from '$lib/types/types';
// import { SvelteMap as SvelteMap_ } from 'svelte/reactivity';
declare global {
  interface String {
    capitalize(): string
  }
  interface Number {
    // gets (callback) that recives currrent index
    times(callback: (index: number) => void): void
  }
  var log: typeof console.log;
  type SvelteMap<K, V> = SvelteMap_<K, V>;
  export { SvelteMap_ as SvelteMap };
  export type Field = {
    name: string
    type: string
    isArray: boolean
    isOptional: boolean
    isDataEntry: boolean
    attrs?: string
    permissions?: string
  }
  // no name; it should be part of Models with their name as a key
  export type Model = {
    fields: Field[]
    attrs?: string[]
    permissions?: string
  }
  export type RouteName = string
  export type ModelName = string
  export type EnumName = string
  export type Models = Record<string, Model>
  export type SelectedModel = Record<
    ModelName,
    {
      routeName: string
      permissions?: string
    }
  >
  export type SelectedModels = SvelteMap<RouteName, SelectedModel>
  export type Components = string[]
  export type Payload = Record<
    string,
    SelectedModels | Model | Components | string
  > // { route: string | null } = { route: null };
  export type TEnum = Record<string, string>
  export type TEnums = Record<string, TEnum>;
  export type TCallbackFunc = (() => void) | undefined
  export type TPaths = Record<string, vscode.Uri>
  export type DbParams = Record<string, string | number>

  // props for creating +page.svelte/+page.server.ts route pager
  export type TCreatePageProps = {
    routeName: string
    model: Model
  }
  export type PageKey = 'OrmOne' | 'OrmThree'
  export type TResult = { success: boolean; error?: string }
  export type TCommandResult<TF extends boolean = false> = {
    success: TF
    code: number
    stdout: string
    stderr: string
    command: string
    args: string[]
    error?: Error
  }

  export const CStick = {
    top: 'top',
    right: 'right',
    below: 'below',
    left: 'left',
  } as const
  export type TStick = typeof CStick[keyof typeof CStick]
  // export type DependencyType = 'dependencies' | 'devDependencies'
  namespace App {
    // interface Error {}
    // interface Locals {
    // 	user: Types.UserPartial;
    // }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export { }

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
// import * as Types from '$lib/types/types';
// import { Paths as PathsClass } from './src/extension.js'
// import { SvelteMap} from 'svelte/reactivity'
declare global {
  // type TPaths = PathsClass
  type Field = {
    name: string
    type: string
    isArray: boolean
    isOptional: boolean
    isDataEntry: boolean
    attrs?: string
    permissions?: string
  }
  interface String {
    capitalize(): string
  }
  interface Number {
    // Prima funkciju (callback) koja kao argument može dobiti trenutni indeks
    times(callback: (index: number) => void): void
  }
  function myGlobalFunction(param: string): number
  // no name; it should be part of Models with their name as a key
  type Model = {
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
	export type SelectedModels = Record<RouteName, SelectedModel>
  type Components = string[]
  type TypeOfPayload = string
  type Payload = Record<
    TypeOfPayload,
    SelectedModels | Model | Components | string | string[]
  >
  type Role = 'User' | 'Admin' | 'Moderator' | 'Visitor' | 'Customer'
  type TUserLogIn = {
    firstName: string
    lastName: string
    role: Role
    email?: string
    password?: string
  }

  type TCallbackFunc = (() => void) | undefined
  // type TPaths = Record<string, string>
  type DbParams = Record<string, string | number>

  // props for creating +page.svelte/+page.server.ts route pager
  type TCreatePageProps = {
    routeName: string
    model: Model
  }
  type PageKey = 'OrmOne' | 'OrmThree'
  type TEnum = Record<string, string>
  type TEnums = Record<string, TEnum>
  type TResult = { success: boolean; error?: string }
  type TCommandResult<TF extends boolean = false> = {
    success: TF
    code: number
    stdout: string
    stderr: string
    command: string
    args: string[]
    error?: Error
  }
  type TStick =
    'left' | 'right' | 'middle' | 'middle-over-left' | 'below' | 'above'
  // type DependencyType = 'dependencies' | 'devDependencies'
  namespace App {
    // interface Error {}
    // interface Locals {
    // 	user: Types.TUserLogIn;
    // }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}
// Crucial: d.ts files with imports need an empty to be treated as a module
declare module '*.mp4' {
  const src: string
  export default src
}
export {}

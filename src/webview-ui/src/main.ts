import { mount, unmount } from 'svelte'
import App from './App.svelte'

console.log('[main] Mounting App.svelte - timestamp:', new Date().toISOString())
const app = mount(App, {
  target: document.getElementById('app')!,
})
console.log('[main] App.svelte mounted successfully', new Date().toISOString())
// Optional: expose for cleanup / HMR in dev
if (import.meta.hot) {
  console.log('[main] disposing')
  import.meta.hot.accept()
  import.meta.hot.dispose(() => unmount(app))
}
export default app

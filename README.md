#### Svelte 5 VsCode Webview Extension

-- TODO
[ormOne] continue to receive messages after it is done

- making video shorter -- in Dev Tools filter enter [CRUD l-ext] to get only e=xtensiion console.logs
- console.log('%c🚀 Running in Webview DEV mode', 'color: lime; font-size: 13px')
- rm -rf out \*.vsix node_modules/.cache node_modules/.vite; pnpm ix
- what Ubuntu version is in WSL
  cat /etc/os-release
- Part One.
  On start it tries to find approot/prisma/schema.prisma and
  if not found it offers to install necessary npm packages
  and to create a role and database by offering to user to
  enter the necessary attributes and select 'installORMPartOne'
  button. When npm packages are installed and role and db created
  if opens two VS Code tabs beside the extension tab with
  sample schema.prisma file and connection string created by
  the extension (if user enters attributes for role and db)
  waiting for user to finalize the schema and connection string
  and press 'continue' button for part two of installation.
  it creates 'prisma/installORMPartTwoPending.txt' pending file
  so if user close and restarts extension again it will know
  that part two is not done and show the Part Two screen
- Part Two
  It displays information screen with all CLI commands for
  finalizing Prisma ORM installation waiting for user to select
  'continue' button or close it and finish installation themself
  -- and delete the pending file.
- Setting Appliction Properties
  It show a page that ask what attributes the newly generated pages
  and files shoud have. It show a summary/details list ot all
  models, that is read for schema.prisma, offering user
  to select which of them should be used to create
  <pre style='padding:0;margin:0;'>
    📂routes
    ┣ 📂route-name
       ┣ 📜+page.svelte
       ┣ 📜+page.server.ts
  </pre>

  and to assign to models what route-name should be created
  and to select what of utility UI components to include in
  newly created +page.svelte pages;

  Code should be split among App, extension and Orm*.svelte
  extension.ts = VS Code side / backend / filesystem / commands
  App.svelte = Webview side / frontend / UI brain, it can contain things
  that are global inside the webview UI.
  Orm*.svelte = Individual pages / screen components

  The component can be uniinstall from command line in Enbedded Terminal with
  code --uninstall-extension mbanem.l-ext

- create a panel and set panel.webview.html from a call to getHtml() which returns
- an HTML page that should load a main.ts starter code
- `<body>`
- &emsp;`<div id="app"></div>`
  &emsp;`<script`
  &emsp;&emsp;`type="module"`
  &emsp;&emsp;`src="http://localhost:5432/src/main.ts">`
  &emsp;`</script>`
  `</body>`
- which i turn mounts an App.svelte at id='app' in the above markup

The App.svelte is a UI router containing no UI markup, it is the top-most component that exists for the lifetime of the webview. Everything else is rendered beneath it. It naturally plays the role that +layout.svelte would play in a SvelteKit application.
Things that belong in App.svelte are:

- theme initialization
- global styles
- application state shared by all pages
- page navigation (OrmOne → OrmTwo → OrmThree)
- message handling from VS Code
- modal dialogs used throughout the app
- loading overlays
- toast/message components

It decides:

- Which page is shown?
- When to read schema?
- What happens when user clicks Next?
- What happens when a message arrives?
- Should a spinner be shown?
- Should a page change?

The extension.ts as MVC Model
It owns the real data and operations:

- readSchema()
- parsePrismaSchema()
- generateFiles()
- runPrismaCommands()
- createDatabase()
- copyTemplates()

It knows about:

- filesystem
- Prisma
- VS Code
- workspace
- terminal
  but knows nothing about buttons, dialogs, or layouts

App.svelte as MVC Controller

It decides:

Which page is shown?
When to read schema?
What happens when user clicks Next?
What happens when a message arrives?
Should a spinner be shown?
Should a page change?

OrmOne/OrmTwo/OrmThree as MVC Views
They should ideally be mostly:

- display data
- collect user input
- raise events

It doesn't know:

- where schema came from
- how files are generated
- how messages are passed

It only knows:

- Here are some roles.
- User selected ADMIN.
- Tell App.svelte.

It imports all the component pages and has a listener called by the tension for dynamically maunting a page for a given component name.
Components collect information via user interface an send data to extension to carry on activities and call for the next component in a chain of commands.

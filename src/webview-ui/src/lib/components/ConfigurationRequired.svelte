<script lang="ts">
</script>

<div class="config-warning-container">
  <h2>⚠️ Configuration Required</h2>

  <h3>We couldn't read your Prisma schema or database connection.</h3>

  <p>
    The extension is currently paused because your <code>schema.prisma</code> file
    is invalid or cannot generate valid models. We are monitoring your workspace files
    in the background and will automatically proceed once everything is ready.
  </p>

  <div class="requirements-box">
    <strong>To continue to the next step, please ensure:</strong>
    <ul>
      <li><code>schema.prisma</code> is saved and contains valid syntax.</li>
      <li>
        <code>.env</code> contains a valid <code>DATABASE_URL</code> connection string.
      </li>
    </ul>
  </div>

  <hr />

  <h3>What would you like to do next?</h3>
  <ul>
    <li>
      <strong>Fix it now:</strong> Update your files and <strong>Save</strong> them.
      The extension will automatically detect the changes and unlock the next step.
    </li>
    <li>
      <strong>Run manually:</strong> You can run <code>npx prisma init</code> or your
      migration commands directly in your terminal, then relaunch the extension.
    </li>
  </ul>

  <blockquote>
    💡 <strong>Tip:</strong> Once your database connection is active and your schema
    saves successfully, this screen will update automatically.
  </blockquote>

  <hr />

  <h3>🛠️ Why this matters for your workflow</h3>
  <p>
    Once your schema is valid, the extension unlocks complete <strong
      >CRUD automation for SvelteKit</strong
    >. It will automatically scaffold your <code>+page.svelte</code>
    UI routes alongside your <code>+page.server.ts</code> server actions, directly
    mapped to your Prisma models.
  </p>
</div>

<style lang="scss">
  :global(.config-warning-container) {
    max-width: 600px;
    padding: 1.5rem;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    line-height: 1.5;
  }

  h2 {
    margin-top: 0;
  }

  :global(code) {
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.05);
    padding: 0.15rem 0.3rem;
    border-radius: 3px;
  }

  :global(.requirements-box) {
    background-color: rgba(255, 165, 0, 0.1);
    border-left: 4px solid orange;
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 0 4px 4px 0;
  }

  ul {
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
  }

  hr {
    border: 0;
    border-top: 1px solid #ccc;
    margin: 1.5rem 0;
  }

  blockquote {
    margin: 1rem 0;
    padding: 0.5rem 1rem;
    background-color: rgba(0, 0, 0, 0.02);
    border-radius: 4px;
    font-style: italic;
  }
</style>

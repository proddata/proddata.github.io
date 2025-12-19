<script setup>
const year = new Date().getFullYear();
</script>

<template>
  <main class="container">
    <header class="header">
      <h1>proddata</h1>
      <p class="sub">Vue + Vite, deployed with GitHub Pages.</p>
    </header>

    <section class="card">
      <h2>Next steps</h2>
      <ol>
        <li>Run <code>npm install</code></li>
        <li>Start dev server: <code>npm run dev</code></li>
        <li>Push to <code>main</code> to deploy</li>
      </ol>
    </section>

    <footer class="footer">
      <span>© {{ year }}</span>
    </footer>
  </main>
</template>


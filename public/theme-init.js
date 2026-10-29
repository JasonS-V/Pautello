// Apply the saved theme before React paints, under the same CSP as the app.
(function () {
  try {
    var stored =
      localStorage.getItem('pautello_theme') ||
      localStorage.getItem('stavio_theme') ||
      localStorage.getItem('sonata_theme');
    var isDark = stored ? stored === 'dark' : true;
    var root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (error) {
    // Keep the default dark theme when storage is unavailable.
  }
})();

const BrowserManager = require('./services/shared/browserManager');
(async () => {
  try {
    const manager = new BrowserManager();
    await manager.init({ userDataDir: './storage/chrome-profiles/test_profile' });
    console.log('BrowserManager launched successfully');
    await manager.close();
  } catch (err) {
    console.error('BrowserManager failed:', err);
    process.exit(1);
  }
})();

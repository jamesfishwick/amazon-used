const { chromium } = require('playwright');
const path = require('path');

async function debugExtension() {
  console.log('🔧 DEBUGGING EXTENSION - CHECKING BACKGROUND SCRIPT...\n');
  
  // Launch browser with extension loaded
  const pathToExtension = path.join(__dirname);
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  // Open the extension service worker console
  const pages = browser.pages();
  console.log(`📄 Initial pages: ${pages.length}`);
  
  // Navigate to a wishlist to trigger the extension
  const page = await browser.newPage();
  
  // Listen to all console logs from all contexts
  browser.on('page', (newPage) => {
    newPage.on('console', msg => {
      const text = msg.text();
      if (text.includes('BACKGROUND:') || text.includes('ANALYZING') || text.includes('TAB') || text.includes('ERROR') || text.includes('OFFERS')) {
        console.log(`🔧 ${newPage.url().includes('chrome-extension') ? 'SERVICE WORKER' : 'PAGE'}: ${text}`);
      }
    });
  });
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Background script') || text.includes('Processing:') || text.includes('returned') || text.includes('ERROR')) {
      console.log(`📄 CONTENT: ${text}`);
    }
  });
  
  console.log('🌐 Opening wishlist page...');
  await page.goto('https://www.amazon.com/hz/wishlist/ls/3DFK5C9F229Y5?ref=nav_wishlist_lists_1', { 
    waitUntil: 'domcontentloaded',
    timeout: 60000 
  });
  
  console.log('⏳ Waiting 10 seconds for extension to process first few items...');
  await page.waitForTimeout(10000);
  
  // Check extension service worker
  console.log('\n🔍 CHECKING EXTENSION SERVICE WORKER...');
  
  // Try to access the service worker directly
  try {
    const extensionPages = browser.pages();
    console.log(`📄 Total pages/workers: ${extensionPages.length}`);
    
    for (let i = 0; i < extensionPages.length; i++) {
      const extensionPage = extensionPages[i];
      const url = extensionPage.url();
      console.log(`  ${i + 1}. ${url}`);
      
      if (url.includes('chrome-extension')) {
        console.log(`🔧 Found extension context: ${url}`);
        
        // Try to evaluate in the service worker context
        try {
          const result = await extensionPage.evaluate(() => {
            return {
              hasChrome: typeof chrome !== 'undefined',
              hasRuntime: typeof chrome?.runtime !== 'undefined',
              hasTabsAPI: typeof chrome?.tabs !== 'undefined',
              extensionId: chrome?.runtime?.id
            };
          });
          console.log(`🔧 Service worker state:`, result);
        } catch (e) {
          console.log(`❌ Could not evaluate in service worker: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Error checking service worker: ${error.message}`);
  }
  
  // Check if any tabs were created
  console.log('\n📊 CHECKING CREATED TABS...');
  const allPages = browser.pages();
  console.log(`📄 Total pages/tabs: ${allPages.length}`);
  
  allPages.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.url()}`);
  });
  
  // Look for any Amazon offers pages
  const offerPages = allPages.filter(p => p.url().includes('amazon.com') && p.url().includes('olp-opf-redir'));
  console.log(`🔗 Offers pages found: ${offerPages.length}`);
  
  if (offerPages.length > 0) {
    console.log('✅ Background script is creating tabs');
    for (const offerPage of offerPages) {
      console.log(`  📄 ${offerPage.url()}`);
    }
  } else {
    console.log('❌ No offers pages found - background script may not be working');
  }
  
  // Check if extension is loaded in manifest
  console.log('\n🔍 CHECKING EXTENSION INSTALLATION...');
  try {
    await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const extensionInfo = await page.evaluate(() => {
      const extensionCards = Array.from(document.querySelectorAll('extensions-item'));
      return extensionCards.map(card => {
        const name = card.shadowRoot?.querySelector('#name')?.textContent;
        const enabled = card.shadowRoot?.querySelector('#enableToggle')?.checked;
        const errors = card.shadowRoot?.querySelector('#errors-button')?.textContent;
        return { name, enabled, errors };
      }).filter(ext => ext.name?.includes('Amazon') || ext.name?.includes('Wishlist'));
    });
    
    console.log('🔧 Extension status:', extensionInfo);
  } catch (e) {
    console.log('❌ Could not check extension status');
  }
  
  console.log('\n⏸️ Keeping browser open for 30 seconds for manual inspection...');
  console.log('💡 Check the browser console for more detailed logs');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

debugExtension().catch(console.error);
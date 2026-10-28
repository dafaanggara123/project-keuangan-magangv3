const fs = require('fs');
const token = fs.readFileSync('token.txt', 'utf8').trim();

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  const puppeteer = require('C:/Users/user/AppData/Local/npm-cache/_npx/0f94ee7615faf582/node_modules/puppeteer-core');
  const lighthouse = require('C:/Users/user/AppData/Local/npm-cache/_npx/0f94ee7615faf582/node_modules/lighthouse').default;

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=412,823']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tok) => {
    localStorage.setItem('p2_token', tok);
  }, token);

  console.log('Token set in localStorage, running lighthouse on Dashboard...');

  const port = new URL(browser.wsEndpoint()).port;

  const result = await lighthouse('http://localhost:4173/', {
    port: Number(port),
    output: 'json',
    logLevel: 'info',
    disableStorageReset: true,
  });

  fs.writeFileSync('lh-dashboard.json', JSON.stringify(result.lhr, null, 2));
  console.log('Saved lh-dashboard.json');

  await browser.close();
}

run().catch(console.error);

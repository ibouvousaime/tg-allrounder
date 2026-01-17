const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function screenshotRedditPost(postUrl, outputPath = "reddit.png") {
	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
	});
	const page = await browser.newPage();
	await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) " + "AppleWebKit/537.36 (KHTML, like Gecko) " + "Chrome/120.0.0.0 Safari/537.36");

	await page.setViewport({
		width: 1280,
		height: 800,
		deviceScaleFactor: 2,
	});

	await page.goto(postUrl, {
		waitUntil: "networkidle2",
		timeout: 60000,
	});
	//await page.waitForTimeout(3000);
	/* await page.evaluate(() => {
		const buttons = [...document.querySelectorAll("button")];
		const acceptBtn = buttons.find((b) => b.innerText.toLowerCase().includes("accept"));
		if (acceptBtn) acceptBtn.click();
	}); */
	/* 
	const post = await page.waitForSelector(".commentarea", {
		timeout: 15000,
	});
 */
	const buffer = await page.screenshot({});

	await browser.close();
	return buffer;
}

function extractOldRedditLink(text) {
	if (!text) return null;

	const redditRegex = /(https?:\/\/)?(www\.|m\.|old\.)?(reddit\.com\/[^\s]+|redd\.it\/[^\s]+)/i;

	const match = text.match(redditRegex);
	if (!match) return null;

	let url = match[0];

	if (!url.startsWith("http")) {
		url = "https://" + url;
	}

	try {
		const parsed = new URL(url);

		if (parsed.hostname === "redd.it") {
			return `https://old.reddit.com${parsed.pathname}`;
		}

		parsed.hostname = "old.reddit.com";
		return parsed.toString();
	} catch {
		return null;
	}
}

module.exports = { screenshotRedditPost, extractOldRedditLink };

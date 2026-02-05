const puppeteer = require("puppeteer");
const axios = require("axios");

async function getWiktionaryPages(query) {
	const url = "https://en.wiktionary.org/w/api.php";

	const response = await axios.get(url, {
		params: {
			action: "parse",
			page: query,
			format: "json",
			prop: "text",
			redirects: 1,
			origin: "*",
		},
		headers: {
			"User-Agent": "telegram-@wusten_haman_bot/1.0 (your-email@example.com)",
		},
	});

	const html = response.data.parse.text["*"];

	return await renderHtml(html);
}

async function renderHtml(html) {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.setContent(html, { waitUntil: "load" });
	const buffer = await page.screenshot({
		clip: { x: 0, y: 0, width: 800, height: 2048 },
	});
	await browser.close();
	return buffer;
}

module.exports = { getWiktionaryPages };

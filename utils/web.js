const puppeteer = require("puppeteer");
const fs = require("fs");
async function findDirectArchiveLink(url) {
	url = `https://web.archive.org/web/${url}`;
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

	await page.goto(url, { waitUntil: "networkidle2" });
	const content = await page.content();
	const finalUrl = page.url();
	await browser.close();
	fs.writeFileSync("content.html", content);

	return finalUrl;
}

module.exports = { findDirectArchiveLink };

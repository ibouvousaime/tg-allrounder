const puppeteer = require("puppeteer");
const fs = require("fs");
async function findDirectArchiveLink(url) {
	const cleanUrl = url.replace(/^https?:\/\//, "");
	const archiveUrl = `https://web.archive.org/web/${cleanUrl}`;

	const browser = await puppeteer.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});
	const page = await browser.newPage();

	await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

	await page.goto(archiveUrl, { waitUntil: "networkidle2", timeout: 30000 });
	const finalUrl = page.url();
	await browser.close();

	return finalUrl;
}

module.exports = { findDirectArchiveLink };

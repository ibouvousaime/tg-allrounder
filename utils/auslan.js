const puppeteer = require("puppeteer");

async function findAuslanSignVideoLink(word) {
	const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
	const page = await browser.newPage();

	try {
		const searchUrl = `https://find.auslan.fyi/search?query=${encodeURIComponent(word)}&page=0&vp=d`;
		await page.goto(searchUrl, { waitUntil: "networkidle2" });

		await page.waitForSelector("video", { timeout: 10000 });

		const videoLink = await page.evaluate(() => {
			const videoElement = document.querySelector("video");
			if (videoElement) {
				return videoElement.src || videoElement.querySelector("source")?.src;
			}
			return null;
		});

		if (videoLink) {
			return videoLink;
		} else {
			return null;
		}
	} catch (error) {
		console.error(`An error occurred while searching for "${word}": ${error.message}`);
		return null;
	} finally {
		await browser.close();
	}
}

module.exports = { findAuslanSignVideoLink };

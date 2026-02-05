const katex = require("katex");
const puppeteer = require("puppeteer");
const sharp = require("sharp");
async function renderLatexToPngBuffer(latex) {
	const html = `
	<!DOCTYPE html>
	<html>
	<head>
		<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
		<style>
			body {
				margin: 0;
				padding: 0;
				display: inline-block;
			}
		</style>
	</head>
	<body>
		${katex.renderToString(latex, {
			throwOnError: false,
			displayMode: true,
		})}
	</body>
	</html>
	`;

	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	const page = await browser.newPage();

	await page.setViewport({ width: 800, height: 600 });

	await page.setContent(html, {
		waitUntil: ["domcontentloaded", "networkidle0"],
	});

	await page.waitForSelector(".katex-display");

	const el = await page.$(".katex-display");

	const pngBuffer = await el.screenshot({
		omitBackground: true,
	});

	await browser.close();
	const meta = await sharp(pngBuffer).metadata();
	return pngBuffer;
}

module.exports = { renderLatexToPngBuffer };

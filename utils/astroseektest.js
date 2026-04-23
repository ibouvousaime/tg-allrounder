const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

function decimalToDegMin(value) {
	const abs = Math.abs(value);
	const deg = Math.floor(abs);
	const min = Math.round((abs - deg) * 60);
	return { deg, min };
}

const houseMap = {
	W: "whole_horizon",
	P: "placidus",
	K: "koch",
	R: "regiomontanus",
	C: "campanus",
	E: "equal",
	V: "vehlow_equal",
};

function buildAstroSeekUrl(subject) {
	const lat = decimalToDegMin(subject.latitude);
	const lon = decimalToDegMin(subject.longitude);

	const params = new URLSearchParams({
		input_natal: 1,
		send_calculation: 1,

		narozeni_den: subject.day,
		narozeni_mesic: subject.month,
		narozeni_rok: subject.year,

		narozeni_hodina: subject.hour,
		narozeni_minuta: subject.minute,
		narozeni_sekunda: 0,

		narozeni_city: `${subject.city || ""}, ${subject.nation || ""}`,
		narozeni_mesto_hidden: subject.city || "",
		narozeni_stat_hidden: subject.nation || "",

		narozeni_sirka_stupne: lat.deg,
		narozeni_sirka_minuty: lat.min,
		narozeni_sirka_smer: subject.latitude >= 0 ? 0 : 1,

		narozeni_delka_stupne: lon.deg,
		narozeni_delka_minuty: lon.min,
		narozeni_delka_smer: subject.longitude >= 0 ? 0 : 1,

		narozeni_timezone_form: "auto",
		narozeni_timezone_dst_form: "auto",

		house_system: houseMap[subject.houses_system_identifier] || "placidus",
	});

	return `https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?${params.toString()}`;
}
async function getAstroSeekChart(subject) {
	const url = buildAstroSeekUrl(subject);

	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
	});

	let page;
	try {
		page = await browser.newPage();
		await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
		await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

		await page.goto(url, {
			waitUntil: "networkidle2",
			timeout: 60000,
		});

		try {
			await page.waitForSelector("#tabs_content_container", { timeout: 10000 });
		} catch (err) {
			await page.waitForSelector("button, input", { timeout: 10000 });

			await page.evaluate(() => {
				const buttons = Array.from(document.querySelectorAll("button, input"));
				const agreeBtn = buttons.find((el) => el.innerText?.toLowerCase().includes("agree") || el.value?.toLowerCase().includes("agree"));
				if (agreeBtn) agreeBtn.click();
			});
			await new Promise((res) => setTimeout(res, 1500));

			await page.waitForSelector("#tabs_content_container", { timeout: 15000 });
		}

		const imageData = await page.evaluate(() => {
			const imgs = Array.from(document.querySelectorAll("#tabs_content_container img"));

			const biggest = imgs.sort((a, b) => {
				return b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight;
			})[0];

			if (!biggest) return null;

			const canvas = document.createElement("canvas");
			canvas.width = biggest.naturalWidth;
			canvas.height = biggest.naturalHeight;
			const ctx = canvas.getContext("2d");
			ctx.drawImage(biggest, 0, 0);

			return canvas.toDataURL("image/png");
		});

		if (!imageData) {
			throw new Error("Could not find chart image");
		}

		const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
		const buffer = Buffer.from(base64Data, "base64");

		return { buffer, url };
	} catch (err) {
		console.error(`AstroSeek chart error: ${err.message}`);
		if (page) {
			try {
				const screenshot = await page.screenshot({ encoding: "base64" });
				console.error(`Page screenshot (base64): ${screenshot.substring(0, 100)}...`);
				const html = await page.content();
				console.error(`Page title: ${await page.title()}`);
				const errorText = await page.evaluate(() => document.body.innerText.substring(0, 500));
				console.error(`Page content snippet: ${errorText}`);
			} catch (debugErr) {
				console.error(`Debug capture failed: ${debugErr.message}`);
			}
		}
		return { buffer: null, url };
	} finally {
		await browser.close();
	}
}

module.exports = { getAstroSeekChart };

import axios from "axios";
import puppeteer from "puppeteer";

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

export async function getAstroSeekChart(subject) {
	const url = buildAstroSeekUrl(subject);

	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	try {
		const page = await browser.newPage();

		await page.goto(url, {
			waitUntil: "networkidle2",
			timeout: 60000,
		});

		await page.waitForSelector("img", { timeout: 15000 });

		await new Promise((res) => setTimeout(res, 2000));

		/* 		const images = await page.$$("img");

		let chartElement = null;

		for (const img of images) {
			const src = await img.evaluate((el) => el.src);
			if (src && src.includes("chart")) {
				chartElement = img;
				break;
			}
		}

		if (!chartElement && images.length > 0) {
			chartElement = images[0];
		}

		if (!chartElement) {
			throw new Error("Chart element not found");
		}
 */

		await page.waitForSelector("button, input", { timeout: 10000 });

		// try to click the "AGREE" button
		await page.evaluate(() => {
			const buttons = Array.from(document.querySelectorAll("button, input"));

			const agreeBtn = buttons.find((el) => el.innerText?.toLowerCase().includes("agree") || el.value?.toLowerCase().includes("agree"));

			if (agreeBtn) agreeBtn.click();
		});
		await new Promise((res) => setTimeout(res, 1500));

		await page.waitForSelector("#tabs_content_container", {
			timeout: 15000,
		});

		const src = await page.evaluate(() => {
			const imgs = Array.from(document.querySelectorAll("#tabs_content_container img"));

			const biggest = imgs.sort((a, b) => {
				return b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight;
			})[0];

			return biggest?.src;
		});

		const response = await axios.get(src, {
			responseType: "arraybuffer",
		});

		const buffer = Buffer.from(response.data);

		return { buffer, url };
	} finally {
		await browser.close();
	}
}

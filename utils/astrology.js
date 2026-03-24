const axios = require("axios");
const NodeGeocoder = require("node-geocoder");
const options = {
	provider: "openstreetmap",
};
const puppeteer = require("puppeteer");

const geocoder = NodeGeocoder(options);
const { find } = require("geo-tz");
const countries = require("./countries");
const fs = require("node:fs");
const allowedLanguages = ["EN", "FR", "PT", "ES", "TR", "RU", "IT", "CN", "DE", "HI"];

const prettier = require("prettier");
async function getAstrologyChart(dateInfo, language = "EN") {
	const locationInfo = dateInfo.location || {};
	const apiKey = process.env.ASTRO_API_KEY;
	const apiUrl = process.env.ASTROLOGER_API_URL || "http://localhost:8000";

	const timezone = find(dateInfo.lat, dateInfo.lng)[0];
	if (!timezone) {
		throw new Error("Could not determine timezone from coordinates");
	}

	const subject = {
		name: dateInfo.name,
		city: locationInfo.city || "",
		year: dateInfo.year,
		month: dateInfo.month,
		day: dateInfo.day,
		hour: dateInfo.hour,
		minute: dateInfo.minute,
		longitude: dateInfo.lng,
		latitude: dateInfo.lat,
		timezone: timezone,
		houses_system_identifier: "W",
	};
	const countryCode = locationInfo.country ? getCountryCode(locationInfo.country) : null;
	if (countryCode) {
		subject.nation = countryCode;
	}

	const payload = {
		subject,
		theme: "strawberry",
		style: "modern",
		show_zodiac_background_ring: true,
		language: allowedLanguages.includes(language) ? language : "EN",
	};

	const response = await axios.post(`${apiUrl}/api/v5/chart/birth-chart`, payload, {
		headers: {
			"X-RapidAPI-Key": apiKey,
			"Content-Type": "application/json",
		},
	});

	const svgData = response.data.chart;
	fs.writeFileSync("astrology_data.json", JSON.stringify(response.data.chart_data, null, 2));
	if (!svgData) {
		throw new Error("No SVG chart returned from API");
	}

	return await convertSVGToPNG(svgData);
}

async function generateSynastryChart(subject1, subject2, language = "EN") {
	const apiKey = process.env.ASTRO_API_KEY;
	const apiUrl = process.env.ASTROLOGER_API_URL || "http://localhost:8000";

	formatSubject = (subject) => {
		const timezone = find(subject.lat, subject.lng)[0];
		if (!timezone) {
			throw new Error("Could not determine timezone from coordinates");
		}
		const output = {
			name: subject.name,
			city: subject.location.city || "",
			year: subject.year,
			month: subject.month,
			day: subject.day,
			hour: subject.hour,
			minute: subject.minute,
			longitude: subject.lng,
			latitude: subject.lat,
			timezone: timezone,
			houses_system_identifier: "W",
		};
		const countryCode = subject.location?.country ? getCountryCode(subject.location.country) : null;
		if (countryCode) {
			output.nation = countryCode;
		}
		return output;
	};
	const payload = {
		first_subject: formatSubject(subject1),
		second_subject: formatSubject(subject2),
		theme: "strawberry",
		style: "modern",

		show_zodiac_background_ring: true,
		language: allowedLanguages.includes(language) ? language : "EN",
	};

	const response = await axios.post(`${apiUrl}/api/v5/chart/synastry`, payload, {
		headers: {
			"X-RapidAPI-Key": apiKey,
			"Content-Type": "application/json",
		},
	});

	const svgData = response.data.chart;
	if (!svgData) {
		throw new Error("No SVG chart returned from API");
	}

	return await convertSVGToPNG(svgData, { width: 2048, height: 768 });
}

async function convertSVGToPNG(svgData, options = { width: 2048, height: 2048 }, cleanOptions = null) {
	const browser = await puppeteer.launch({
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	let cleanedSVG = svgData;
	/* 	if (cleanOptions) {
		cleanedSVG = await cleanKerykeionSVG(svgData, cleanOptions);
	} */

	try {
		const page = await browser.newPage();

		await page.setViewport({
			width: options.width,
			height: options.height,
			deviceScaleFactor: 2,
		});

		const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: ${options.width}px;
              height: ${options.height}px;
              background: #0f172a; /* matches --kerykeion-color-base-100 */
              display: flex;
              align-items: center;
              justify-content: center;
            }
            svg {
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          ${svgData}
        </body>
      </html>
    `;

		await page.setContent(html, { waitUntil: "networkidle0" });

		const buffer = await page.screenshot({
			type: "png",
			clip: { x: 0, y: 0, width: options.width, height: options.height },
		});

		return buffer;
	} finally {
		await browser.close();
	}
}

async function getSolarReturnChart(dateInfo, year) {
	const apiKey = process.env.ASTRO_API_KEY;
	const apiUrl = process.env.ASTROLOGER_API_URL || "http://localhost:8000";
	formatSubject = (subject) => {
		const timezone = find(subject.lat, subject.lng)[0];
		if (!timezone) {
			throw new Error("Could not determine timezone from coordinates");
		}
		const output = {
			name: subject.name,
			city: subject.location.city || "",
			year: subject.year,
			month: subject.month,
			day: subject.day,
			hour: subject.hour,
			minute: subject.minute,
			longitude: subject.lng,
			latitude: subject.lat,
			timezone: timezone,
			houses_system_identifier: "W",
		};
		const countryCode = subject.location?.country ? getCountryCode(subject.location.country) : null;
		if (countryCode) {
			output.nation = countryCode;
		}
		return output;
	};
	const subject = formatSubject(dateInfo);
	const payload = {
		subject,
		theme: "strawberry",

		year,
		show_zodiac_background_ring: true,
		double_chart_aspect_grid_type: "list",
		show_house_position_comparison: false,
		show_cusp_position_comparison: false,
		show_aspect_icons: false,
	};
	const response = await axios.post(`${apiUrl}/api/v5/chart/solar-return`, payload, {
		headers: {
			"X-RapidAPI-Key": apiKey,
			"Content-Type": "application/json",
		},
	});
	const svgData = response.data.chart;
	const formattedSVG = await prettier.format(svgData, { parser: "html" });
	fs.writeFileSync("solar_return_chart.svg", formattedSVG);

	if (!svgData) {
		throw new Error("No SVG chart returned from API");
	}

	return await convertSVGToPNG(svgData, { width: 2048, height: 768 }, { removeRightPanels: true, removeAspectList: true, width: 800 });
}

async function getCoordinates(location) {
	try {
		const res = await geocoder.geocode(location);

		if (!res || res.length === 0) {
			throw new Error(`No results found for "${location}"`);
		}

		const { latitude, longitude } = res[0];
		return { lat: latitude, lng: longitude };
	} catch (error) {
		console.error("Geocoding error:", error.message);
		throw error;
	}
}

function getCountryCode(countryName) {
	const lower = countryName.toLowerCase().trim();
	return countries.countries.find((c) => c.name.toLowerCase() === lower)?.code || null;
}

module.exports = {
	getAstrologyChart,
	getCoordinates,
	generateSynastryChart,
	getSolarReturnChart,
};

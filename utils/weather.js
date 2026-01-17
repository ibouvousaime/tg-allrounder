const axios = require("axios");
const escapeHTML = (str) => {
	if (typeof str !== "string") return str;
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

async function getForecastDay(location, dayIndex = 0, degreeType = "C") {
	if (dayIndex < 0 || dayIndex > 6 || !Number.isFinite(dayIndex)) {
		dayIndex = 0;
	}

	const apiKey = process.env.WEATHER_API;
	const url = `http://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=${dayIndex + 2}&aqi=yes&alerts=no`;

	try {
		const response = await axios.get(url);
		const apiData = response.data;

		const day = dayIndex >= apiData.forecast.forecastday.length ? apiData.forecast.forecastday.slice(-1)[0] : apiData.forecast.forecastday[dayIndex];

		const item = {
			location: {
				name: [apiData.location.name, apiData.location.region, apiData.location.country].filter((e) => e && e.trim().length).join(", "),
				degreetype: degreeType,
				localTime: apiData.location.localtime,
			},
			forecast: {
				info: dayIndex >= apiData.forecast.forecastday.length ? `No forecast for day ${dayIndex}; using ${apiData.forecast.forecastday.length}. :(` : "",
				date: day.date,
				low: degreeType === "C" ? day.day.mintemp_c : day.day.mintemp_f,
				high: degreeType === "C" ? day.day.maxtemp_c : day.day.maxtemp_f,
				condition: day.day.condition.text,
				uv: day.day.uv,
				astro: day.astro,
				air: day.day?.air_quality,
				chanceOfRain: day.day.daily_chance_of_rain,
				chanceOfSnow: day.day.daily_chance_of_snow,
				totalPrecip: degreeType === "C" ? day.day.totalprecip_mm : day.day.totalprecip_in,
				maxWind: day.day.maxwind_mph,
			},
		};

		return getFormattedForecastData(item);
	} catch (err) {
		if (err.response?.data?.error) {
			console.error("API Error:", err.response.data.error.message);
			return err.response.data.error.message;
		}
		console.error(err);
		return "@ibouprofen, fix me pls";
	}
}

async function getWeather(location, degreeType = "C") {
	const apiKey = process.env.WEATHER_API;

	const url = `http://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=1&aqi=yes&alerts=no`;

	try {
		const response = await axios.get(url);
		const apiData = response.data;

		const item = {
			location: {
				name: [apiData.location.name, apiData.location.region, apiData.location.country].filter((element) => element && element?.trim()?.length).join(", "),
				degreetype: degreeType,
				localTime: apiData.location.localtime,
			},
			current: {
				temperature: degreeType === "C" ? apiData.current.temp_c : apiData.current.temp_f,
				humidity: apiData.current.humidity,
				feelslike: degreeType === "C" ? apiData.current.feelslike_c : apiData.current.feelslike_f,
				skytext: apiData.current.condition.text,
				observationtime: apiData.current.last_updated,
				winddisplay: `${apiData.current.wind_mph} mph ${apiData.current.wind_dir}`,
				dewPt: degreeType === "C" ? apiData.current.dewpoint_c : apiData.current.dewpoint_f,
				uv: apiData.current.uv,
			},
			forecast: {
				low: degreeType === "C" ? apiData.forecast.forecastday[0].day.mintemp_c : apiData.forecast.forecastday[0].day.mintemp_f,
				high: degreeType === "C" ? apiData.forecast.forecastday[0].day.maxtemp_c : apiData.forecast.forecastday[0].day.maxtemp_f,
				astro: apiData.forecast.forecastday[0].astro,
				air: apiData.forecast.forecastday[0].day?.air_quality || apiData.current?.air_quality,
				chanceOfRain: apiData.forecast.forecastday[0].day.daily_chance_of_rain,
				chanceOfSnow: apiData.forecast.forecastday[0].day.daily_chance_of_snow,
				totalPrecip: degreeType === "C" ? apiData.forecast.forecastday[0].day.totalprecip_mm : apiData.forecast.forecastday[0].day.totalprecip_in,
			},
		};
		const formattedTextResult = getFormattedWeatherData(item);
		return formattedTextResult;
	} catch (err) {
		if (err.response && err.response.data && err.response.data.error) {
			const apiErrorMessage = err.response.data.error.message;
			console.error("API Error:", apiErrorMessage);
			return apiErrorMessage;
		}
		console.error(err);
		return "@ibouprofen, fix me pls";
	}
}

function getFormattedWeatherData(item) {
	const cToF = (c) => (c * 9) / 5 + 32;
	const fToC = (f) => ((f - 32) * 5) / 9;

	const formatTemp = (temp, unit) => {
		if (unit === "C") return `${temp}°C (${cToF(temp).toFixed(1)}°F)`;
		if (unit === "F") return `${temp}°F (${fToC(temp).toFixed(1)}°C)`;
		return `${temp}°${unit}`;
	};
	const formatUsEpaIndex = (i) => {
		const labels = ["Unknown", "Good", "Moderate", "Unhealthy (Sensitive)", "Unhealthy", "Very Unhealthy", "Hazardous"];
		return `${labels[i] || "Unknown"}`;
	};

	const lines = [
		`<b>Location:</b> ${escapeHTML(item.location.name)}`,
		`<b>Temp:</b> ${formatTemp(item.current.temperature, item.location.degreetype)}`,
		`<b>Feels like:</b> ${formatTemp(item.current.feelslike, item.location.degreetype)}`,
		`<b>Humidity:</b> ${item.current.humidity}%`,
		`<b>Conditions:</b> ${escapeHTML(item.current.skytext)}`,
		`<b>Wind:</b> ${escapeHTML(item.current.winddisplay)}`,
		`<b>Low / High:</b> ${formatTemp(item.forecast.low, item.location.degreetype)} / ${formatTemp(item.forecast.high, item.location.degreetype)}`,
		`<b>Time:</b> Local ${item.location.localTime} | Observation ${item.current.observationtime}`,
	];

	if (item.forecast.air) lines.push(`<b>Air Quality:</b> ${formatUsEpaIndex(item.forecast.air["us-epa-index"])}`);

	if (item.forecast.chanceOfRain > 0) {
		const precipUnit = item.location.degreetype === "C" ? "mm" : "in";
		lines.push(`<b>Rain:</b> ${item.forecast.chanceOfRain}% chance, ${item.forecast.totalPrecip}${precipUnit} expected`);
	}

	if (item.forecast.chanceOfSnow > 0) {
		lines.push(`<b>Snow:</b> ${item.forecast.chanceOfSnow}% chance`);
	}

	return `<pre>${lines.join("\n")}</pre>`.replace("69%", "69% (nice)");
}

function getFormattedForecastData(item) {
	const cToF = (c) => (c * 9) / 5 + 32;
	const fToC = (f) => ((f - 32) * 5) / 9;

	const formatTemp = (temp, unit) => {
		if (unit === "C") return `${temp}°C (${cToF(temp).toFixed(1)}°F)`;
		if (unit === "F") return `${temp}°F (${fToC(temp).toFixed(1)}°C)`;
		return `${temp}°${unit}`;
	};

	const formatUsEpaIndex = (i) => {
		const labels = ["Unknown", "Good", "Moderate", "Unhealthy (Sensitive)", "Unhealthy", "Very Unhealthy", "Hazardous"];
		return `${labels[i] || "Unknown"}`;
	};

	const lines = [
		`${item.forecast.info}`,
		`<b>Location:</b> ${escapeHTML(item.location.name)}`,
		`<b>Date:</b> ${item.forecast.date}`,
		`<b>Conditions:</b> ${escapeHTML(item.forecast.condition)}`,
		`<b>Low / High:</b> ${formatTemp(item.forecast.low, item.location.degreetype)} / ${formatTemp(item.forecast.high, item.location.degreetype)}`,
		`<b>UV:</b> ${item.forecast.uv}`,
		`<b>Max wind:</b> ${item.forecast.maxWind} mph`,
	].filter((str) => str?.trim()?.length);

	if (item.forecast.air) {
		lines.push(`<b>Air Quality:</b> ${formatUsEpaIndex(item.forecast.air["us-epa-index"])}`);
	}

	if (item.forecast.chanceOfRain > 0) {
		const precipUnit = item.location.degreetype === "C" ? "mm" : "in";
		lines.push(`<b>Rain:</b> ${item.forecast.chanceOfRain}% chance, ${item.forecast.totalPrecip}${precipUnit} expected`);
	}

	if (item.forecast.chanceOfSnow > 0) {
		lines.push(`<b>Snow:</b> ${item.forecast.chanceOfSnow}% chance`);
	}

	if (item.forecast.astro) {
		lines.push(`<b>Sun:</b> ↑ ${item.forecast.astro.sunrise} | ↓ ${item.forecast.astro.sunset}`);
	}
	const output = `<pre>${lines.join("\n")}</pre>`.replace("69%", "69% (nice)");
	return output;
}

function extractDayOffset(input) {
	input = input.toLowerCase();

	if (input.includes("tomorrow")) return 1;

	const match = input.match(/\b(?:in\s*)?(?:day\s*)?(\d+)\s*days?\b/);
	if (match) return Number(match[1]);

	return 0;
}

function extractLocation(input) {
	return input
		.replace(/\b(tomorrow|in\s*\d+\s*days?|day\s*\d+|\d+\s*days?)\b/gi, "")
		.replace(/\s+/g, " ")
		.trim();
}
module.exports = { getWeather, getForecastDay, extractDayOffset, extractLocation };

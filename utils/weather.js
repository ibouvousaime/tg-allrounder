const axios = require("axios");
const escapeHTML = (str) => {
	if (typeof str !== "string") return str;
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};
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
			console.error(apiErrorMessage);
			return "I bet there was a typo in ur msg smh (details: " + apiErrorMessage + ")\n<b>You can just edit your message, btw.</b>";
		}
		console.error(err);
		return "@swaggeux, fix me pls";
	}
}

function getFormattedWeatherData(item) {
	const cToF = (c) => (c * 9) / 5 + 32;
	const fToC = (f) => ((f - 32) * 5) / 9;

	const getTempEmoji = (temp, unit) => {
		const tempC = unit === "C" ? temp : fToC(temp);
		if (tempC >= 35) return "🔥";
		if (tempC >= 25) return "☀️";
		if (tempC >= 15) return "🌤️";
		if (tempC >= 5) return "🌥️";
		if (tempC >= -5) return "❄️";
		return "🥶";
	};

	const getHumidityEmoji = (humidity) => {
		if (humidity >= 80) return "💧";
		if (humidity >= 60) return "💦";
		return "🌵";
	};

	const getConditionEmoji = (condition) => {
		const lower = condition.toLowerCase();
		if (lower.includes("sunny") || lower.includes("clear")) return "☀️";
		if (lower.includes("partly cloudy")) return "⛅";
		if (lower.includes("cloudy") || lower.includes("overcast")) return "☁️";
		if (lower.includes("rain") || lower.includes("drizzle")) return "🌧️";
		if (lower.includes("thunder") || lower.includes("storm")) return "⛈️";
		if (lower.includes("snow") || lower.includes("blizzard")) return "❄️";
		if (lower.includes("fog") || lower.includes("mist")) return "🌫️";
		if (lower.includes("sleet")) return "🌨️";
		return "🌤️";
	};

	const getWindEmoji = (windSpeed) => {
		const speed = parseFloat(windSpeed);
		if (speed >= 25) return "💨";
		if (speed >= 15) return "🍃";
		return "🌬️";
	};

	const getRainEmoji = (chance) => {
		if (chance >= 70) return "🌧️";
		if (chance >= 40) return "🌦️";
		return "☔";
	};

	const getSnowEmoji = (chance) => {
		if (chance >= 70) return "❄️";
		return "🌨️";
	};

	const getAirQualityEmoji = (index) => {
		if (index === 1) return "✅";
		if (index === 2) return "🟡";
		if (index === 3) return "🟠";
		if (index === 4) return "🔴";
		if (index === 5) return "🟣";
		if (index === 6) return "🟤";
		return "❓";
	};

	const formatTemp = (temp, unit) => {
		const emoji = getTempEmoji(temp, unit);
		if (unit === "C") return `${temp}°C (${cToF(temp).toFixed(1)}°F) ${emoji} `;
		if (unit === "F") return `${temp}°F (${fToC(temp).toFixed(1)}°C) ${emoji} `;
		return `${temp}°${unit} ${emoji}`;
	};
	const formatUsEpaIndex = (i) => {
		const labels = ["Unknown", "Good", "Moderate", "Unhealthy (Sensitive)", "Unhealthy", "Very Unhealthy", "Hazardous"];
		return `${labels[i] || "Unknown"} ${getAirQualityEmoji(i)} `;
	};

	const lines = [
		`<b>Location:</b> ${escapeHTML(item.location.name)}`,
		`<b>Temp:</b> ${formatTemp(item.current.temperature, item.location.degreetype)}`,
		`<b>Feels like:</b> ${formatTemp(item.current.feelslike, item.location.degreetype)}`,
		`<b>Humidity:</b> ${item.current.humidity}% ${getHumidityEmoji(item.current.humidity)}`,
		`<b>Conditions:</b> ${escapeHTML(item.current.skytext)} ${getConditionEmoji(item.current.skytext)}`,
		`<b>Wind:</b> ${escapeHTML(item.current.winddisplay)} ${getWindEmoji(item.current.winddisplay)}`,
		`<b>Low / High:</b> ${formatTemp(item.forecast.low, item.location.degreetype)} / ${formatTemp(item.forecast.high, item.location.degreetype)}`,
		`<b>Time:</b> Local ${item.location.localTime} | Observation ${item.current.observationtime}`,
	];

	if (item.forecast.air) lines.push(`<b>Air Quality:</b> ${formatUsEpaIndex(item.forecast.air["us-epa-index"])}`);

	if (item.forecast.chanceOfRain > 0) {
		const precipUnit = item.location.degreetype === "C" ? "mm" : "in";
		lines.push(
			`<b>Rain:</b> ${item.forecast.chanceOfRain}% chance, ${item.forecast.totalPrecip}${precipUnit} expected ${getRainEmoji(item.forecast.chanceOfRain)}`
		);
	}

	if (item.forecast.chanceOfSnow > 0) {
		lines.push(`<b>Snow:</b> ${item.forecast.chanceOfSnow}% chance ${getSnowEmoji(item.forecast.chanceOfSnow)}`);
	}

	return `<pre>${lines.join("\n")}</pre>`.replace("69%", "69% (nice)");
}

module.exports = { getWeather };

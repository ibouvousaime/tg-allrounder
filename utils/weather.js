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
				name: `${apiData.location.name}, ${apiData.location.region}, ${apiData.location.country}`,
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
	const formatTemp = (temp, unit) => {
		if (unit === "C") return `${temp}°C (${cToF(temp).toFixed(1)}°F)`;
		if (unit === "F") return `${temp}°F (${fToC(temp).toFixed(1)}°C)`;
		return `${temp}°${unit}`;
	};
	const formatUsEpaIndex = (i) => ["Unknown", "Good", "Moderate", "Unhealthy (Sensitive)", "Unhealthy", "Very Unhealthy", "Hazardous"][i] || "Unknown";

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

	return `<pre>${lines.join("\n")}</pre>`;
}

module.exports = { getWeather };

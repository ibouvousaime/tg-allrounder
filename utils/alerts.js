const axios = require("axios");

const WMO_CODES = {
	0: "Clear sky",
	1: "Mainly clear",
	2: "Partly cloudy",
	3: "Overcast",
	45: "Fog",
	48: "Depositing rime fog",
	51: "Light drizzle",
	53: "Moderate drizzle",
	55: "Dense drizzle",
	56: "Light freezing drizzle",
	57: "Dense freezing drizzle",
	61: "Slight rain",
	63: "Moderate rain",
	65: "Heavy rain",
	66: "Light freezing rain",
	67: "Heavy freezing rain",
	71: "Slight snow fall",
	73: "Moderate snow fall",
	75: "Heavy snow fall",
	77: "Snow grains",
	80: "Slight rain showers",
	81: "Moderate rain showers",
	82: "Violent rain showers",
	85: "Slight snow showers",
	86: "Heavy snow showers",
	95: "Thunderstorm",
	96: "Thunderstorm with slight hail",
	99: "Thunderstorm with heavy hail",
};

const SEVERE_CODES = new Set([95, 96, 99, 66, 67, 56, 57]);
const WIND_GUST_THRESHOLD = 80;
const WIND_SPEED_THRESHOLD = 60;
const PRECIP_THRESHOLD = 30;
const SNOWFALL_THRESHOLD = 20;

function escapeHTML(str) {
	if (typeof str !== "string") return str;
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getAlertId(alert) {
	return `${alert.event}_${alert.effective}`;
}

function formatAlertMessage(alert, locationName) {
	const lines = [
		`<b>⚠️ Weather Alert for ${escapeHTML(locationName)}</b>`,
		`<b>${escapeHTML(alert.headline)}</b>`,
		`<b>Severity:</b> ${escapeHTML(alert.severity)}  |  <b>Urgency:</b> ${escapeHTML(alert.urgency)}`,
		`<b>Event:</b> ${escapeHTML(alert.event)}`,
		`<b>Effective:</b> ${alert.effective}`,
		`<b>Expires:</b> ${alert.expires}`,
	];
	if (alert.areas) lines.push(`<b>Areas:</b> ${escapeHTML(alert.areas)}`);
	if (alert.desc) lines.push(`\n${escapeHTML(alert.desc)}`);
	if (alert.instruction) lines.push(`\n<b>Instructions:</b> ${escapeHTML(alert.instruction)}`);
	return `<blockquote expandable>${lines.join("\n")} </blockquote>`;
}

function buildAlert(date, { event, headline, severity, urgency, desc, instruction }) {
	return {
		id: getAlertId({ event, effective: date }),
		event,
		headline,
		severity,
		urgency,
		effective: date,
		expires: date,
		areas: "",
		desc,
		instruction,
	};
}

function generateAlertsFromForecast(daily, locationName) {
	const alerts = [];

	for (let i = 0; i < daily.time.length; i++) {
		const date = daily.time[i];
		const code = daily.weather_code[i];
		const precip = daily.precipitation_sum[i];
		const maxWind = daily.wind_speed_10m_max[i];
		const maxGust = daily.wind_gusts_10m_max[i];

		if (code === 99) {
			alerts.push(
				buildAlert(date, {
					event: "Thunderstorm with Heavy Hail",
					headline: "Severe Thunderstorm Warning",
					severity: "Extreme",
					urgency: "Immediate",
					desc: "Severe thunderstorm with heavy hail expected. Large hailstones may cause damage to property, vehicles, and injury.",
					instruction: "Seek shelter indoors immediately. Stay away from windows. Park vehicles under cover if possible.",
				}),
			);
		} else if (code === 96) {
			alerts.push(
				buildAlert(date, {
					event: "Thunderstorm with Hail",
					headline: "Thunderstorm Warning",
					severity: "Severe",
					urgency: "Immediate",
					desc: "Thunderstorm with hail expected. Small hailstones and gusty winds possible.",
					instruction: "Seek shelter indoors. Be aware of slippery roads and reduced visibility.",
				}),
			);
		} else if (code === 95 && (maxGust > 50 || precip > 10)) {
			alerts.push(
				buildAlert(date, {
					event: "Thunderstorm",
					headline: "Thunderstorm Warning",
					severity: "Severe",
					urgency: "Immediate",
					desc: "Thunderstorm expected with lightning, gusty winds, and heavy rain.",
					instruction: "Seek shelter indoors. Avoid open areas, tall objects, and water. Unplug sensitive electronics.",
				}),
			);
		}

		if (code >= 66 && code <= 67) {
			alerts.push(
				buildAlert(date, {
					event: "Freezing Rain",
					headline: "Freezing Rain Advisory",
					severity: "Severe",
					urgency: "Expected",
					desc: "Freezing rain expected. Surfaces including roads, sidewalks, and power lines may become icy.",
					instruction: "Avoid driving if possible. Walk carefully on slippery surfaces. Be prepared for possible power outages.",
				}),
			);
		}

		if (code >= 56 && code <= 57) {
			alerts.push(
				buildAlert(date, {
					event: "Freezing Drizzle",
					headline: "Freezing Drizzle Advisory",
					severity: "Moderate",
					urgency: "Expected",
					desc: "Freezing drizzle expected leading to icy patches on roads and walkways.",
					instruction: "Use caution when driving or walking. Allow extra travel time.",
				}),
			);
		}

		if (maxGust >= WIND_GUST_THRESHOLD) {
			alerts.push(
				buildAlert(date, {
					event: "High Wind Gusts",
					headline: "Wind Warning",
					severity: maxGust >= 100 ? "Extreme" : "Severe",
					urgency: "Expected",
					desc: `Strong wind gusts of up to ${maxGust} km/h expected. May cause damage to structures, falling branches, and power outages.`,
					instruction: "Secure loose outdoor objects. Avoid parking under trees. Be cautious of flying debris.",
				}),
			);
		}

		if (maxWind >= WIND_SPEED_THRESHOLD && maxGust < WIND_GUST_THRESHOLD) {
			alerts.push(
				buildAlert(date, {
					event: "Strong Winds",
					headline: "Wind Advisory",
					severity: "Moderate",
					urgency: "Expected",
					desc: `Strong winds of ${maxWind} km/h expected. Difficult driving conditions possible for high-profile vehicles.`,
					instruction: "Secure outdoor items. Take care if driving a high-profile vehicle.",
				}),
			);
		}

		if (precip >= PRECIP_THRESHOLD) {
			alerts.push(
				buildAlert(date, {
					event: "Heavy Precipitation",
					headline: "Flood Advisory",
					severity: precip >= 100 ? "Severe" : "Moderate",
					urgency: "Expected",
					desc: `${precip} mm of precipitation expected in a single day. Risk of flooding in low-lying and poor drainage areas.`,
					instruction: "Avoid flooded areas. Do not drive through standing water. Monitor local flood warnings.",
				}),
			);
		}

		const isSnow = code >= 71 && code <= 75;
		const snowCm = precip * 1.2;
		if (isSnow && snowCm >= SNOWFALL_THRESHOLD) {
			alerts.push(
				buildAlert(date, {
					event: "Heavy Snowfall",
					headline: "Snow Warning",
					severity: precip >= 40 ? "Severe" : "Moderate",
					urgency: "Expected",
					desc: `${precip} cm of snowfall expected. Significant accumulations leading to difficult travel and possible disruptions.`,
					instruction: "Avoid non-essential travel. Keep warm clothing and emergency supplies ready.",
				}),
			);
		}
	}

	return alerts;
}

async function getAlerts(location) {
	try {
		const geoRes = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
			params: { name: location, count: 1, language: "en", format: "json" },
		});

		if (!geoRes.data.results || geoRes.data.results.length === 0) {
			return { locationName: location, alerts: [], error: "Location not found" };
		}

		const geo = geoRes.data.results[0];
		const locationName = `${geo.name}, ${geo.country}`;

		const forecastRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
			params: {
				latitude: geo.latitude,
				longitude: geo.longitude,
				daily: "weather_code,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
				timezone: "auto",
				forecast_days: 2,
			},
		});

		const daily = forecastRes.data.daily;
		console.log({ daily, location });
		const alerts = generateAlertsFromForecast(daily, locationName);

		return { locationName, alerts };
	} catch (err) {
		if (err.response?.data?.reason) {
			console.error("Open-Meteo API Error:", err.response.data.reason);
			return { locationName: location, alerts: [], error: err.response.data.reason };
		}
		console.error("Alerts fetch error:", err);
		return { locationName: location, alerts: [], error: "Failed to fetch alerts" };
	}
}

module.exports = { getAlerts, formatAlertMessage, getAlertId };

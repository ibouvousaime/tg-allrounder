const Tgfancy = require("tgfancy");
require("dotenv").config();
const { exec } = require("child_process");
const NodeCache = require("node-cache");
var weather = require("weather-js");

const bot = new Tgfancy(process.env.TELEGRAM_BOT_TOKEN, {
	polling: true,
});
const myCache = new NodeCache();
bot.on("edited_message", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text || "";
	handleMessages({ chatId, msg, text, messageID: msg.message_id });
});

bot.on("text", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text;
	handleMessages({ chatId, text, msg });
});

function handleMessages({ chatId, msg, text }) {
	switch (text.split(" ")[0]) {
		case "/start":
			bot.sendMessage(chatId, "hi");
			break;
		case "/help":
			bot.sendMessage(chatId, "Commands:\n/trans to translate text\n/weather to get the weather");
			break;
		case "/delete":
			const deleteMsg = async () => {
				try {
					await bot.deleteMessage(chatId, msg.message_id);
					await bot.deleteMessage(chatId, msg.reply_to_message?.message_id);
				} catch (err) {
					console.error(err);
				}
			};
			deleteMsg();

			break;
		case "/weather":
			const location = text.split(" ").slice(1).join(" ");
			getWeather(location)
				.then(async (weatherData) => {
					handleResponse(weatherData, msg, chatId, myCache, bot, "code").catch((err) => {
						console.error(err);
					});
				})
				.catch((err) => {
					console.error(err);
				});
			break;
		case "/trans":
			const translateString = text.split(" ").slice(1).join(" ");
			const ansiEscapeRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g;
			translateShell(translateString)
				.then(async (response) => {
					handleResponse(response.replace(ansiEscapeRegex, ""), msg, chatId, myCache, bot, "pre").catch((err) => {
						console.error(err);
					});
				})
				.catch((err) => {
					console.error(err);
				});
			break;
		default:
			bot.sendMessage(chatId, "Sorry, I didn't understand that command.");
	}
}

function handleResponse(text, msg, chatId, myCache, bot, containerFormat) {
	return new Promise(async (resolve, reject) => {
		const previousResponse = myCache.get(`message-${msg.message_id}`);
		if (previousResponse) {
			bot
				.editMessageText(containerFormat ? `<${containerFormat}>${text}</${containerFormat}>` : text, {
					parse_mode: "HTML",
					message_id: previousResponse,
					chat_id: chatId,
				})
				.then(resolve)
				.catch(async (err) => {
					console.error(err);
					sendNewMessage(bot, chatId, text, msg.message_id, myCache, containerFormat).catch((err) => {
						console.error(err);
						reject();
					});
				});
		} else {
			sendNewMessage(bot, chatId, text, msg.message_id, myCache, containerFormat).catch((err) => {
				console.error(err);
				reject();
			});
		}
	});
}

async function sendNewMessage(bot, chatId, data, messageId, myCache, containerFormat) {
	try {
		const responseMessage = await bot.sendMessage(chatId, containerFormat ? `<${containerFormat}>${data}</${containerFormat}>` : data, {
			parse_mode: "HTML",
			reply_to_message_id: messageId,
		});
		myCache.set(`message-${messageId}`, responseMessage.message_id, 10000);
	} catch (err) {
		console.error(err);
	}
}

function translateShell(string) {
	return new Promise((resolve, reject) => {
		isAllowed = /^[a-zA-Z0-9 ]+$/.test(string);
		//if (isAllowed) {
		exec(`trans "${string}"`, (error, stdout, stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);
				reject(stderr);
			} else {
				resolve(stdout);
			}
		});
		//} else {
		//}
	});
}

function getWeather(location) {
	return new Promise((resolve, reject) => {
		weather.find({ search: location, degreeType: "C" }, function (err, result) {
			if (err) {
				console.error(err);
				reject();
			}
			try {
				if (result[0]) {
					const formattedTextResult = getFormattedWeatherData(result[0]);
					resolve(formattedTextResult);
				} else {
					resolve("No results found... :)");
				}
			} catch (err) {
				console.error(err, result);
				reject();
			}
		});
	});
}

function getFormattedWeatherData(item) {
	const resultLines = [];
	resultLines.push(`Location: ${item.location.name}`);
	resultLines.push(`Current Temperature: ${item.current.temperature}°${item.location.degreetype}`);
	resultLines.push(`Conditions: ${item.current.skytext}`);
	resultLines.push(`Observation Time: ${item.current.observationtime} on ${item.current.date}`);
	resultLines.push(`Humidity: ${item.current.humidity}%`);
	resultLines.push(`Wind: ${item.current.winddisplay}`);
	resultLines.push("Forecast:");
	item.forecast.forEach((day) => {
		resultLines.push(`  ${day.day} (${day.date}): ${day.skytextday}, ${day.low}°-${day.high}°`);
		if (day.precip) {
			resultLines.push(`    Chance of precipitation: ${day.precip}%`);
		}
	});
	return resultLines.join("\n");
}

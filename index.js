const Tgfancy = require("tgfancy");
require("dotenv").config();
const { exec } = require("child_process");
const NodeCache = require("node-cache");
var weather = require("weather-js");
const axios = require("axios");
const { error } = require("console");
const sharp = require("sharp");
const { removeImageBackground } = require("./utils/backgroundRemover");

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
	const sender = msg.from;
	handleMessages({ chatId, text, msg, sender });
});

function handleMessages({ chatId, msg, text, sender }) {
	switch (text.split(" ")[0].split("@")[0]) {
		case "/start":
			bot.sendMessage(chatId, "hi");
			break;
		case "/help":
			bot.sendMessage(
				chatId,
				`Commands:
                /trans <text> to translate text
                /weather <location> to get the weather
                /unsplash while replying to a message to get an image quote
                /cf or /coinflip to get a coin flip`
			);
			break;
		case "/cf":
		case "/coinflip":
			const isHead = Math.random() < 0.5;
			handleResponse(isHead ? "Heads." : "Tails.", msg, chatId, myCache, bot, null).catch((err) => {
				console.error(err);
			});
			break;
		case "/unsplash":
			const replyToMessage = msg.reply_to_message;
			if (replyToMessage) {
				generateUnsplashImage(replyToMessage.text, replyToMessage.from)
					.then((buffer) => {
						bot.sendPhoto(chatId, buffer);
					})
					.catch((err) => {
						console.error(error);
					});
			}
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
		case "/translate":
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
		case "/removebackground":
			if (msg.reply_to_message && msg.reply_to_message.photo) {
				const chatId = msg.chat.id;
				const photoArray = msg.reply_to_message.photo;
				const highestQualityPhoto = photoArray[photoArray.length - 1];
				bot.getFileLink(highestQualityPhoto.file_id).then(async (link) => {
					const response = await axios({
						method: "get",
						url: link,
						responseType: "arraybuffer",
					});
					const imageData = response.data;
					const result = await removeImageBackground(imageData);
					const fileOpts = {
						filename: "image.png",
						contentType: "image/png",
					};
					await bot.sendPhoto(chatId, result, fileOpts);
				});
			}
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

async function fetchImage(url) {
	try {
		const response = await axios({
			method: "get",
			url: url,
			responseType: "arraybuffer",
		});
		return response.data;
	} catch (error) {
		console.error("Error fetching image:", error.message);
		return null;
	}
}
function getSenderInfo(sender) {
	return `${sender.first_name} ${sender.last_name ? sender.last_name : ""} (@${sender.username})`;
}

function wrapText(text, maxWidth, fontSize) {
	const words = text.split(" ");
	const lines = [];
	let currentLine = words[0];

	for (let i = 1; i < words.length; i++) {
		const word = words[i];
		const width = currentLine.length + word.length + 1;
		if (width > maxWidth) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine += " " + word;
		}
	}
	lines.push(currentLine);

	return lines;
}

const darkNatureSearchTerms = [
	"forest+moonlight",
	"mountain+night",
	"river+twilight",
	"desert+starry+sky",
	"ocean+moon",
	"lake+night",
	"snow+night",
	"cave+dark",
	"volcano+night",
	"jungle+night",
];
function generateUnsplashImage(text, sender) {
	return new Promise(async (resolve, reject) => {
		try {
			chosenSearchTerm = darkNatureSearchTerms[Math.floor(Math.random() * darkNatureSearchTerms.length)];
			const API_URL = `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${chosenSearchTerm}&per_page=10`;

			const response = await axios.get(API_URL, {
				responseType: "json",
			});
			const results = response.data.hits;
			const chosenImage = results[Math.floor(Math.random() * results.length)];
			const image = await fetchImage(chosenImage.largeImageURL);
			const imageData = Buffer.from(image, "binary");
			const fontSize = 80;
			const metadata = await sharp(imageData).metadata();
			const maxWidth = parseInt(metadata.width / (fontSize / 2));
			let lines = wrapText(text, maxWidth, fontSize);
			lines[0] = '"' + lines[0];
			const lastIndex = lines.length - 1;
			lines[lastIndex] = lines[lastIndex] + '"';
			let svgText = `<svg width="${metadata.width}" height="${metadata.height}">`;

			lines.forEach((line, index) => {
				svgText += `<text x="50%" y="${30 + index * 10}%" alignment-baseline="middle" text-anchor="middle" font-size="${fontSize}" fill="white">${line}</text>`;
			});

			svgText += `<text x="90%" y="${40 + lines.length * 10}%" alignment-baseline="middle" text-anchor="end" font-size="${fontSize}" fill="white">- ${getSenderInfo(sender)}</text>`;
			svgText += `</svg>`;
			const modifiedImage = await sharp(imageData)
				.composite([
					{
						input: Buffer.from(svgText),
					},
				])
				.toFormat("jpeg")
				.toBuffer();

			const buffer = await sharp(modifiedImage).toBuffer();
			resolve(buffer);
		} catch (err) {
			console.error(err);
			reject(err);
		}
	});
}

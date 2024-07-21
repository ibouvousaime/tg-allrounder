const Tgfancy = require("tgfancy");
require("dotenv").config();
const { exec } = require("child_process");
const NodeCache = require("node-cache");
var weather = require("weather-js");
const axios = require("axios");
const { error } = require("console");
const sharp = require("sharp");
const { removeImageBackground, generateUnsplashImage } = require("./utils/image");
const natural = require("natural");
const tokenizer = new natural.SentenceTokenizer();
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
                /cf or /coinflip to get a coin flip
				/removebackground or /rmbg to remove the background (reply to a message with an image)
				/tldr to get a summary-ish of an article`
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
		/* 		case "/cancel":
			const person = msg.reply_to_message?.from;
			if (person) {
				handleResponse(
					`${person.first_name} ${person.last_name ? person.last_name : ""}(${person.username}) has been cancelled for saying something so vile. Eww.`,
					msg,
					chatId,
					myCache,
					bot,
					null
				).catch((err) => {
					console.error(err);
				});
			}
			break; */
		case "/translate":
		case "/trans":
			const textMsg = text.split(" ").slice(1).join(" ");
			const translateString = (textMsg.trim().length ? textMsg : msg.reply_to_message?.text?.split(" ").slice(1).join(" ")) || "";
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
		case "/removebg":
		case "/rmbg":
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
			} else {
				handleResponse("This command should be a response to a message that has an image, you donkey.", msg, chatId, myCache, bot, "pre").catch((err) => {
					console.error(err);
				});
			}
			break;
		case "/tldr":
			let webpageURL = extractUrl(msg.text) || extractUrl(msg.reply_to_message?.text);
			import("@extractus/article-extractor").then(async ({ extract }) => {
				const article = await extract(webpageURL);
				const summary = summarizeText(article.content.replace(/<[^>]*>/g, ""));
				handleResponse(summary, msg, chatId, myCache, bot, "i").catch((err) => {
					console.error(err);
				});
			});
			break;
	}
}

function extractUrl(text) {
	const urlRegex = /(\bhttps?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
	const urls = text.match(urlRegex);
	return urls ? urls[0] : null;
}

function summarizeText(text, maxSentences = 2) {
	const sentences = tokenizer.tokenize(text);
	const TfIdf = natural.TfIdf;
	const tfidf = new TfIdf();
	sentences.forEach((sentence) => {
		tfidf.addDocument(sentence);
	});
	const sentenceImportance = sentences.map((sentence, index) => {
		return {
			sentence,
			importance: tfidf.tfidf(sentence, index),
		};
	});

	sentenceImportance.sort((a, b) => b.importance - a.importance);
	return sentenceImportance
		.slice(0, maxSentences)
		.map((item) => item.sentence)
		.join(" ");
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

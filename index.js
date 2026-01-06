const Tgfancy = require("tgfancy");

require("dotenv").config();
const { exec } = require("child_process");
const NodeCache = require("node-cache");
var weather = require("weather-js");
const { error } = require("console");
const { removeImageBackground, generateUnsplashImage, doOCR, generateWordCloud, resizeImageBuffer, isEmojiString } = require("./utils/image");
const { sendSimpleRequestToClaude, sendRequestWithImageToClaude, guessMediaType, sendSimpleRequestToDeepSeek } = require("./utils/ai");
const fs = require("fs");
const math = require("mathjs");
const { getWordEtymology } = require("./utils/dictionary");

const bot = new Tgfancy(process.env.TELEGRAM_BOT_TOKEN, {
	baseApiUrl: process.env.LOCAL_TELEGRAM_API_URL || "http://localhost:8081",
	polling: true,
});
var forceAudio = false;

const { MongoClient } = require("mongodb");
const ansiEscapeRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const eightBallResponses = [
	"Yes, definitely",
	"It is certain",
	"Without a doubt",
	"Yes, definitely",
	"You may rely on it",
	"As I see it, yes",
	"Most likely",
	"Outlook good",
	"Yes",
	"Signs point to yes",
	"Reply hazy, try again",
	"Ask again later",
	"Better not tell you now",
	"Cannot predict now",
	"Concentrate and ask again",
	"Don't count on it",
	"My reply is no",
	"My sources say no",
	"Outlook not so good",
	"Very doubtful",
];
const mongoUri = process.env.MONGO_URI;

const client = new MongoClient(mongoUri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

const db = client.db("messages");
const collection = db.collection("messages");
const musicCollection = db.collection("music");
const tarotCollection = db.collection("tarot");

const { Convert } = require("easy-currencies");
const { extractAndConvertToCm } = require("./utils/converter");
const { eyeWords, reactToTelegramMessage, bannedWords, nerdwords, sendPoll } = require("./utils/reactions");
const { getRandomOracleMessageObj, getContext, explainContextClaude } = require("./utils/oracle");
const { generateEmbedding, findSimilarMessages, countSenders, searchMessagesByEmbedding } = require("./utils/search");
const { extractTweetId, extractTweet, generateTweetScreenshot } = require("./utils/bird");
const { getAndSendRandomQuestion } = require("./utils/trivia");
const { sendRandomQuizz } = require("./utils/quizz");
const { getPollResults } = require("./utils/telegram_polls");
const { getReading } = require("./utils/tarot");
const { MaxPool3DGrad } = require("@tensorflow/tfjs");
const { extractAndEchoSocialLink, downloadImageAsBuffer, getAlbumFromSong, downloadVideoFromUrl } = require("./utils/downloader");
const { findDirectArchiveLink } = require("./utils/web");
const { textToSpeech, createConversationAudio } = require("./utils/tts");
const { makeid, createMessageBlocks } = require("./utils/util");
const { getMusicStats } = require("./utils/music");

const myCache = new NodeCache();
const axios = require("axios");
const { getWeather, getForecastDay, extractDayOffset, extractLocation } = require("./utils/weather");
const { getUserMessagesAndAnalyse } = require("./utils/political");
const { getLocalNews } = require("./utils/news");
const { withBurnedSubtitles } = require("./utils/transcriber");
const { getTimeAtLocation, findTimezones } = require("./utils/time");

axios
	.post(`${process.env.LOCAL_TELEGRAM_API_URL || "http://localhost:8081"}/bot${process.env.TELEGRAM_BOT_TOKEN}/setMyCommands`, {
		commands: [
			{ command: "help", description: "Display help message with all commands" },
			{ command: "weather", description: "Get the weather" },
			{ command: "forecast", description: "Get forecast" },
			{ command: "8ball", description: "Get a Magic 8-Ball response" },
			{ command: "coinflip", description: "Flip a coin" },
			{ command: "calc", description: "Calculate mathematical expressions" },
			{ command: "when", description: "Show message date - reply to message" },
			{ command: "weather", description: "Get weather in Celsius" },
			{ command: "trans", description: "Translate text to another language" },
			{ command: "etymology", description: "Get word etymology" },
			{ command: "unsplash", description: "Generate quote image - reply to message" },
			{ command: "ocr", description: "Extract text from image - reply to image" },
			{ command: "wordcloud", description: "Generate word cloud from recent messages" },
			{ command: "createsticker", description: "Create sticker from image with emojis" },
			{ command: "oracle", description: "Get oracle reading with audio" },
			{ command: "archive", description: "Get archive.org link for URL" },
			{ command: "musicstats", description: "View music statistics" },
			{ command: "findalbum", description: "Find album for audio track - reply to audio" },
			{ command: "regex", description: "Search messages by regex pattern" },
			{ command: "search", description: "Semantic search for messages by meaning" },
			{ command: "count", description: "Count message occurrences" },
			{ command: "glossary", description: "Search glossary" },
			{ command: "addtoglossary", description: "Add word to glossary with definition" },
			{ command: "downloadaudio", description: "Reply to a message with a URL to download audio or do /downloadaudio <url>" },
			{ command: "download", description: "Reply to a message with a URL to download a video or do /download <url>" },
			{ command: "cc", description: "Convert currency" },
			{ command: "addsubtitles", description: "add subtitles to a video" },
			{ command: "summary", description: "Summarize last N messages (default: 100)" },
		],
	})
	.then(() => {
		console.log("Bot commands registered successfully");
	})
	.catch((err) => {
		console.error("Failed to register bot commands:", err);
	});

bot.on("edited_message", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text || "";
	collection.updateOne({ chatId: chatId, messageId: msg.message_id }, { $set: { text: msg.text } });
	if (msg.audio?.title && msg.audio?.performer) {
		await storeMusicInDB(msg.audio, msg);
	}
	if (
		msg.chat.type == "private" &&
		!process.env.ALLOWED_TO_DM_BOT.split(" ")
			.map((userid) => Number(userid))
			.includes(msg.from.id)
	) {
		return;
	}
	handleMessages({ chatId, msg, text, messageID: msg.message_id });
});

function getAdminsIds(chatId) {
	return new Promise(async (resolve, reject) => {
		try {
			let admins = [];
			try {
				admins = await bot.getChatAdministrators(chatId);
			} catch (err) {
				console.error(err);
			}
			const adminIDs = admins.map((admin) => admin.user.id);
			resolve(adminIDs);
		} catch (err) {
			console.error(err);
			resolve([]);
		}
	});
}

/* bot.on("poll", async (msg) => {
	console.log(msg);
});
 */
function isUserAllowedToDM(userId) {
	const allowedUsers = process.env.ALLOWED_TO_DM_BOT.split(" ").map((userid) => Number(userid));
	return allowedUsers.includes(userId);
}
const videoExtensions = [".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv"];

async function handleSocialMediaLinks(text, chatId, messageId, msg) {
	extractAndEchoSocialLink(text, (output) => {
		if (Array.isArray(output)) {
			output.forEach((media) => {
				fs.readFile(media, async (err, data) => {
					if (err) {
						console.error("error reading file:", media, err);
						return;
					}
					const isVideo = videoExtensions.some((videoext) => media.endsWith(videoext));
					if (isVideo) {
						bot.sendVideo(chatId, data, { reply_to_message_id: messageId });
					} else {
						const sentAudio = await bot.sendAudio(chatId, data, {
							reply_to_message_id: messageId,
						});
						storeMusicInDB(sentAudio.audio, sentAudio, msg.from);
					}
				});
			});
		}
	});
}

async function handleTweetPreview(msg, text, chatId) {
	const tweetId = extractTweetId(text);
	if (!tweetId || text.includes("no preview")) {
		return;
	}
	try {
		const tweetData = await extractTweet(text);
		if (!tweetData) return;
		const messageOptions = {
			parse_mode: "HTML",
			disable_web_page_preview: true,
			has_spoiler: text.includes("spoiler"),
		};
		//const hasVideos = tweetData?.media?.some((media) => media.type == "VIDEO" || media.type == "GIF");
		if (!text.includes("screenshot")) {
			let tweetText = `${tweetData?.fullText} \nTweet by ${tweetData?.tweetBy?.fullName || ""} (@${tweetData?.tweetBy?.userName}) on ${tweetData?.createdAt || ""}`;
			tweetData.media = tweetData.media || [];
			tweetData.media = await Promise.all(
				tweetData.media.map((media) => {
					return new Promise(async (resolve, reject) => {
						try {
							media.url = await downloadImageAsBuffer(media.url);
							resolve(media);
						} catch (err) {
							reject(err);
						}
					});
				})
			);

			const media = tweetData.media;
			const mediaCount = media?.length || 0;

			const tweetTextParts = createMessageBlocks(tweetText, 750).map((text) => `<blockquote expandable>${text}</blockquote>`);
			tweetText = tweetTextParts[0];
			if (mediaCount === 0) {
				await bot.sendMessage(chatId, tweetText, messageOptions);
			} else if (mediaCount === 1) {
				const singleMedia = media[0];
				const optionsWithCaption = { ...messageOptions, caption: tweetText };

				if (singleMedia.type === "VIDEO") {
					await bot.sendVideo(chatId, singleMedia.url, optionsWithCaption);
				} else {
					await bot.sendPhoto(chatId, singleMedia.url, optionsWithCaption);
				}
			} else if (mediaCount > 1 && mediaCount <= 10) {
				const mediaGroup = media.map((item, index) => ({
					type: item.type.toLowerCase(),
					media: item.url,
					...(index === 0 && { caption: tweetText, parse_mode: "HTML" }),
				}));
				await bot.sendMediaGroup(chatId, mediaGroup);
			} else {
				for (const item of media) {
					if (item.type === "VIDEO") {
						await bot.sendVideo(chatId, item.url);
					} else if (item.type === "PHOTO") {
						await bot.sendPhoto(chatId, item.url);
					}
				}
				await bot.sendMessage(chatId, tweetText, messageOptions);
			}
			if (tweetTextParts.length > 1) {
				for (let i = 1; i < tweetTextParts.length; i++) {
					await bot.sendMessage(chatId, tweetTextParts[i], messageOptions);
				}
			}
		} else {
			await bot.sendPhoto(chatId, await generateTweetScreenshot(tweetData), messageOptions);
		}
	} catch (error) {
		console.error("Failed to send tweet media:", error);
	}
}

async function handleTriggerWordLogging(msg, text, chatId) {
	if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
		return;
	}

	const triggerWords = process.env.TRIGGER_WORDS?.split(" ") || [];
	if (triggerWords.some((word) => text.toLowerCase().includes(word.toLowerCase()))) {
		await bot.sendMessage(process.env.LogChat, `https://t.me/c/${msg.chat.id.toString().slice(4)}/${msg.message_id}`);
		await bot.forwardMessage(process.env.LogChat, chatId, msg.message_id);
	}
}

async function storeMessageInDB(msg, chatId) {
	if (!msg.text || msg.text?.trim()?.startsWith("/")) {
		return;
	}

	const newMessage = {
		chatId: chatId,
		messageId: msg.message_id,
		text: msg.text,
		date: new Date(msg.date * 1000),
		sender: [msg.from.first_name, msg.from.last_name].join(" "),
	};

	collection.insertOne({ ...newMessage }).catch((err) => {
		console.error(err);
	});
}

async function storeMusicInDB(audio, msg, actualSender) {
	msg.from = actualSender ? actualSender : msg.from;
	const alreadyExists = await collection.findOne({ messageId: msg.messageId });
	if (!alreadyExists) {
		const musicData = {
			chatId: msg.chat.id,
			messageId: msg.messageId,
			file_name: audio?.file_name,
			title: audio.title,
			performer: audio.performer,
			date: new Date(msg.date * 1000),
			sender: [msg.from.first_name, msg.from.last_name].join(" "),
		};

		musicCollection.insertOne({ ...musicData }).catch((err) => {
			console.error(err);
		});
	}
}

async function storeTarotReadingInDB(userId, chatId, cards, interpretation, question = "") {
	const readingData = {
		userId: userId,
		chatId: chatId,
		cards: cards,
		interpretation: interpretation,
		question: question,
		date: new Date(),
	};

	tarotCollection.insertOne(readingData).catch((err) => {
		console.error(err);
	});
}

async function getLastTarotReading(userId, chatId) {
	try {
		const lastReading = await tarotCollection.findOne({ userId: userId, chatId: chatId }, { sort: { date: -1 } });
		return lastReading;
	} catch (err) {
		console.error(err);
		return null;
	}
}

bot.on("audio", async (msg) => {
	if (msg.audio?.title && msg.audio?.performer) {
		await storeMusicInDB(msg.audio, msg);
	}
});

bot.on("text", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text || msg.caption;
	/* if (msg.text.startsWith("/"))
		if (msg.from.first_name.trim().startsWith("sam")) {
			const msgWarn = await bot.sendMessage(msg.chat.id, "Procastinators are banned from using this bot.");
			setTimeout(() => {
				bot.deleteMessage(msg.chat.id, msgWarn.message_id);
			}, 2000);
		} */
	if (msg.chat.type === "private" && !isUserAllowedToDM(msg.from.id)) {
		return;
	}
	const probability = Math.random();
	const triggerPattern = process.env.TRIGGER_TERMS || "";
	const regex = new RegExp(`\\b(${triggerPattern})\\b`, "gi");
	let count = 0;
	for (const match of text.matchAll(regex)) {
		count++;
	}
	const threshold = 0.1 * count;
	if (regex.test(text) && probability < threshold) {
		const cacheKey = `trigger-voice-${chatId}`;
		const lastTriggerDate = myCache.get(cacheKey);
		const now = new Date();

		if (!lastTriggerDate || now - lastTriggerDate > 24 * 60 * 60 * 1000) {
			bot.sendVoice(chatId, fs.readFileSync("audio/hihi.ogg"), { reply_to_message_id: msg.message_id });
			myCache.set(cacheKey, now);
		}
	}
	await handleSocialMediaLinks(text, chatId, msg.message_id, msg);

	await handleTweetPreview(msg, text, chatId);

	await handleTriggerWordLogging(msg, text, chatId);

	await storeMessageInDB(msg, chatId);

	if (text.trim()[0] === "/") {
		const sender = msg.from;
		handleMessages({ chatId, text, msg, sender });
	}
});
function getRandomElement(arr) {
	const randomIndex = Math.floor(Math.random() * arr.length);
	return arr[randomIndex];
}
async function handleMessages({ chatId, msg, text, sender }) {
	try {
		const splitCommand = text.split(" ")[0].split("@");
		const command = splitCommand[0];
		const botName = splitCommand[1];
		if (command && (botName === process.env.BOT_USERNAME || !botName)) {
			switch (command) {
				case "/help":
					const message = `<blockquote expandable>Welcome! 🤖

Here are the commands you can use:

<b>General Commands:</b>
/help - Display this help message
/8ball - Get a Magic 8-Ball response (also /interview)
/coinflip - Flip a coin (also /cf)
/calc - Calculate mathematical expressions
/when - Show message date and original forward date

<b>Weather & Location:</b>
/weather [city] - Get weather in Celsius
/weatherf [city] - Get weather in Fahrenheit

<b>Translation & Language:</b>
/trans :[lang] [text] - Translate text (also /cis)
/etymology [word] - Get word etymology

<b>Image & Media:</b>
/unsplash - Generate quote image (reply to message)
/wordcloud - Generate word cloud from recent messages
/removebg - Remove background or delete sticker (also /rmbg, /deletesticker)
/createsticker [emojis] - Create sticker from image (also /addsticker)

<b>AI & Analysis:</b>
/dream - Get dream interpretation
/oracle [target] - Get oracle reading with audio
/tldr - Summarize webpage or article
/archive - Get archive.org link for URL

<b>Tarot Readings:</b>
/tarot1 - Single card reading
/tarot3 - Three card reading
/tarot10 - Ten card reading


<b>Music:</b>
/musicStats - View music statistics
/findAlbum - Find album for audio track (reply to audio)

<b>Search & Database:</b>
/regex [pattern] - Search messages by regex
/search [query] - Semantic search by meaning
/count [pattern] - Count message occurrences
/glossary [word] - Search glossary
/addtoglossary word : definition - Add to glossary
/deleteFromGlossary [id] - Delete from glossary

<b>Admin & Polls:</b>
/delete - Delete message and reply
/invite [name] - Create invite poll
/voteban [name] - Create ban poll

<b>Currency:</b>
/cc [amount] [from] to [to] - Convert currency (also /currencyConvert)
</blockquote>
`;

					handleResponse(message, msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
					break;
				case "/interview":
				case "/8ball":
					const response = getRandomElement(eightBallResponses);
					handleResponse(response, msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
					break;
				case "/wordcloud":
					const currentDate = new Date();
					const oneWeekAgo = new Date(currentDate);
					oneWeekAgo.setDate(currentDate.getDate() - 2);

					collection
						.find({ chatId })
						.sort({ date: -1 })
						.limit(100)
						.toArray()
						.then((result) => {
							const messages = result.map((message) => message.text).join(" ");
							generateWordCloud(messages).then((wordCloudImage) => {
								const fileOptions = {
									filename: "image.png",
									contentType: "image/png",
								};
								bot.sendPhoto(chatId, wordCloudImage, { reply_to_message_id: msg.message_id }, fileOptions);
							});
						});

					break;
				case "/downloadaudio":
					forceAudio = true;
				case "/download":
					const downloadLinkStr = [msg.reply_to_message?.text || "", msg.text].join(" ");
					downloadVideoFromUrl(downloadLinkStr, !!forceAudio, (output) => {
						const messageId = msg.messageId;
						if (Array.isArray(output)) {
							output.forEach((media) => {
								fs.readFile(media, async (err, data) => {
									if (err) {
										console.error("error reading file:", media, err);
										return;
									}
									const isVideo = videoExtensions.some((videoext) => media.endsWith(videoext));
									if (isVideo) {
										bot.sendVideo(
											chatId,
											data,
											{
												reply_to_message_id: messageId,
											},
											{ filename: new Date() + "video.mp4", contentType: "video/mp4" }
										);
									} else {
										const sentAudio = await bot.sendAudio(chatId, data, {
											reply_to_message_id: messageId,
										});
										storeMusicInDB(sentAudio.audio, sentAudio, msg.from);
									}
								});
							});
						}
					});
					break;

				case "/calc":
					const expression = msg.text.split(" ").slice(1).join(" ");
					let result = math.evaluate(expression);
					handleResponse(`${result}`, msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
					break;
				/* case "/political": {
					const name = msg.text.split(" ").slice(1)[0];
					const analysis = await getUserMessagesAndAnalyse(name, collection, chatId);
					bot.sendMessage(chatId, "Output: \n" + analysis, { parse_mode: "HTML" });
					break;
				} */
				case "/cc":
				case "/currencyConvert":
					const input = msg.text.split(" ").slice(1);
					if (input.length > 4) return;
					const amount = Number(input[0]);
					const currencyFrom = input[1];
					if (!currencyFrom) {
						handleResponse("Missing input currency. Example command : /cc 25000 XOF to USD.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}
					const currencyTo = input[2] !== "to" ? input[2] : input[3] || "USD";
					if (Number.isFinite(amount)) {
						Convert(amount)
							.from(currencyFrom)
							.to(currencyTo)
							.then((response) => {
								handleResponse(`${amount} ${currencyFrom} => ${Number(response).toFixed(2)} ${currencyTo}`, msg, chatId, myCache, bot, null).catch((err) => {
									console.error(err);
								});
							})
							.catch((err) => {
								console.error(err);
							});
					}
					break;
				case "/cf":
				case "/coinflip":
					const isHead = Math.random() < 0.5;
					handleResponse(isHead ? "Heads." : "Tails.", msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
					break;

				/*
					if (msg.reply_to_message && (msg.reply_to_message.photo || msg.reply_to_message.sticker)) {
						const userQuestion = msg.text.split(" ").slice(1).join(" ");
						const photoArray = msg.reply_to_message.photo;
						const highestQualityPhoto = photoArray ? photoArray[photoArray.length - 1] : msg.reply_to_message.sticker;
						bot.getFile(highestQualityPhoto.file_id).then(async (file) => {
							const fileUrl = `${process.env.LOCAL_TELEGRAM_API_URL || "http://localhost:8081"}/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
							const response = await fetch(fileUrl);
							const imageBuffer = await response.arrayBuffer();
							const base64Image = Buffer.from(imageBuffer).toString("base64");

							const basePrompt =
								"Explain what's on this image like an OCR engine would but make it easy to parse what's on the image. Keep it short and on what seems important.";
							const finalPrompt =
								userQuestion.trim().length > 0 ? `${basePrompt}\n\nAdditionally, answer this question about the image: ${userQuestion}` : basePrompt;

							const ollamaResponse = await axios.post(
								"http://localhost:11434/api/generate",
								{
									model: "gemma2:2b",
									prompt: finalPrompt,
									images: [base64Image],
									stream: false,
								},
								{
									timeout: 600000,
								}
							);

							const LLMTextOutput = ollamaResponse.data.response;
							handleResponse(
								`<blockquote expandable> ${LLMTextOutput.replace(/&/g, "&amp;")
									.replace(/</g, "&lt;")
									.replace(/>/g, "&gt;")
									.replace(/"/g, "&quot;")
									.replace(/'/g, "&#39;")}</blockquote>`,
								msg,
								msg.chat.id,
								myCache,
								bot,
								null
							).catch((err) => {
								console.error(err);
							});
						});
					}
					break; */
				case "/unsplash":
					let replyToMessage = msg.reply_to_message;
					if (msg.reply_to_message?.forward_from) {
						replyToMessage = { from: msg.reply_to_message?.forward_from };
					}
					if (msg.reply_to_message?.forward_origin) {
						replyToMessage = {
							from: {
								first_name: msg.reply_to_message?.forward_origin?.sender_user_name || msg.reply_to_message?.forward_origin?.sender_user?.first_name,
							},
						};
					}
					if (msg.quote?.text) {
						msg.quote.text = `${msg.quote.position != 0 ? "..." : ""}${msg.quote.text}${msg.quote.position + msg.quote.text.length < msg.reply_to_message.text.length ? "..." : ""}`;
					}
					const messageToQuote = (msg.quote?.text || msg.reply_to_message?.text || msg.reply_to_message?.caption).replace(/\n/g, "<br/>");
					if (replyToMessage) {
						generateUnsplashImage(messageToQuote, replyToMessage.from)
							.then((buffer) => {
								const fileOptions = {
									filename: "image.png",
									contentType: "image/png",
								};
								bot.sendPhoto(chatId, buffer, { reply_to_message_id: msg.message_id }, fileOptions);
							})
							.catch((err) => {
								console.error(error);
							});
					}
					break;
				case "/delete":
					const deleteMsg = async () => {
						try {
							bot.deleteMessage(chatId, msg.message_id);
							bot.deleteMessage(chatId, msg.reply_to_message?.message_id);
						} catch (err) {
							console.error(err);
						}
					};
					if (msg?.from.id == process.env.STICKER_OWNER) deleteMsg();

					break;
				case "/forecast":
					{
						const userInput = text.split(" ").slice(1).join(" ");

						const dayIndex = extractDayOffset(userInput);
						const location = extractLocation(userInput);
						getForecastDay(location, dayIndex)
							.then(async (weatherData) => {
								handleResponse(weatherData, msg, chatId, myCache, bot, null).catch((err) => {
									console.error(err);
								});
							})
							.catch((err) => {
								console.error(err);
							});
					}
					break;
				case "/weather":
					const location = text.split(" ").slice(1).join(" ");

					getWeather(location)
						.then(async (weatherData) => {
							handleResponse(weatherData, msg, chatId, myCache, bot, null).catch((err) => {
								console.error(err);
							});
						})
						.catch((err) => {
							console.error(err);
						});
					break;
				case "/processPoll":
					bot.sendMessage(msg.chat.id, `I am connected to: ${bot.options.baseApiUrl}`);
					break;
				case "/etymology":
					let msgQuery = text.split(" ").slice(1).join(" ");
					let lang = msgQuery.split(" ")[0];
					if (lang.startsWith(":")) {
						msgQuery = text.split(" ").slice(2).join(" ");
						lang = lang.slice(1);
					} else {
						lang = null;
					}
					const etymologyQuery = (msgQuery.trim().length ? msgQuery : msg.quote?.text || msg.reply_to_message?.text || msg.reply_to_message?.caption) || "";

					getWordEtymology(etymologyQuery, lang)
						.then((response) => {
							if (response.length)
								handleResponse(response.replace(ansiEscapeRegex, ""), msg, chatId, myCache, bot, "pre").catch((err) => {
									console.error(err);
								});
						})
						.catch((err) => {
							console.error(err);
						});
					break;
				case "/invite":
					const invite = text.split(" ").slice(1).join(" ");
					sendPoll(db, msg.chat.id, `Invite ${invite} to the chat?`, [{ text: "Yes" }, { text: "No" }], false);
					break;
				case "/voteban":
					const victim = text.split(" ").slice(1).join(" ");
					sendPoll(db, msg.chat.id, `Ban ${victim}?`, [{ text: "Yes" }, { text: "No" }], true);
					break;

				case "/cis":
				case "/trans":
					let textMsg = text.split(" ").slice(1).join(" ");
					let languageInfo = textMsg.split(" ")[0];
					if (languageInfo.includes(":")) {
						textMsg = text.split(" ").slice(2).join(" ");
					} else {
						languageInfo = null;
					}
					const translateString = (textMsg.trim().length ? textMsg : msg.quote?.text || msg.reply_to_message?.text || msg.reply_to_message?.caption) || "";

					translateShell(translateString.replace(/['"]/g, "\\$&"), languageInfo)
						.then(async (response) => {
							if (response.length == 0) {
								bot.sendMessage();
							}
							handleResponse(
								response
									.replace(ansiEscapeRegex, "")
									.replace(/\n\s*\n/g, "\n")
									.trim(),
								msg,
								chatId,
								myCache,
								bot,
								"pre"
							).catch((err) => {
								console.error(err);
							});
						})
						.catch((err) => {
							console.error(err);
						});
					break;
				case "/when":
					let reply = `Date: ${new Date(msg.reply_to_message.date * 1000).toUTCString()}`;
					if (msg.reply_to_message.forward_date) {
						reply += `\nOriginal date: ${new Date(msg.reply_to_message.forward_date * 1000).toUTCString()}`;
					}
					handleResponse(reply, msg, chatId, myCache, bot).catch((err) => {
						console.error(err);
					});
					break;
				case "/removebg":
				case "/rmbg":
				case "/deletesticker":
					if (!((await getAdminsIds(chatId)).includes(msg.from.id) || msg.from.id == process.env.STICKER_OWNER) && msg.chat.type != "private") {
						await bot.sendMessage(msg.chat.id, "no, ur not my dad");
						return;
					}

					if (msg.reply_to_message?.sticker) {
						console.log(msg.reply_to_message?.sticker, msg.chat.id.toString().slice(4));
						if (!msg.reply_to_message?.sticker?.set_name.includes(chatId.toString().slice(4)) && msg.chat.type != "private") {
							await bot.sendMessage(msg.chat.id, "no, wtf");
							return;
						}
						bot.deleteStickerFromSet(msg.reply_to_message?.sticker?.file_id).then(() => {
							bot.sendMessage(chatId, "Sticker deleted").then((message) => {});
						});
					}
					break;
				case "/addsubtitles":
					const language = text.split(" ").slice(1).join(" ") || "en";
					if (msg.reply_to_message && (msg.reply_to_message.video || msg.reply_to_message.document)) {
						const file = await bot.getFile(msg.reply_to_message.video ? msg.reply_to_message.video.file_id : msg.reply_to_message.document.file_id);
						withBurnedSubtitles(
							file.file_path,
							async ({ outputVideoPath }) => {
								await bot.sendVideo(chatId, outputVideoPath, { reply_to_message_id: msg.message_id }, { filename: "video.mp4", contentType: "video/mp4" });
								return;
							},
							{ language }
						);
					}
					break;

				case "/createsticker":
				case "/addsticker":
					if (msg.reply_to_message && (msg.reply_to_message.photo || msg.reply_to_message.sticker || msg.reply_to_message.document)) {
						const emojis = msg.text.split(" ").slice(1).join(" ").replace(/\s+/g, "");
						if (!isEmojiString(emojis) && emojis.trim().length == 0) {
							handleResponse("Correct usage: /addsticker <emojis>. Example : /addsticker 💧🍉.", msg, chatId, myCache, bot, null).catch((err) => {
								console.error(err);
							});
							break;
						}
						const photoArray = msg.reply_to_message.photo;
						const highestQualityPhoto = photoArray ? photoArray[photoArray.length - 1] : msg.reply_to_message.sticker || msg.reply_to_message.document;
						console.log(highestQualityPhoto);
						bot.getFile(highestQualityPhoto.file_id).then(async (file) => {
							const arrayBuffer = fs.readFileSync(file.file_path);
							fs.writeFileSync("tempfile", Buffer.from(arrayBuffer));
							const imageBuffer = Buffer.from(arrayBuffer);
							const resizedImage = await resizeImageBuffer(imageBuffer);
							const stickerPackName = `hummus${chatId.toString().slice(4)}_by_${process.env.BOT_USERNAME}`;
							bot
								.addStickerToSet(process.env.STICKER_OWNER, stickerPackName, resizedImage, emojis)
								.then(() => {
									handleResponse(`<a href="t.me/addstickers/${stickerPackName}"> Done </a>`, msg, chatId, myCache, bot, null)
										.then((message) => {
											/*                     setTimeout(() => {
                      bot.deleteMessage(chatId, message.message_id);
                    }, 5000); */
										})
										.catch((err) => {
											console.error(err);
										});
								})
								.catch((err) => {
									bot
										.createNewStickerSet(process.env.STICKER_OWNER, stickerPackName, `${msg.chat.title}'s Stickers`, resizedImage, emojis)
										.then(() => {
											bot.setChatStickerSet(chatId, stickerPackName);
											handleResponse(`New sticker pack created t.me/addstickers/${stickerPackName}`, msg, chatId, myCache, bot, null).catch((err) => {
												console.error(err);
											});
										})
										.catch((err) => {
											console.error(err);
										});
								});
						});
					}
					break;

				case "/addtoglossary":
					const glossaryCollection = db.collection("glossary");
					const args = msg.text.split(" ").slice(1).join(" ").split(":");
					if (args.length != 2) {
						handleResponse(
							"Wrong format, should be /addGlossary word : definition. You can edit your message with the correction.",
							msg,
							chatId,
							myCache,
							bot,
							null
						).catch((err) => {
							console.error(err);
						});
					} else {
						const word = args[0];
						const definition = args[1];
						const elementId = (Math.random() + 1).toString(36).substring(7);
						const document = {
							word,
							definition,
							author: msg.from.id,
							chatId,
							id: elementId,
						};

						glossaryCollection.insertOne(document).then(() => {
							handleResponse("Saved.", msg, chatId, myCache, bot, null).catch((err) => {
								console.error(err);
							});
						});
					}
					break;
				case "/deleteFromGlossary":
					const isAdmin = (await getAdminsIds(chatId)).includes(msg.from.id);
					const wordToDeleteId = msg.text.split(" ").slice(1).join(" ");
					if (isAdmin) {
						db.collection("glossary")
							.deleteOne({ id: wordToDeleteId })
							.then(() => {
								handleResponse("Done.", msg, chatId, myCache, bot, null).catch((err) => {
									console.error(err);
								});
							});
					} else {
						db.collection("glossary")
							.deleteOne({ id: wordToDeleteId, author: msg.text.id })
							.then((doc) => {
								if (doc.deletedCount) {
									handleResponse("Done.", msg, chatId, myCache, bot, null).catch((err) => {
										console.error(err);
									});
								} else {
									handleResponse(
										"Nothing has been deleted, either the command is wrong or you're trying to delete a word someone else added while not being an admin. (You can just edit your message if it's the former case.)",
										msg,
										chatId,
										myCache,
										bot,
										null
									).catch((err) => {
										console.error(err);
									});
								}
							});
					}
					break;
				/* 			case "/quran":
				handleResponse(`Sorry, @${msg.from.username}, I don't do it for the kuffar.`, msg, chatId, myCache, bot, null).catch((err) => {});
				break; */
				case "/glossary":
					const query = msg.text.split(" ").slice(1).join(" ");
					db.collection("glossary")
						.aggregate([
							{
								$match: {
									word: {
										$regex: new RegExp(query, "i"),
									},
									chatId,
								},
							},
							{
								$limit: 10,
							},
						])
						.toArray()
						.then(async (results) => {
							let textOutput = "";

							if (results.length) {
								textOutput = "<b>Results:</b>\n\n";
								for (let element of results) {
									const author = (await bot.getChatMember(chatId, element.author)).user;
									textOutput += `<b>${element.word}</b>\n`;
									textOutput += `Definition: ${element.definition}\n`;
									textOutput += `Contributed by: <i>${[author.first_name, author.last_name].join(" ").trim()}</i>\n\n`;
									textOutput += `Delete command <code>/deleteFromGlossary ${element.id}</code>\n\n`;
								}
							} else {
								textOutput = "No results found.";
							}
							handleResponse(textOutput, msg, chatId, myCache, bot, null).catch((err) => {
								console.error(err);
							});
						});
					break;
				case "/count":
					const countRegex = msg.text.split(" ").slice(1)?.join(" ");
					countSenders(db.collection("messages"), chatId, countRegex)
						.then((results) => {
							let textOutput = results
								.map((element) => {
									return `${element._id}: ${element.count} ${element.count == 1 ? "time" : "times"}`;
								})
								.join("\n");
							if (textOutput.trim().length == 0) {
								textOutput = "No results found";
							} else {
								textOutput = "Results : \n" + textOutput;
							}
							handleResponse(`<blockquote expandable>${textOutput}</blockquote>`, msg, chatId, myCache, bot, null)
								.then((message) => {
									/* setTimeout(() => {
                  bot.deleteMessage(chatId, message.message_id);
                  bot.deleteMessage(chatId, msg.message_id);
                }, 30000); */
								})
								.catch((err) => {
									console.error(err);
								});
						})
						.catch((err) => {
							console.error(err);
						});
					break;
				case "/regex":
					const regex = msg.text.split(" ").slice(1)?.join(" ");
					findSimilarMessages(db.collection("messages"), chatId, regex)
						.then((results) => {
							let textOutput = results
								.map((element) => {
									return `<a href="https://t.me/c/${element.chatId.toString().slice(4)}/${element.messageId}"> ${element.sender}: ${element.text.length > 20 ? element.text.slice(0, 20) + "..." : element.text}</a>`;
								})
								.join("\n");
							if (textOutput.trim().length == 0) {
								textOutput = "No results found";
							} else {
								textOutput = "<blockquote expandable>Results : \n" + textOutput + "</blockquote>";
							}
							handleResponse(textOutput, msg, chatId, myCache, bot, null).catch((err) => {
								console.error(err);
							});
						})
						.catch((err) => {
							consol.error(err);
						});
					break;
				/*
				case "/search":
					const searchQuery = msg.text.split(" ").slice(1)?.join(" ");
					if (!searchQuery || searchQuery.trim().length < 2) {
						handleResponse(" Usage: /search <your query>", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						break;
					}
					searchMessagesByEmbedding(db.collection("messages"), chatId, searchQuery)
						.then((results) => {
							let textOutput = results
								.map((element) => {
									//const similarityPercent = (element.similarity * 100).toFixed(1);
									return `<a href="https://t.me/c/${element.chatId.toString().slice(4)}/${element.messageId}">${element.sender}: ${element.text.length > 30 ? element.text.slice(0, 30) + "..." : element.text}</a>`;
								})
								.join("\n");
							if (textOutput.trim().length == 0) {
								textOutput = "No results found.";
							} else {
								textOutput = "<blockquote expandable>Semantic search results:\n" + textOutput + "</blockquote>";
							}
							handleResponse(textOutput, msg, chatId, myCache, bot, null).catch((err) => {
								console.error(err);
							});
						})
						.catch((err) => {
							console.error(err);
							 handleResponse("Error performing semantic search. Please try again.", msg, chatId, myCache, bot, null).catch((e) => {
								console.error(e);
							}); 
						});
					break;*/

				/* const currentMessageURL = extractUrl(msg.text);
					const repliedToMessageURL = extractUrl(msg.reply_to_message?.text || msg.reply_to_message?.caption);
					const msgQuestion = msg.text.split(" ").slice(1).join(" ").trim();
					let webpageURL = currentMessageURL || repliedToMessageURL;
					import("@extractus/article-extractor").then(async ({ extract }) => {
						try {
							if (!webpageURL) {
								handleResponse("No link detected.", msg, chatId, myCache, bot, "i").catch((err) => {
									console.error(err);
								});
								return;
							}
							const article = await extract(webpageURL);
							const cleanedContent = article.content.replace(/<[^>]*>/g, "");
							console.log("Extracted content:", cleanedContent);
							const telegramHTMLPrompt = ``;
							const prompt = "Generate a tldr for this article.";
							let request = `${cleanedContent} ${prompt}\n ${telegramHTMLPrompt}`;
							if (repliedToMessageURL && msgQuestion.length) {
								request = `Give a short answer to this question ${msgQuestion}. Here's the article to repond to the question: ${cleanedContent}\n ${telegramHTMLPrompt}`;
							}

							const tldrMessage = await bot.sendMessage(msg.chat.id, `<blockquote expandable>One sec...</blockquote>`, {
								parse_mode: "HTML",
							});

							const summary = await sendSimpleRequestToDeepSeek(request);
							const summaryMessageBlocks = createMessageBlocks(summary);
							await bot.editMessageText(`<blockquote expandable>${summaryMessageBlocks[0].replace(/<\/?p>/g, "")}</blockquote>`, {
								parse_mode: "HTML",
								message_id: tldrMessage.message_id,
								chat_id: msg.chat.id,
							});
							let previousMessage = tldrMessage;
							if (summaryMessageBlocks.length > 1) {
								for (let i = 1; i < summaryMessageBlocks.length; i++) {
									previousMessage = await bot.sendMessage(
										chatId,
										`Part ${i + 1}: <blockquote expandable> ${summaryMessageBlocks[i].replace(/<\/?p>/g, "")}</blockquote>`,
										{
											parse_mode: "HTML",
											reply_to_message_id: previousMessage.message_id,
										}
									);
								}
							}
						} catch (err) {
							console.error(err);
						}
					});
					break; */
				case "/archive":
					const articleURL = extractUrl(msg?.reply_to_message?.text) || extractUrl(msg.text);
					if (articleURL) {
						findDirectArchiveLink(articleURL)
							.then((url) => {
								handleResponse(url, msg, chatId, myCache, bot, null).catch((err) => {
									console.error(err);
								});
							})
							.catch((err) => {
								console.error(err);
								handleResponse("Failed to get archive link.", msg, chatId, myCache, bot, null);
							});
					} else {
						handleResponse("No URL found. Reply to a message with a URL or use /archive <url>", msg, chatId, myCache, bot, null);
					}
					break;
				case "/tarot1":
				case "/tarot3":
				case "/tarot10":
					const cardsToDraw = Number(msg.text.split("tarot")[1]) || 3;
					const { reading, slideshowPath } = await getReading(cardsToDraw);
					await bot.sendVideo(
						chatId,
						slideshowPath,
						{ reply_to_message_id: msg.message_id, parse_mode: "HTML", caption: `<blockquote expandable>${reading.join("\n")}</blockquote>` },
						{ filename: "tarot_reading.mp4", contentType: "video/mp4" }
					);
					fs.unlinkSync(slideshowPath);

					break;
				case "/musicstats":
					const stats = await getMusicStats(musicCollection, msg.chat.id);
					await bot.sendMessage(msg.chat.id, `<blockquote expandable>${stats}</blockquote>`, {
						parse_mode: "HTML",
					});
					break;
				case "/clock": {
					const location = text.split(" ").slice(1).join(" ");
					const timeZone = findTimezones(location)[0];
					if (!timeZone) {
						handleResponse(`no timezone found for "${location}"`, msg, chatId, myCache, bot, "pre").catch((err) => {
							console.error(err);
						});
						return;
					}
					const time = getTimeAtLocation(timeZone);
					handleResponse(`Time in ${timeZone}: ${time}`, msg, chatId, myCache, bot, "pre").catch((err) => {
						console.error(err);
					});
				}

				case "/findalbum":
					if (msg.reply_to_message.audio) {
						const audio = msg.reply_to_message.audio;
						const fullMusicName = `${audio.performer} - ${audio.title}`;
						const output = await getAlbumFromSong(fullMusicName);
						await bot.sendMessage(msg.chat.id, `<a href="${output.albumLink}">${output.name}</a>`, { parse_mode: "HTML", reply_to_message_id: msg.messageId });
					}
					break;
				/* case "/trans":
					{
						let textMsg = text.split(" ").slice(1).join(" ");
						const translateString = (textMsg.trim().length ? textMsg : msg.quote?.text || msg.reply_to_message?.text || msg.reply_to_message?.caption) || "";
						const ollamaResponse = await axios.post(
							"http://localhost:11434/api/generate",
							{
								model: "gemma2:2b",
								prompt: `translate this sentence to English: ${translateString}. Only reply with the translation.`,
								stream: false,
							},
							{
								timeout: 600000,
							}
						);

						const summary = ollamaResponse.data.response;
						const summaryBlocks = createMessageBlocks(summary);

						let previousMessage = await bot.sendMessage(chatId, `<blockquote expandable>${summaryBlocks[0]}</blockquote>`, {
							parse_mode: "HTML",
						});
						if (summaryBlocks.length > 1) {
							for (let i = 1; i < summaryBlocks.length; i++) {
								previousMessage = await bot.sendMessage(chatId, `Part ${i + 1}: <blockquote expandable>${summaryBlocks[i]}</blockquote>`, {
									parse_mode: "HTML",
									reply_to_message_id: previousMessage.message_id,
								});
							}
						}
					}
					break;
 */ /*
				case "/summary":
					handleResponse("I disabled it because it was bad anyway.", msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
					break;
				 
					let limit = parseInt(msg.text.split(" ")[1]) || 100;
					limit = limit > 100 ? 100 : limit;
					limit = limit < 50 ? 50 : limit;
					const summaryLoadingMessage = await bot.sendMessage(
						msg.chat.id,
						`<blockquote expandable>Fetching last ${limit} messages and generating summary...</blockquote>`,
						{
							parse_mode: "HTML",
						}
					);

					try {
						const messages = await collection.find({ chatId }).sort({ date: -1 }).limit(limit).toArray();

						if (messages.length === 0) {
							await bot.editMessageText(`<blockquote expandable>No messages found in the database.</blockquote>`, {
								parse_mode: "HTML",
								message_id: summaryLoadingMessage.message_id,
								chat_id: msg.chat.id,
							});
							break;
						}

						const formattedMessages = messages
							.reverse()
							.map((m) => `${m.sender}: ${m.text}`)
							.join("\n");

						const ollamaResponse = await axios.post(
							"http://localhost:11434/api/generate",
							{
								model: "gemma2:2b",
								prompt: `Please provide a concise summary of the following chat conversation. Focus on the main topics, key points, and any important decisions or conclusions:\n\n${formattedMessages}`,
								stream: false,
							},
							{
								timeout: 600000,
							}
						);

						const summary = ollamaResponse.data.response;
						const summaryBlocks = createMessageBlocks(summary);

						await bot.editMessageText(`<blockquote expandable><b>Summary of last ${messages.length} messages:</b>\n\n${summaryBlocks[0]}</blockquote>`, {
							parse_mode: "HTML",
							message_id: summaryLoadingMessage.message_id,
							chat_id: msg.chat.id,
						});

						let previousMessage = summaryLoadingMessage;
						if (summaryBlocks.length > 1) {
							for (let i = 1; i < summaryBlocks.length; i++) {
								previousMessage = await bot.sendMessage(chatId, `Part ${i + 1}: <blockquote expandable>${summaryBlocks[i]}</blockquote>`, {
									parse_mode: "HTML",
									reply_to_message_id: previousMessage.message_id,
								});
							}
						}
					} catch (err) {
						console.error("Error generating summary:", err);
						await bot.deleteMessage(msg.chat.id, summaryLoadingMessage.message_id);
					}
					break; */
				case "/news":
					let city = text.split(" ").slice(1).join(" ");
					const news = await getLocalNews(city);
					handleResponse(news, msg, chatId, myCache, bot, null, true).catch((e) => {
						console.error(e);
					});
					break;
				/* case "/voiceTarot1":
			case "/voiceTarot3":
			case "/voiceTarot10": {
				const cardsToDraw = Number(msg.text.split("tarot")[1]) || 3;
				const userQuestion = msg.text.split(" ").splice(1).join(" ");
				const { slideshowPath, reading, imagePaths } = await getReading(cardsToDraw);
				const fileOptions = {
					filename: "video.mp4",
					contentType: "video/mp4",
				};
				const voiceMap = {
					Dasha: "en_US-kathleen-low",
					Anna: "en_US-hfc_female-medium",
				};
				const llmRequest = `
					Generate a tarot reading for ${[msg.from.first_name, msg.from.last_name].join(" ").trim()} (@${msg.from.username}) based on these cards: ${reading.join(",")}.

					The response MUST be a valid JSON array of objects, with no introductory text or markdown formatting around the JSON itself.

					Each object in the array represents a turn in a conversation and must contain two keys:
					1. "speaker": A string with the value "Dasha" or "Anna".
					2. "text": A string containing their dialogue. The text in this field should be formatted for Telegram's HTML parse mode (e.g., using <b> for bold, <i> for italics).

					Here is an example of the required format:
					\`\`\`json
					[
					{ "speaker": "Dasha", "text": "Okay, so like, for the querent, the first card is The Tower. It’s giving… <b>catastrophe</b>." },
					{ "speaker": "Anna", "text": "Literally. A complete and utter systems collapse. Very chic, actually. It means you get to rebuild from the ashes." },
					{ "speaker": "Dasha", "text": "Right. And then they got the Ten of Swords. So, total annihilation, betrayal, rock bottom. But, like, in a <i>cleansing</i> way?" },
					{ "speaker": "Anna", "text": "It’s the end of a cycle. You have to hit the bottom to have a big bounce-back. It’s pure potentiality." }
					]
					\`\`\`

					The content of the conversation should be a tarot reading performed by Dasha Nekrasova and Anna Khachiyan from the Red Scare podcast.
					
					${userQuestion.trim().length > 0 ? `The reading should address this specific question: "${userQuestion}"` : ""}

					Guidelines for the conversation content:
					- It should include their typical banter, cultural references, and sardonic tone.
					- They must directly address ${msg.from.username ? `@${msg.from.username}` : "the querent"} during the reading.
					- Interpret each card's meaning in relation to the others.
					- Maintain the nihilistic yet insightful tone of the podcast.
					- Include references to psychoanalysis, cultural theory, or art when relevant.
					- End with some form of conclusion about the querent's situation.
					- DO NOT say that something is "very [insert thinker's name]" in the tarot cards.
					- If there's a natural opportunity for a clever wordplay or joke related to the querent's name that fits the reading's context, include it, but do not force it.
					- The dialogue should include non-verbal cues for text-to-speech. Use bracketed text for actions like [laughter], [laughs], [sighs], [gasps], [clears throat], or [music]. Use em dashes (—) or ellipses (...) for hesitations, ♪ for song lyrics, and CAPITALIZATION for emphasizing a word.
					`;

				const interpretation = await sendSimpleRequestToClaude(llmRequest);
				const conversationData = JSON.parse(interpretation.content[0].text).map((sentence) => {
					sentence.voice = voiceMap[sentence.speaker];
					return sentence;
				});
				console.log(conversationData);
				const outputFile = await createConversationAudio(conversationData, "data/" + makeid() + "_tarot.wav");
				await bot.sendAudio(chatId, outputFile);
				break;
			} */
			}
		}
	} catch (err) {
		console.error(err);
	}
}

function extractUrl(text) {
	if (!text) {
		return null;
	}
	var urlRegex = /(https?:\/\/[^ ]*)/;
	const matches = text.match(urlRegex);
	if (!matches) return null;
	var url = matches[0];
	return url ?? null;
}
function handleResponse(text, msg, chatId, myCache, bot, containerFormat, disablePreview = false) {
	return new Promise(async (resolve, reject) => {
		const previousResponse = myCache.get(`message-${msg.message_id}`);
		if (previousResponse) {
			bot
				.editMessageText(containerFormat ? `<${containerFormat}>${text}</${containerFormat}>` : text, {
					parse_mode: "HTML",
					message_id: previousResponse,
					chat_id: chatId,
					disable_web_page_preview: disablePreview,
				})
				.then(() => resolve(msg))
				.catch(async (err) => {
					console.error(err);
					sendNewMessage(bot, chatId, text, msg.message_id, myCache, containerFormat).catch((err) => {
						console.error(err);
						reject();
					});
				});
		} else {
			sendNewMessage(bot, chatId, text, msg.message_id, myCache, containerFormat, disablePreview)
				.then((response) => {
					resolve(response);
				})
				.catch((err) => {
					console.error(err);
					reject();
				});
		}
	});
}

async function sendNewMessage(bot, chatId, data, messageId, myCache, containerFormat, disablePreview = false) {
	try {
		const responseMessage = await bot.sendMessage(chatId, containerFormat ? `<${containerFormat}>${data}</${containerFormat}>` : data, {
			parse_mode: "HTML",
			reply_to_message_id: messageId,
			disable_web_page_preview: disablePreview,
		});
		myCache.set(`message-${messageId}`, responseMessage.message_id, 10000);
		return responseMessage;
	} catch (err) {
		console.error(err);
	}
}

function translateShell(string, languagePart) {
	return new Promise((resolve, reject) => {
		isAllowed = /^[a-zA-Z0-9 ]+$/.test(string);
		//if (isAllowed) {
		exec(`trans ${languagePart || ""} "${string}"`, (error, stdout, stderr) => {
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

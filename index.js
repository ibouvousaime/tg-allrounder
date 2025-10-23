const Tgfancy = require("tgfancy");

require("dotenv").config();
const { exec } = require("child_process");
const NodeCache = require("node-cache");
var weather = require("weather-js");
const { error } = require("console");
const { removeImageBackground, generateUnsplashImage, doOCR, generateWordCloud, resizeImageBuffer, isEmojiString } = require("./utils/image");
const { sendSimpleRequestToClaude, sendRequestWithImageToClaude, guessMediaType } = require("./utils/ai");
const fs = require("fs");
const math = require("mathjs");
const { getWordEtymology } = require("./utils/dictionary");

const bot = new Tgfancy(process.env.TELEGRAM_BOT_TOKEN, {
	polling: {
		params: {
			allowed_updates: ["message", "message_reaction"],
		},
	},
});

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

const { Convert } = require("easy-currencies");
const { extractAndConvertToCm } = require("./utils/converter");
const { eyeWords, reactToTelegramMessage, bannedWords, nerdwords, sendPoll } = require("./utils/reactions");
const { getRandomOracleMessageObj, getContext, explainContextClaude } = require("./utils/oracle");
const { generateEmbedding, findSimilarMessages, countSenders } = require("./utils/search");
const { extractTweetId, extractTweet } = require("./utils/bird");
const { getAndSendRandomQuestion } = require("./utils/trivia");
const { sendRandomQuizz } = require("./utils/quizz");
const { getPollResults } = require("./utils/telegram_polls");
const { getReading } = require("./utils/tarot");
const { MaxPool3DGrad } = require("@tensorflow/tfjs");
const { extractAndEchoSocialLink, getSpotifyMusicLink, downloadImageAsBuffer, getAlbumFromSong, downloadVideoFromUrl } = require("./utils/downloader");
const { findDirectArchiveLink } = require("./utils/web");
const { textToSpeech, createConversationAudio } = require("./utils/tts");
const { makeid } = require("./utils/util");
const { getMusicStats } = require("./utils/music");

const myCache = new NodeCache();
const axios = require("axios");

axios
	.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setMyCommands`, {
		commands: [
			{ command: "help", description: "Display help message with all commands" },
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
			{ command: "dream", description: "Get dream interpretation" },
			{ command: "oracle", description: "Get oracle reading with audio" },
			{ command: "tldr", description: "Summarize webpage or article" },
			{ command: "archive", description: "Get archive.org link for URL" },
			{ command: "tarot1", description: "Single card tarot reading" },
			{ command: "tarot3", description: "Three card tarot reading" },
			{ command: "tarot10", description: "Ten card tarot reading" },
			{ command: "musicstats", description: "View music statistics" },
			{ command: "findalbum", description: "Find album for audio track - reply to audio" },
			{ command: "regex", description: "Search messages by regex pattern" },
			{ command: "count", description: "Count message occurrences" },
			{ command: "glossary", description: "Search glossary" },
			{ command: "addtoglossary", description: "Add word to glossary with definition" },
			{ command: "download", description: "Reply to a message with a URL to download a video or do /download <url>" },

			{ command: "cc", description: "Convert currency" },
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

bot.on("poll", async (msg) => {
	console.log(msg);
});

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
						const sentAudio = await bot.sendAudio(chatId, data, { reply_to_message_id: messageId });
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

		const tweetText = `<blockquote expandable>${tweetData?.fullText} \nTweet by ${tweetData?.tweetBy?.fullName || ""} (@${tweetData?.tweetBy?.userName}) on ${tweetData?.createdAt || ""} </blockquote>`;

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

		const messageOptions = {
			parse_mode: "HTML",
			disable_web_page_preview: true,
			has_spoiler: text.includes("spoiler"),
		};

		if (mediaCount === 0) {
			bot.sendMessage(chatId, tweetText, messageOptions);
		} else if (mediaCount === 1) {
			const singleMedia = media[0];
			const optionsWithCaption = { ...messageOptions, caption: tweetText };

			if (singleMedia.type === "VIDEO") {
				bot.sendVideo(chatId, singleMedia.url, optionsWithCaption);
			} else {
				bot.sendPhoto(chatId, singleMedia.url, optionsWithCaption);
			}
		} else if (mediaCount > 1 && mediaCount <= 10) {
			const mediaGroup = media.map((item, index) => ({
				type: item.type.toLowerCase(),
				media: item.url,
				...(index === 0 && { caption: tweetText, parse_mode: "HTML" }),
			}));
			bot.sendMediaGroup(chatId, mediaGroup);
		} else {
			for (const item of media) {
				if (item.type === "VIDEO") {
					await bot.sendVideo(chatId, item.url);
				} else if (item.type === "PHOTO") {
					await bot.sendPhoto(chatId, item.url);
				}
			}
			bot.sendMessage(chatId, tweetText, messageOptions);
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
			file_name: audio.file_name,
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

bot.on("audio", async (msg) => {
	if (msg.audio?.title && msg.audio?.performer) {
		await storeMusicInDB(msg.audio, msg);
	}
});

bot.on("text", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text || msg.caption;

	if (msg.chat.type === "private" && !isUserAllowedToDM(msg.from.id)) {
		return;
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
	F;
}
async function handleMessages({ chatId, msg, text, sender }) {
	try {
		switch (text.split(" ")[0].split("@")[0]) {
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
/ocr - Extract text from image (reply to image)
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
					.deleteMany({ date: { $lt: oneWeekAgo } })
					.then((output) => {
						console.log(output);
					})
					.catch((err) => {
						console.error(err);
					});
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

			case "/download": {
				const downloadLinkStr = [msg.reply_to_message?.text || "", msg.text].join(" ");
				downloadVideoFromUrl(downloadLinkStr, (output) => {
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
									bot.sendVideo(chatId, data, { reply_to_message_id: messageId });
								} else {
									const sentAudio = await bot.sendAudio(chatId, data, { reply_to_message_id: messageId });
									storeMusicInDB(sentAudio.audio, sentAudio, msg.from);
								}
							});
						});
					}
				});
				break;
			}
			case "/calc":
				const expression = msg.text.split(" ").slice(1).join(" ");
				let result = math.evaluate(expression);
				handleResponse(`${result}`, msg, chatId, myCache, bot, null).catch((err) => {
					console.error(err);
				});
				break;
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
			case "/ocr":
				if (msg.reply_to_message && (msg.reply_to_message.photo || msg.reply_to_message.sticker)) {
					const photoArray = msg.reply_to_message.photo;
					const highestQualityPhoto = photoArray ? photoArray[photoArray.length - 1] : msg.reply_to_message.sticker;
					bot.getFile(highestQualityPhoto.file_id).then(async (file) => {
						const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
						const response = await fetch(fileUrl);
						const imageData = await response.arrayBuffer();
						const responseLLM = await sendRequestWithImageToClaude(
							`Explain what's on this image like an OCR engine would but make it easy to parse what's on the image. Keep it short and on what seems important.`,
							imageData,
							guessMediaType(fileUrl)
						);
						const LLMTextOutput = responseLLM.content[0].text;
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
				break;
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
				deleteMsg();

				break;
			case "/weatherf":
				const locationF = text.split(" ").slice(1).join(" ");
				getWeather(locationF, "F")
					.then(async (weatherData) => {
						handleResponse(weatherData, msg, chatId, myCache, bot, "pre")
							/*  .then((message) => {
                setTimeout(() => {
                  bot.deleteMessage(chatId, message.message_id);
                }, 30000);
              }) */
							.catch((err) => {
								console.error(err);
							});
					})
					.catch((err) => {
						console.error(err);
					});
				break;
			case "/weather":
				const location = text.split(" ").slice(1).join(" ");

				getWeather(location)
					.then(async (weatherData) => {
						handleResponse(weatherData.replace(/Srinagar, India/, "Srinagar, Jammu and Kashmir"), msg, chatId, myCache, bot, "pre").catch((err) => {
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
				sendPoll(db, msg.chat.id, `Invite ${invite} to the chat?`, [{ text: "Yes" }, { text: "No" }], true);
				break;
			case "/voteban":
				const victim = text.split(" ").slice(1).join(" ");
				sendPoll(db, msg.chat.id, `Ban ${victim}?`, [{ text: "Yes" }, { text: "No" }], false);
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
				console.log(msg);
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
				if (!(await getAdminsIds(chatId)).includes(msg.from.id) && msg.chat.type != "private") {
					await bot.sendMessage(msg.chat.id, "no, ur not my dad");
					return;
				}

				if (msg.reply_to_message?.sticker) {
					if (!msg.reply_to_message?.sticker?.set_name.includes(chatId) && msg.chat.type != "private") {
						await bot.sendMessage(msg.chat.id, "no, wtf");
						return;
					}
					bot.deleteStickerFromSet(msg.reply_to_message?.sticker?.file_id).then(() => {
						bot.sendMessage(chatId, "Sticker deleted").then((message) => {});
					});
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
					bot.getFile(highestQualityPhoto.file_id).then(async (file) => {
						const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
						const imageResponse = await fetch(fileUrl);
						const arrayBuffer = await imageResponse.arrayBuffer();
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
			case "/dream":
				let inlineDream = text.split(" ").slice(1).join(" ");

				const dreamData = inlineDream + (msg.quote?.text || msg.reply_to_message?.text || msg.reply_to_message?.caption || "");
				if (!dreamData.trim().length) return;
				sendSimpleRequestToClaude(`Pretend you're a dream interpreter and interpret this dream: ${dreamData}`).then((response) => {
					handleResponse(`<blockquote expandable>${response.content[0].text}</blockquote>`, msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
				});
				break;
			case "/oracle":
				let target = text.split(" ").slice(1).join(" ");

				explainContextClaude(db.collection("books"), `${target?.length > 0 ? target : "@" + msg.from.username}`)
					.then((context) => {
						textToSpeech(context).then(async (file) => {
							await bot.sendAudio(chatId, file);
							if (fs.existsSync(file)) {
								fs.rmSync(file.substring(0, file.lastIndexOf("/")), { recursive: true, force: true });
							}
						});
						handleResponse(`<blockquote expandable>${context}</blockquote>`, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					})
					.catch((err) => {
						console.error(err);
					});

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
							textOutput = "Results : \n" + textOutput;
						}
						handleResponse(textOutput, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					})
					.catch((err) => {
						consol.error(err);
					});
				break;
			case "/tldr":
				const currentMessageURL = extractUrl(msg.text);
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
						const telegramHTMLPrompt = ``;
						const prompt = "Generate a tldr for this article.";
						let request = `${cleanedContent} ${prompt}\n ${telegramHTMLPrompt}`;
						if (repliedToMessageURL && msgQuestion.length) {
							request = `Give a short answer to this question ${msgQuestion}. Here's the article to repond to the question: ${cleanedContent}\n ${telegramHTMLPrompt}`;
						}
						const summary = await sendSimpleRequestToClaude(request);
						handleResponse(`<blockquote expandable>${summary.content[0].text}</blockquote>`, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					} catch (err) {
						console.error(err);
					}
				});
				break;
			case "/archive":
				const articleURL = extractUrl(msg?.reply_to_message?.text);
				if (articleURL) {
					findDirectArchiveLink(articleURL).then((url) => {
						handleResponse(url, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					});
				}
				break;
			case "/tarot1":
			case "/tarot3":
			case "/tarot10":
				const cardsToDraw = Number(msg.text.split("tarot")[1]) || 3;
				const userQuestion = msg.text.split(" ").splice(1).join(" ");
				const { slideshowPath, reading, imagePaths } = await getReading(cardsToDraw);
				const fileOptions = {
					filename: "video.mp4",
					contentType: "video/mp4",
				};

				const llmRequest = `
				Generate a tarot reading for ${[msg.from.first_name, msg.from.last_name].join(" ").trim()} (@${msg.from.username}) based on these cards: ${reading.join(",")}.
				${userQuestion.trim().length > 0 ? `The reading should address this specific question: "${userQuestion}"` : ""}
				
				Format the response as a conversation between Dasha Nekrasova and Anna Khachiyan from the Red Scare podcast. Include their typical banter, cultural references, and sardonic tone. They should directly address ${msg.from.username ? `@${msg.from.username}` : "the querent"} during the reading.
				
				If there's a natural opportunity for a clever wordplay or joke related to the querent's name that fits the reading's context, include it, but don't force it.
				
				The reading should:
				- Interpret each card's meaning in relation to the others
				- Maintain the nihilistic yet insightful tone of the podcast
				- Include references to psychoanalysis, cultural theory, or art when relevant
				- End with some form of conclusion about the querent's situation
				- NOT say that something is very [insert thinkers name] in the tarot cards
				- Write a message as it's gonna be parsed by the telegram HTML parse mode
				`;
				const tarotMessage = await bot.sendMessage(msg.chat.id, reading.join("\n") + `\n<blockquote expandable>One sec...</blockquote>`, {
					parse_mode: "HTML",
				});

				const interpretation = await sendSimpleRequestToClaude(llmRequest);
				await bot.editMessageText(reading.join("\n") + `\n<blockquote expandable>${interpretation.content[0].text}</blockquote>`, {
					parse_mode: "HTML",
					message_id: tarotMessage.message_id,
					chat_id: msg.chat.id,
				});
				break;
			case "/musicstats":
				const stats = await getMusicStats(musicCollection, msg.chat.id);
				await bot.sendMessage(msg.chat.id, `<blockquote expandable>${stats}</blockquote>`, {
					parse_mode: "HTML",
				});
				break;
			case "/findalbum":
				if (msg.reply_to_message.audio) {
					const audio = msg.reply_to_message.audio;
					const fullMusicName = `${audio.performer} - ${audio.title}`;
					const output = await getAlbumFromSong(fullMusicName);
					await bot.sendMessage(msg.chat.id, `<a href="${output.albumLink}">${output.name}</a>`, { parse_mode: "HTML", reply_to_message_id: msg.messageId });
				}
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
	console.log(matches, "matches");
	if (!matches) return null;
	var url = matches[0];
	return url ?? null;
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
				.then(() => resolve(msg))
				.catch(async (err) => {
					console.error(err);
					sendNewMessage(bot, chatId, text, msg.message_id, myCache, containerFormat).catch((err) => {
						console.error(err);
						reject();
					});
				});
		} else {
			sendNewMessage(bot, chatId, text, msg.message_id, myCache, containerFormat)
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

async function sendNewMessage(bot, chatId, data, messageId, myCache, containerFormat) {
	try {
		const responseMessage = await bot.sendMessage(chatId, containerFormat ? `<${containerFormat}>${data}</${containerFormat}>` : data, {
			parse_mode: "HTML",
			reply_to_message_id: messageId,
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

function getWeather(location, degreeType = "C") {
	return new Promise((resolve, reject) => {
		weather.find({ search: location, degreeType }, function (err, result) {
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
	const cToF = (c) => (c * 9) / 5 + 32;
	const fToC = (f) => ((f - 32) * 5) / 9;
	const formatTemp = (temp, degreeType) => {
		if (degreeType === "C") {
			const fahrenheit = cToF(temp).toFixed(1);
			return `${temp}°C (${fahrenheit}°F)`;
		} else if (degreeType === "F") {
			const celsius = fToC(temp).toFixed(1);
			return `${temp}°F (${celsius}°C)`;
		}
		return `${temp}°${degreeType}`;
	};

	resultLines.push(`Location: ${item.location.name}`);
	resultLines.push(`Current Temperature: ${formatTemp(item.current.temperature, item.location.degreetype)}`);
	resultLines.push(`Humidity: ${item.current.humidity}%`);
	if (item.current.feelslike) {
		resultLines.push(`Feels Like: ${formatTemp(item.current.feelslike, item.location.degreetype)}`);
	}
	resultLines.push(`Conditions: ${item.current.skytext}`);
	resultLines.push(`Observation Time: ${item.current.observationtime} on ${item.current.date}`);
	resultLines.push(`Wind: ${item.current.winddisplay}`);
	resultLines.push(`Low: ${formatTemp(item.forecast[0].low, item.location.degreetype)}`);
	resultLines.push(`High: ${formatTemp(item.forecast[0].high, item.location.degreetype)}`);
	if (item.current.dewPt) {
		resultLines.push(`Dew point: ${formatTemp(item.current.dewPt, item.location.degreetype)}`);
	}

	return resultLines.join("\n");
}

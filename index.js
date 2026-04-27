Array.prototype.random = function () {
	return this[Math.floor(Math.random() * this.length)];
};
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const NodeCache = require("node-cache");
const { saveCache, loadCache } = require("./utils/cachePersistence");
var weather = require("weather-js");
const { error } = require("console");
const { removeImageBackground, generateUnsplashImage, doOCR, generateWordCloud, resizeImageBuffer, isEmojiString } = require("./utils/image");
const { sendSimpleRequestToClaude, sendRequestWithImageToClaude, guessMediaType, sendSimpleRequestToDeepSeek } = require("./utils/ai");
const { summarizeUrl } = require("./utils/summarize");
const fs = require("fs");
const os = require("node:os");
const path = require("node:path");
const math = require("mathjs");
const { getWordEtymology, lookupWord } = require("./utils/dictionary");
const { sleepQuotes } = require("./utils/sleepQuotes");
const moment = require("moment");
const { DateTime } = require("luxon");
const { find } = require("geo-tz");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
	baseApiUrl: process.env.LOCAL_TELEGRAM_API_URL || "http://localhost:8081",
	polling: {
		params: {
			allowed_updates: ["message", "edited_message", "message_reaction"],
		},
	},
});

const originalProcessUpdate = bot.processUpdate.bind(bot);
bot.processUpdate = function (update) {
	return originalProcessUpdate(update);
};
const originalGetUpdates = bot.getUpdates.bind(bot);
bot.getUpdates = function (form = {}) {
	return originalGetUpdates(form)
		.then((updates) => {
			return updates;
		})
		.catch((err) => {
			console.error("getUpdates error:", err.message);
			throw err;
		});
};
bot.on("polling_error", (error) => console.log("Polling error:", error));
(async () => {
	try {
		const botInfo = await bot.getMe();
		console.log("Bot connected successfully:", botInfo);
	} catch (error) {
		console.error("Failed to get bot info:", error.message);
	}
})();
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
const reactionsCollection = db.collection("reactions");
const dadJokesCollection = db.collection("dadJokes");
const alertSubscriptions = db.collection("alertSubscriptions");
const dictionaryCollection = client.db("wiktionary").collection("words");

const { Convert } = require("easy-currencies");
const { extractAndConvertToCm } = require("./utils/converter");
const { eyeWords, reactToTelegramMessage, bannedWords, nerdwords, sendPoll } = require("./utils/reactions");
const { getRandomOracleMessageObj, getContext, explainContext, sanitizeTags } = require("./utils/oracle");
const { generateEmbedding, findSimilarMessages, countSenders, searchMessagesByEmbedding, wordCountLeaderboard } = require("./utils/search");
const { extractTweetId, extractTweet, generateTweetScreenshot } = require("./utils/bird");
const { getAndSendRandomQuestion } = require("./utils/trivia");
const { sendRandomQuizz } = require("./utils/quizz");
const { getPollResults } = require("./utils/telegram_polls");
const { getReading } = require("./utils/tarot");
const {
	extractAndDownloadFromSocialLink,
	downloadImageAsBuffer,
	getAlbumFromSong,
	downloadVideoFromUrl,
	extractAudioFromVideo,
} = require("./utils/downloader");
const { findDirectArchiveLink } = require("./utils/web");
const { textToSpeech, createConversationAudio } = require("./utils/tts");
const { makeid, createMessageBlocks } = require("./utils/util");
const { getMusicStats } = require("./utils/music");
const escapeHTML = (str) => {
	if (typeof str !== "string") return str;
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const myCache = new NodeCache();
loadCache(myCache);

const SAVE_INTERVAL_MS = 5 * 60 * 1000;
const saveInterval = setInterval(() => saveCache(myCache), SAVE_INTERVAL_MS);

function gracefulShutdown() {
	clearInterval(saveInterval);
	saveCache(myCache);
	process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

const axios = require("axios");
const { getWeather, getForecastDay, extractDayOffset, extractLocation } = require("./utils/weather");
const { getAlerts, formatAlertMessage, getAlertId } = require("./utils/alerts");
const { getUserMessagesAndAnalyse } = require("./utils/political");
const { getLocalNews } = require("./utils/news");
const { withBurnedSubtitles, transcribeAudio } = require("./utils/transcriber");
const { cutVideo } = require("./utils/cutter");
const { getTimeAtLocation, findTimezones } = require("./utils/time");
const { getRandomQuranVerse } = require("./utils/quran");
const { screenshotRedditPost, extractOldRedditLink } = require("./utils/reddit");
const { getWiktionaryPages } = require("./utils/wikitionary");
const { sanitizeTelegramHtml } = require("./utils/html-sanitizer");
const { findAuslanSignVideoLink } = require("./utils/auslan");
const { renderLatexToPngBuffer } = require("./utils/latex");
const { generateBarChartSvg, renderSvgToPng, DAY_NAMES } = require("./utils/charts");
const { analyzeSentiment, analyzePhoto, emotionToEmoji, allowedReactionEmojis } = require("./utils/transformers");
const { handleTimeReminders } = require("./utils/reminder");
const {
	getCoordinates,
	getAstrologyChart,
	generateSynastryChart,
	generateCompositeChart,
	getSolarReturnChart,
	getAstroloseekChart,
} = require("./utils/astrology");
const { sub } = require("@tensorflow/tfjs-node");

axios
	.post(`${process.env.LOCAL_TELEGRAM_API_URL || "http://localhost:8081"}/bot${process.env.TELEGRAM_BOT_TOKEN}/setMyCommands`, {
		commands: [
			{
				command: "help",
				description: "Display help message with all commands",
			},
			{ command: "weather", description: "Get the weather" },
			{ command: "forecast", description: "Get forecast" },
			{ command: "8ball", description: "Get a Magic 8-Ball response" },
			{ command: "coinflip", description: "Flip a coin" },
			{ command: "calc", description: "Calculate mathematical expressions" },
			{
				command: "when",
				description: "Show message date - reply to message",
			},
			{ command: "weather", description: "Get weather in Celsius" },
			{ command: "trans", description: "Translate text to another language" },
			{ command: "etymology", description: "Get word etymology" },
			{
				command: "unsplash",
				description: "Generate quote image - reply to message",
			},
			{
				command: "ocr",
				description: "Extract text from image - reply to image",
			},
			{
				command: "wordcloud",
				description: "Generate word cloud from recent messages",
			},
			{
				command: "createsticker",
				description: "Create sticker from image with emojis",
			},
			{ command: "oracle", description: "Get oracle reading with audio" },
			{ command: "archive", description: "Get archive.org link for URL" },
			{ command: "summarize", description: "Summarize article from URL" },
			{ command: "musicstats", description: "View music statistics" },
			{
				command: "findalbum",
				description: "Find album for audio track - reply to audio",
			},
			{ command: "regex", description: "Search messages by regex pattern" },
			{
				command: "search",
				description: "Semantic search for messages by meaning",
			},
			{ command: "count", description: "Count message occurrences" },
			{
				command: "wordleaderboard",
				description: "Show word count leaderboard",
			},
			{ command: "glossary", description: "Search glossary" },
			{
				command: "addtoglossary",
				description: "Add word to glossary with definition",
			},
			{
				command: "downloadaudio",
				description: "Reply to a message with a URL to download audio or do /downloadaudio <url>",
			},
			{
				command: "download",
				description: "Reply to a message with a URL to download a video or do /download <url>",
			},
			{ command: "cc", description: "Convert currency" },
			{ command: "addsubtitles", description: "add subtitles to a video" },
			{
				command: "cut",
				description: "Cut video from start to end time (reply to video)",
			},
			{
				command: "extractaudio",
				description: "Extract audio from video (reply to video)",
			},
			{
				command: "summary",
				description: "Summarize last N messages (default: 100)",
			},
			/* 			{ command: "dad", description: "Get a random dad joke" },
			 */ { command: "alquran", description: "Get a random Quran verse" },
			{ command: "bible", description: "Get a random Bible verse" },
			{ command: "torah", description: "Get a random Torah verse" },

			{
				command: "dictionary",
				description: "Look up a word in the dictionary",
			},
			{
				command: "transcribe",
				description: "Transcribe audio or voice message (reply to audio)",
			},
			{
				command: "reactionstats",
				description: "Show stats for reactions",
			},
			{
				command: "wordcount",
				description: "Show word count",
			},
			{ command: "birthdata", description: "Register birth data" },
			{
				command: "registerbirthdata",
				description: "Register birth data for another user (admin only)",
			},
			{
				command: "natal",
				description: "Get natal chart based on registered birth data",
			},
			{
				command: "synastry",
				description: "Get synastry chart between you and another user based on registered birth data",
			},
			{
				command: "composite",
				description: "Get composite chart between you and another user based on registered birth data",
			},
			{ command: "solarreturn", description: "Get solar return chart" },
			{
				command: "natalifbornnow",
				description: "Get natal chart for people born rn",
			},
			{
				command: "natalifconceivechildnow",
				description: "Get natal chart for child born 40 weeks from now",
			},
			{
				command: "activity",
				description: "Show chat activity graphs (hourly & daily)",
			},
			{
				command: "registeralert",
				description: "Register for weather alerts for a city",
			},
			{
				command: "unregisteralert",
				description: "Unregister from weather alerts for a city",
			},
			{
				command: "myalerts",
				description: "List your weather alert subscriptions",
			},
		],
	})
	.then(() => {})
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
bot.on("message_reaction", async (msg) => {
	try {
		const reactionDoc = {
			chat_id: msg.chat.id,
			chat_title: msg.chat.title,
			chat_type: msg.chat.type,
			message_id: msg.message_id,
			user_id: msg.user.id,
			user_username: msg.user.username,
			user_first_name: msg.user.first_name,
			date: new Date(msg.date * 1000),
			old_reaction: msg.old_reaction,
			new_reaction: msg.new_reaction,
			timestamp: new Date(),
		};
		await reactionsCollection.insertOne(reactionDoc);
		console.log("Reaction saved to database");
	} catch (error) {
		console.error("Failed to save reaction to database:", error.message);
	}
});

/* bot.on("message", async (msg) => {
	console.log("Message event received, type:", msg.chat.type, "chatId:", msg.chat.id);
}); */
setTimeout(() => {
	console.log("Bot started, waiting for updates...");
	console.log("Polling URL:", bot.options.baseApiUrl);
}, 1000);

const ALERT_CHECK_INTERVAL = 2 * 60 * 60 * 1000;
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
const alertChecker = async () => {
	try {
		const subs = await alertSubscriptions.find({}).toArray();
		const uniqueLocations = [...new Set(subs.map((s) => s.city))];
		for (const city of uniqueLocations) {
			await sleep(5000);
			const { alerts } = await getAlerts(city);
			const currentAlertIds = new Set(alerts.map((a) => a.id));

			const matchingSubs = subs.filter((s) => s.city === city);
			for (const sub of matchingSubs) {
				const previousIds = new Set(sub.lastAlertIds || []);
				const newAlerts = alerts.filter((a) => !previousIds.has(a.id));

				if (newAlerts.length > 0) {
					for (const alert of newAlerts) {
						const msgText = formatAlertMessage(alert, sub.cityDisplay || sub.city);
						const taggedMsg = `<a href="tg://user?id=${sub.userId}">⛑</a>\n${msgText}`;
						bot.sendMessage(sub.chatId, taggedMsg, { parse_mode: "HTML" }).catch((err) => {
							console.error("Failed to send alert notification:", err);
						});
					}
					await alertSubscriptions.updateOne({ _id: sub._id }, { $set: { lastAlertIds: [...currentAlertIds] } });
				}
			}
		}
	} catch (err) {
		console.error("Alert checker error:", err);
	}
};
const loop = async () => {
	await alertChecker();
	setTimeout(loop, ALERT_CHECK_INTERVAL);
};
loop();
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

function isUserAllowedToDM(userId) {
	const allowedUsers = process.env.ALLOWED_TO_DM_BOT.split(" ").map((userid) => Number(userid));
	return allowedUsers.includes(userId);
}
const videoExtensions = [".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv"];

async function handleSocialMediaLinks(text, chatId, messageId, msg) {
	extractAndDownloadFromSocialLink(text, (output) => {
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

async function translateTweet(tweetData) {
	console.log("translating...", tweetData.fullText);
	console.log("Reply", tweetData.replyTo);
	tweetData.fullText = await translateShell(tweetData.fullText, "en");
	if (tweetData.replyTo) {
		tweetData.replyTo = await translateTweet(tweetData.replyTo);
	}
	if (tweetData.quoted) {
		tweetData.quoted = await translateTweet(tweetData.quoted);
	}
	return tweetData;
}

async function handleTweetPreview(msg, text, chattriId) {
	const chatId = msg.chat.id;

	const tweetId = extractTweetId(text);
	if (!tweetId || text.includes("no preview")) {
		return;
	}
	try {
		let tweetData = await extractTweet(text);
		if (!tweetData) return;
		const messageOptions = {
			parse_mode: "HTML",
			disable_web_page_preview: true,
			has_spoiler: text.includes("spoiler"),
		};
		if (text.includes("translate")) {
			tweetData = await translateTweet(tweetData);
		}
		//const hasVideos = tweetData?.media?.some((media) => media.type == "VIDEO" || media.type == "GIF");
		if (!text.includes("screenshot")) {
			let tweetText = `${tweetData?.fullText} \nTweet by ${tweetData?.tweetBy?.fullName || ""} (@${tweetData?.tweetBy?.userName}) on ${moment.utc(tweetData?.createdAt).format("MMMM Do YYYY [at] h:mm a [(GMT)]") || ""}`;
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
				}),
			);

			const media = tweetData.media;
			const mediaCount = media?.length || 0;

			const tweetTextParts = createMessageBlocks(tweetText, 2000).map((text) => `<blockquote expandable>${text}</blockquote>`);
			tweetText = tweetTextParts[0];
			/* if (mediaCount === 0) {
				//await bot.sendMessage(chatId, tweetText, messageOptions);
			} else if (mediaCount === 1) {
				const singleMedia = media[0];
				const optionsWithCaption = { ...messageOptions };

				if (singleMedia.type === "VIDEO" || singleMedia.type == "GIF") {
					await bot.sendVideo(chatId, singleMedia.url, optionsWithCaption);
				} else {
					await bot.sendPhoto(chatId, singleMedia.url, optionsWithCaption);
				}
			} else */ if (mediaCount > 0 && mediaCount <= 10) {
				const mediaGroup = media.map((item, index) => ({
					type: item.type.toLowerCase(),
					media: item.url,
					...(index === 0 && { parse_mode: "HTML" }),
				}));
				await bot.sendMediaGroup(chatId, mediaGroup);
			} else {
				for (const item of media) {
					if (item.type === "VIDEO" || item.type == "GIF") {
						await bot.sendVideo(chatId, item.url, optionsWithCaption);
					} else if (item.type === "PHOTO") {
						await bot.sendPhoto(chatId, item.url, optionsWithCaption);
					}
				}
				//await bot.sendMessage(chatId, tweetText, messageOptions);
			}
			//	if (tweetTextParts.length > 1) {
			for (let i = 0; i < tweetTextParts.length; i++) {
				await bot.sendMessage(chatId, tweetTextParts[i], messageOptions);
			}
			//}
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
		sender: [msg.from.first_name, msg.from.last_name].join(" ").trim(),
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

/* bot.on("voice", async (msg) => {
	try {
		const chatId = msg.chat.id;
		const voice = msg.voice;
		if (!voice) return;
		const randomChance = Math.random();

		console.log(`Voice message received from ${msg.from.id} in ${chatId}, duration: ${voice.duration}s`);

		if (voice.duration > 300) {
			console.log(`Long voice message (${voice.duration}s), transcription may take time.`);
		}

		const file = await bot.getFile(voice.file_id);
		const localFilePath = file.file_path;

		if (!require("fs").existsSync(localFilePath)) {
			console.error(`File not found at ${localFilePath}`);
			return;
		}

		console.log(`Voice file located at ${localFilePath}`);

		const transcription = await transcribeAudio(localFilePath);

		if (!transcription || transcription.trim().length === 0) {
			console.log("Transcription empty, skipping sentiment analysis");
			return;
		}

		let emoji = null;
		try {
			const sentimentResults = await analyzeSentiment(transcription);
			const result = sentimentResults[0];
			if (result.score < 0.75) {
				console.log("voice sentiment too weak", {
					score: result.score,
					emotion: result.label,
				});
				return;
			}
			if (result) {
				console.log("vm emotion", result);
				emoji = emotionToEmoji(result.label);
			}
		} catch (sentimentError) {
			console.error("Sentiment analysis failed:", sentimentError);
		}

		if (emoji && emoji.length > 0 && allowedReactionEmojis.includes(emoji)) {
			const canReact = (chatId, cooldown = 60 * 60_000) => {
				const key = `audioReactionCooldown:${chatId}`;
				if (myCache.get(key)) return false;
				myCache.set(key, true, cooldown / 1000);
				return true;
			};
			if (canReact(msg.chat.id)) {
				reactToTelegramMessage(bot, emoji, chatId, msg.message_id);
			}
		}
	} catch (error) {
		console.error("Voice transcription failed:", error);
	}
}); */
/* bot.on("photo", async (msg) => {
	const photoMedia = msg.photo.pop();

	if (photoMedia) {
		bot.getFile(photoMedia.file_id).then((file) => {
			const fileSizeInBytes = file.file_size;
			const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
			console.log(fileSizeInMB, "MB");
			if (fileSizeInMB < 20) {
				analyzePhoto(file.file_path).then((analysis) => {
					console.log(analysis);
				});
			}
		});
	}
}); */

const antCollection = db.collection("ants");

bot.on("text", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text || msg.caption;

	if (msg.chat.type === "private" && !isUserAllowedToDM(msg.from.id)) {
		return;
	}

	/* const probability = Math.random();
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
	} */

	/* 	const redditLink = extractOldRedditLink(msg.text);
	if (redditLink) {
		const image = await screenshotRedditPost(redditLink);
		bot.sendPhoto(msg.chat.id, image);
	} */
	handleTimeReminders(msg, antCollection, bot);

	/* if (text.trim().length > 0) {
		analyzeSentiment(text).then((analysis) => {
			const canReact = (chatId, cooldown = 60 * 60_000) => {
				const key = `reactionCooldown:${chatId}`;
				if (myCache.get(key)) return false;

				myCache.set(key, true, cooldown / 1000);
				return true;
			};

			const result = analysis[0];
			if (msg.chat.title.includes("testing")) result.score = 1;
			if (result.label == "neutral") return;
			if (result.score < 0.9) return;
			const later = (fn, min = 5000, max = 10000) =>
				setTimeout(
					() => {
						fn();
						console.log("reacted later");
					},
					min + Math.random() * (max - min),
				);

			const chaos = Math.abs(Math.sin(Date.now() % 10000)) * Math.random();
			const maybe = (p) => Math.random() < p;

			const mood = Math.floor(Date.now() / 60000) % 3;
			const moodChance = mood === 0 ? 0.2 : mood === 1 ? 0.3 : 0.25;

			if (!maybe(moodChance)) {
				console.log("Reaction refused", {
					chat: msg.chat.title,
					acceptanceChance: moodChance,
					score: result.score,
					emotion: result.label,
					text,
				});
				return;
			}
			console.log({ chaos, moodChance });

			const react = () => {
				const emoji = emotionToEmoji(result.label);
				if (!emoji.length) return;
				if (!canReact(chatId)) {
					console.log("cooldown active for chat");
					return;
				}
				reactToTelegramMessage(bot, emoji, chatId, msg.message_id);
			};
			/* if (maybe(0.4)) {
        console.log("double react triggered");
        if (!canReact(chatId)) {
          console.log("cooldown active for chat");
          return;
        }
        reactToTelegramMessage(
          bot,
          allowedReactionEmojis.random(),
          chatId,
          msg.message_id,
        );
        later(react);
        return;
      } 
			if (maybe(0.01)) {
				console.log("later react triggered");
				setTimeout(react, 120000);
				return;
			}
			console.log("regular react triggered");

			react();
		});
	} */

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
/registeralert [city] - Get pinged for weather alerts
/unregisteralert [city] - Stop alerts for a city
/myalerts - List your alert subscriptions

<b>Translation & Language:</b>
/trans :[lang] [text] - Translate text (also /cis)
/etymology [word] - Get word etymology

<b>Image & Media:</b>
/unsplash - Generate quote image (reply to message)
/wordcloud - Generate word cloud from recent messages
/createsticker [emojis] - Create sticker from image (also /addsticker)
/cut <start> <end> - Cut video (reply to video)
/extractaudio - Extract audio from video (reply to video)

<b>Analysis:</b>
/archive - Get archive.org link for URL
/summarize - Summarize article from URL
/reactionstats - Show reaction leaderboard for this chat
/activity - Show chat activity graphs (hourly & daily)

<b>Tarot Readings:</b>
/tarot1 - Single card reading
/tarot3 - Three card reading
/tarot10 - Ten card reading


<b>Music:</b>
/musicStats - View music statistics
/findAlbum - Find album for audio track (reply to audio)

<b>Search & Database:</b>
/search [pattern] - Search messages by regex
/count [pattern] - Count message occurrences
/wordcount- Show word count leaderboard
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

				case "/transcribe":
					if (msg.reply_to_message && (msg.reply_to_message.audio || msg.reply_to_message.voice)) {
						const file = await bot.getFile(msg.reply_to_message.voice ? msg.reply_to_message.voice.file_id : msg.reply_to_message.audio.file_id);
						try {
							const transcription = await transcribeAudio(file.file_path);
							await bot.sendMessage(chatId, `<blockquote expandable>\n${transcription}</blockquote>`, {
								reply_to_message_id: msg.message_id,
								parse_mode: "HTML",
							});
						} catch (error) {
							console.error("Transcription failed:", error);
							await bot.sendMessage(chatId, `failed: ${error.message}`, {
								reply_to_message_id: msg.message_id,
							});
						}
					} else {
						await bot.sendMessage(chatId, "Please reply to an audio or voice message to transcribe.", { reply_to_message_id: msg.message_id });
					}
					break;

				case "/wordcloud":
					collection
						.find({ chatId })
						.sort({ date: -1 })
						.limit(500)
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
				/* 				case "/dad":
					try {
						const jokes = await dadJokesCollection.aggregate([{ $sample: { size: 1 } }]).toArray();
						if (jokes.length > 0) {
							handleResponse(jokes[0].joke, msg, chatId, myCache, bot, null).catch((err) => {
								console.error(err);
							});
						}
					} catch (error) {
						console.error("Failed to fetch dad joke:", error);
					}
					break; */
				case "/8ball":
					const response = getRandomElement(eightBallResponses);
					handleResponse(response, msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
					break;

				case "/downloadaudio":
					forceAudio = true;
				case "/download":
					const downloadLinkStr = [msg.reply_to_message?.text || "", msg.text].join(" ");
					downloadVideoFromUrl(downloadLinkStr, !!forceAudio, (output) => {
						const messageId = msg.message_id;
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
											{
												filename: new Date() + "video.mp4",
												contentType: "video/mp4",
											},
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

				case "/cc":
				case "/currencyConvert":
					const input = msg.text.split(" ").slice(1);
					if (input.length > 4) return;
					const amount = Number(input[0].replace(/,/g, ""));
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
				case "/no":
					axios.get("https://naas.isalman.dev/no").then((response) => {
						handleResponse(response.data.reason, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					});
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
				case "/registeralert":
					{
						const city = text.split(" ").slice(1).join(" ").trim();
						if (!city) {
							bot.sendMessage(chatId, "Please specify a city. Example: /registeralert Paris", { reply_to_message_id: msg.message_id });
							break;
						}
						const existing = await alertSubscriptions.findOne({ userId: msg.from.id, chatId, city: city.toLowerCase() });
						if (existing) {
							bot.sendMessage(chatId, `You're already registered for alerts in ${escapeHTML(city)}.`, {
								reply_to_message_id: msg.message_id,
								parse_mode: "HTML",
							});
							break;
						}
						const { locationName, alerts, error } = await getAlerts(city);
						if (error) {
							bot.sendMessage(chatId, `Could not find city`, { reply_to_message_id: msg.message_id });
							break;
						}
						await alertSubscriptions.insertOne({
							userId: msg.from.id,
							chatId,
							city: city.toLowerCase(),
							cityDisplay: locationName,
							lastAlertIds: alerts.map((a) => a.id),
							createdAt: new Date(),
						});
						const confirmMsg = `Registered for weather alerts in <b>${escapeHTML(locationName)}</b>.`;
						bot.sendMessage(chatId, confirmMsg, { reply_to_message_id: msg.message_id, parse_mode: "HTML" });
					}
					break;

				case "/unregisteralert":
					{
						const city = text.split(" ").slice(1).join(" ").trim().toLowerCase();
						if (!city) {
							bot.sendMessage(chatId, "Please specify a city. Example: /unregisteralert Paris", { reply_to_message_id: msg.message_id });
							break;
						}
						const result = await alertSubscriptions.deleteOne({ userId: msg.from.id, chatId, city });
						if (result.deletedCount > 0) {
							bot.sendMessage(chatId, `Unregistered from alerts for <b>${escapeHTML(city)}</b>.`, {
								reply_to_message_id: msg.message_id,
								parse_mode: "HTML",
							});
						} else {
							bot.sendMessage(chatId, `You are not registered for alerts in <b>${escapeHTML(city)}</b>.`, {
								reply_to_message_id: msg.message_id,
								parse_mode: "HTML",
							});
						}
					}
					break;

				case "/myalerts":
					{
						const subs = await alertSubscriptions.find({ userId: msg.from.id, chatId }).toArray();
						if (subs.length === 0) {
							bot.sendMessage(chatId, "You have no weather alert subscriptions. Use /registeralert <city> to add one.", {
								reply_to_message_id: msg.message_id,
							});
						} else {
							const list = subs.map((s, i) => `${i + 1}. <b>${escapeHTML(s.cityDisplay || s.city)}</b>`).join("\n");
							bot.sendMessage(chatId, `Your weather alert subscriptions:\n${list}`, { reply_to_message_id: msg.message_id, parse_mode: "HTML" });
						}
					}
					break;

				case "/processPoll":
					bot.sendMessage(msg.chat.id, `I am connected to: ${bot.options.baseApiUrl}`);
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
					if (!languageInfo.includes(":")) {
						languageInfo = null;
					} else {
						textMsg = textMsg.split(" ").slice(1).join(" ");
					}
					const translateString = (textMsg.trim().length ? textMsg : msg.quote?.text || msg.reply_to_message?.text || msg.reply_to_message?.caption) || "";

					translateShell(translateString, languageInfo)
						.then(async (response) => {
							if (response.length == 0) {
								handleResponse("Translation failed or returned empty.", msg, chatId, myCache, bot, null).catch((err) => console.error(err));
								return;
							}
							handleResponse(
								`<blockquote expandable> ${response} </blockquote>`
									.replace(ansiEscapeRegex, "")
									.replace(/\n\s*\n/g, "\n")
									.trim(),
								msg,
								chatId,
								myCache,
								bot,
								null,
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
				case "/reactionstats":
					try {
						const sevenDaysAgo = new Date();
						sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

						const topUsers = await reactionsCollection
							.aggregate([
								{ $match: { chat_id: chatId } },
								{
									$match: {
										timestamp: {
											$gte: sevenDaysAgo,
										},
									},
								},
								{ $unwind: "$new_reaction" },
								{ $group: { _id: "$user_id", total_reactions: { $sum: 1 } } },
								{ $sort: { total_reactions: -1 } },
								{ $limit: 10 },
							])
							.toArray();

						if (topUsers.length === 0) {
							await bot.sendMessage(chatId, "No reaction data found for this chat.", {
								reply_to_message_id: msg.message_id,
							});
							break;
						}

						const leaderboard = [];
						for (const user of topUsers) {
							const userId = user._id;

							const topEmoji = await reactionsCollection
								.aggregate([
									{ $match: { chat_id: chatId, user_id: userId } },
									{ $unwind: "$new_reaction" },
									{
										$group: {
											_id: "$new_reaction.emoji",
											count: { $sum: 1 },
										},
									},
									{ $sort: { count: -1 } },
									{ $limit: 1 },
								])
								.toArray();

							const topEmojiStr = topEmoji.length > 0 ? topEmoji[0]._id : "❓";
							const emojiCount = topEmoji.length > 0 ? topEmoji[0].count : 0;

							const userReaction = await reactionsCollection.findOne(
								{ chat_id: chatId, user_id: userId },
								{ projection: { user_username: 1, user_first_name: 1 } },
							);

							const userName = userReaction?.user_first_name;

							leaderboard.push({
								userId,
								userName,
								total_reactions: user.total_reactions,
								top_emoji: topEmojiStr,
								top_emoji_count: emojiCount,
							});
						}

						let leaderboardText = `<pre>`;
						leaderboardText += `Rank | Name         | React | Top Emoji\n`;
						leaderboardText += `----------------------------------------\n`;
						leaderboard.forEach((user, index) => {
							const rank = String(index + 1).padEnd(4);
							const name = user.userName.slice(0, 12).padEnd(12);
							const reactions = String(user.total_reactions).padEnd(5);
							const topEmoji = `${user.top_emoji} (${user.top_emoji_count})`;
							leaderboardText += `${rank} | ${name} | ${reactions} | ${topEmoji}\n`;
						});
						leaderboardText += `</pre>`;
						await bot.sendMessage(chatId, leaderboardText, {
							reply_to_message_id: msg.message_id,
							parse_mode: "HTML",
						});
					} catch (error) {
						console.error("Error fetching reaction stats:", error);
					}
					break;
				case "/activity": {
					try {
						const oldest = await collection.find({ chatId }).sort({ date: 1 }).limit(1).project({ date: 1 }).toArray();

						const hourlyData = await collection
							.aggregate([{ $match: { chatId } }, { $group: { _id: { $hour: "$date" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
							.toArray();

						const hourlyMap = Object.fromEntries(hourlyData.map((d) => [d._id, d.count]));
						const hourlySeries = Array.from({ length: 24 }, (_, i) => ({
							label: i.toString().padStart(2, "0"),
							value: hourlyMap[i] || 0,
						}));

						const dailyData = await collection
							.aggregate([{ $match: { chatId } }, { $group: { _id: { $dayOfWeek: "$date" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
							.toArray();

						const dailyMap = Object.fromEntries(dailyData.map((d) => [d._id, d.count]));
						const dailySeries = DAY_NAMES.map((name, i) => ({
							label: name,
							value: dailyMap[i + 1] || 0,
						}));

						const timeframe = oldest.length > 0 ? `Since ${oldest[0].date.toLocaleDateString()}` : "";

						const svgHourly = generateBarChartSvg(hourlySeries, {
							title: `Avg Messages per Hour  ${timeframe}`,
							barColor: "#89b4fa",
						});
						const svgDaily = generateBarChartSvg(dailySeries, {
							title: `Avg Messages per Day  ${timeframe}`,
							barColor: "#a6e3a1",
						});

						const [hourlyPng, dailyPng] = await Promise.all([renderSvgToPng(svgHourly), renderSvgToPng(svgDaily)]);

						await bot.sendMediaGroup(chatId, [
							{ type: "photo", media: hourlyPng },
							{ type: "photo", media: dailyPng },
						]);
					} catch (err) {
						console.error("Activity command failed:", err);
						await bot.sendMessage(chatId, "Failed to generate activity charts.", {
							reply_to_message_id: msg.message_id,
						});
					}
					break;
				}
				case "/removebg":
				case "/rmbg":
				case "/deletesticker":
					if (!((await getAdminsIds(chatId)).includes(msg.from.id) || msg.from.id == process.env.STICKER_OWNER) && msg.chat.type != "private") {
						await bot.sendMessage(msg.chat.id, "no, ur not my dad");
						return;
					}

					if (msg.reply_to_message?.sticker) {
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
							{ language },
						);
					}
					break;

				case "/cut": {
					const args = text.split(" ").slice(1);
					if (args.length < 2) {
						handleResponse(
							"Usage: /cut <start> <end> (reply to a video). Times can be seconds (e.g., 5) or HH:MM:SS (e.g., 00:01:30).",
							msg,
							chatId,
							myCache,
							bot,
							null,
						).catch((err) => {
							console.error(err);
						});
						break;
					}
					const [start, end] = args;
					if (msg.reply_to_message && (msg.reply_to_message.video || msg.reply_to_message.document)) {
						const file = await bot.getFile(msg.reply_to_message.video ? msg.reply_to_message.video.file_id : msg.reply_to_message.document.file_id);
						cutVideo(file.file_path, start, end, async ({ outputVideoPath }) => {
							await bot.sendVideo(chatId, outputVideoPath, { reply_to_message_id: msg.message_id }, { filename: "cut.mp4", contentType: "video/mp4" });
							return;
						});
					}
					break;
				}

				case "/extractaudio": {
					if (msg.reply_to_message && (msg.reply_to_message.video || msg.reply_to_message.document)) {
						try {
							const file = await bot.getFile(msg.reply_to_message.video ? msg.reply_to_message.video.file_id : msg.reply_to_message.document.file_id);
							await extractAudioFromVideo(file.file_path, async ({ outputAudioPath }) => {
								const sentAudio = await bot.sendAudio(chatId, outputAudioPath, {
									reply_to_message_id: msg.message_id,
								});
								storeMusicInDB(sentAudio.audio, sentAudio, msg.from);
							});
						} catch (error) {
							console.error("Failed to extract audio:", error);
							await bot.sendMessage(chatId, `Failed to extract audio: ${error.message}`, {
								reply_to_message_id: msg.message_id,
							});
						}
					} else {
						handleResponse("Please reply to a video or document to extract audio.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					}
					break;
				}

				case "/createsticker":
				case "/addsticker":
					if (msg.reply_to_message && (msg.reply_to_message.photo || msg.reply_to_message.sticker || msg.reply_to_message.document)) {
						let emojis = msg.text.split(" ").slice(1).join(" ").replace(/\s+/g, "");
						if (emojis.trim().length === 0) {
							emojis = "🍉";
						}
						const photoArray = msg.reply_to_message.photo;
						const highestQualityPhoto = photoArray ? photoArray[photoArray.length - 1] : msg.reply_to_message.sticker || msg.reply_to_message.document;
						bot.getFile(highestQualityPhoto.file_id).then(async (file) => {
							const arrayBuffer = fs.readFileSync(file.file_path);
							const imageBuffer = Buffer.from(arrayBuffer);
							const resizedImage = await resizeImageBuffer(imageBuffer);
							const stickerPackName = `hummus${chatId.toString().slice(4)}_by_${process.env.BOT_USERNAME}`;
							bot
								.addStickerToSet(process.env.STICKER_OWNER, stickerPackName, resizedImage, emojis)
								.then(() => {
									handleResponse(`<a href="t.me/addstickers/${stickerPackName}"> Done </a>`, msg, chatId, myCache, bot, null)
										.then((message) => {})
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
							null,
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
										null,
									).catch((err) => {
										console.error(err);
									});
								}
							});
					}
					break;

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
								.then((message) => {})
								.catch((err) => {
									console.error(err);
								});
						})
						.catch((err) => {
							console.error(err);
						});
					break;
				case "/wordcount":
					let limit = 10;
					wordCountLeaderboard(db.collection("messages"), chatId, limit)
						.then((results) => {
							let textOutput = results
								.map((element) => {
									return `${element._id}: ${element.totalWords} words (${element.messageCount} messages)`;
								})
								.join("\n");
							if (textOutput.trim().length == 0) {
								textOutput = "no results found";
							} else {
								textOutput = "Word count:\n" + textOutput;
							}
							handleResponse(`<blockquote expandable>${textOutput}</blockquote>`, msg, chatId, myCache, bot, null)
								.then((message) => {})
								.catch((err) => {
									console.error(err);
								});
						})
						.catch((err) => {
							console.error(err);
						});
					break;
				case "/search":
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

				case "/summarize":
					const fullContext = [msg?.reply_to_message?.text?.toString(), msg.text?.toString()].filter((element) => element).join("");
					const summaryUrl = extractUrl(fullContext);
					console.log(summaryUrl);
					if (summaryUrl) {
						summarizeUrl(summaryUrl)
							.then((summary) => {
								handleResponse(
									`Not an LLM summary, lower your expectations <blockquote expandable>${summary}</blockquote>`,
									msg,
									chatId,
									myCache,
									bot,
									null,
								).catch((err) => {
									console.error(err);
								});
							})
							.catch((err) => {
								console.log(summarizeUrl);
								handleResponse("failed to summarize URL, probably ran out of memory lel, get me a bigger server ty.", msg, chatId, myCache, bot, null);
							});
					} else {
						handleResponse("No URL found. Reply to a message with a URL or use /summarize <url>", msg, chatId, myCache, bot, null);
					}
					break;
				case "/tarot1":
				case "/tarot3":
				case "/tarot10": {
					if (msg.chat.type !== "private") return;
					const cardsToDraw = Number(msg.text.split("tarot")[1]) || 3;
					const userQuestion = msg.text.split(" ").splice(1).join(" ");
					const { reading } = await getReading(cardsToDraw);

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
				- The response has to be in HTML and only use these tags: b, strong, i, em, u, ins, s, strike, del, tg-spoiler, a

				`;

					const tarotMessage = await bot.sendMessage(msg.chat.id, reading.join("\n") + `\n<blockquote expandable>One sec...</blockquote>`, {
						parse_mode: "HTML",
					});

					const interpretationText = sanitizeTags(await sendSimpleRequestToDeepSeek(llmRequest));
					const interpretationMessageBlocks = createMessageBlocks(interpretationText);
					await bot.editMessageText(reading.join("\n") + `\n<blockquote expandable>${interpretationMessageBlocks[0]}</blockquote>`, {
						parse_mode: "HTML",
						message_id: tarotMessage.message_id,
						chat_id: msg.chat.id,
					});
					if (interpretationMessageBlocks.length > 1) {
						for (let i = 1; i < interpretationMessageBlocks.length; i++) {
							await bot.sendMessage(chatId, `\n<blockquote expandable> ${interpretationMessageBlocks[i]}</blockquote>`, { parse_mode: "HTML" });
						}
					}
					break;
				}
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
					break;
				}

				case "/findalbum":
					if (msg.reply_to_message.audio) {
						const audio = msg.reply_to_message.audio;
						const fullMusicName = `${audio.performer} - ${audio.title}`;
						const output = await getAlbumFromSong(fullMusicName);
						await bot.sendMessage(msg.chat.id, `<a href="${output.albumLink}">${output.name}</a>`, { parse_mode: "HTML", reply_to_message_id: msg.messageId });
					}
					break;

				case "/news":
					let city = text.split(" ").slice(1).join(" ");
					const news = await getLocalNews(city);
					handleResponse(news, msg, chatId, myCache, bot, null, true).catch((e) => {
						console.error(e);
					});
					break;
				case "/alquran":
					const verseData = await getRandomQuranVerse();
					handleResponse(verseData, msg, chatId, myCache, bot, null).catch((e) => {
						console.error(e);
					});
					break;
				case "/torah":
					const books = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"];
					const randomBook = books[Math.floor(Math.random() * books.length)];
					const torahDB = client.db("bible");
					const torahVerse = await torahDB
						.collection("verses")
						.aggregate([{ $match: { translation: "KJV", book: randomBook } }, { $sample: { size: 1 } }])
						.toArray();

					const t = torahVerse[0];

					const torahText = `${t.book} ${t.chapter}:${t.verse}\n${t.text}`;
					handleResponse(`<blockquote expandable>${torahText}</blockquote>`, msg, chatId, myCache, bot, null).catch((e) => {
						console.error(e);
					});
					break;
				case "/bible":
					const bibleDB = client.db("bible");
					const verse = await bibleDB
						.collection("verses")
						.aggregate([{ $match: { translation: "KJV" } }, { $sample: { size: 1 } }])
						.toArray();

					const v = verse[0];

					const verseText = `${v.book} ${v.chapter}:${v.verse}\n${v.text}`;
					handleResponse(`<blockquote expandable>${verseText} </blockquote>`, msg, chatId, myCache, bot, null).catch((e) => {
						console.error(e);
					});
					break;
				case "/oracle":
					let target = text.split(" ").slice(1).join(" ");

					explainContext(db.collection("books"), `${target?.length > 0 ? target : "@" + msg.from.username}`)
						.then((context) => {
							handleResponse(`<blockquote expandable>${context}</blockquote>`, msg, chatId, myCache, bot, null).catch((err) => {
								console.error(err);
							});
						})
						.catch((err) => {
							console.error(err);
						});

					const { slideshowPath, reading, imagePaths } = await getReading(cardsToDraw);
					const fileOptions = {
						filename: "video.mp4",
						contentType: "video/mp4",
					};

					const lastReading = await getLastTarotReading(msg.from.id, msg.chat.id);
					const lastReadingContext = lastReading
						? `\n\nFor context, their last reading was on ${lastReading.date.toDateString()} with the cards: ${lastReading.cards.join(", ")}. ${lastReading.question ? `They asked: "${lastReading.question}".` : ""} The interpretation was: "${lastReading.interpretation}"`
						: "";

					const llmRequest = `
				Generate a tarot reading for ${[msg.from.first_name, msg.from.last_name].join(" ").trim()} (@${msg.from.username}) based on these cards: ${reading.join(",")}.
				${userQuestion.trim().length > 0 ? `The reading should address this specific question: "${userQuestion}"` : ""}${lastReadingContext}

				Format the response as a conversation between Dasha Nekrasova and Anna Khachiyan from the Red Scare podcast. Include their typical banter, cultural references, and sardonic tone. They should directly address ${msg.from.username ? `@${msg.from.username}` : "the querent"} during the reading.

				If there's a natural opportunity for a clever wordplay or joke related to the querent's name that fits the reading's context, include it, but don't force it.

				The reading should:
				- Interpret each card's meaning in relation to the others
				- Maintain the nihilistic yet insightful tone of the podcast
				- Include references to psychoanalysis, cultural theory, or art when relevant
				- End with some form of conclusion about the querent's situation
				- NOT say that something is very [insert thinkers name] in the tarot cards
				- Write a message as it's gonna be parsed by the telegram HTML parse mode, so no markdown
				You may use only the following HTML tags in your output: <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>, <span class="tg-spoiler">, <tg-spoiler>, <a>, <tg-emoji>, <code>, <pre>, and <blockquote> (including the expandable attribute).
				${lastReading ? "- Reference or acknowledge the previous reading if relevant to the current cards" : ""}
				`;
					const tarotMessage = await bot.sendMessage(msg.chat.id, reading.join("\n") + `\n<blockquote expandable>One sec...</blockquote>`, {
						parse_mode: "HTML",
					});

					const interpretation = sanitizeTelegramHtml(await sendSimpleRequestToDeepSeek(llmRequest));
					await storeTarotReadingInDB(msg.from.id, msg.chat.id, reading, interpretation, userQuestion);
					const interpretationMessageBlocks = createMessageBlocks(interpretation);
					await bot.editMessageText(reading.join("\n") + `\n<blockquote expandable>${interpretationMessageBlocks[0]}</blockquote>`, {
						parse_mode: "HTML",
						message_id: tarotMessage.message_id,
						chat_id: msg.chat.id,
					});
					if (interpretationMessageBlocks.length > 1) {
						for (let i = 1; i < interpretationMessageBlocks.length; i++) {
							await bot.sendMessage(chatId, `\n<blockquote expandable> ${interpretationMessageBlocks[i]}</blockquote>`);
						}
					}
					break;
				case "/auslan":
					const auslanText = text.split(" ").slice(1).join(" ") || msg.reply_to_message?.text || "";
					if (auslanText.trim().length == 0) {
						handleResponse("usage: /auslan <word>", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}
					const mediaUrl = await findAuslanSignVideoLink(auslanText);
					if (mediaUrl) {
						bot.sendVideo(chatId, mediaUrl, { reply_to_message_id: msg.message_id }, { filename: "auslan.mp4", contentType: "video/mp4" });
					}
					break;
				case "/latex":
					const latexInput = text.split(" ").slice(1).join(" ") || msg.reply_to_message?.text || "";
					if (latexInput.trim().length == 0) {
						handleResponse("usage: /latex <latex code>", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}
					const buffer = await renderLatexToPngBuffer(latexInput);
					bot.sendPhoto(chatId, buffer, { reply_to_message_id: msg.message_id }, { filename: "latex.png", contentType: "image/png" });
					break;
				case "/birthdata": {
					const birthDataInput = text.split(" ").slice(1).join(" ") || "";
					if (!birthDataInput.trim().length) {
						handleResponse("usage: /registerBirthData date, time, location (e.g., 1990-01-01 12:00 New York)", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}
					const LLMNormalizedDataInfo = await sendSimpleRequestToDeepSeek(
						`Normalize this birth data into a structured JSON format with fields for date, time, and location: ${birthDataInput}. Example output: {"date": "1990-01-01", "time": "12:00", "location": {"city": "New York", "country": "USA"}}. Make sure to only include the JSON in your response without any additional text. Only use the fields mentioned in the example, and if any information is missing from the input, set that field to null. For location, if you can only extract a city or a country, that's fine, just set the other field to null.`,
					);
					const firstBraceIndex = LLMNormalizedDataInfo.indexOf("{");
					const lastBraceIndex = LLMNormalizedDataInfo.lastIndexOf("}");
					if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
						handleResponse("Failed to parse birth data. Please ensure the input is in the correct format.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}

					const normalizedBirthData = JSON.parse(LLMNormalizedDataInfo.substring(firstBraceIndex, lastBraceIndex + 1));
					const coordinates = await getCoordinates([normalizedBirthData.location.city, normalizedBirthData.location.country].join(", "));
					await db.collection("birthData").updateOne(
						{
							userId: msg.from.id,
							chatId,
						},
						{
							$set: {
								name: [msg.from.first_name, msg.from.last_name, `(@${msg.from.username})`].join(" ").trim(),
								username: msg.from.username,
								...normalizedBirthData,
								...coordinates,
							},
						},
						{
							upsert: true,
						},
					);
					const formattedBirthData = `Date: ${normalizedBirthData.date || "N/A"}\nTime: ${normalizedBirthData.time || "N/A"}\nLocation: ${normalizedBirthData.location.city || ""}${normalizedBirthData.location.city && normalizedBirthData.location.country ? ", " : ""}${normalizedBirthData.location.country || "N/A"}`;
					handleResponse(
						`Birth data registered successfully. Please ensure the following information is correct. \n${formattedBirthData}`,
						msg,
						chatId,
						myCache,
						bot,
						null,
					).catch((err) => {
						console.error(err);
					});
					break;
				}
				case "/registerbirthdata": {
					if (!msg.reply_to_message) {
						handleResponse("Please reply to a user's message with /registerbirthdata to register birth data for them.", msg, chatId, myCache, bot, null).catch(
							(err) => {
								console.error(err);
							},
						);
						return;
					}
					const adminIds = await getAdminsIds(chatId);
					if (![...adminIds, Number(process.env.STICKER_OWNER)].includes(msg.from.id)) {
						handleResponse("Only admins can register birth data for other users.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}
					const targetUser = msg.reply_to_message.from;
					const birthDataInput = text.split(" ").slice(1).join(" ") || "";
					if (!birthDataInput.trim().length) {
						handleResponse("usage: /registerbirthdata date, time, location (e.g., 1990-01-01 12:00 New York)", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}
					const LLMNormalizedDataInfo = await sendSimpleRequestToDeepSeek(
						`Normalize this birth data into a structured JSON format with fields for date, time, and location: ${birthDataInput}. Example output: {"date": "1990-01-01", "time": "12:00", "location": {"city": "New York", "country": "USA"}}. Make sure to only include the JSON in your response without any additional text. Only use the fields mentioned in the example, and if any information is missing from the input, set that field to null. For location, if you can only extract a city or a country, that's fine, just set the other field to null.`,
					);
					const firstBraceIndex = LLMNormalizedDataInfo.indexOf("{");
					const lastBraceIndex = LLMNormalizedDataInfo.lastIndexOf("}");
					if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
						handleResponse("Failed to parse birth data. Please ensure the input is in the correct format.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}

					const normalizedBirthData = JSON.parse(LLMNormalizedDataInfo.substring(firstBraceIndex, lastBraceIndex + 1));
					const coordinates = await getCoordinates([normalizedBirthData.location.city, normalizedBirthData.location.country].join(", "));
					await db.collection("birthData").updateOne(
						{
							userId: targetUser.id,
							chatId,
						},
						{
							$set: {
								name: [targetUser.first_name, targetUser.last_name, `(@${targetUser.username})`].join(" ").trim(),
								username: targetUser.username,
								...normalizedBirthData,
								...coordinates,
							},
						},
						{
							upsert: true,
						},
					);
					const formattedBirthData = `Date: ${normalizedBirthData.date || "N/A"}\nTime: ${normalizedBirthData.time || "N/A"}\nLocation: ${normalizedBirthData.location.city || ""}${normalizedBirthData.location.city && normalizedBirthData.location.country ? ", " : ""}${normalizedBirthData.location.country || "N/A"}`;
					handleResponse(
						`Birth data registered successfully for ${targetUser.first_name}. Please ensure the following information is correct. \n${formattedBirthData}`,
						msg,
						chatId,
						myCache,
						bot,
						null,
					).catch((err) => {
						console.error(err);
					});
					break;
				}
				case "/synastry":
					let subjectsUsernames = msg.text
						.split(" ")
						.slice(1)
						.map((s) => s.replace("@", ""))
						.filter((s) => s.trim().length > 0);
					let repliedToID = msg.reply_to_message?.from?.id;
					if (subjectsUsernames.length == 1) {
						subjectsUsernames = [subjectsUsernames[0], msg.reply_to_message?.from?.username || ""].filter((s) => s.trim().length > 0);
					}
					if (!subjectsUsernames || subjectsUsernames.length < 1) {
						handleResponse(
							"Please provide the usernames of two users to compare their birth data, reply to a message to include the replied user's birth data, or a combination of both. For example: /synastry @user1 @user2 or reply to a user's message with /synastry @otherUser.",
							msg,
							chatId,
							myCache,
							bot,
							null,
						).catch((err) => {
							console.error(err);
						});
						return;
					}
					const getFormattedData = (birthData) => {
						const dateInfo = birthData.date ? new Date(birthData.date) : null;

						const dataInfo = {
							name: birthData.name || "",
							year: dateInfo.getFullYear(),
							month: dateInfo.getMonth() + 1,
							day: dateInfo.getDate(),
							hour: birthData.time ? parseInt(birthData.time.split(":")[0]) : 0,
							minute: birthData.time ? parseInt(birthData.time.split(":")[1]) : 0,
							city: birthData.location?.city || "",
							lat: birthData.lat,
							lng: birthData.lng,
							location: birthData.location,
						};
						return dataInfo;
					};
					const otherBirthData = await db.collection("birthData").findOne({ chatId, username: subjectsUsernames[0] });
					let userBirthData;
					if (subjectsUsernames[1]) {
						userBirthData = await db.collection("birthData").findOne({ chatId, username: subjectsUsernames[1] });
					} else {
						userBirthData = await db.collection("birthData").findOne({ chatId, userId: repliedToID });
					}

					const formattedOtherBirthData = otherBirthData ? getFormattedData(otherBirthData) : null;
					const formattedUserBirthData = userBirthData ? getFormattedData(userBirthData) : null;

					if (!otherBirthData || !userBirthData) {
						const missingUsers = [];
						if (!otherBirthData) {
							missingUsers.push(`@${subjectsUsernames[0]}`);
						}
						if (!userBirthData) {
							missingUsers.push(subjectsUsernames[1] ? `@${subjectsUsernames[1]}` : "the replied user");
						}
						handleResponse(
							`Birth data not found for ${missingUsers.join(" and ")}. make sure both you and the other user have registered their birth data using /birthdata.`,
							msg,
							chatId,
							myCache,
							bot,
							null,
						).catch((err) => {
							console.error(err);
						});
					}
					const image = await generateSynastryChart(formattedUserBirthData, formattedOtherBirthData);
					await bot.sendDocument(
						chatId,
						image,
						{
							reply_to_message_id: msg.message_id,
						},
						{ filename: "synastry_chart.png", contentType: "image/png" },
					);
					break;
				case "/composite":
					let compositeSubjectsUsernames = msg.text
						.split(" ")
						.slice(1)
						.map((s) => s.replace("@", ""))
						.filter((s) => s.trim().length > 0);
					let compositeRepliedToID = msg.reply_to_message?.from?.id;
					if (compositeSubjectsUsernames.length == 1) {
						compositeSubjectsUsernames = [compositeSubjectsUsernames[0], msg.reply_to_message?.from?.username || ""].filter((s) => s.trim().length > 0);
					}
					if (!compositeSubjectsUsernames || compositeSubjectsUsernames.length < 1) {
						handleResponse(
							"Please provide the usernames of two users to calculate their composite chart, reply to a message to include the replied user's birth data, or a combination of both. For example: /composite @user1 @user2 or reply to a user's message with /composite @otherUser.",
							msg,
							chatId,
							myCache,
							bot,
							null,
						).catch((err) => {
							console.error(err);
						});
						return;
					}
					const getCompositeFormattedData = (birthData) => {
						const dateInfo = birthData.date ? new Date(birthData.date) : null;

						const dataInfo = {
							name: birthData.name || "",
							year: dateInfo.getFullYear(),
							month: dateInfo.getMonth() + 1,
							day: dateInfo.getDate(),
							hour: birthData.time ? parseInt(birthData.time.split(":")[0]) : 0,
							minute: birthData.time ? parseInt(birthData.time.split(":")[1]) : 0,
							city: birthData.location?.city || "",
							lat: birthData.lat,
							lng: birthData.lng,
							location: birthData.location,
						};
						return dataInfo;
					};
					const compositeOtherBirthData = await db.collection("birthData").findOne({ chatId, username: compositeSubjectsUsernames[0] });
					let compositeUserBirthData;
					if (compositeSubjectsUsernames[1]) {
						compositeUserBirthData = await db.collection("birthData").findOne({ chatId, username: compositeSubjectsUsernames[1] });
					} else {
						compositeUserBirthData = await db.collection("birthData").findOne({ chatId, userId: compositeRepliedToID });
					}

					const compositeFormattedOtherBirthData = compositeOtherBirthData ? getCompositeFormattedData(compositeOtherBirthData) : null;
					const compositeFormattedUserBirthData = compositeUserBirthData ? getCompositeFormattedData(compositeUserBirthData) : null;

					if (!compositeOtherBirthData || !compositeUserBirthData) {
						const missingUsers = [];
						if (!compositeOtherBirthData) {
							missingUsers.push(`@${compositeSubjectsUsernames[0]}`);
						}
						if (!compositeUserBirthData) {
							missingUsers.push(compositeSubjectsUsernames[1] ? `@${compositeSubjectsUsernames[1]}` : "the replied user");
						}
						handleResponse(`Birth data not found for ${missingUsers.join(" and ")}.`, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					}
					const compositeImage = await generateCompositeChart(compositeFormattedUserBirthData, compositeFormattedOtherBirthData);
					await bot.sendDocument(
						chatId,
						compositeImage,
						{
							reply_to_message_id: msg.message_id,
						},
						{ filename: "composite_chart.png", contentType: "image/png" },
					);
					break;
				case "/natalifconceivechildnow": {
					const locationInput = text.split(" ").slice(1).join(" ").trim();
					if (!locationInput) {
						handleResponse("Usage: /natalifconceivechildnow [location] (e.g., /natalifconceivechildnow New York)", msg, chatId, myCache, bot, null).catch(
							(err) => {
								console.error(err);
							},
						);
						break;
					}

					try {
						const coordinates = await getCoordinates(locationInput);
						const timezone = find(coordinates.lat, coordinates.lng)[0];
						if (!timezone) {
							throw new Error("Could not determine timezone for location");
						}
						const now = DateTime.now().setZone(timezone);
						if (!now.isValid) {
							throw new Error(`Invalid datetime: ${now.invalidExplanation}`);
						}
						const futureDate = now.plus({ weeks: 40 });
						const dataInfo = {
							name: "Future child (born 40 weeks from now)",
							year: futureDate.year,
							month: futureDate.month,
							day: futureDate.day,
							hour: futureDate.hour,
							minute: futureDate.minute,
							lat: coordinates.lat,
							lng: coordinates.lng,
							location: {
								city: locationInput.split(",")[0].trim(),
								country: null,
							},
						};
						const { buffer: chart, url } = await getAstroloseekChart(dataInfo);
						await bot.sendPhoto(chatId, chart, {
							reply_to_message_id: msg.message_id,
							caption: `<a href="${url}">Astroseek link</a>`,
							parse_mode: "HTML",
						});
					} catch (error) {
						console.error("Error generating natal chart for future child:", error);
					}
					break;
				}
				case "/natalifbornnow": {
					const locationInput = text.split(" ").slice(1).join(" ").trim();
					if (!locationInput) {
						handleResponse("Usage: /natalifbornnow [location] (e.g., /natalifbornnow New York)", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						break;
					}

					try {
						const coordinates = await getCoordinates(locationInput);
						const timezone = find(coordinates.lat, coordinates.lng)[0];
						if (!timezone) {
							throw new Error("Could not determine timezone for location");
						}
						const now = DateTime.now().setZone(timezone);
						if (!now.isValid) {
							throw new Error(`Invalid datetime: ${now.invalidExplanation}`);
						}
						const dataInfo = {
							name: "Someone (now)",
							year: now.year,
							month: now.month,
							day: now.day,
							hour: now.hour,
							minute: now.minute,
							lat: coordinates.lat,
							lng: coordinates.lng,
							location: {
								city: locationInput.split(",")[0].trim(),
								country: null,
							},
						};
						const { buffer: chart, url } = await getAstroloseekChart(dataInfo, null);
						await bot.sendPhoto(chatId, chart, {
							reply_to_message_id: msg.message_id,
							caption: `<a href="${url}">Astroseek link</a>`,
							parse_mode: "HTML",
						});
					} catch (error) {
						console.error("Error generating natal chart for now:", error);
					}
					break;
				}
				case "/natalfor": {
					let birthDataInfoRawText = text.split(" ").slice(1).join(" ");
					const parsedDataInfo = await sendSimpleRequestToDeepSeek(
						`Parse this birth data into a structured JSON format with fields for date, time, and location: ${birthDataInfoRawText} including the name of the person who it's for otherwize call him anonymous. Example output: {"name": "John Doe", "year": "1990", "month": "01", "day": "01", "hour": "12", "minute": "00", "location": {"city": "New York", "country": "USA"}}. Make sure to only include the JSON in your response without any additional text. Only use the fields mentioned in the example, and if any information is missing from the input, set that field to null. For location, if you can only extract a city or a country, that's fine, just set the other field to null.`,
					);
					const firstBraceIndexNatal = parsedDataInfo.indexOf("{");
					const lastBraceIndexNatal = parsedDataInfo.lastIndexOf("}");
					if (firstBraceIndexNatal === -1 || lastBraceIndexNatal === -1 || lastBraceIndexNatal <= firstBraceIndexNatal) {
						handleResponse("Failed to parse birth data. Please ensure the input is in the correct format.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}

					const normalizedBirthDataInfo = JSON.parse(parsedDataInfo.substring(firstBraceIndexNatal, lastBraceIndexNatal + 1));
					const coordinatesInfo = await getCoordinates(normalizedBirthDataInfo.location.city);
					const completeBirthDataInfo = {
						...normalizedBirthDataInfo,
						...coordinatesInfo,
					};
					const { buffer: chart, url } = await getAstroloseekChart(completeBirthDataInfo);
					await bot.sendPhoto(chatId, chart, {
						reply_to_message_id: msg.message_id,
						caption: `<a href="${url}">Astroseek link</a>`,
						parse_mode: "HTML",
					});
					break;
				}
				case "/natal":
					let languageCode = null;
					const birthData = await db.collection("birthData").findOne({
						chatId,
						$or: [{ userId: msg.reply_to_message?.from?.id || msg?.from?.id }],
					});

					if (!birthData) {
						handleResponse("No birth data found. add your birth data first using /birthdata.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						return;
					}
					const dateInfo = birthData.date ? new Date(birthData.date) : null;
					const dataInfo = {
						name: birthData.name || "",
						year: dateInfo.getFullYear(),
						month: dateInfo.getMonth() + 1,
						day: dateInfo.getDate(),
						hour: birthData.time ? parseInt(birthData.time.split(":")[0]) : 0,
						minute: birthData.time ? parseInt(birthData.time.split(":")[1]) : 0,
						city: birthData.location?.city || "",
						lat: birthData.lat,
						lng: birthData.lng,
						location: birthData.location,
					};

					const { buffer: chart, url } = await getAstroloseekChart(dataInfo, languageCode);
					if (chart) {
						await bot.sendPhoto(chatId, chart, {
							reply_to_message_id: msg.message_id,
							caption: `<a href="${url}">Astroseek link</a>`,
							parse_mode: "HTML",
						});
					} else {
						await bot.sendMessage(chatId, `<a href=${url}>Astroseek Link</a>`, { reply_to_message_id: msg.message_id, parse_mode: "HTML" });
					}
					break;
				case "/solarreturn":
					let solarUsername = msg.reply_to_message?.from?.username || "";
					solarUsername = (solarUsername || msg.from.username).replace("@", "");
					const birthDataForSolar = await db.collection("birthData").findOne({
						chatId,
						$or: [{ username: solarUsername }, { userId: msg.reply_to_message?.from?.id }],
					});
					if (!birthDataForSolar) {
						handleResponse("No birth data found. add your birth data first using /birthdata.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						break;
					}
					const dateInfoForSolar = birthDataForSolar.date ? new Date(birthDataForSolar.date) : null;
					const dataInfoForSolar = {
						name: birthDataForSolar.name || "",
						year: dateInfoForSolar.getFullYear(),
						month: dateInfoForSolar.getMonth() + 1,
						day: dateInfoForSolar.getDate(),
						hour: birthDataForSolar.time ? parseInt(birthDataForSolar.time.split(":")[0]) : 0,
						minute: birthDataForSolar.time ? parseInt(birthDataForSolar.time.split(":")[1]) : 0,
						city: birthDataForSolar.location?.city || "",
						lat: birthDataForSolar.lat,
						lng: birthDataForSolar.lng,
						location: birthDataForSolar.location,
						birthday: dateInfoForSolar,
					};
					const today = new Date();
					const birthdayThisYear = new Date(today.getFullYear(), dateInfoForSolar.getMonth(), dateInfoForSolar.getDate());
					if (today > birthdayThisYear) {
						solarYear = today.getFullYear();
					} else {
						solarYear = today.getFullYear() - 1;
					}
					const solarChart = await getSolarReturnChart(dataInfoForSolar, solarYear);
					await bot.sendDocument(
						chatId,
						solarChart,
						{
							reply_to_message_id: msg.message_id,
						},
						{ filename: `solar_return_chart_${solarYear}_${solarUsername}` },
					);
					break;
				case "/etymology":
				case "/dictionary":
					let searchQuery = text.split(" ").slice(1).join(" ").split("|")[0].trim().toLowerCase();
					let languageQuery = text.split("|").slice(1).join(" ").trim();
					if (languageQuery.length == 0) {
						languageQuery = null;
					}
					const { word, audioUrls, langCode } = await lookupWord(dictionaryCollection, searchQuery, languageQuery);
					if (!word) {
						handleResponse(`Word not found (language ${langCode})`, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						break;
					}
					/* if (audioUrls && audioUrls.length > 0) {
						bot
							.sendMediaGroup(
								chatId,
								audioUrls.map((url) => ({ type: "audio", media: url })),
								{ reply_to_message_id: msg.message_id },
							)
							.catch((err) => {
								console.error(err);
							});
					} */
					if (audioUrls && audioUrls.length > 0) {
						await bot.sendVoice(chatId, audioUrls[0], {
							reply_to_message_id: msg.message_id,
						});
					}
					const messageBlocks = createMessageBlocks(word, 4000);
					for (const block of messageBlocks) {
						await bot.sendMessage(chatId, `<blockquote expandable>${block}</blockquote>`, { parse_mode: "HTML", reply_to_message_id: msg.message_id });
					}
					break;
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
		await bot.sendChatAction(chatId, "typing");

		const previousResponse = myCache.get(`message-${chatId}-${msg.message_id}`);
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
		myCache.set(`message-${chatId}-${messageId}`, responseMessage.message_id, 10000);
		return responseMessage;
	} catch (err) {
		console.error(err);
	}
}

async function translateShell(string, languagePart) {
	try {
		let source = "auto";
		let target = "en";
		if (!string) return "";
		if (languagePart) {
			if (languagePart.includes(":")) {
				const parts = languagePart.split(":");
				source = parts[0] || "auto";
				target = parts[1] || "en";
			} else {
				target = languagePart;
			}
		}

		const escapedString = string.replace(/"/g, '\\"').replace(/`/g, "\\`").replace(/\$/g, "\\$");
		const { stdout } = await execAsync(`trans -b -s "${source}" -t "${target}" "${escapedString}"`);
		return stdout;
	} catch (error) {
		console.error(`Translate-shell error: ${error}`);
		throw error;
	}
}

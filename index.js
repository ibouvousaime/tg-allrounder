const Tgfancy = require("tgfancy");

require("dotenv").config();
const { exec } = require("child_process");
const NodeCache = require("node-cache");
var weather = require("weather-js");
const { error } = require("console");
const { removeImageBackground, generateUnsplashImage, doOCR, generateWordCloud, resizeImageBuffer, isEmojiString } = require("./utils/image");
const { sendSimpleRequestToClaude } = require("./utils/ai");
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
const { Convert } = require("easy-currencies");
const { extractAndConvertToCm } = require("./utils/converter");
const { eyeWords, reactToTelegramMessage, bannedWords, nerdwords, sendPoll } = require("./utils/reactions");
const { getRandomOracleMessageObj, getContext, explainContextClaude } = require("./utils/oracle");
const { generateEmbedding, findSimilarMessages, countSenders } = require("./utils/search");
const { extractTweetId, extractTweet, getInstagramVideoLink } = require("./utils/bird");
const { getAndSendRandomQuestion } = require("./utils/trivia");
const { sendRandomQuizz } = require("./utils/quizz");
const { getPollResults } = require("./utils/telegram_polls");
const { getReading } = require("./utils/tarot");
const { MaxPool3DGrad } = require("@tensorflow/tfjs");

const myCache = new NodeCache();
bot.on("edited_message", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text || "";
	collection.updateOne({ chatId: chatId, messageId: msg.message_id }, { $set: { text: msg.text } });
	handleMessages({ chatId, msg, text, messageID: msg.message_id });
});
function containsWord(str, word) {
	const regex = new RegExp(`\\b${word}\\b`, "i");
	return regex.test(str);
}
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

/* setInterval(() => {
	bot.getUpdates({ allowed_updates: ["poll", "poll_answer"] }).then((updates) => {
		console.log("poll updates", updates);
	});
}, 3000); */

bot.on("poll", async (msg) => {
	console.log(msg);
});

bot.on("text", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text;
	const tweetId = extractTweetId(msg.text);
	if (tweetId) {
		if (msg.link_preview_options?.is_disabled) {
			const tweetData = await extractTweet(msg.text);
			console.log(tweetData);
			if (tweetData) {
				const tweetText = `<blockquote expandable>${tweetData?.fullText} \nTweet by ${tweetData?.tweetBy?.fullName || ""} (@${tweetData?.tweetBy?.userName}) on ${tweetData?.createdAt || ""} </blockquote>`;
				if (tweetData.media?.length == 1) {
					tweetData.media?.forEach((media) => {
						if (media.type == "VIDEO") {
							bot.sendVideo(chatId, media.url, {
								caption: tweetText,
								parse_mode: "HTML",
							});
						} else if (media.type == "PHOTO") {
							bot.sendPhoto(chatId, media.url, {
								caption: tweetText,
								parse_mode: "HTML",
							});
						}
					});
				}
				if (tweetData.media?.length > 1 && tweetData.media?.length <= 10) {
					const mediaData = tweetData.media
						.filter((media) => media.type == "PHOTO" || media.type == "PHOTO")
						.map((media) => {
							return { type: media.type.toLowerCase(), media: media.url };
						});
					bot.sendMediaGroup(chatId, mediaData);
					bot.sendMessage(chatId, tweetText, { parse_mode: "HTML" });
				}
				if (!tweetData.media?.length) {
					bot.sendMessage(chatId, tweetText, { parse_mode: "HTML" });
				}
			}
		}
	}
	if (msg.chat.type == "group" || msg.chat.type == "supergroup") {
		const triggerWords = process.env.TRIGGER_WORDS?.split(" ") || [];
		if (triggerWords.some((word) => text.toLowerCase().includes(word.toLowerCase()))) {
			await bot.sendMessage(process.env.LogChat, `https://t.me/c/${msg.chat.id.toString().slice(4)}/${msg.message_id}`);
			await bot.forwardMessage(process.env.LogChat, chatId, msg.message_id);
		}
	}

	const sender = msg.from;
	const newMessage = {
		chatId: chatId,
		messageId: msg.message_id,
		text: msg.text,
		date: msg.date,
		sender: [msg.from.first_name, msg.from.last_name].join(" "),
	};
	if (msg.text && !msg.text?.trim()?.startsWith("/")) {
		newMessage.date = new Date(newMessage.date * 1000);
		collection.insertOne({ ...newMessage }).catch((err) => {
			console.error(err);
		});
	}
	if (text.trim()[0] != "/") return;
	handleMessages({ chatId, text, msg, sender });
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
				const message = `Welcome! 🤖

Here are the commands you can use:

/weather - Get current weather information. Simply type <code>/weather [city name]</code> to get the latest weather update for your location.

/trans - Translate text to different languages. Use <code>/trans :[language code] [text]</code> to get your translation. Example: <code>/trans :es Hello</code> to translate "Hello" to Spanish.

/unsplash - Generate a quote image. Reply to a message with <code>/unsplash</code> to create a beautiful image with the quoted text.

/coinflip - Flip a coin. Use <code>/coinflip</code> to flip a virtual coin and get heads or tails.


/ocr - Perform Optical Character Recognition (OCR). Reply to an image with <code>/ocr</code> to extract text from the image.

/wordcloud - Generate a word cloud image from the last 100 messages. Use <code>/wordcloud</code> to create a word cloud from recent text.

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
							handleResponse(Number(response).toFixed(2).toString(), msg, chatId, myCache, bot, null).catch((err) => {
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
				let language = text.split(" ")[1]?.trim();
				if (msg.reply_to_message && msg.reply_to_message.photo) {
					const photoArray = msg.reply_to_message.photo;
					const highestQualityPhoto = photoArray[photoArray.length - 1];
					bot.getFile(highestQualityPhoto.file_id).then(async (file) => {
						const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
						const response = await fetch(fileUrl);
						const imageData = await response.arrayBuffer();
						const output = await doOCR(language, Buffer.from(imageData));
						const responseLLM = await sendSimpleRequestToClaude(
							`${output}
              Fix the output from that OCR output and return just the text that feels unimportant (like from a UI). Write an English tldr after`
						);
						const LLMTextOutput = responseLLM.content[0].text;
						handleResponse(
							`<blockquote expandable> ${LLMTextOutput.replace(/&/g, "&amp;")
								.replace(/</g, "&lt;")
								.replace(/>/g, "&gt;")
								.replace(/"/g, "&quot;")
								.replace(/'/g, "&#39;")}</blockquote>`,
							msg,
							chatId,
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
						handleResponse(weatherData, msg, chatId, myCache, bot, "pre")
							/* .then((message) => {
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
				const chatID = chatId.toString().slice(4);

				if (msg.reply_to_message?.sticker) {
					if (!msg.reply_to_message?.sticker?.set_name.includes(chatID) && msg.chat.type != "private") {
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
				if (msg.reply_to_message && (msg.reply_to_message.photo || msg.reply_to_message.sticker)) {
					const emojis = msg.text.split(" ").slice(1).join(" ").replace(/\s+/g, "");
					if (!isEmojiString(emojis) && emojis.trim().length == 0) {
						handleResponse("Correct usage: /addsticker <emojis>. Example : /addsticker 💧🍉.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						break;
					}
					const photoArray = msg.reply_to_message.photo;
					const highestQualityPhoto = photoArray ? photoArray[photoArray.length - 1] : msg.reply_to_message.sticker;
					bot.getFile(highestQualityPhoto.file_id).then(async (file) => {
						const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
						const chatId = msg.chat.id;
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
				const arguments = msg.text.split(" ").slice(1).join(" ").split(":");
				if (arguments.length != 2) {
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
					const word = arguments[0];
					const definition = arguments[1];
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
		}
	} catch (err) {
		console.error(err);
	}
}

function extractUrl(text) {
	if (!text) return null;
	const urlRegex = /(\bhttps?:\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
	const urls = text.match(urlRegex);
	return urls ? urls[0] : null;
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
	resultLines.push(`Location: ${item.location.name}`);
	resultLines.push(`Current Temperature: ${item.current.temperature}°${item.location.degreetype}`);
	resultLines.push(`Humidity: ${item.current.humidity}%`);
	if (item.current.feelslike) resultLines.push(`Feels Like: ${item.current.feelslike}°${item.location.degreetype}`);
	resultLines.push(`Conditions: ${item.current.skytext}`);
	resultLines.push(`Observation Time: ${item.current.observationtime} on ${item.current.date}`);
	resultLines.push(`Wind: ${item.current.winddisplay}`);
	resultLines.push(`High: ${item.forecast[0].high}°${item.location.degreetype}`);
	resultLines.push(`Low: ${item.forecast[0].low}°${item.location.degreetype}`);
	if (item.current.dewPt) resultLines.push(`Dew point: ${item.current.dewPt}°${item.location.degreetype}`); /* 	resultLines.push("Forecast:");
	item.forecast.forEach((day) => {
		resultLines.push(`  ${day.day} (${day.date}): ${day.skytextday}, ${day.low}°-${day.high}°`);
		if (day.precip) {
			resultLines.push(`    Chance of precipitation: ${day.precip}%`);
		}
	}); */
	return resultLines.join("\n");
}

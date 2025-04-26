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
			const admins = await bot.getChatAdministrators(chatId);
			const adminIDs = admins.map((admin) => admin.user.id);
			resolve(adminIDs);
		} catch (err) {
			console.error(err);
			reject();
		}
	});
}

bot.on("text", async (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text;
	const tweetId = extractTweetId(msg.text);
	/* 	getInstagramVideoLink(msg.text)
		.then((instagramLinks) => {
			instagramLinks.forEach((link) => {
				bot.sendVideo(chatId, link.download_link);
			});
		})
		.catch((err) => {
			console.error(err);
		}); */
	if (tweetId) {
		if (msg.link_preview_options?.is_disabled) {
			const tweetData = await extractTweet(msg.text);
			const tweetText = `${tweetData.fullText} \nTweet by ${tweetData?.tweetBy?.fullName} (@${tweetData?.tweetBy?.userName}) on ${tweetData.createdAt}`;
			if (tweetData.media?.length == 1) {
				tweetData.media?.forEach((media) => {
					if (media.type == "video") {
						bot.sendVideo(chatId, media.url, { caption: tweetText });
					} else if (media.type == "photo") {
						bot.sendPhoto(chatId, media.url, { caption: tweetText });
					}
				});
			}
			if (tweetData.media?.length > 1 && tweetData.media?.length <= 10) {
				const mediaData = tweetData.media
					.filter((media) => media.type == "photo" || media.type == "video")
					.map((media) => {
						return { type: media.type, media: media.url };
					});
				bot.sendMediaGroup(chatId, mediaData);
				bot.sendMessage(chatId, tweetText);
			}
			if (!tweetData.media?.length) {
				bot.sendMessage(chatId, tweetText);
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
	/* if (text.toLowerCase().includes("Ibou")) {
		bot.forwardMessage()
	} */
	const sender = msg.from;
	const newMessage = {
		chatId: chatId,
		messageId: msg.message_id,
		text: msg.text,
		date: msg.date,
		sender: [msg.from.first_name, msg.from.last_name].join(" "),
	};
	/* 	const measurement = extractAndConvertToCm("something " + msg.text.split(" ").slice(1).join(" "));
	if (measurement) {
		bot.sendMessage(msg.chat.id, `${measurement} cm*`);
	}
	if (eyeWords.some((word) => containsWord(msg.text.toLowerCase(), word))) {
		reactToTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, "👀", chatId, msg.message_id);
	} else if (bannedWords.some((word) => containsWord(msg.text.toLowerCase(), word)) || measurement) {
		reactToTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, "🤬", chatId, msg.message_id);
	} else if (nerdwords.some((word) => containsWord(msg.text.toLowerCase(), word))) {
		reactToTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, "🤓", chatId, msg.message_id);
	} */
	let embeddings = undefined;
	if (msg.text && !msg.text?.trim()?.startsWith("/")) {
		/* if (!msg.text?.startsWith("/")) {
			model
				.embed([msg.text])
				.then((embeddings) => {
					collection.insertOne({ ...newMessage, embeddings: embeddings?.arraySync()[0] });
				})
				.catch((err) => {
					console.log(err)
					collection.insertOne({ ...newMessage });
				});
		} else { */
		collection.insertOne({ ...newMessage }).catch((err) => {
			console.error(err);
		});
		/* } */
	}
	if (text.trim()[0] != "/") return;
	handleMessages({ chatId, text, msg, sender });
});
function getRandomElement(arr) {
	const randomIndex = Math.floor(Math.random() * arr.length);
	return arr[randomIndex];
}
async function handleMessages({ chatId, msg, text, sender }) {
	try {
		switch (text.split(" ")[0].split("@")[0]) {
			case "/start":
				bot.sendMessage(chatId, "hi");
				break;
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
					handleResponse("Missing input currency. Example command : /cc 25000 AED to USD.", msg, chatId, myCache, bot, null).catch((err) => {
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
							handleResponse(Math.round(response).toString(), msg, chatId, myCache, bot, null).catch((err) => {
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
						handleResponse(
							output.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"),
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
						from: { first_name: msg.reply_to_message?.forward_origin?.sender_user_name || msg.reply_to_message?.forward_origin?.sender_user?.first_name },
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
						await bot.deleteMessage(chatId, msg.message_id);
						await bot.deleteMessage(chatId, msg.reply_to_message?.message_id);
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
						handleResponse(weatherData, msg, chatId, myCache, bot, "pre").catch((err) => {
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
						handleResponse(weatherData, msg, chatId, myCache, bot, "pre").catch((err) => {
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
				sendPoll(msg.chat.id, `Invite ${invite} to the chat?`, [{ text: "Yes" }, { text: "No" }], true);
				break;
			case "/voteban":
				const victim = text.split(" ").slice(1).join(" ");
				sendPoll(msg.chat.id, `Ban ${victim}?`, [{ text: "Yes" }, { text: "No" }], false);
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
			case "/removebg":
			case "/rmbg":
			case "/deletesticker":
				if (!(await getAdminsIds(chatId)).includes(msg.from.id)) {
					bot.sendMessage("no, ur not my dad");
				}
				if (msg.reply_to_message?.sticker) {
					bot.deleteStickerFromSet(msg.reply_to_message?.sticker?.file_id).then(() => {
						bot.sendMessage(chatId, "Sticker deleted");
					});
				}
			case "/createsticker":
			case "/addsticker":
				if (msg.reply_to_message && msg.reply_to_message.photo) {
					const emojis = msg.text.split(" ").slice(1).join(" ").replace(/\s+/g, "");
					if (!isEmojiString(emojis) && emojis.trim().length == 0) {
						handleResponse("Correct usage: /addsticker <emojis>. Example : /addsticker 💧🍉.", msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
						break;
					}
					const photoArray = msg.reply_to_message.photo;
					const highestQualityPhoto = photoArray[photoArray.length - 1];
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
								handleResponse("Done", msg, chatId, myCache, bot, null).catch((err) => {
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
					handleResponse(response.content[0].text, msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
				});
				break;
			case "/oracle":
				let target = text.split(" ").slice(1).join(" ");

				explainContextClaude(db.collection("books"), `${target?.length > 0 ? target : "@" + msg.from.username}`)
					.then((context) => {
						handleResponse(context, msg, chatId, myCache, bot, null).catch((err) => {
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
					const document = { word, definition, author: msg.from.id, chatId, id: elementId };

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
			/*case "/count":
			 if (msg.from.id == 189835675) {
				bot.deleteMessage(chatId, msg.message_id);
				break;
			} 
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
						handleResponse(textOutput, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					})
					.catch((err) => {
						consol.error(err);
					});
				break;*/
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
							request = `Give a very short answer to this question ${msgQuestion}. Here's the article to repond to the question: ${cleanedContent}\n ${telegramHTMLPrompt}`;
						}
						const summary = await sendSimpleRequestToClaude(request);
						handleResponse(summary.content[0].text, msg, chatId, myCache, bot, null).catch((err) => {
							console.error(err);
						});
					} catch (err) {
						console.error(err);
					}
				});
				break;
			case "/quizz":
				try {
					const lastUsedKey = `lastUsed-${chatId}`;
					const lastUsed = myCache.get(lastUsedKey);
					const cooldown = 20000;
					if (lastUsed && new Date() - new Date(lastUsed) < cooldown) {
						const timeLeft = Math.ceil((cooldown - (new Date() - new Date(lastUsed))) / 1000);
						handleResponse(`Patience, you can ask for a new quiz in ${timeLeft} seconds.`, msg, chatId, myCache, bot, null)
							.then((resp) => {
								setTimeout(() => {
									bot.deleteMessage(chatId, msg.message_id);
									bot.deleteMessage(chatId, resp.message_id);
								}, 2000);
							})
							.catch((err) => {
								console.error(err);
							});
						return;
					}
					const quizzCollection = db.collection("trivia");
					await sendRandomQuizz(quizzCollection, msg.chat.id);
					myCache.set(lastUsedKey, new Date().toISOString());
				} catch (err) {
					console.error(err);
				}
				break;
			case "/trivia":
				const lastUsedKey = `lastUsed-${chatId}`;
				const lastUsed = myCache.get(lastUsedKey);
				const cooldown = 20000;
				if (lastUsed && new Date() - new Date(lastUsed) < cooldown) {
					const timeLeft = Math.ceil((cooldown - (new Date() - new Date(lastUsed))) / 1000);
					handleResponse(`Patience, you can ask for a new question in ${timeLeft} seconds.`, msg, chatId, myCache, bot, null)
						.then((resp) => {
							setTimeout(() => {
								bot.deleteMessage(chatId, msg.message_id);
								bot.deleteMessage(chatId, resp.message_id);
							}, 2000);
						})
						.catch((err) => {
							console.error(err);
						});
					return;
				}

				let category = msg.text.split(" ")[1];
				if (!category || category?.length == 0) {
					category = "general";
				}
				try {
					await getAndSendRandomQuestion(category, chatId, "hard");
					const lastUsedKey = `lastUsed-${chatId}`;
					myCache.set(lastUsedKey, new Date().toISOString());
				} catch (err) {
					console.error(err);
					handleResponse("Rate limit reached. If this happens too often, I will switch to a different API.", msg, chatId, myCache, bot, null).catch((err) => {
						console.error(err);
					});
				}
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
	if (item.current.dewPt) resultLines.push(`Dew point: ${item.current.dewPt}°${item.location.degreetype}`); /* 	resultLines.push("Forecast:");
	item.forecast.forEach((day) => {
		resultLines.push(`  ${day.day} (${day.date}): ${day.skytextday}, ${day.low}°-${day.high}°`);
		if (day.precip) {
			resultLines.push(`    Chance of precipitation: ${day.precip}%`);
		}
	}); */
	return resultLines.join("\n");
}

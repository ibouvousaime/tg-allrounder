const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const puppeteer = require("puppeteer");
const { getUnsplashView } = require("../unsplashview");
const { createWorker } = require("tesseract.js");
const LanguageDetect = require("languagedetect");
const natural = require("natural");
const { sendSimpleRequestToClaude } = require("./ai");
const { getWorldCloudPage, getWordCloudPage, functionWords } = require("./wordcloud");
const TfIdf = natural.TfIdf;
const sharp = require("sharp");

const darkNatureSearchTerms = [
	"forest+moonlight",
	"mountain+night",
	"river+twilight",
	"flower+starry+sky",
	"ocean+moon",
	"lake+night",
	"snow+night",
	"cave+dark",
	"volcano+night",
	"jungle+night",
];

const supportedLanguages = [
	"afr",
	"amh",
	"ara",
	"asm",
	"aze",
	"aze_cyrl",
	"bel",
	"ben",
	"bod",
	"bos",
	"bul",
	"cat",
	"ceb",
	"ces",
	"chi_sim",
	"chi_tra",
	"chr",
	"cym",
	"dan",
	"deu",
	"dzo",
	"ell",
	"eng",
	"enm",
	"epo",
	"est",
	"eus",
	"fas",
	"fin",
	"fra",
	"frk",
	"frm",
	"gle",
	"glg",
	"grc",
	"guj",
	"hat",
	"heb",
	"hin",
	"hrv",
	"hun",
	"iku",
	"ind",
	"isl",
	"ita",
	"ita_old",
	"jav",
	"jpn",
	"kan",
	"kat",
	"kat_old",
	"kaz",
	"khm",
	"kir",
	"kor",
	"kur",
	"lao",
	"lat",
	"lav",
	"lit",
	"mal",
	"mar",
	"mkd",
	"mlt",
	"msa",
	"mya",
	"nep",
	"nld",
	"nor",
	"ori",
	"pan",
	"pol",
	"por",
	"pus",
	"ron",
	"rus",
	"san",
	"sin",
	"slk",
	"slv",
	"spa",
	"spa_old",
	"sqi",
	"srp",
	"srp_latn",
	"swa",
	"swe",
	"syr",
	"tam",
	"tel",
	"tgk",
	"tgl",
	"tha",
	"tir",
	"tur",
	"uig",
	"ukr",
	"urd",
	"uzb",
	"uzb_cyrl",
	"vie",
	"yid",
];

const supportedLanguageNames = [
	"Afrikaans",
	"Amharic",
	"Arabic",
	"Assamese",
	"Azerbaijani",
	"Azerbaijani - Cyrillic",
	"Belarusian",
	"Bengali",
	"Tibetan",
	"Bosnian",
	"Bulgarian",
	"Catalan; Valencian",
	"Cebuano",
	"Czech",
	"Chinese - Simplified",
	"Chinese - Traditional",
	"Cherokee",
	"Welsh",
	"Danish",
	"German",
	"Dzongkha",
	"Greek, Modern (1453-)",
	"English",
	"English, Middle (1100-1500)",
	"Esperanto",
	"Estonian",
	"Basque",
	"Persian",
	"Finnish",
	"French",
	"German Fraktur",
	"French, Middle (ca. 1400-1600)",
	"Irish",
	"Galician",
	"Greek, Ancient (-1453)",
	"Gujarati",
	"Haitian; Haitian Creole",
	"Hebrew",
	"Hindi",
	"Croatian",
	"Hungarian",
	"Inuktitut",
	"Indonesian",
	"Icelandic",
	"Italian",
	"Italian - Old",
	"Javanese",
	"Japanese",
	"Kannada",
	"Georgian",
	"Georgian - Old",
	"Kazakh",
	"Central Khmer",
	"Kirghiz; Kyrgyz",
	"Korean",
	"Kurdish",
	"Lao",
	"Latin",
	"Latvian",
	"Lithuanian",
	"Malayalam",
	"Marathi",
	"Macedonian",
	"Maltese",
	"Malay",
	"Burmese",
	"Nepali",
	"Dutch; Flemish",
	"Norwegian",
	"Oriya",
	"Panjabi; Punjabi",
	"Polish",
	"Portuguese",
	"Pushto; Pashto",
	"Romanian; Moldavian; Moldovan",
	"Russian",
	"Sanskrit",
	"Sinhala; Sinhalese",
	"Slovak",
	"Slovenian",
	"Spanish; Castilian",
	"Spanish; Castilian - Old",
	"Albanian",
	"Serbian",
	"Serbian - Latin",
	"Swahili",
	"Swedish",
	"Syriac",
	"Tamil",
	"Telugu",
	"Tajik",
	"Tagalog",
	"Thai",
	"Tigrinya",
	"Turkish",
	"Uighur; Uyghur",
	"Ukrainian",
	"Urdu",
	"Uzbek",
	"Uzbek - Cyrillic",
	"Vietnamese",
	"Yiddish",
];

function getSenderInfo(sender) {
	return `${sender.first_name} ${sender.last_name ? sender.last_name : ""} (@${sender.username || "anonymous"})`;
}

///
//
//
//
function getMostImportantWord(sentence) {
	const tfidf = new TfIdf();
	tfidf.addDocument(sentence);
	const words = new Set(sentence.toLowerCase().match(/\b\w+\b/g));
	let maxScore = 0;
	let mostImportantWord = "";
	words.forEach((word) => {
		const score = tfidf.tfidf(word, 0);
		if (score > maxScore) {
			maxScore = score;
			mostImportantWord = word;
		}
	});
	return mostImportantWord;
}

function getTopNImportantWords(sentence, n = 100) {
	const tfidf = new TfIdf();
	tfidf.addDocument(sentence);

	const words = new Set(sentence.toLowerCase().match(/\b\w+\b/g));
	const wordScores = [];

	words.forEach((word) => {
		if (!functionWords.has(word) && word.length >= 3) {
			const score = tfidf.tfidf(word, 0);
			wordScores.push({ word, score });
		}
	});

	wordScores.sort((a, b) => b.score - a.score);
	const topNWords = wordScores.slice(0, n).map((item) => {
		return { text: item.word, size: item.score };
	});

	return topNWords;
}

/* async function getMostImportantWord(sentence) {
	const mostImportantWord = (await sendSimpleRequestToClaude(`Provide a 2-word search query for an image to describe: "${sentence}".`)).content[0].text
		.split(" ")
		.join("+");
	console.log(mostImportantWord);
	return mostImportantWord;
} */

function removeImageBackground(buffer) {
	return new Promise((resolve, reject) => {
		try {
			const filename = (Math.random() + 1).toString(36);
			const fullPath = path.join("tmp", filename);
			fs.writeFileSync(fullPath, buffer);
			exec(`rembg i ${fullPath} ${fullPath}-done`, (err, stdout, stderr) => {
				if (err) {
					console.error(err, stderr);
					reject();
				}
				const output = fs.readFileSync(`${fullPath}-done`, buffer);
				setTimeout(() => {
					fs.unlinkSync(fullPath);
					fs.unlinkSync(`${fullPath}-done`);
				}, 2000);
				resolve(output);
			});
		} catch (err) {
			console.error(err);
			reject();
		}
	});
}
function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
function getViewScreenshot(view, idToWaitFor) {
	return new Promise(async (resolve, reject) => {
		try {
			const browser = await puppeteer.launch();
			const page = await browser.newPage();
			await page.setContent(view);
			page
				.on("console", (message) => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
				.on("pageerror", ({ message }) => console.log(message))
				.on("response", (response) => console.log(`${response.status()} ${response.url()}`))
				.on("requestfailed", (request) => console.log(`${request.failure().errorText} ${request.url()}`));
			if (idToWaitFor) {
				await delay(5000);
			}
			const buffer = await page.screenshot({});
			browser.close();
			resolve(buffer);
		} catch (err) {
			reject(err);
		}
	});
}

function generateUnsplashImage(text, sender, useDefaultImages = false) {
	return new Promise(async (resolve, reject) => {
		try {
			const lngDetector = new LanguageDetect();
			lngDetector.setLanguageType("iso2");
			const language = lngDetector.detect(text, 1)[0][0];
			const keywords = darkNatureSearchTerms;
			let chosenSearchTerm = useDefaultImages ? keywords[Math.floor(Math.random() * keywords.length)] : getMostImportantWord(text);
			const textSubstitute = process.env.SUBSTITUTE_TEXT.split(" ");
			const textSubstituteWith = process.env.SUBSTITUTE_TEXT_WITH.split(" ");
			for (let index in textSubstitute) {
				if (text.includes(textSubstitute[index])) {
					chosenSearchTerm += ` ${textSubstituteWith[index]}`;
					break;
				}
			}
			const API_URL = `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${chosenSearchTerm}&per_page=10&lang=${language}`;

			const response = await axios.get(API_URL, {
				responseType: "json",
			});
			if (response.status == 429) {
				setTimeout(async () => {
					resolve(await generateUnsplashImage(text, sender, useDefaultImages));
				}, 10000);
			} else {
				const results = response.data.hits;
				if (response.data.hits.length == 0) {
					setTimeout(async () => {
						resolve(await generateUnsplashImage(text, sender, true));
					}, 2000);
				} else {
					const chosenImage = results[Math.floor(Math.random() * results.length)];
					const view = getUnsplashView(chosenImage.largeImageURL, text, getSenderInfo(sender));
					getViewScreenshot(view)
						.then((output) => {
							resolve(output);
						})
						.catch((err) => {
							reject(err);
						});
				}
			}
		} catch (err) {
			console.error(err);
			reject(err);
		}
	});
}

function doOCR(language, imageBuffer) {
	return new Promise(async (resolve, reject) => {
		try {
			language = language?.length ? language : "eng";
			if (language.toLowerCase() == "chinese") {
				language = "chi_sim";
			}
			const isFullLanguageName = supportedLanguageNames.findIndex((lang) => lang == language[0].toUpperCase() + language.slice(1));

			if (isFullLanguageName != -1) {
				language = supportedLanguages[isFullLanguageName];
			}
			if (supportedLanguages.includes(language)) {
				const worker = await createWorker(language);
				const {
					data: { text },
				} = await worker.recognize(imageBuffer);
				resolve(text);
				await worker.terminate();
			} else {
				resolve(
					`${language} is not supported. Please consult <a href="https://tesseract-ocr.github.io/tessdoc/Data-Files#data-files-for-version-400-november-29-2016">this page</a> to figure out the language code you're looking for. Remember you can just edit your message and this text will be updated.`
				);
			}
		} catch (err) {
			console.error(err);
			reject(err);
		}
	});
}

function generateWordCloud(text) {
	return new Promise((resolve, reject) => {
		const words = getTopNImportantWords(text);
		const view = getWordCloudPage(words);
		getViewScreenshot(view, "wordCloudCanvas")
			.then((output) => {
				resolve(output);
			})
			.catch((err) => {
				reject(err);
			});
	});
}

async function resizeImageBuffer(imageLink) {
	return new Promise(async (resolve, reject) => {
		try {
			const inputBuffer = fs.readFileSync(imageLink);
			const image = sharp(inputBuffer);
			const metadata = await image.metadata();
			const { width, height } = metadata;
			const scalingFactor = Math.min(512 / width, 512 / height);
			const newWidth = Math.round(width * scalingFactor);
			const newHeight = Math.round(height * scalingFactor);

			const resizedBuffer = await image.resize(newWidth, newHeight).toBuffer();

			resolve(resizedBuffer);
		} catch (err) {
			reject(err);
		}
	});
}

function isEmojiString(str) {
	const trimmedStr = str.replace(/\s+/g, "");
	const emojiRegex =
		/^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}]+$/u;
	return emojiRegex.test(trimmedStr);
}

module.exports = { removeImageBackground, generateUnsplashImage, doOCR, generateWordCloud, resizeImageBuffer, isEmojiString };

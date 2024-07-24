const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const puppeteer = require("puppeteer");
const { getUnsplashView } = require("../unsplashview");
const { createWorker } = require("tesseract.js");
const LanguageDetect = require("languagedetect");
const natural = require("natural");
const TfIdf = natural.TfIdf;
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

function generateUnsplashImage(text, sender, useDefaultImages = false) {
	return new Promise(async (resolve, reject) => {
		try {
			const lngDetector = new LanguageDetect();
			lngDetector.setLanguageType("iso2");
			const language = lngDetector.detect(text, 1)[0][0];
			const keywords = darkNatureSearchTerms;
			chosenSearchTerm = useDefaultImages ? keywords[Math.floor(Math.random() * keywords.length)] : getMostImportantWord(text);
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
					const browser = await puppeteer.launch();
					const page = await browser.newPage();
					const view = getUnsplashView(chosenImage.largeImageURL, text, getSenderInfo(sender));
					await page.setContent(view);
					const buffer = await page.screenshot({});
					browser.close();
					resolve(buffer);
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

module.exports = { removeImageBackground, generateUnsplashImage, doOCR };

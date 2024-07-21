const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const puppeteer = require("puppeteer");
const { getUnsplashView } = require("../unsplashview");

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

function getSenderInfo(sender) {
	return `${sender.first_name} ${sender.last_name ? sender.last_name : ""} (@${sender.username})`;
}

///
//
//
//
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
			const browser = await puppeteer.launch();
			const page = await browser.newPage();
			const view = getUnsplashView(chosenImage.largeImageURL, text, getSenderInfo(sender));
			await page.setContent(view);
			const buffer = await page.screenshot({});
			browser.close();
			resolve(buffer);
		} catch (err) {
			console.error(err);
			reject(err);
		}
	});
}

module.exports = { removeImageBackground, generateUnsplashImage };

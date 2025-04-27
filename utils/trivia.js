const axios = require("axios");
const { sendPoll } = require("./reactions");
const { triviaCategories } = require("../categories");
const { Db } = require("mongodb");
const defaultCategory = {
	id: 9,
	name: "General Knowledge",
};
const defaultDifficulty = "hard";
async function getATriviaCategory(search) {
	try {
		const axios = require("axios");
		const data = triviaCategories;

		const categories = data.trivia_categories;
		const category = categories.find((cat) => cat.name.toLowerCase().includes(search.toLowerCase()));
		if (category) {
			const result = {
				id: category.id,
				name: category.name,
			};
			console.log("Category found:", result);
			return result;
		} else {
			return defaultCategory;
		}
	} catch (error) {
		console.error("Error fetching trivia categories:", error);
		return null;
	}
}
function generateRandomString(length) {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}

function getAndSendRandomQuestion(db, categoryStr, chatId, difficulty = "hard", repeat = true) {
	return new Promise(async (resolve, reject) => {
		const category = await getATriviaCategory(categoryStr);
		console.log("Category:", category, categoryStr);
		const url = `https://opentdb.com/api.php?amount=1&category=${category.id}&difficulty=${difficulty}`;
		return axios
			.get(url)
			.then(async (response) => {
				const data = response.data;
				if (data.response_code === 0) {
					const question = data.results[0];
					const allOptions = [...question.incorrect_answers, question.correct_answer];
					const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
					const telegramOptions = shuffledOptions.map((option) => ({
						text: option,
						option: generateRandomString(10),
						callback_data: option,
					}));
					const pollOutput = await sendPoll(
						db,
						chatId,
						[category.name, ": ", question.question, "\n\n(10 second cooldown)"].join(""),
						telegramOptions,
						false,
						process.env.TELEGRAM_BOT_TOKEN,
						20,
						true,
						telegramOptions.findIndex((option) => option.text === question.correct_answer)
					);
					resolve(pollOutput);
				} else {
					await sleep(6000);
					if (repeat) {
						getAndSendRandomQuestion(db, "general knowledge", chatId, difficulty, false);
					} else {
						reject(new Error("No trivia question found"));
					}
				}
			})
			.catch((error) => {
				console.error("Error fetching trivia question:", url);
				reject(error);
			});
	});
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { getAndSendRandomQuestion };

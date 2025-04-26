const axios = require("axios");
const { sendPoll } = require("./reactions");
const { triviaCategories } = require("../categories");
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

async function getAndSendRandomQuestion(categoryStr, chatId, difficulty = "hard", repeat = true) {
	const category = await getATriviaCategory(categoryStr);
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
				return sendPoll(
					chatId,
					[category.name, ": ", question.question, "\n\n(20 second cooldown)"].join(""),
					telegramOptions,
					false,
					process.env.TELEGRAM_BOT_TOKEN,
					20,
					true,
					telegramOptions.findIndex((option) => option.text === question.correct_answer)
				);
			} else {
				await sleep(6000);
				if (repeat) {
					getAndSendRandomQuestion("general knowledge", chatId, difficulty, false);
				} else {
					throw new Error("No trivia found", categoryStr, category);
				}
			}
		})
		.catch((error) => {
			console.error("Error fetching trivia question:", url);
			throw error;
		});
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { getAndSendRandomQuestion };

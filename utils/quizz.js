const { Db } = require("mongodb");
const { sendSimpleRequestToClaude } = require("./ai");
const { sendPoll } = require("./reactions");
const { getPollResults } = require("./telegram_polls");
function generateRandomString(length) {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}

function sendRandomQuizz(db, mongoCollection, chatId) {
	return new Promise(async (resolve, reject) => {
		const questionDoc = (await mongoCollection.aggregate([{ $sample: { size: 1 } }]).toArray())[0];
		sendSimpleRequestToClaude(
			`You are a trivia expert. Given the following trivia question: "${questionDoc.Question}" and its correct answer: "${questionDoc.Answer}", generate three plausible, SHORT but incorrect answers. Ensure the incorrect answers are distinct, contextually relevant, and not overly similar to the correct answer. Reply with a JSON object in the format {"IncorrectAnswers": ["answer1", "answer2", "answer3"]}.`
		).then(async (response) => {
			const answers = JSON.parse(response.content[0].text).IncorrectAnswers.map((answer) => answer.replace(/[^\w\s]/g, "").trim());
			questionDoc.IncorrectAnswers = answers;
			const question = {
				question: questionDoc.Question,
				answer: questionDoc.Answer,
				options: [questionDoc.Answer, ...questionDoc.IncorrectAnswers],
			};
			const shuffledOptions = question.options.sort(() => Math.random() - 0.5);
			const pollOutput = await sendPoll(
				db,
				chatId,
				question.question,
				shuffledOptions.map((option) => {
					return {
						text: option,
						option: generateRandomString(10),
						callback_data: option,
					};
				}),
				false,
				process.env.TELEGRAM_BOT_TOKEN,
				20,
				true,
				shuffledOptions.findIndex((option) => option === question.answer)
			);
			resolve(pollOutput);
		});
	});
}

module.exports = { sendRandomQuizz };

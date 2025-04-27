const eyeWords = [];
const bannedWords = [];
const nerdwords = [];
const axios = require("axios");
const he = require("he");

function reactToTelegramMessage(token, reaction, chatId, messageId) {
	const params = new URLSearchParams({
		chat_id: chatId,
		message_id: messageId,
	});
	const reactions = JSON.stringify([{ type: "emoji", emoji: reaction }]);
	const url = `https://api.telegram.org/bot${token}/setMessageReaction?${params.toString()}&reaction=${encodeURIComponent(reactions)}`;

	axios
		.get(url)
		.then((response) => {})
		.catch((error) => {
			console.error("Error:", error.response ? error.response.data : error.message);
		});
}

function sendPoll(db, chatId, question, options, anon, botToken = process.env.TELEGRAM_BOT_TOKEN, open_period = null, quizz = false, correct_answer = null) {
	return new Promise(async (resolve, reject) => {
		try {
			const url = `https://api.telegram.org/bot${botToken}/sendPoll`;
			const payload = {
				chat_id: chatId,
				question: he.decode(question),
				options: options.map((option) => he.decode(option.text || option)),
				is_anonymous: anon,
			};
			if (open_period !== null) {
				payload.open_period = open_period;
			}
			if (quizz) {
				payload.type = "quiz";
				if (correct_answer !== null) {
					payload.correct_option_id = correct_answer;
				}
			}
			const response = await axios.post(url, payload);
			const data = response.data;
			db.collection("polls").insertOne({
				chatId: chatId,
				question: question,
				options: options.map((option) => option.text || option),
				correct_answer: correct_answer,
				data: data.result,
			});

			resolve(response.data.result);
		} catch (error) {
			console.error("Error sending poll:", payload);
			reject(error);
		}
	});
}
module.exports = { eyeWords, bannedWords, nerdwords, reactToTelegramMessage, sendPoll };

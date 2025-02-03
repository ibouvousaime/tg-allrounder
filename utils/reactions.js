const eyeWords = [];
const bannedWords = [];
const nerdwords = [];
const axios = require("axios");

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

const sendPoll = async (chatId, question, options, anon, botToken = process.env.TELEGRAM_BOT_TOKEN) => {
	try {
		const url = `https://api.telegram.org/bot${botToken}/sendPoll`;

		const response = await axios.post(url, {
			chat_id: chatId,
			question: question,
			options: JSON.stringify(options),
			is_anonymous: anon,
		});

		console.log("Poll sent successfully:", response.data);
		return response.data;
	} catch (error) {
		console.error("Error sending poll:", error.response ? error.response.data : error.message);
		throw error;
	}
};
module.exports = { eyeWords, bannedWords, nerdwords, reactToTelegramMessage, sendPoll };

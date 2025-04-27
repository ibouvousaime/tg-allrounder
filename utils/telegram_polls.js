const axios = require("axios");

function getPollResults(pollId, chatId, botToken = process.env.TELEGRAM_BOT_TOKEN) {
	const url = `https://api.telegram.org/bot${botToken}/getPollResults`;
	const params = new URLSearchParams({
		poll_id: pollId,
		chat_id: chatId,
	});
	return axios
		.get(`${url}?${params.toString()}`)
		.then((response) => response.data)
		.catch((error) => {
			console.error("Error:", error.response ? error.response.data : error.message);
			throw error;
		});
}

module.exports = { getPollResults };

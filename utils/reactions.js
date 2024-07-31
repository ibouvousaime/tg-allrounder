const eyeWords = ["kir", "seks", "31", "کیر", "cock"];
const bannedWords = ["nigga", "repost", "onion", "bibi"];
const nerdwords = ["linux", "code", "rust", "python"];
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

module.exports = { eyeWords, bannedWords, nerdwords, reactToTelegramMessage };

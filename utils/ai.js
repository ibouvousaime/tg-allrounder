const Anthropic = require("@anthropic-ai/sdk");
const anthropic = new Anthropic({});

function sendSimpleRequestToClaude(message) {
	return anthropic.messages.create({
		max_tokens: 1024,
		messages: [{ role: "user", content: message }],
		model: "claude-3-7-sonnet-latest",
	});
}

function guessMediaType(filename) {
	const extension = filename.split(".").pop().toLowerCase();

	switch (extension) {
		case "jpeg":
		case "jpg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "gif":
			return "image/gif";
		case "webp":
			return "image/webp";
		default:
			return "image/jpeg";
	}
}

function sendRequestWithImageToClaude(textMessage, imageArrayBuffer, imageMediaType) {
	const imageBase64 = Buffer.from(imageArrayBuffer).toString("base64");
	const userMessageContent = [
		{
			type: "image",
			source: {
				type: "base64",
				media_type: imageMediaType,
				data: imageBase64,
			},
		},
		{
			type: "text",
			text: textMessage,
		},
	];

	return anthropic.messages.create({
		max_tokens: 1024,
		messages: [{ role: "user", content: userMessageContent }],
		model: "claude-3-7-sonnet-latest",
	});
}

module.exports = { sendSimpleRequestToClaude, sendRequestWithImageToClaude, guessMediaType };

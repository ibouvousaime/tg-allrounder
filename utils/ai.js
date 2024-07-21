const Anthropic = require("@anthropic-ai/sdk");
const anthropic = new Anthropic({});

function sendSimpleRequestToClaude(message) {
	return anthropic.messages.create({
		max_tokens: 1024,
		messages: [{ role: "user", content: message }],
		model: "claude-3-haiku-20240307",
	});
}
module.exports = { sendSimpleRequestToClaude };

let sentimentPipelinePromise;
let imagePipelinePromise;
let imageMutex = Promise.resolve();

async function getSentimentPipeline() {
	if (!sentimentPipelinePromise) {
		sentimentPipelinePromise = import("@xenova/transformers").then(({ pipeline }) =>
			pipeline("text-classification", "MicahB/emotion_text_classifier", { quantized: true }),
		);
	}
	return sentimentPipelinePromise;
}

async function getPhotoPipeline() {
	if (!imagePipelinePromise) {
		imagePipelinePromise = import("@xenova/transformers").then(({ pipeline }) =>
			pipeline("image-to-text", "MicahB/emotion_text_classifier", { quantized: true }),
		);
	}
	return imagePipelinePromise;
}

async function analyzeSentiment(text) {
	const classifier = await getSentimentPipeline();
	return classifier(text, { top_k: null });
}

let isProcessing = false;
const queue = [];

async function analyzePhoto(image) {
	const classifier = await getPhotoPipeline();
	return classifier(image);
}

function emotionToEmoji(label) {
	switch (label) {
		case "joy":
		case "happiness":
		case "amusement":
			return "😁";

		case "love":
		case "affection":
			return "😍";

		case "excitement":
			return "🤩";

		case "pride":
			return "😎";

		case "optimism":
			return "💯";

		case "gratitude":
			return "🙏";

		case "curiosity":
		case "confusion":
			return "🤔";

		case "realization":
			return "🤯";

		case "surprise":
			return "😱";

		case "neutral":
			return "";

		case "nervousness":
			return "😨";

		case "sadness":
			return "😢";

		case "disappointment":
		case "remorse":
			return "💔";

		case "grief":
		case "embarrassment":
			return "😭";

		case "anger":
		case "annoyance":
			return "😡";

		case "hate":
			return "🤬";

		case "disgust":
			return "🤮";

		case "fear":
			return "😨";

		default:
			return "";
	}
}

const allowedReactionEmojis = [
	"❤",
	"👍",
	"👎",
	"🔥",
	"🥰",
	"👏",
	"😁",
	"🤔",
	"🤯",
	"😱",
	"🤬",
	"😢",
	"🎉",
	"🤩",
	"🤮",
	"💩",
	"🙏",
	"👌",
	"🕊",
	"🤡",
	"🥱",
	"🥴",
	"😍",
	"🐳",
	"❤‍🔥",
	"🌚",
	"🌭",
	"💯",
	"🤣",
	"⚡",
	"🍌",
	"🏆",
	"💔",
	"🤨",
	"😐",
	"🍓",
	"🍾",
	"💋",
	"🖕",
	"😈",
	"😴",
	"😭",
	"🤓",
	"👻",
	"👨‍💻",
	"👀",
	"🎃",
	"🙈",
	"😇",
	"😨",
	"🤝",
	"✍",
	"🤗",
	"🫡",
	"🎅",
	"🎄",
	"☃",
	"💅",
	"🤪",
	"🗿",
	"🆒",
	"💘",
	"🙉",
	"🦄",
	"😘",
	"💊",
	"🙊",
	"😎",
	"👾",
	"🤷‍♂",
	"🤷",
	"🤷‍♀",
	"😡",
];
module.exports = { analyzeSentiment, analyzePhoto, emotionToEmoji, allowedReactionEmojis };

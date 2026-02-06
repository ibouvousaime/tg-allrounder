let sentimentPipelinePromise;
let imagePipelinePromise;
let imageMutex = Promise.resolve();

async function getSentimentPipeline() {
	if (!sentimentPipelinePromise) {
		sentimentPipelinePromise = import("@xenova/transformers").then(({ pipeline }) =>
			pipeline("sentiment-analysis", "Xenova/bert-base-multilingual-uncased-sentiment", { quantized: true }),
		);
	}
	return sentimentPipelinePromise;
}

async function getPhotoPipeline() {
	if (!imagePipelinePromise) {
		imagePipelinePromise = import("@xenova/transformers").then(({ pipeline }) =>
			pipeline("image-to-text", "Xenova/trocr-base-handwritten", { quantized: true }),
		);
	}
	return imagePipelinePromise;
}

async function analyzeSentiment(text) {
	const classifier = await getSentimentPipeline();
	return classifier(text);
}

let isProcessing = false;
const queue = [];

async function analyzePhoto(image) {
	const classifier = await getPhotoPipeline();
	return classifier(image);
}

module.exports = { analyzeSentiment, analyzePhoto };

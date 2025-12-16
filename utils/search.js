function isValidRegex(str) {
	try {
		new RegExp(str);
		return true;
	} catch (e) {
		return false;
	}
}

function findSimilarMessages(collection, chatId, regex) {
	/* regex = regex.replace(/[\[\]\\.^$*+?(){}|]/g, "\\$&"); */
	return new Promise(async (resolve, reject) => {
		if (regex.trim().length < 2) {
			resolve([]);
			return;
		}
		if (isValidRegex(regex)) {
			await collection
				.aggregate([
					{
						$match: {
							text: {
								$regex: new RegExp(regex, "i"),
							},
							chatId,
							$expr: {
								$not: {
									$regexMatch: {
										input: "$text",
										regex: "^/",
									},
								},
							},
						},
					},
				])
				.sort({ date: -1 })
				//.limit(40)
				.toArray()
				.then((output) => {
					resolve(output);
				});
		} else {
			console.log("not a regex", regex);
		}
	});
}

function countSenders(collection, chatId, regex) {
	/* regex = regex.replace(/[\[\]\\.^$*+?(){}|]/g, "\\$&"); */
	return new Promise(async (resolve, reject) => {
		if (isValidRegex(regex)) {
			await collection
				.aggregate([
					{
						$match: {
							text: {
								$regex: new RegExp(regex, "i"),
							},
							chatId,
							$expr: {
								$not: {
									$regexMatch: {
										input: "$text",
										regex: "^/",
									},
								},
							},
						},
					},
					{
						$group: {
							_id: "$sender",
							count: { $sum: 1 },
						},
					},
					{
						$sort: { count: -1 },
					},
					{
						$limit: 10,
					},
				])
				.toArray()
				.then((output) => {
					resolve(output);
				})
				.catch((err) => {
					console.error(err);
					reject();
				});
		} else {
			console.log("not a regex", regex);
			reject();
		}
	});
}

async function generateLocalEmbedding(text) {
	const tf = require("@xenova/transformers");
	const pipe = await tf.pipeline("feature-extraction", "Xenova/multilingual-e5-small");
	const output = await pipe(text, { pooling: "mean", normalize: true });
	return Array.from(output.data);
}

function cosineSimilarity(vecA, vecB) {
	if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < vecA.length; i++) {
		dotProduct += vecA[i] * vecB[i];
		normA += vecA[i] * vecA[i];
		normB += vecB[i] * vecB[i];
	}

	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchMessagesByEmbedding(collection, chatId, searchQuery, limit = 10) {
	return new Promise(async (resolve, reject) => {
		try {
			if (!searchQuery || searchQuery.trim().length < 2) {
				resolve([]);
				return;
			}

			const queryEmbedding = await generateLocalEmbedding(searchQuery);

			const messages = await collection
				.find({
					chatId,
					embedding: { $exists: true },
					$expr: {
						$not: {
							$regexMatch: {
								input: "$text",
								regex: "^/",
							},
						},
					},
				})
				.toArray();

			const messagesWithSimilarity = messages.map((msg) => ({
				...msg,
				similarity: cosineSimilarity(queryEmbedding, msg.embedding),
			}));

			messagesWithSimilarity.sort((a, b) => b.similarity - a.similarity);

			resolve(messagesWithSimilarity.slice(0, limit));
		} catch (err) {
			console.error("Error in searchMessagesByEmbedding:", err);
			reject(err);
		}
	});
}

module.exports = { findSimilarMessages, countSenders, searchMessagesByEmbedding };

const tf = require("@tensorflow/tfjs");
const use = require("@tensorflow-models/universal-sentence-encoder");
function isValidRegex(str) {
	try {
		new RegExp(str);
		return true;
	} catch (e) {
		return false;
	}
}
async function generateEmbedding(text) {
	console.log("loading model");
	const model = await use.load();
	console.log("embedding text");
	const embeddings = await model.embed([text]);
	console.log("done embedding text");
	return embeddings.arraySync()[0];
}

function findSimilarMessages(collection, regex) {
	return new Promise(async (resolve, reject) => {
		if (isValidRegex(regex)) {
			const result = await collection
				.aggregate([
					{
						$match: {
							text: {
								regex: new RegExp(regex),
							},
						},
					},
				])
				.limit(5)
				.toArray()
				.then((output) => {
					console.log(output);
					resolve(output);
				});
		} else {
			console.log("not a regex", regex);
		}
	});
}

module.exports = { generateEmbedding, findSimilarMessages };

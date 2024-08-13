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
				.limit(10)
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
const OnigScanner = require("oniguruma").OnigScanner;

function replaceText(originalString, regexPattern, replacementText) {
	try {
		const scanner = new OnigScanner([regexPattern]);
		let result = originalString;
		let currentIndex = 0;
		let match;

		while ((match = scanner.findNextMatchSync(result, currentIndex))) {
			result = result.substring(0, match.captureIndices[0].start) + replacementText + result.substring(match.captureIndices[0].end);
			currentIndex = match.captureIndices[0].start + replacementText.length;
		}

		return result;
	} catch (err) {
		return `cant parse this regex, ${regexPattern}`;
	}
}

module.exports = { findSimilarMessages, countSenders, replaceText };

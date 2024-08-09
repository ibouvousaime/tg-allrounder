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

module.exports = { findSimilarMessages, countSenders };

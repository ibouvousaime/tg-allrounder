import natural from "natural";
function evaluateBulkMessages(messages, minConfidence = 0, minSpread = 0.05, minMargin = 0.03) {
	return new Promise((resolve, reject) => {
		natural.BayesClassifier.load("trained_model.json", null, (err, classifier) => {
			if (err) return reject(err);

			const results = messages
				.map((text) => {
					const scores = classifier.getClassifications(text);
					const best = scores[0];
					const values = scores.map((s) => s.value);

					const spread = Math.max(...values) - Math.min(...values);
					const second = scores[1];
					const margin = best.value - (second?.value ?? 0);

					const isFlat = spread < minSpread;
					const weakSignal = margin < minMargin;

					return {
						text,
						verdict: best.label,
						confidence: best.value,
						all_scores: scores,
						meta: { spread, margin, isFlat, weakSignal },
					};
				})
				.filter((item) => item.confidence >= minConfidence && !item.meta.isFlat && !item.meta.weakSignal);

			resolve(results);
		});
	});
}

async function evaluateAndGroupLabels(messages) {
	const output = await evaluateBulkMessages(messages);
	const labelData = {};
	for (const message of output) {
		if (!labelData[message.verdict]) {
			labelData[message.verdict] = {
				count: 1,
				messages: [message.text],
			};
		} else {
			labelData[message.verdict].count++;
			labelData[message.verdict].messages.push(message.text);
		}
	}
	return labelData;
}

export async function getUserMessagesAndAnalyse(name, collection, chatId) {
	const messages = await collection.find({ sender: { $regex: name }, chatId }).toArray();
	const textMessages = messages.map((message) => message.text).filter((text) => text && text.length);
	console.log(textMessages.slice(0, 5));
	const output = await evaluateAndGroupLabels(textMessages);
	let textOuput = "";
	for (const label in output) {
		textOuput += label + ": " + output[label].count + " messages\n";
		textOuput += "<blockquote expandable>";
		output[label].messages.forEach((msg, index) => {
			textOuput += `${index + 1}. ${msg}\n`;
		});
		textOuput += "</blockquote>";
	}
	return textOuput;
}

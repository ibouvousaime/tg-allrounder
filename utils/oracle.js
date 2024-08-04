const { sendSimpleRequestToClaude } = require("./ai");
const oracleData = require("./oracle-data.json");
const contextSize = 500;
function getDiceNumbers() {
	return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}
function getRandomOracleMessage() {
	let numbers = getDiceNumbers();
	let message = oracleData.filter((line) => line["#1"] == numbers[0] && line["#2"] == numbers[1] && line["#3"] == numbers[2])[0];
	return message.Oracle.includes("—") ? getRandomOracleMessage() : message;
}

function getRandomOracleMessageObj() {
	let message = getRandomOracleMessage();
	const output = { lineNumber: message.Line, bookNumber: message.Book, book: message.Source, line: message.Oracle };
	return output;
}

function getContext(collection, book, line) {
	return new Promise((resolve, reject) => {
		collection
			.findOne({
				content: {
					$regex: line.trim().substring(10),
					$options: "i",
				},
				book,
			})
			.then(async (document) => {
				if (!document) {
					resolve(null);
					return;
				}
				const lineIndex = document.content.indexOf(line);
				const startIndex = findLastPunctuationIndex(line, lineIndex);
				const smallerContext = document.content.substring(startIndex < 0 ? 0 : startIndex, startIndex + contextSize);
				resolve(smallerContext);
			})
			.catch((err) => {
				reject(err);
			});
	});
}

async function explainContextClaude(collection, destination) {
	return new Promise(async (resolve, reject) => {
		let randomOracleMessage = getRandomOracleMessageObj();
		let context = await getContext(collection, randomOracleMessage.book, randomOracleMessage.line);
		while (!context) {
			randomOracleMessage = getRandomOracleMessageObj();
			context = await getContext(collection, randomOracleMessage.book, randomOracleMessage.line);
		}
		const line = randomOracleMessage.line;
		const book = randomOracleMessage.book;
		const prompt = `Imagine you rolled a 3-sided die and received this oracle line: "${line}" from the book "${book}". Here's the context from the book: "${context}". 
Now, explain to ${destination} what this oracle line means for their life.

`;
		sendSimpleRequestToClaude(prompt)
			.then((response) => {
				resolve(response.content[0].text);
			})
			.catch((err) => {
				reject(err);
			});
	});
}

function findNextPunctuationIndex(str, afterIndex) {
	const punctuationRegex = /[.,\/#!$%\^&\*;:{}=\-_`~()]/g;
	let lastIndex = -1;

	while (punctuationRegex.test(str) && punctuationRegex.lastIndex > afterIndex) {
		lastIndex = punctuationRegex.lastIndex - 1;
	}

	return (lastIndex = -1 ? 0 : lastIndex);
}
function findLastPunctuationIndex(str, beforeIndex) {
	const punctuationRegex = /[.,\/#!$%\^&\*;:{}=\-_`~()]/g;
	let lastIndex = -1;

	while (punctuationRegex.test(str) && punctuationRegex.lastIndex < beforeIndex) {
		lastIndex = punctuationRegex.lastIndex - 1;
	}

	return (lastIndex = -1 ? 0 : lastIndex);
}

module.exports = { getRandomOracleMessageObj, getContext, explainContextClaude };

const { sendSimpleRequestToClaude, sendSimpleRequestToDeepSeek } = require("./ai");
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
		const lineIsDifferent = line.indexOf("[") != -1 ? line.indexOf("[") - 1 : null;
		line = lineIsDifferent ? line.trim().substring(lineIsDifferent) : line.trim();
		collection
			.findOne({
				content: {
					$regex: line,
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
function sanitizeTags(input) {
	const allowedTags = ["b", "strong", "i", "em", "u", "ins", "s", "strike", "del", "tg-spoiler", "a", "tg-emoji", "tg-time", "code", "pre", "blockquote"];

	const regex = new RegExp(`<(?!\\/?(${allowedTags.join("|")})(?:\\s|>))\\/?[\\w\\s="-]+.*?>`, "gi");

	return input.replace(regex, "");
}
async function explainContext(collection, destination) {
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
		The response has to be in HTML and only use these tags: b, strong, i, em, u, ins, s, strike, del, tg-spoiler, a, code, pre, blockquote
`;
		sendSimpleRequestToDeepSeek(prompt)
			.then((response) => {
				console.log(response);
				resolve(sanitizeTags(response));
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

module.exports = { getRandomOracleMessageObj, getContext, explainContext, sanitizeTags };

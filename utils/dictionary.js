const wiktionary = require("wiktionary-node");

function getWordEtymology(word) {
	return new Promise(async (resolve, reject) => {
		try {
			wiktionary("word")
				.then((result) => {
					resolve(result);
				})
				.catch((error) => {
					reject(error);
				});
		} catch (err) {
			reject(err);
		}
	});
}

module.exports = { getWordEtymology };

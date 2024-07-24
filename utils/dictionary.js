const axios = require("axios");

function getWordEtymology(word, lang) {
	return new Promise(async (resolve, reject) => {
		try {
			const languageCodes = ["en", "es", "fr", "de", "it", "pt"];
			const { Etymo } = await import("etymo-js");
			const etymo = new Etymo();
			const results = await etymo.search(word);
			if (lang && languageCodes.includes(lang)) {
				const path = results[0].path;
				const output = await etymo.get(path, { lang });
				resolve(output.def.split("\n")[0]);
			} else {
				resolve(results[0].def.split("\n")[0]);
			}
		} catch (err) {
			reject(err);
		}
	});
}
module.exports = { getWordEtymology };

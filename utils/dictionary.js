const axios = require("axios");
const { lang } = require("moment");
const { MeiliSearch } = require("meilisearch");
const client = new MeiliSearch({
	host: "http://127.0.0.1:7700",
	apiKey: process.env.MEILI_MASTER_KEY,
});

const INDEX_NAME = "dictionary";

function detectLangCode(word) {
	const w = word.trim();
	const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
	const persianRegex = /[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/;
	const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
	const turkishRegex = /[\u00C7\u00E7\u011E\u011F\u0130\u0131\u015E\u015F\u00D6\u00F6\u00DC\u00FC]/;
	if (japaneseRegex.test(w)) {
		return "ja";
	}

	if (persianRegex.test(w)) {
		return "fa";
	}

	if (arabicRegex.test(w)) {
		return "ar";
	}
	if (turkishRegex.test(w)) {
		return "tr";
	}
	return "en";
}

async function lookupWord(collection, word, langCode) {
	const resolvedLangCode = langCode ?? detectLangCode(word);

	const query = {
		word: word.trim().toLowerCase(),
		lang_code: resolvedLangCode,
	};

	const doc = await collection.findOne(query);

	if (!doc) {
		return { word: null, audioUrls: [], langCode: resolvedLangCode };
	}

	return formatWordEntry(doc, resolvedLangCode);
}

function formatWordEntry(entry, langCode) {
	const lines = [];
	if (!entry) {
		return { word: null, audioUrls: [] };
	}
	const pos = entry.pos ? entry.pos : "unknown POS";
	lines.push(`${entry.word} (${entry.lang}, ${pos})`);
	lines.push("");

	if (entry.etymology_text || entry.etymology_templates?.length) {
		lines.push("Etymology:");
		if (entry.etymology_text) {
			lines.push(entry.etymology_text.trim());
		} else {
			for (const tpl of entry.etymology_templates ?? []) {
				if (tpl.expansion) {
					lines.push(tpl.expansion.trim());
				}
			}
		}
		lines.push("");
	}

	if (entry.senses?.length) {
		lines.push("Meanings:");
		entry.senses.forEach((sense, i) => {
			const gloss = sense.glosses?.[0];
			if (gloss) {
				lines.push(`${i + 1}. ${gloss}`);
			}
		});
		lines.push("");
	}

	const ipa = entry.sounds?.find((s) => s.ipa)?.ipa;
	if (ipa) {
		lines.push("Pronunciation:");
		lines.push(`IPA: ${ipa}`);
		lines.push("");
	}
	const audioUrls = entry.sounds
		?.map((s) => {
			if (s.mp3_url || s.ogg_url) {
				return s.mp3_url ? s.mp3_url : s.ogg_url;
			} else return null;
		})
		?.filter((url) => url !== null);

	return { word: lines.join("\n"), audioUrls, langCode };
}
module.exports = { lookupWord };

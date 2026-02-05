const { MongoClient } = require("mongodb");
const { MeiliSearch } = require("meilisearch");
const pLimit = require("p-limit").default;
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "wiktionary";
const COLLECTION = "words";

const MEILI_HOST = "http://127.0.0.1:7700";
const MEILI_API_KEY = process.env.MEILI_MASTER_KEY;
const INDEX_NAME = "dictionary";

const BATCH_SIZE = 1000;
const limit = pLimit(5); // prevent Meili overload

const mongo = new MongoClient(MONGO_URI);
const meili = new MeiliSearch({
	host: MEILI_HOST,
	apiKey: MEILI_API_KEY,
});

function buildLookup(word, forms) {
	const set = new Set();
	set.add(word.toLowerCase());

	for (const f of forms ?? []) {
		if (f.form) {
			set.add(f.form.toLowerCase());
		}
	}

	return [...set];
}

async function run() {
	await mongo.connect();
	const db = mongo.db(DB_NAME);
	const col = db.collection(COLLECTION);

	const index = meili.index(INDEX_NAME);

	// create index if missing
	await meili.createIndex(INDEX_NAME, { primaryKey: "id" }).catch(() => {});

	// configure index ONCE
	await index.updateSettings({
		searchableAttributes: ["lookup", "word"],
		filterableAttributes: ["lang_code", "pos"],
		distinctAttribute: "word",
	});

	const cursor = col.find({}, { batchSize: BATCH_SIZE });

	let batch = [];
	let processed = 0;

	for await (const doc of cursor) {
		const entry = {
			id: doc._id.toString(),
			word: doc.word,
			lookup: buildLookup(doc.word, doc.forms),
			lang: doc.lang,
			lang_code: doc.lang_code,
			pos: doc.pos,
			ipa: doc.sounds?.map((s) => s.ipa).filter(Boolean),
		};

		batch.push(entry);

		if (batch.length >= BATCH_SIZE) {
			const send = batch;
			batch = [];

			await limit(() => index.addDocuments(send));
			processed += send.length;

			if (processed % 50_000 === 0) {
			}
		}
	}

	if (batch.length) {
		await index.addDocuments(batch);
		processed += batch.length;
	}

	await mongo.close();
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});

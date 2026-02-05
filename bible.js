const fs = require("fs");
const { MongoClient } = require("mongodb");

require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "bible";
const COLLECTION = "verses";
const TRANSLATION = "KJV";

async function importBible() {
	const client = new MongoClient(MONGO_URI);
	await client.connect();

	const col = client.db(DB_NAME).collection(COLLECTION);

	const data = JSON.parse(fs.readFileSync("data/kjv.json", "utf8"));

	const docs = data.verses.map((v) => ({
		book: v.book_name,
		book_id: v.book,
		chapter: v.chapter,
		verse: v.verse,
		text: v.text,
		translation: TRANSLATION,
	}));

	// Remove existing translation if re-importing
	await col.deleteMany({ translation: TRANSLATION });

	await col.insertMany(docs);

	await client.close();
}

importBible();

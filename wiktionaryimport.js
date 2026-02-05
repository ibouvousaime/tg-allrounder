const fs = require("fs");
const readline = require("readline");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "wiktionary";
const COLLECTION_NAME = "words";
const BATCH_SIZE = 500;
const PROGRESS_FILE = ".import-progress.json";

function loadProgress(filePath) {
	if (!fs.existsSync(PROGRESS_FILE)) {
		return { file: filePath, line: 0 };
	}
	const p = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
	if (p.file !== filePath) {
		console.warn("⚠️ Progress file is for a different input file. Ignoring.");
		return { file: filePath, line: 0 };
	}
	return p;
}

function saveProgress(filePath, line) {
	fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ file: filePath, line }, null, 2));
}

async function importJsonl(filePath) {
	const client = new MongoClient(MONGO_URI, {
		maxPoolSize: 1,
		socketTimeoutMS: 0,
		serverSelectionTimeoutMS: 30000,
	});

	const progress = loadProgress(filePath);
	let currentLine = 0;
	let inserted = 0;

	try {
		await client.connect();
		const db = client.db(DB_NAME);
		const collection = db.collection(COLLECTION_NAME);

		const rl = readline.createInterface({
			input: fs.createReadStream(filePath),
			crlfDelay: Infinity,
		});

		let batch = [];

		for await (const line of rl) {
			currentLine++;

			// Skip already imported lines
			if (currentLine <= progress.line) continue;

			const trimmedLine = line.trim();
			if (!trimmedLine) continue;

			try {
				batch.push(JSON.parse(trimmedLine));
			} catch {
				console.error(`❌ Invalid JSON at line ${currentLine}, skipped`);
				continue;
			}

			if (batch.length >= BATCH_SIZE) {
				await collection.insertMany(batch, {
					ordered: false,
					writeConcern: { w: 1, j: false },
				});

				inserted += batch.length;
				saveProgress(filePath, currentLine);
				batch = [];
			}
		}

		// Final batch
		if (batch.length > 0) {
			await collection.insertMany(batch, { ordered: false });
			inserted += batch.length;
			saveProgress(filePath, currentLine);
		}
	} catch (err) {
		console.error("💥 Import crashed:", err);
		console.error(`ℹ️ Safe to restart — last saved line: ${currentLine}`);
	} finally {
		await client.close();
	}
}

const filePath = process.argv[2];
if (!filePath) {
	console.error("Usage: node import.js <path-to-jsonl>");
	process.exit(1);
}

importJsonl(filePath);

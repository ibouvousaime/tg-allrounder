const { MongoClient } = require("mongodb");
const schedule = require("node-schedule");
const dotenv = require("dotenv");
const tf = require("@xenova/transformers");

dotenv.config();

const mongoUri = process.env.MONGO_URI;
const dbName = "messages";
const collectionName = "messages";

if (!mongoUri) {
	console.error("MONGO_URI is missing in .env");
	process.exit(1);
}

let isJobRunning = false;

async function generateLocalEmbedding(text) {
	const pipe = await tf.pipeline("feature-extraction", "Xenova/multilingual-e5-small");
	const output = await pipe(text, { pooling: "mean", normalize: true });
	return Array.from(output.data);
}

async function backfillMissingEmbeddings() {
	if (isJobRunning) {
		console.log("[Embeddings] Job skipped: Previous job is still running.");
		return;
	}

	isJobRunning = true;
	const client = new MongoClient(mongoUri);

	try {
		await client.connect();
		const collection = client.db(dbName).collection(collectionName);

		const totalCount = await collection.countDocuments({
			embedding: { $exists: false },
			text: { $exists: true },
		});

		if (totalCount === 0) {
			console.log("[Embeddings] No pending documents found.");
			return;
		}

		console.log(`[Embeddings] Processing ${totalCount} documents...`);

		let processed = 0;
		const batchSize = 100;

		while (true) {
			const docs = await collection
				.find({
					embedding: { $exists: false },
					text: { $exists: true, $ne: "", $ne: null },
				})
				.limit(batchSize)
				.sort({ _id: -1 })
				.toArray();

			if (docs.length === 0) break;

			const bulkOps = [];

			for (const doc of docs) {
				if (!doc.text?.trim()?.length) continue;

				try {
					const vec = await generateLocalEmbedding(doc.text);
					bulkOps.push({
						updateOne: {
							filter: { _id: doc._id },
							update: { $set: { embedding: vec } },
						},
					});
				} catch (err) {
					console.error(`[Embeddings] Error generating vector for doc ${doc._id}:`, err);
				}
			}

			if (bulkOps.length > 0) {
				await collection.bulkWrite(bulkOps);
				processed += bulkOps.length;
				console.log(`[Embeddings] Progress: ${processed}/${totalCount} completed.`);
			}
		}

		console.log(`[Embeddings] Job finished. Processed ${processed} documents.`);
	} catch (error) {
		console.error("[Embeddings] Critical Error:", error);
	} finally {
		await client.close();
		isJobRunning = false;
	}
}

backfillMissingEmbeddings();

const cronSchedule = "*/5 * * * *";
schedule.scheduleJob(cronSchedule, backfillMissingEmbeddings);

console.log(`[Embeddings] Service started. Schedule: ${cronSchedule}`);

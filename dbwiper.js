const { MongoClient } = require("mongodb");
const schedule = require("node-schedule");
const dotenv = require("dotenv");
const moment = require("moment");

dotenv.config();

const mongoUri = process.env.MONGO_URI;
const dbName = "messages";
const collectionName = "messages";

if (!mongoUri) {
	console.error("MONGO_URI is missing in .env");
	process.exit(1);
}

async function clearMessageCollection() {
	const client = new MongoClient(mongoUri);

	try {
		await client.connect();
		const db = client.db(dbName);
		const collection = db.collection(collectionName);

		const sevenDaysAgo = moment().subtract(7, "days").toDate();

		console.log(`[Cleanup] Checking for messages older than: ${sevenDaysAgo}`);

		const result = await collection.deleteMany({
			date: { $lt: sevenDaysAgo },
		});

		if (result.deletedCount > 0) {
			console.log(`[Cleanup] Deleted ${result.deletedCount} documents.`);
		} else {
			console.log(`[Cleanup] No old messages to delete.`);
		}
	} catch (error) {
		console.error("[Cleanup] Error:", error);
	} finally {
		await client.close();
	}
}

clearMessageCollection();

const cronSchedule = "*/30 * * * *";
schedule.scheduleJob(cronSchedule, clearMessageCollection);

console.log(`[Cleanup] Service started. Schedule: ${cronSchedule}`);

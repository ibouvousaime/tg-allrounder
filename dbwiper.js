const { MongoClient } = require("mongodb");
const schedule = require("node-schedule");
const dotenv = require("dotenv");
dotenv.config();

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
	console.error("MONGODB_URI is not set in the environment variables.");
	process.exit(1);
}

const dbName = "messages";
const collectionName = "messages";

async function clearMessageCollection() {
	const client = new MongoClient(mongoUri);

	try {
		await client.connect();
		const db = client.db(dbName);
		const collection = db.collection(collectionName);

		const result = await collection.deleteMany({ date: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
		console.log(`Cleared collection ${collectionName} in database ${dbName}. Deleted ${result.deletedCount} documents.`);
	} catch (error) {
		console.error("Error clearing collection:", error);
	} finally {
		await client.close();
	}
}
clearMessageCollection();
const cronSchedule = "*/30 * * * *";
schedule.scheduleJob(cronSchedule, clearMessageCollection);
console.log(`Deleting every hour job scheduled with cron schedule: ${cronSchedule}`);

process.on("SIGINT", async () => {
	console.log("Received SIGINT. Exiting...");
	process.exit(0);
});

process.on("SIGTERM", async () => {
	console.log("Received SIGTERM. Exiting...");
	process.exit(0);
});

process.stdin.resume();

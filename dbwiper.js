const { MongoClient } = require("mongodb");
const schedule = require("node-schedule");
require("dotenv").config();

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
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

		const result = await collection.deleteMany({});
		console.log(`Cleared collection ${collectionName} in database ${dbName}. Deleted ${result.deletedCount} documents.`);
	} catch (error) {
		console.error("Error clearing collection:", error);
	} finally {
		await client.close();
	}
}

const cronSchedule = "0 3 * * 0";
schedule.scheduleJob(cronSchedule, clearMessageCollection);

console.log(`Scheduled job to clear collection ${collectionName} in database ${dbName} every week on schedule: ${cronSchedule}`);

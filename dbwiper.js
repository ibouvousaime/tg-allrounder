const { MongoClient } = require("mongodb");
const schedule = require("node-schedule");
const dotenv = require("dotenv");
const moment = require("moment");

dotenv.config();

const mongoUri = process.env.MONGO_URI;
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
		console.log(await collection.countDocuments());
		const sevenDaysAgo = moment().subtract(7, "days").toDate();

		const result = await collection.deleteMany({
			date: { $lt: sevenDaysAgo },
		});
		console.log(`Cleared collection ${collectionName} in database ${dbName}. Deleted ${result.deletedCount} documents at ${new Date().toString()}.`);
	} catch (error) {
	} finally {
		await client.close();
	}
}
clearMessageCollection();
const cronSchedule = "*/30 * * * *";
schedule.scheduleJob(cronSchedule, clearMessageCollection);
console.log(`Deleting every hour job scheduled with cron schedule: ${cronSchedule}`);

process.stdin.resume();

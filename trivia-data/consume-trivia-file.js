const fs = require("fs");
const { MongoClient } = require("mongodb");
dotenv = require("dotenv");
dotenv.config();
const mongoUri = process.env.MONGO_URI;
const client = new MongoClient(mongoUri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});
const db = client.db("messages");
const collection = db.collection("trivia");

const filenames = ["web-dev.json", "web-train.json", "wikipedia-dev.json", "wikipedia-train.json"];

function loadJSONFile(filePath) {
	try {
		const data = fs.readFileSync(filePath, "utf8");
		return JSON.parse(data);
	} catch (err) {
		console.error("Error reading or parsing file:", err);
		return null;
	}
}
function filterQuestionFields(data) {
	return data
		.map((item) => {
			if (!item.Answer) return null;
			item.Answer = item.Answer.Value;
			const { Answer, Question, QuestionId, QuestionSource } = item;
			return { Answer, Question, QuestionId, QuestionSource };
		})
		.filter((element) => element !== null);
}

const filteredFiles = fs.readdirSync(".").filter((file) => file.startsWith("filtered_"));
for (const file of filteredFiles) {
	try {
		fs.unlinkSync(file);
		console.log(`Deleted file: ${file}`);
	} catch (err) {
		console.error(`Error deleting file ${file}:`, err);
	}
}
let total = 0;
for (const filename of filenames) {
	const triviaData = loadJSONFile(filename);
	if (triviaData) {
		const filteredData = filterQuestionFields(triviaData.Data);
		collection.insertMany(filteredData, (err, result) => {
			if (err) {
				console.error("Error inserting data into MongoDB:", err);
			} else {
				console.log(`Inserted ${result.insertedCount} documents from ${filename}`);
			}
		});
	}
}

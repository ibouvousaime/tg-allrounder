const { MongoClient, ObjectId } = require("mongodb");
const mongoUri = "mongodb://localhost:27017";

const client = new MongoClient(mongoUri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

const db = client.db("messages");
const collection = db.collection("messages");
async function generateAllEmbeddings() {
	collection
		.find({})
		.toArray()
		.then(async (docs) => {
			const docsToProcess = docs.filter((doc) => doc.text && !doc.text.trim().startsWith("/"));
			const total = docsToProcess.length;
			let i = 0;
			for (let doc of docsToProcess) {
				const embeddings = await model.embed([doc.text]);
				const embeddingsArrray = embeddings.arraySync()[0];
				const res = await collection.updateOne({ _id: new ObjectId(doc._id) }, { $set: { embeddings: embeddingsArrray } });
				i++;
			}
		});
}

generateAllEmbeddings();

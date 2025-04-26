const fs = require("fs");
const readline = require("readline");
const bookRegex = /BOOK\s([IVXLCDM]+)/;
const { MongoClient } = require("mongodb");
dotenv = require("dotenv");
dotenv.config();

const mongoUri = process.env.MONGO_URI;
const xml2js = require("xml2js");

const client = new MongoClient(mongoUri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});
const db = client.db("messages");
const collection = db.collection("books");

async function* readLargeFileGenerator(filePath) {
	const readStream = fs.createReadStream(filePath, { encoding: "utf8" });
	const rl = readline.createInterface({
		input: readStream,
		crlfDelay: Infinity,
	});

	for await (const line of rl) {
		yield line;
	}
}

async function extractBookContent(filePath, book) {
	let currentBook = 0;
	let number = 1;
	let i = 0;
	for await (let line of readLargeFileGenerator(filePath)) {
		if (line.replace(/[^\x00-\x7F]/g, "").trim().length == 0) continue;
		let bookLineMatch = line.match(bookRegex);
		if (bookLineMatch) {
			currentBook = romanToNumber(bookLineMatch[1]);
			number = 1;
			continue;
		}
		if (currentBook == 0) continue;
		const document = { book, bookNumber: currentBook, line, number };
		await collection.insertOne(document);
		i++;
		if (i % 100 == 0) console.log(document);
		number++;
	}
}
//console.log(romanToNumber("II"));

function extractXMLBookContent(filePath, bookName) {
	fs.readFile(filePath, (err, data) => {
		if (err) {
			console.error(err);
			return;
		}
		xml2js.parseString(data, async (err, result) => {
			if (err) {
				console.error(err);
				return;
			}
			const books = result["TEI.2"]["text"][0]["body"][0]["div1"];
			for (let book of books) {
				const bookDocument = { book: bookName, number: Number(book["$"]["n"]), content: book["p"][0]["_"] };
				console.log(book["p"][0]["milestone"]);
				await collection.insertOne(bookDocument);
			}
			process.exit(0);
		});
	});
}
extractXMLBookContent("odyssey.xml", "Odyssey");
extractXMLBookContent("iliad.xml", "Iliad");

/* extractBookContent("odyssey.mb.txt", "Odyssey");
extractBookContent("iliad.mb.txt", "Iliad"); */

function romanToNumber(roman) {
	const romanMap = {
		I: 1,
		V: 5,
		X: 10,
		L: 50,
		C: 100,
		D: 500,
		M: 1000,
	};

	let number = 0;
	let previousValue = 0;

	for (let i = roman.length - 1; i >= 0; i--) {
		const currentValue = romanMap[roman[i]];

		if (currentValue < previousValue) {
			number -= currentValue;
		} else {
			number += currentValue;
		}

		previousValue = currentValue;
	}

	return number;
}

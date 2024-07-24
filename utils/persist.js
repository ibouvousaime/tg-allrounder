const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "tmp", "settings.json");

function saveVariable(key, value) {
	let data = {};

	if (fs.existsSync(filePath)) {
		const rawData = fs.readFileSync(filePath);
		data = JSON.parse(rawData);
	}

	data[key] = value;

	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function fetchVariable(key) {
	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(filePath, JSON.stringify({}));
	}

	const rawData = fs.readFileSync(filePath);
	const data = JSON.parse(rawData);

	if (!(key in data)) {
		return null;
	}

	return data[key];
}

module.exports = { saveVariable, fetchVariable };

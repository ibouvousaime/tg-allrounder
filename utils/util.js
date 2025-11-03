function makeid(length) {
	var result = "";
	var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

function createMessageBlocks(text, limit = 3000) {
	const parts = [];
	let current = "";

	for (const line of text.split("\n")) {
		if ((current + "\n" + line).length > limit) {
			parts.push(current.trim());
			current = line;
		} else {
			current += (current ? "\n" : "") + line;
		}
	}

	if (current.trim()) parts.push(current.trim());
	return parts;
}
module.exports = { makeid, createMessageBlocks };

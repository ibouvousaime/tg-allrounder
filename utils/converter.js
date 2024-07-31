const extractAndConvertToCm = (str) => {
    if (!str) return 0;
	str = str.replace("‘", "'");
	const regex = /\b(\d+(\.\d+)?)\s*(feet|ft|')?\s*(\d+(\.\d+)?)?\s*(inches|in|")?\b/gi;
	let match;
	let totalCm = 0;

	while ((match = regex.exec(str)) !== null) {
		const feetValue = match[1] ? parseFloat(match[1]) : 0;
		const inchValue = match[4] ? parseFloat(match[4]) : 0;

		if (match[3] === "feet" || match[3] === "ft" || match[3] === "'") {
			totalCm += feetValue * 30.48;
		}

		if (match[6] === "inches" || match[6] === "in" || match[6] === '"') {
			totalCm += inchValue * 2.54;
		} else if (!match[6] && match[3] === "'") {
			totalCm += inchValue * 2.54;
		}
	}

	return totalCm;
};

module.exports = { extractAndConvertToCm };

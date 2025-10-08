const { cards } = require("./cardInfo");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const os = require("os");
function getReading(count) {
	return new Promise(async (resolve, reject) => {
		const tarotCards = cards;
		const shuffledCards = tarotCards.sort(() => Math.random() - 0.5);
		const selectedCards = shuffledCards.slice(0, count);
		const reading = selectedCards.map((card) => ({
			name: card.name,
			image: card.filename,
			reversed: false,
		}));
		const imagePaths = reading.map((card) => "cards/" + card.image);
		const slideshowPath = `${new Date().getTime()}.mp4`;
		//await generateSlideShow(reading, slideshowPath);
		resolve({ imagePaths, slideshowPath, reading: reading.map((card) => card.name) });
	});
}

function generateSlideShow(cards, outputPath, durationPerImage = 3, fps = 30) {
	const imagePaths = cards.map((card) => card.image);

	return new Promise((resolve, reject) => {
		const tempFile = path.join(os.tmpdir(), `ffmpeg-input-${Date.now()}.txt`);

		try {
			const fileContent = imagePaths
				.map((p, index) => {
					const card = cards[index];
					cardFullName = card.name + (card.reversed ? " (reversed)" : "");
					let line = `file '${path.resolve("cards/" + (card.reversed ? "flipped_" : "") + p)}`;

					line += `\nduration ${durationPerImage}`;
					return line;
				})
				.join("\n");
			fs.writeFileSync(tempFile, fileContent, "utf-8");
		} catch (err) {
			reject(err);
		}
		ffmpeg()
			.input(tempFile)
			.inputOptions(["-f concat", "-safe 0"])
			.outputFPS(fps)
			.videoCodec("libx264")
			.outputOptions("-pix_fmt yuv420p")
			.size("1280x720")
			.on("end", () => {
				fs.unlinkSync(tempFile);
				resolve();
			})
			.on("error", (err) => {
				fs.unlinkSync(tempFile);
				reject(err);
			})
			.save(outputPath);
	});
}

module.exports = { getReading };

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
			image: "cards/" + card.filename,
		}));
		const imagePaths = reading.map((card) => card.image);
		const slideshowPath = `${new Date().getTime()}.mp4`;
		await generateSlideShow(imagePaths, slideshowPath);
		resolve({ slideshowPath, reading: reading.map((card) => card.name).join(", ") });
	});
}

function generateSlideShow(imagePaths, outputPath, durationPerImage = 3, fps = 30) {
	return new Promise((resolve, reject) => {
		const tempFile = path.join(os.tmpdir(), `ffmpeg-input-${Date.now()}.txt`);

		try {
			const fileContent = imagePaths.map((p) => `file '${path.resolve(p)}'\nduration ${durationPerImage}`).join("\n");
			console.log(fileContent, tempFile);
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

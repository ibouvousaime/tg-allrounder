const axios = require("axios");
const Ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

async function textToSpeech(text, voice, fullOutputPath = "output.wav") {
	const url = "http://localhost:5000/";
	const data = { text, voice };
	try {
		const response = await axios({
			method: "POST",
			url: url,
			data: data,
			responseType: "stream",
		});

		const writer = fs.createWriteStream(fullOutputPath);

		response.data.pipe(writer);

		return new Promise((resolve, reject) => {
			writer.on("finish", () => {
				console.log(`saved audio to ${fullOutputPath}`);
				resolve(fullOutputPath);
			});
			writer.on("error", (err) => {
				console.error(err);
				fs.unlink(fullOutputPath, () => reject(err));
			});
		});
	} catch (error) {
		if (error.response) {
			console.error(`Error: Server responded with status ${error.response.status}`);

			throw new Error(`error code ${error.response.status}`);
		} else if (error.request) {
			throw new Error("dead server");
		} else {
			console.error(error.message);
			throw error;
		}
	}
}

/* async function createConversationAudio(conversation, finalOutputPath = "conversation.wav", apiUrl = "http://127.0.0.1:6000/create-conversation-audio/") {
	try {
		const formData = new FormData();
		formData.append("conversation_json", JSON.stringify(conversation));
		formData.append("output_filename", path.basename(finalOutputPath));

		const response = await axios.post(apiUrl, formData, {
			responseType: "arraybuffer",
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API request failed with status ${response.status}: ${errorText}`);
		}

		const audioArrayBuffer = response.data;

		const audioBuffer = Buffer.from(audioArrayBuffer);

		const outputDir = path.dirname(finalOutputPath);
		await fs.mkdir(outputDir, { recursive: true });

		await fs.writeFile(finalOutputPath, audioBuffer);

		console.log(`saved conversation audio to ${finalOutputPath}`);
		return finalOutputPath;
	} catch (error) {
		console.error("Error:", error);
		throw error;
	}
} */

async function createConversationAudio(conversation, finalOutputPath = "conversation.wav") {
	const tempDir = await fs.promises.mkdtemp(path.join(__dirname, "temp-audio-"));
	console.log(`Created temporary directory: ${tempDir}`);
	const audioClips = [];

	try {
		const generationPromises = conversation.map((part, index) => {
			const clipPath = path.join(tempDir, `output-${index}.wav`);
			audioClips.push(clipPath);
			return textToSpeech(part.text, part.voice, clipPath);
		});

		await Promise.all(generationPromises);

		await new Promise((resolve, reject) => {
			const command = Ffmpeg();
			audioClips.forEach((clip) => command.input(clip));

			command
				.on("error", (err) => {
					console.error("ffmpeg merge error:", err);
					reject(err);
				})
				.on("end", () => {
					resolve(finalOutputPath);
				})
				.mergeToFile(finalOutputPath, path.dirname(finalOutputPath));
		});

		return finalOutputPath;
	} catch (error) {
		console.error("conversation creation error :", error);
		throw error;
	} finally {
		await fs.promises.rm(tempDir, { recursive: true, force: true });
	}
}

module.exports = { textToSpeech, createConversationAudio };

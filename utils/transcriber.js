const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const execAsync = promisify(exec);

async function withBurnedSubtitles(
	inputVideoPath,
	callback,
	{ language = "en", modelPath = os.homedir() + "/whisper.cpp/models/ggml-base.bin", whisperBin = os.homedir() + "/whisper.cpp/build/bin/whisper-cli" } = {}
) {
	if (!fsSync.existsSync(inputVideoPath)) {
		throw new Error("Input video does not exist");
	}

	const tmpId = crypto.randomUUID();
	const tempDir = path.join("/tmp", `subs-${tmpId}`);

	const subtitlePath = path.join(tempDir, "subtitles.srt");
	const outputVideoPath = path.join(tempDir, "output.mp4");

	await fs.mkdir(tempDir, { recursive: true });
	const audioDestinationFile = path.join(tempDir, "audio.wav");
	const commandConvertToAudio = `ffmpeg -y -i "${inputVideoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioDestinationFile}"`;
	await execAsync(commandConvertToAudio);

	try {
		const output = await execAsync(
			[
				whisperBin,
				`-m "${modelPath}"`,
				`-l ${language}`,
				"-osrt",
				"--threads 2",
				`-of "${path.join(tempDir, "subtitles")}"`,
				`"${audioDestinationFile}"`,
				"--translate",
			].join(" "),
			{
				maxBuffer: 1024 * 1024 * 10,
			}
		);
		console.log("Whisper output:", output.stdout, output.stderr);
		if (!fsSync.existsSync(subtitlePath)) {
			throw new Error("no srt generated");
		}

		await execAsync(
			[
				"ffmpeg",
				"-y",
				`-i "${inputVideoPath}"`,
				`-vf "subtitles='${subtitlePath}':force_style='FontSize=16,Outline=2'"`,
				"-c:a copy",
				`"${outputVideoPath}"`,
			].join(" ")
		);

		await callback({
			tempDir,
			subtitlePath,
			outputVideoPath,
		});
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
}

module.exports = {
	withBurnedSubtitles,
};

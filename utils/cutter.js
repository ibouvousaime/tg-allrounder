const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const execAsync = promisify(exec);

async function cutVideo(inputVideoPath, start, end, callback) {
	if (!fsSync.existsSync(inputVideoPath)) {
		throw new Error("Input video does not exist");
	}

	const tmpId = crypto.randomUUID();
	const tempDir = path.join(os.tmpdir(), `cut-${tmpId}`);
	const outputVideoPath = path.join(tempDir, "cut.mp4");

	await fs.mkdir(tempDir, { recursive: true });

	const startArg = formatTime(start);
	const endArg = formatTime(end);
	console.log({ startArg, endArg, start, end });
	const ffmpegCmd = ["ffmpeg", "-y", `-i "${inputVideoPath}"`, `-ss ${startArg}`, `-to ${endArg}`, "-c copy", `"${outputVideoPath}"`].join(" ");

	try {
		await execAsync(ffmpegCmd);
		await callback({
			tempDir,
			outputVideoPath,
		});
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
}

function formatTime(time) {
	const seconds = Number.parseFloat(time);
	if (!Number.isNaN(seconds) && !time.includes(":")) {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
	}
	const parts = String(time).split(":");
	if (parts.length === 3) {
		return time;
	}
	if (parts.length === 2) {
		return `00:${time}`;
	}
	return time;
}

module.exports = {
	cutVideo,
};

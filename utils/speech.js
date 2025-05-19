const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function textToSpeechBufferLinux(text) {
	return new Promise((resolve, reject) => {
		const tmpFile = path.join(os.tmpdir(), `tts-${Date.now()}.wav`);
		const command = `text2wave  "${text.replace(/"/g, '\\"')}" -w ${tmpFile}`;

		exec(command, (err) => {
			if (err) return reject(new Error("espeak failed: " + err.message));

			fs.readFile(tmpFile, (err, data) => {
				fs.unlink(tmpFile, () => {});
				if (err) return reject(err);
				resolve(data);
			});
		});
	});
}

module.exports = { textToSpeechBufferLinux };

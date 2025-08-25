const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const fs = require("fs");
const { promisify } = require("node:util");
const execPromise = promisify(exec);

function makeid(length) {
	var result = "";
	var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

async function extractAndEchoSocialLink(text, callback) {
	const socialLinkRegex = /(https?:\/\/(www\.)?((tiktok\.com|vm\.tiktok\.com|instagram\.com)\/|youtube\.com\/shorts\/)[^\s]+)/;
	const match = text.match(socialLinkRegex);
	if (!match || !match[0]) {
		return;
	}

	const link = match[0];
	console.log(`Found link: ${link}`);

	const destinationFolder = path.join(os.tmpdir(), makeid(20));
	const filePath = path.join(destinationFolder, "video.%(ext)s");
	fs.mkdirSync(destinationFolder);
	const ytDlpCommand = `${os.homedir()}/.local/bin/yt-dlp "${link}" -o "${filePath}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --cookies ${os.homedir()}/cookies.txt `;
	const galleryDlCommand = `${os.homedir()}/.local/bin/gallery-dl "${link}" --dest "${destinationFolder}" --cookies ${os.homedir()}/cookies.txt`;

	try {
		try {
			await execPromise(ytDlpCommand);
		} catch (ytDlpError) {
			console.log(ytDlpError);
			console.error(`yt-dlp failed, trying gallery-dl...`);
			await execPromise(galleryDlCommand);
			usedGalleryDL = true;
		}

		//await flattenDirectory(destinationFolder);
		const files = getAllFilesSync(destinationFolder);
		if (files) {
			await callback(files);
		} else {
			console.error("Download succeeded, but no file was found.");
		}
	} catch (error) {
		console.log(galleryDlCommand);
		console.error(`All download attempts failed: ${error}`);
	} finally {
		if (fs.existsSync(destinationFolder)) {
			fs.rmSync(destinationFolder, { recursive: true, force: true });
		}
	}
}

const getAllFilesSync = (dirPath, arrayOfFiles = []) => {
	const files = fs.readdirSync(dirPath);
	files.forEach((file) => {
		const fullPath = path.join(dirPath, file);

		if (fs.statSync(fullPath).isDirectory()) {
			getAllFilesSync(fullPath, arrayOfFiles);
		} else {
			arrayOfFiles.push(fullPath);
		}
	});

	return arrayOfFiles;
};

module.exports = { extractAndEchoSocialLink };

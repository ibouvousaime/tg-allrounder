const os = require("os");
const { exec } = require("child_process");
const fs = require("fs");
const { promisify } = require("node:util");
const execPromise = promisify(exec);
const SpottyDL = require("spottydl");
const axios = require("axios");
const { makeid } = require("./util");
const { spawn } = require("node:child_process");
const path = require("path");
const crypto = require("crypto");

async function loadMusicModule() {
	const musicModule = await import("ytmusic-api");

	const YTMusic = musicModule.default;
	return YTMusic;
}

function spawnPromise(command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			shell: true,
		});

		child.stdout.on("data", (data) => {
			process.stdout.write(data);
		});

		child.stderr.on("data", (data) => {
			process.stderr.write(data);
		});

		child.on("error", reject);

		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`yt-dlp exited with code ${code}`));
			}
		});
	});
}

async function extractAndEchoSocialLink(text, callback) {
	let audioMode = false;
	let filename = "video";
	const { spotifyConvertedLink, name } = await getSpotifyMusicLink(text);
	if (spotifyConvertedLink) {
		text = spotifyConvertedLink;
		audioMode = true;
		filename = name;
		console.log("spotify detected", spotifyConvertedLink);
	}
	const socialLinkRegex =
		/(https?:\/\/(www\.)?((tiktok\.com|vm\.tiktok\.com|music\.youtube\.com|soundcloud\.com|on\.soundcloud\.com)\/|youtube\.com\/shorts\/)[^\s]+)/;

	const match = text.match(socialLinkRegex);
	if (!match || !match[0]) {
		return;
	}

	const link = match[0];
	if (link.includes("soundcloud")) audioMode = true;
	const destinationFolder = path.join(os.tmpdir(), makeid(20));
	fs.mkdirSync(destinationFolder);
	const ytDlpCommand = [
		`${os.homedir()}/.local/bin/yt-dlp`,
		`--embed-metadata`,
		`"${link}"`,
		`-P "${destinationFolder}"`,
		audioMode ? '-x --audio-format mp3 -f "bestaudio/best"' : '-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"',
		`--cookies ${os.homedir()}/cookies.txt`,
	].join(" ");
	const galleryDlCommand = `${os.homedir()}/.local/bin/gallery-dl "${link}" --dest "${destinationFolder}" --cookies ${os.homedir()}/cookies.txt`;
	console.log(ytDlpCommand);
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
		setTimeout(() => {
			if (fs.existsSync(destinationFolder)) {
				fs.rmSync(destinationFolder, { recursive: true, force: true });
			}
		}, 5000);
	}
}

async function downloadVideoFromUrl(text, forceAudio, callback) {
	const urlRegex = /(https?:\/\/[^\s]+)/;
	const match = text.match(urlRegex);

	if (!match || !match[0]) {
		console.error("No URL found in the provided text.");
		return;
	}

	const link = match[0];
	const destinationFolder = path.join(os.tmpdir(), makeid(20));
	fs.mkdirSync(destinationFolder);

	let isAudioOnly = false;
	if (forceAudio) {
		isAudioOnly = true;
	}
	const ytdlpPath = `${os.homedir()}/.local/bin/yt-dlp`;
	const ytDlpCommandArgs = [
		"--embed-metadata",
		`"${link}"`,
		`-P "${destinationFolder}"`,

		isAudioOnly ? '-x --audio-format mp3 -f "bestaudio/best"' : '-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"',
		" --trim-filenames 10",
		"--merge-output-format mp4",
		'--postprocessor-args "ffmpeg:-movflags +faststart"',
		`--cookies ${os.homedir()}/cookies.txt`,
	];
	console.log("downloading with", ytDlpCommandArgs);
	try {
		await spawnPromise(ytdlpPath, ytDlpCommandArgs);

		const files = getAllFilesSync(destinationFolder);
		if (files && files.length > 0) {
			await callback(files);
		} else {
			console.error("no files found after download command");
		}
	} catch (error) {
		console.error(`download error: "${link}":`, error);
	} finally {
		setTimeout(() => {
			if (fs.existsSync(destinationFolder)) {
				fs.rmSync(destinationFolder, { recursive: true, force: true });
			}
		}, 10000);
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

function findSpotifyTrackLink(text) {
	const spotifyRegex = /(?:https?:\/\/open\.spotify\.com\/|spotify:)(track|album)[:\/]([a-zA-Z0-9]+)/;

	const matches = text.match(spotifyRegex);

	if (matches) {
		const fullLink = matches[0];
		const type = matches[1];
		const id = matches[2];

		return { fullLink, type, id };
	} else {
		return { fullLink: null, type: null, id: null };
	}
}

async function getSpotifyMusicLink(link) {
	const { fullLink, type } = findSpotifyTrackLink(link);
	if (fullLink) {
		const YTMusic = await loadMusicModule();
		const ytmusic = new YTMusic();
		await ytmusic.initialize(/* { cookies: fs.readFileSync(path.join(os.homedir(), "cookies.txt")).toString() } */);

		if (type == "track") {
			const songData = await SpottyDL.getTrack(fullLink);
			const fullSongName = `${songData.artist} - ${songData.title}`;
			const result = await ytmusic.searchSongs(fullSongName);
			return { spotifyConvertedLink: `https://music.youtube.com/watch?v=${result[0].videoId}`, name: fullSongName };
		} else if (type == "album") {
			const albumData = await SpottyDL.getAlbum(fullLink);
			const fullAlbumName = `${albumData.artist} - ${albumData.name}}`;
			const youtubeAlbums = await ytmusic.searchAlbums(fullAlbumName);
			return { spotifyConvertedLink: `https://music.youtube.com/playlist?list=${youtubeAlbums[0].playlistId}`, name: fullAlbumName };
		}
	} else return { spotifyConvertedLink: null, name: null };
}

async function getAlbumFromSong(songName) {
	const YTMusic = await loadMusicModule();
	const ytmusic = new YTMusic();
	await ytmusic.initialize();
	const youtubeAlbums = await ytmusic.searchAlbums(songName);
	return {
		albumLink: `https://music.youtube.com/playlist?list=${youtubeAlbums[0].playlistId}`,
		name: `${youtubeAlbums[0].artist.name} - ${youtubeAlbums[0].name}`,
	};
}

async function downloadImageAsBuffer(url) {
	try {
		const response = await axios.get(url, {
			responseType: "arraybuffer",
		});

		const imageBuffer = Buffer.from(response.data, "binary");

		return imageBuffer;
	} catch (error) {
		throw new Error(`code: ${error.response ? error.response.status : "N/A"}`);
	}
}

module.exports = {
	extractAndEchoSocialLink,
	getSpotifyMusicLink,
	downloadImageAsBuffer,
	getAlbumFromSong,
	downloadVideoFromUrl,
};

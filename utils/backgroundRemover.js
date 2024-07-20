const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

///
//
//
//
function removeImageBackground(buffer) {
	return new Promise((resolve, reject) => {
		try {
			const filename = (Math.random() + 1).toString(36);
			const fullPath = path.join("tmp", filename);
			fs.writeFileSync(fullPath, buffer);
			exec(`rembg i ${fullPath} ${fullPath}-done`, (err, stdout, stderr) => {
				if (err) {
					console.error(err, stderr);
					reject();
				}
				const output = fs.readFileSync(`${fullPath}-done`, buffer);
				setTimeout(() => {
					fs.unlinkSync(fullPath);
					fs.unlinkSync(`${fullPath}-done`);
				}, 2000);
				resolve(output);
			});
		} catch (err) {
			console.error(err);
			reject();
		}
	});
}

module.exports = { removeImageBackground };

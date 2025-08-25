const { Rettiwt } = require("rettiwt-api");
const dotenv = require("dotenv");
dotenv.config();
const rettiwt = new Rettiwt({ apiKey: process.env.TWITTER_API_KEY });

function extractTweetId(url) {
	const regex = /status\/(\d+)/;
	const match = url.match(regex);

	if (match) {
		const tweetId = match[1];
		return tweetId;
	} else {
		return null;
	}
}

function extractTweet(url) {
	return new Promise((resolve, reject) => {
		const tweetId = extractTweetId(url);

		rettiwt.tweet
			.details(tweetId, "id")
			.then((res) => {
				resolve(res);
			})
			.catch((err) => {
				console.error(err);
				reject();
			});
	});
}

module.exports = { extractTweet, extractTweetId };

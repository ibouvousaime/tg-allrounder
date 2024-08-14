const testurl = "https://x.com/islaminchina/status/1823459291711578224?t=z45p1hf3ScMlszuqHp35PA&s=19";
const { Rettiwt } = require("rettiwt-api");
const rettiwt = new Rettiwt();

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
    return new Promise((resolve, reject)=> {
        const tweetId = extractTweetId(url);
        rettiwt.tweet
            .details(tweetId)
            .then((res) => {
                resolve(res)
            })
            .catch((err) => {
                console.error(err)
                reject()
            });
   
    })
}

module.exports = { extractTweet, extractTweetId };

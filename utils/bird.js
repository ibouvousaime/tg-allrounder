const { Rettiwt } = require("rettiwt-api");
const dotenv = require("dotenv");
dotenv.config();
const rettiwt = new Rettiwt({ apiKey: process.env.TWITTER_API_KEY });
const instagramDl = require("@sasmeee/igdl");

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

function extractInstaLinks(text) {
  const reelRegex =
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/[a-zA-Z0-9_-]+\/?/g;
  const reelLinks = text.match(reelRegex);
  return reelLinks || [];
}

function getInstagramVideoLink(text) {
  return new Promise(async (resolve, reject) => {
    try {
      const links = extractInstaLinks(text);
      console.log(links);
      let output = [];
      for (let link of links) {
        console.log(link);
        output.push(await instagramDl(link));
      }
      resolve(output);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { extractTweet, extractTweetId, getInstagramVideoLink };

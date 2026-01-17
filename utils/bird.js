const { Rettiwt } = require("rettiwt-api");
const dotenv = require("dotenv");
const fs = require("fs");
dotenv.config();
const rettiwt = new Rettiwt(/* { apiKey: process.env.TWITTER_API_KEY } */);
const puppeteer = require("puppeteer");
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

async function extractTweet(urlOrId, isId = false, visited = new Set()) {
	const tweetId = isId ? urlOrId : extractTweetId(urlOrId);

	if (visited.has(tweetId)) return null;
	visited.add(tweetId);

	const res = await rettiwt.tweet.details(tweetId, "id");
	if (!res) return null;
	if (res?.replyTo) {
		const replyId = res.replyTo;

		res.replyTo = await extractTweet(replyId, true, visited);
	}

	return res;
}

function renderMedia(media = []) {
	if (!media.length) return "";

	const isGrid = media.length > 1;

	return `
		<div style="
			margin-top: 12px;
			border-radius: 16px;
			overflow: hidden;
			border: 1px solid #333;
			max-width: 100%;
			${isGrid ? "display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px;" : ""}
		">
			${media
				.slice(0, 4)
				.map(
					(m) => `
						<div style="
							max-height: 420px;
							overflow: hidden;
							background: #000;
						"> ${
							m.type == "PHOTO"
								? `<img
								src="${m.url}"
								style="
									width: 100%;
									height: auto;
									max-height: 420px;
									object-fit: contain;
									display: block;
								"
							/>`
								: `<video
								src="${m.url}"
								style="
									width: 100%;
									height: auto;
									max-height: 420px;
									object-fit: contain;
									display: block;
								"
								controls
							></video>`
						}
							
						</div>
					`
				)
				.join("")}
		</div>
	`;
}
function renderReplyChain(tweet) {
	if (!tweet?.replyTo) return "";

	return `
		${renderReplyChain(tweet.replyTo)}
		<div style="color:#8b98a5;font-size:14px;margin-bottom:6px;">
			Replying to <span style="color:#1d9bf0;">@${tweet.replyTo.tweetBy.userName}</span>
		</div>
		${renderMiniTweet(tweet.replyTo)}
	`;
}
function renderMiniTweet(t) {
	if (!t) return "";
	const quotedMediaHtml = renderMedia(t.quoted?.media);

	const media = renderMedia(t.media);

	return `
    <div style="
      border: 1px solid #333;
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 12px;
      background: rgba(255,255,255,0.03);
    ">
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <img src="${t.tweetBy.profileImage}" style="width:20px;height:20px;border-radius:50%;margin-right:8px;" />
        <span style="font-weight:700;font-size:14px;">${t.tweetBy.fullName}</span>
        <span style="color:#8b98a5;font-size:14px;margin-left:4px;">@${t.tweetBy.userName}</span>
      </div>

      <div style="font-size:14px;color:#eff3f4;line-height:1.4;">
        ${t.fullText.replace(/\s+https:\/\/t\.co\/\w+$/, "").trim()}
      </div>

      ${media}

	     ${
					t.quoted
						? `
        <div style="border: 1px solid #333; border-radius: 16px; padding: 12px; margin-top: 10px; background: rgba(255,255,255,0.03);">
          <div style="display: flex; align-items: center; margin-bottom: 4px;">
            <img src="${t.quoted.tweetBy.profileImage}" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 8px;" />
            <span style="font-weight: 700; font-size: 14px;">${t.quoted.tweetBy.fullName}</span>
            <span style="color: #8b98a5; font-size: 14px; margin-left: 4px;">@${t.quoted.tweetBy.userName}</span>
          </div>
          <div style="font-size: 14px; color: #eff3f4;">
            ${t.quoted.fullText.replace(/\s+https:\/\/t\.co\/\w+$/, "").trim()}
          </div>
          ${quotedMediaHtml}
        </div>
      `
						: ""
				}
    </div>
  `;
}

function renderTweet(tweet) {
	const mainMediaHtml = renderMedia(tweet.media);
	const quotedMediaHtml = renderMedia(tweet.quoted?.media);

	return `
    <div style="
      background: linear-gradient(135deg, #15202b 0%, #10171e 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 20px;
      border-radius: 20px;
      max-width: 550px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    ">
  ${renderReplyChain(tweet)} 
      <!-- Header -->
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <img src="${tweet.tweetBy.profileImage}" style="width: 48px; height: 48px; border-radius: 50%; margin-right: 12px;" />
        <div style="flex-grow: 1;">
          <div style="font-weight: 800; font-size: 16px; display: flex; align-items: center;">
            ${tweet.tweetBy.fullName}
            ${tweet.tweetBy.isVerified ? '<span style="color: #1d9bf0; margin-left: 4px;">✓</span>' : ""}
          </div>
          <div style="color: #8b98a5; font-size: 15px;">@${tweet.tweetBy.userName}</div>
        </div>
        <div style="color: #8b98a5; font-size: 20px;">...</div>
      </div>

      <div style="font-size: 19px; line-height: 1.4;">
        ${tweet.fullText.replace(/\s+https:\/\/t\.co\/\w+$/, "").trim()}
      </div>

      ${mainMediaHtml}

      ${
				tweet.quoted
					? `
        <div style="border: 1px solid #333; border-radius: 16px; padding: 12px; margin-top: 10px; background: rgba(255,255,255,0.03);">
          <div style="display: flex; align-items: center; margin-bottom: 4px;">
            <img src="${tweet.quoted.tweetBy.profileImage}" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 8px;" />
            <span style="font-weight: 700; font-size: 14px;">${tweet.quoted.tweetBy.fullName}</span>
            <span style="color: #8b98a5; font-size: 14px; margin-left: 4px;">@${tweet.quoted.tweetBy.userName}</span>
          </div>
          <div style="font-size: 14px; color: #eff3f4;">
            ${tweet.quoted.fullText.replace(/\s+https:\/\/t\.co\/\w+$/, "").trim()}
          </div>
          ${quotedMediaHtml}
        </div>
      `
					: ""
			}

      <div style="color: #8b98a5; font-size: 14px; margin-top: 15px; padding-bottom: 12px; border-bottom: 1px solid #333;">
        ${new Date(tweet.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · 
        ${new Date(tweet.createdAt).toLocaleDateString()}
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 12px; color: #8b98a5; font-size: 13px; font-weight: 600;">
        <span><strong style="color: white;">${tweet.retweetCount.toLocaleString()}</strong> Retweets</span>
        <span><strong style="color: white;">${tweet.quoteCount.toLocaleString()}</strong> Quotes</span>
        <span><strong style="color: white;">${tweet.likeCount.toLocaleString()}</strong> Likes</span>
        <span><strong style="color: white;">${tweet.bookmarkCount.toLocaleString()}</strong> Bookmarks</span>
      </div>

    </div>
  `;
}

async function generateTweetScreenshot(tweetData) {
	const htmlContent = renderTweet(tweetData);
	const browser = await puppeteer.launch({
		headless: "new",
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	const page = await browser.newPage();

	await page.setViewport({
		width: 800,
		height: 1000,
		deviceScaleFactor: 2,
	});

	const fullHtml = `
    <html>
      <style>
        body { 
          margin: 0; 
          padding: 40px; 
          background-color: #000; 
          display: inline-block; 
        }
      </style>
      <body>
        <div id="tweet-container">
          ${htmlContent}
        </div>
      </body>
    </html>
  `;

	await page.setContent(fullHtml, { waitUntil: "networkidle0" });

	const element = await page.$("#tweet-container");

	const imageBuffer = await element.screenshot({
		omitBackground: true,
	});

	await browser.close();
	return imageBuffer;
}

module.exports = { extractTweet, extractTweetId, generateTweetScreenshot };

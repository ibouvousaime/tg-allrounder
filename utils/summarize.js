const Parser = require("@postlight/parser");
const { extract } = require("@extractus/article-extractor");
const puppeteer = require("puppeteer");
const { Readability } = require("@mozilla/readability");
const { parseHTML } = require("linkedom");

let summarizationPipelinePromise;

async function getSummarizationPipeline() {
	if (!summarizationPipelinePromise) {
		summarizationPipelinePromise = import("@xenova/transformers").then(({ pipeline }) =>
			pipeline("summarization", "Xenova/distilbart-cnn-12-6", {
				quantized: true,
			}),
		);
	}
	return summarizationPipelinePromise;
}

async function summarizeText(text) {
	const summarizer = await getSummarizationPipeline();
	const summary = await summarizer(text, {
		max_length: 150,
		min_length: 30,
		do_sample: false,
	});
	return summary[0].summary_text;
}

function isMeaningfulContent(content) {
	if (!content) return false;
	const text = content
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return text.length > 500;
}

async function extractWithPostlightParser(url) {
	try {
		const article = await Parser.parse(url);
		if (article?.content && isMeaningfulContent(article.content)) {
			return article.content;
		}
	} catch (error) {
		console.error("Postlight parser failed:", error.message);
	}
	return null;
}

async function extractWithArticleExtractor(url) {
	try {
		const article = await extract(url);
		if (article?.content && isMeaningfulContent(article.content)) {
			return article.content.replaceAll(/<[^>]*>/g, "");
		}
	} catch (error) {
		console.error("Article extractor failed:", error.message);
	}
	return null;
}

async function extractWithReadability(url) {
	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
			},
		});
		const html = await response.text();
		const { document } = parseHTML(html);
		const reader = new Readability(document);
		const article = reader.parse();
		if (article?.content && isMeaningfulContent(article.content)) {
			return article.content;
		}
	} catch (error) {
		console.error("Readability extraction failed:", error.message);
	}
	return null;
}

async function extractWithPuppeteer(url) {
	let browser;
	try {
		browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
		const page = await browser.newPage();
		await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
		await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

		const content = await page.content();
		const text = content
			.replace(/<[^>]*>/g, " ")
			.replace(/\s+/g, " ")
			.trim();

		if (text.length > 500) {
			return `<div>${text}</div>`;
		}
	} catch (error) {
		console.error("Puppeteer extraction failed:", error.message);
	} finally {
		if (browser) {
			await browser.close();
		}
	}
	return null;
}

async function extractArticleContent(url) {
	console.log(`Extracting article from: ${url}`);

	let content = await extractWithPostlightParser(url);
	if (content) {
		console.log("✓ Extracted with Postlight parser");
		return content;
	}

	content = await extractWithArticleExtractor(url);
	if (content) {
		console.log("✓ Extracted with article-extractor");
		return content;
	}

	content = await extractWithReadability(url);
	if (content) {
		console.log("✓ Extracted with Readability");
		return content;
	}

	content = await extractWithPuppeteer(url);
	if (content) {
		console.log("✓ Extracted with Puppeteer");
		return content;
	}

	throw new Error("Failed to extract article content from URL with any method");
}

async function summarizeUrl(url) {
	try {
		const articleContent = await extractArticleContent(url);
		const summary = await summarizeText(articleContent);
		return summary;
	} catch (error) {
		console.error("Summarization failed:", error);
		throw error;
	}
}

module.exports = { summarizeText, summarizeUrl, extractArticleContent };

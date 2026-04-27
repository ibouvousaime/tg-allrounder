#!/usr/bin/env node

const https = require("https");
const http = require("http");
const net = require("net");
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const SHORTCODE_RE = /instagram\.com\/(?:reels?|p|tv)\/([a-zA-Z0-9_-]+)/;
const RATE_LIMIT_WAIT = 120_000;
const MAX_RETRIES = 3;

const PROXY_URL = getProxyUrl();

function getProxyUrl() {
	const idx = process.argv.indexOf("--proxy");
	if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
	return process.env.IG_PROXY || null;
}

function randBase64(len) {
	return crypto.randomBytes(len).toString("base64url");
}

function extractShortcode(input) {
	const trimmed = input.trim();
	const m = trimmed.match(SHORTCODE_RE);
	if (m) return m[1];
	if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
	throw new Error(`Could not extract shortcode from: ${input}`);
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

// --- Proxy CONNECT tunnel ---

class ProxyTunnel {
	constructor(proxyUrl) {
		const p = new URL(proxyUrl);
		this.proxyHost = p.hostname;
		this.proxyPort = parseInt(p.port) || 3128;
	}

	async connectTLS(targetHost, targetPort = 443) {
		return new Promise((resolve, reject) => {
			const socket = net.connect(this.proxyPort, this.proxyHost, () => {
				socket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`);
			});
			let buf = "";
			socket.on("data", (chunk) => {
				buf += chunk.toString();
				if (buf.includes("\r\n\r\n")) {
					if (buf.startsWith("HTTP/1.1 200") || buf.startsWith("HTTP/1.0 200")) {
						const tlsSocket = tls.connect({ socket, host: targetHost, servername: targetHost }, () => resolve(tlsSocket));
						tlsSocket.on("error", reject);
					} else {
						reject(new Error(`Proxy CONNECT failed: ${buf.split("\r\n")[0]}`));
					}
				}
			});
			socket.on("error", reject);
			socket.on("close", (hadErr) => {
				if (hadErr) reject(new Error("Proxy connection closed"));
			});
		});
	}
}

function parseRawResponse(raw) {
	const headerEnd = raw.indexOf("\r\n\r\n");
	if (headerEnd === -1) return null;
	const headerPart = raw.substring(0, headerEnd);
	let body = raw.substring(headerEnd + 4);

	const statusMatch = headerPart.match(/HTTP\/\d\.\d (\d+)/);
	if (!statusMatch) return null;

	const headers = {};
	for (const line of headerPart.split("\r\n").slice(1)) {
		const colon = line.indexOf(": ");
		if (colon !== -1) headers[line.substring(0, colon).toLowerCase()] = line.substring(colon + 2);
	}
	const statusCode = parseInt(statusMatch[1]);

	if (headers["transfer-encoding"] === "chunked") {
		let decoded = "";
		let pos = 0;
		while (pos < body.length) {
			const chunkEnd = body.indexOf("\r\n", pos);
			if (chunkEnd === -1) break;
			const size = parseInt(body.substring(pos, chunkEnd), 16);
			if (isNaN(size) || size === 0) break;
			decoded += body.substring(chunkEnd + 2, chunkEnd + 2 + size);
			pos = chunkEnd + 2 + size + 2;
		}
		body = decoded;
	}

	return { statusCode, headers, body: Buffer.from(body) };
}

function makeRawRequest(socket, method, pathname, search, headers, body) {
	const reqLine = `${method} ${pathname}${search} HTTP/1.1\r\n`;
	const hdrStr = Object.entries(headers)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\r\n");
	let raw = reqLine + hdrStr + "\r\n\r\n";
	if (body) raw += body;
	socket.write(raw);
}

function collectRawResponse(socket, timeout = 30000) {
	return new Promise((resolve, reject) => {
		let buf = "";
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			socket.destroy();
			reject(new Error("Request timeout"));
		}, timeout);

		socket.on("data", (chunk) => {
			buf += chunk.toString();
			if (!timedOut) {
				// Check if we have complete response (based on headers)
				if (buf.includes("\r\n\r\n")) {
					const parsed = parseRawResponse(buf);
					if (parsed) {
						const cl = parseInt(parsed.headers["content-length"]);
						if (cl !== undefined && !isNaN(cl)) {
							if (buf.length >= headerEnd(parsed.headers) + 4 + cl) {
								clearTimeout(timer);
								resolve(parsed);
							}
						} else if (parsed.headers["transfer-encoding"] === "chunked") {
							// Check if last chunk received
							if (buf.endsWith("0\r\n\r\n")) {
								clearTimeout(timer);
								resolve(parsed);
							}
						} else {
							clearTimeout(timer);
							resolve(parsed);
						}
					}
				}
			}
		});
		socket.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
		socket.on("close", () => {
			clearTimeout(timer);
			if (buf) resolve(parseRawResponse(buf));
			else reject(new Error("Connection closed"));
		});
	});
}

function headerEnd(raw) {
	const idx = raw.indexOf("\r\n\r\n");
	return idx !== -1 ? idx + 4 : 0;
}

// --- HTTP request (with optional proxy) ---

async function httpRequest(url, options = {}) {
	if (PROXY_URL) return proxiedRequest(url, options);
	return nativeRequest(url, options);
}

function nativeRequest(url, options = {}) {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const lib = parsed.protocol === "https:" ? https : http;
		const req = lib.request(
			{
				hostname: parsed.hostname,
				port: parsed.port,
				path: parsed.pathname + parsed.search,
				method: options.method || "GET",
				headers: options.headers || {},
				timeout: options.timeout || 30000,
			},
			(res) => {
				const chunks = [];
				res.on("data", (c) => chunks.push(c));
				res.on("end", () => {
					const cookies = Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ") : "";
					resolve({
						statusCode: res.statusCode,
						headers: res.headers,
						body: Buffer.concat(chunks),
						text: Buffer.concat(chunks).toString("utf8"),
						cookies,
					});
				});
			},
		);
		req.on("error", reject);
		req.on("timeout", () => {
			req.destroy();
			reject(new Error("Request timeout"));
		});
		if (options.body) req.write(options.body);
		req.end();
	});
}

async function proxiedRequest(url, options = {}) {
	const tUrl = new URL(url);
	const tunnel = new ProxyTunnel(PROXY_URL);
	const socket = await tunnel.connectTLS(tUrl.hostname, tUrl.port || 443);

	const reqHeaders = {
		Host: tUrl.hostname,
		Connection: "close",
		...(options.headers || {}),
	};

	makeRawRequest(socket, options.method || "GET", tUrl.pathname, tUrl.search, reqHeaders, options.body || null);
	const response = await collectRawResponse(socket, options.timeout || 30000);
	socket.end();

	const cookies = response.headers["set-cookie"] || "";
	return {
		statusCode: response.statusCode,
		headers: response.headers,
		body: response.body,
		text: response.body.toString("utf8"),
		cookies,
	};
}

// --- IG-specific functions ---

async function getIGCookies() {
	const res = await httpRequest("https://www.instagram.com/", {
		headers: {
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		},
		timeout: 15000,
	});
	const cookies = res.cookies;
	if (!cookies.includes("csrftoken")) throw new Error("Failed to get csrftoken from Instagram");
	return cookies;
}

async function fetchGQLMedia(shortcode, cookies) {
	const formBody = new URLSearchParams({
		variables: JSON.stringify({
			shortcode,
			fetch_tagged_user_count: null,
			hoisted_comment_id: null,
			hoisted_reply_id: null,
		}),
		doc_id: "8845758582119845",
		fb_api_caller_class: "RelayModern",
		fb_api_req_friendly_name: "PolarisPostActionLoadPostQueryQuery",
		server_timestamps: "true",
	}).toString();

	const csrfToken = cookies.match(/csrftoken=([^;]+)/)?.[1] || "";

	const res = await httpRequest("https://www.instagram.com/graphql/query/", {
		method: "POST",
		headers: {
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "*/*",
			"Accept-Language": "en-US,en;q=0.9",
			Origin: "https://www.instagram.com",
			Referer: "https://www.instagram.com/",
			"x-ig-app-id": "936619743392459",
			cookie: cookies,
			"X-CSRFToken": csrfToken,
		},
		body: formBody,
		timeout: 30000,
	});

	if (res.statusCode === 429 || res.statusCode === 401) {
		const err = new Error("Instagram rate limited. Try again in 2+ minutes.");
		err.code = "RATE_LIMITED";
		throw err;
	}
	if (res.statusCode !== 200) {
		throw new Error(`GQL API returned HTTP ${res.statusCode}`);
	}

	const json = JSON.parse(res.text);
	if (json.status !== "ok") throw new Error(`API returned status: ${json.status}`);
	if (!json.data?.xdt_shortcode_media) throw new Error("No media data in response");

	return json.data.xdt_shortcode_media;
}

function parseMediaItems(media) {
	const items = [];

	function addNode(node) {
		const isVideo = node.__typename === "GraphVideo" || node.__typename === "XDTGraphVideo";
		items.push({
			type: isVideo ? "video" : "image",
			url: isVideo ? node.video_url : node.display_url,
			thumbnail: node.display_url,
			width: node.dimensions?.width || 0,
			height: node.dimensions?.height || 0,
		});
	}

	const t = media.__typename;
	if (t === "GraphSidecar" || t === "XDTGraphSidecar") {
		for (const edge of media.edge_sidecar_to_children?.edges || []) addNode(edge.node);
	} else {
		addNode(media);
	}
	return items;
}

function getCaption(media) {
	return media.edge_media_to_caption?.edges?.[0]?.node?.text || "";
}

// --- File download (with optional proxy) ---

function downloadFile(url, outputPath) {
	if (PROXY_URL) return proxiedDownload(url, outputPath);
	return nativeDownload(url, outputPath);
}

function nativeDownload(url, outputPath) {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const lib = parsed.protocol === "https:" ? https : http;

		const doDownload = (targetUrl) => {
			const u = new URL(targetUrl);
			lib
				.get(
					{
						hostname: u.hostname,
						port: u.port,
						path: u.pathname + u.search,
						headers: {
							"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
							Referer: "https://www.instagram.com/",
							Accept: "*/*",
						},
						timeout: 120000,
					},
					(res) => {
						if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
							res.resume();
							return resolve(downloadFile(res.headers.location, outputPath));
						}
						if (res.statusCode !== 200) {
							res.resume();
							return reject(new Error(`Download HTTP ${res.statusCode}`));
						}
						const file = fs.createWriteStream(outputPath);
						res.pipe(file);
						file.on("finish", () => file.close(() => resolve()));
						file.on("error", (err) => {
							file.close();
							fs.unlinkSync(outputPath, () => {});
							reject(err);
						});
					},
				)
				.on("error", reject)
				.on("timeout", function () {
					this.destroy();
					reject(new Error("Download timeout"));
				});
		};
		doDownload(url);
	});
}

async function proxiedDownload(url, outputPath) {
	const tUrl = new URL(url);
	const tunnel = new ProxyTunnel(PROXY_URL);
	const socket = await tunnel.connectTLS(tUrl.hostname, tUrl.port || 443);

	const reqHeaders = {
		Host: tUrl.hostname,
		Connection: "close",
		"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
		Referer: "https://www.instagram.com/",
		Accept: "*/*",
	};

	makeRawRequest(socket, "GET", tUrl.pathname, tUrl.search, reqHeaders);
	const response = await collectRawResponse(socket, 120000);
	socket.end();

	if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
		return downloadFile(response.headers.location, outputPath);
	}
	if (response.statusCode !== 200) {
		throw new Error(`Download HTTP ${response.statusCode}`);
	}

	fs.writeFileSync(outputPath, response.body);
}

// --- Main ---

async function main() {
	const input = process.argv[2];
	if (!input) {
		console.error("Usage: node igdl.js <instagram-url-or-shortcode> [--proxy http://proxy:port]");
		console.error("       IG_PROXY=http://proxy:port node igdl.js <url>");
		console.error("Example: node igdl.js https://www.instagram.com/reel/DWcgKj0E6EJ/");
		if (PROXY_URL) console.error(`Proxy: ${PROXY_URL}`);
		process.exit(1);
	}

	if (PROXY_URL) console.log(`Using proxy: ${PROXY_URL}`);

	const shortcode = extractShortcode(input);
	console.log(`Shortcode: ${shortcode}`);

	console.log("Getting session...");
	const cookies = await getIGCookies();

	let mediaData;
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			console.log("Fetching media info via Instagram API...");
			mediaData = await fetchGQLMedia(shortcode, cookies);
			break;
		} catch (err) {
			if (err.code === "RATE_LIMITED" && attempt < MAX_RETRIES) {
				console.log(`Rate limited. Waiting ${RATE_LIMIT_WAIT / 1000}s...`);
				await sleep(RATE_LIMIT_WAIT);
				continue;
			}
			throw err;
		}
	}

	const caption = getCaption(mediaData);
	const items = parseMediaItems(mediaData);

	if (items.length === 0) throw new Error("No downloadable items found");

	console.log(`Found ${items.length} item(s): ${items.map((i) => i.type).join(", ")}`);
	if (caption) console.log(`Caption: ${caption.slice(0, 80)}${caption.length > 80 ? "..." : ""}`);

	const dirName = `ig_${shortcode}`;
	fs.mkdirSync(dirName, { recursive: true });

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const ext = item.type === "video" ? ".mp4" : ".jpg";
		const label = items.length > 1 ? `${shortcode}_${i + 1}` : shortcode;
		const filepath = path.join(dirName, `${label}${ext}`);

		process.stdout.write(`[${i + 1}/${items.length}] Downloading ${item.type}...`);
		await downloadFile(item.url, filepath);
		const sizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(1);
		console.log(` done (${sizeMB} MB)`);
	}

	console.log(`\nDone! Files saved to ./${dirName}/`);
}

main().catch((err) => {
	console.error(`\nError: ${err.message}`);
	process.exit(1);
});

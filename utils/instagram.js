const https = require("https");
const http = require("http");
const net = require("net");
const tls = require("tls");
const os = require("os");
const fs = require("fs");
const path = require("path");

const SHORTCODE_RE = /instagram\.com\/(?:reels?|p|tv)\/([a-zA-Z0-9_-]+)/;
const MAX_RETRIES = 3;
const RATE_LIMIT_WAIT = 120_000;
const PROXY_URL = process.env.IG_PROXY || "socks5h://127.0.0.1:9050";

class ProxyTunnel {
	constructor(proxyUrl) {
		const p = new URL(proxyUrl);
		this.proxyHost = p.hostname;
		this.proxyPort = parseInt(p.port) || 3128;
		this.isSocks = proxyUrl.startsWith("socks5://") || proxyUrl.startsWith("socks5h://");
	}

	async connectTLS(targetHost, targetPort = 443) {
		const socket = await this._connectTCP(targetHost, targetPort);
		const tlsSocket = tls.connect({ socket, host: targetHost, servername: targetHost });
		return new Promise((resolve, reject) => {
			tlsSocket.once("error", reject);
			tlsSocket.once("secureConnect", () => {
				tlsSocket.removeListener("error", reject);
				resolve(tlsSocket);
			});
		});
	}

	_connectTCP(targetHost, targetPort) {
		if (this.isSocks) return this._socksConnect(targetHost, targetPort);
		return this._httpConnect(targetHost, targetPort);
	}

	_httpConnect(targetHost, targetPort) {
		return new Promise((resolve, reject) => {
			const socket = net.connect(this.proxyPort, this.proxyHost, () => {
				socket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`);
			});
			let buf = "";
			socket.on("data", (chunk) => {
				buf += chunk.toString();
				if (buf.includes("\r\n\r\n")) {
					if (buf.startsWith("HTTP/1.1 200") || buf.startsWith("HTTP/1.0 200")) {
						resolve(socket);
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

	_socksConnect(targetHost, targetPort) {
		return new Promise((resolve, reject) => {
			const socket = net.connect(this.proxyPort, this.proxyHost, () => {
				socks5Handshake(socket, targetHost, targetPort, resolve, reject);
			});
			socket.on("error", reject);
		});
	}
}

function pipeBodyToDisk(socket, remainder, headers, outputPath) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(outputPath);
		let settled = false;

		function fail(err) {
			if (settled) return;
			settled = true;
			file.destroy();
			try {
				fs.unlinkSync(outputPath);
			} catch (_) {}
			reject(err);
		}

		file.on("error", fail);
		socket.on("error", fail);

		if (remainder.length > 0) file.write(remainder);

		if (headers["transfer-encoding"] === "chunked") {
			socket.destroy();
			return fail(new Error("Chunked transfer-encoding not supported in streaming download"));
		}

		socket.pipe(file);

		file.on("finish", () => {
			if (settled) return;
			settled = true;
			resolve();
		});
	});
}

function socks5Handshake(socket, targetHost, targetPort, resolve, reject) {
	let state = 0;
	let buf = Buffer.alloc(0);

	function onData(chunk) {
		buf = Buffer.concat([buf, chunk]);
		try {
			if (state === 0 && buf.length >= 2) {
				const ver = buf[0];
				const method = buf[1];
				if (ver !== 5 || method !== 0) {
					cleanup();
					return reject(new Error(`SOCKS5 handshake failed: ver=${ver} method=${method}`));
				}
				state = 1;
				const hostBuf = Buffer.from(targetHost, "utf8");
				const req = Buffer.alloc(4 + 1 + hostBuf.length + 2);
				req[0] = 5;
				req[1] = 1;
				req[2] = 0;
				req[3] = 3;
				req[4] = hostBuf.length;
				hostBuf.copy(req, 5);
				req.writeUInt16BE(targetPort, 5 + hostBuf.length);
				socket.write(req);
				buf = buf.slice(2);
			}
			if (state === 1 && buf.length >= 4) {
				const rep = buf[1];
				if (rep !== 0) {
					cleanup();
					return reject(new Error(`SOCKS5 connect failed: rep=${rep}`));
				}
				const atyp = buf[3];
				let addrLen;
				if (atyp === 1) addrLen = 4;
				else if (atyp === 3) addrLen = 1 + buf[4];
				else if (atyp === 4) addrLen = 16;
				else {
					cleanup();
					return reject(new Error(`SOCKS5 unknown atyp: ${atyp}`));
				}
				const total = 4 + addrLen + 2;
				if (buf.length >= total) {
					cleanup();
					resolve(socket);
				}
			}
		} catch (err) {
			cleanup();
			reject(err);
		}
	}

	function cleanup() {
		socket.removeListener("data", onData);
		socket.removeListener("error", onError);
	}

	function onError(err) {
		cleanup();
		reject(err);
	}

	socket.on("data", onData);
	socket.on("error", onError);

	const greet = Buffer.from([5, 1, 0]);
	socket.write(greet);
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
				if (buf.includes("\r\n\r\n")) {
					const parsed = parseRawResponse(buf);
					if (parsed) {
						const cl = parseInt(parsed.headers["content-length"]);
						if (cl !== undefined && !isNaN(cl)) {
							if (buf.length >= headerEnd(buf) + 4 + cl) {
								clearTimeout(timer);
								const full = parseRawResponse(buf);
								resolve(full);
							}
						} else if (parsed.headers["transfer-encoding"] === "chunked") {
							if (buf.endsWith("0\r\n\r\n")) {
								clearTimeout(timer);
								const full = parseRawResponse(buf);
								resolve(full);
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

async function getIGCookies() {
	const cookiesPath = path.join(os.homedir(), "igcookies.txt");
	const raw = fs.readFileSync(cookiesPath, "utf8");
	const pairs = [];
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const parts = trimmed.split("\t");
		const name = parts[parts.length - 2];
		const value = parts[parts.length - 1];
		if (name && value) pairs.push(`${name}=${value}`);
	}
	const cookies = pairs.join("; ");
	if (!cookies.includes("csrftoken")) throw new Error("igcookies.txt missing csrftoken");
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
	const check = await httpRequest("https://check.torproject.org/api/ip");
	console.log(check.text);
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
	if (![200, 302].includes(res.statusCode)) {
		throw new Error(`GQL API returned HTTP ${res.statusCode}`);
	}
	console.log(res.body);
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
							try {
								fs.unlinkSync(outputPath);
							} catch (_) {}
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
	const { statusCode, headers, remainder } = await collectStreamingHeaders(socket, 30000);

	if (statusCode >= 300 && statusCode < 400 && headers["location"]) {
		socket.destroy();
		return downloadFile(headers["location"], outputPath);
	}
	if (statusCode !== 200) {
		socket.destroy();
		throw new Error(`Download HTTP ${statusCode}`);
	}

	await pipeBodyToDisk(socket, remainder, headers, outputPath);
}

async function downloadInstagramContent(link, destinationFolder) {
	const shortcode = extractShortcode(link);
	const cookies = await getIGCookies();

	let mediaData;
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			mediaData = await fetchGQLMedia(shortcode, cookies);
			break;
		} catch (err) {
			if (err.code === "RATE_LIMITED" && attempt < MAX_RETRIES) {
				await sleep(RATE_LIMIT_WAIT);
				continue;
			}
			throw err;
		}
	}

	const items = parseMediaItems(mediaData);

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const ext = item.type === "video" ? ".mp4" : ".jpg";
		const label = items.length > 1 ? `${shortcode}_${i + 1}` : shortcode;
		const filepath = path.join(destinationFolder, `${label}${ext}`);
		await downloadFile(item.url, filepath);
	}
}

module.exports = { downloadInstagramContent };

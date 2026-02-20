const fs = require("fs");
const path = require("path");

const cacheFilePath = path.join(__dirname, "..", "tmp", "cache.json");

function ensureCacheDir() {
	const dir = path.dirname(cacheFilePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function serializeValue(value) {
	if (value instanceof Date) {
		return { __type: "Date", value: value.toISOString() };
	}
	return value;
}

function deserializeValue(obj) {
	if (obj && typeof obj === "object" && obj.__type === "Date") {
		return new Date(obj.value);
	}
	return obj;
}

function saveCache(myCache) {
	try {
		ensureCacheDir();
		const keys = myCache.keys();
		const data = [];
		const now = Date.now();
		for (const key of keys) {
			const value = myCache.get(key);
			const ttl = myCache.getTtl(key);
			let expiresAt = null;
			if (ttl !== undefined) {
				expiresAt = now + ttl;
			}
			const serializedValue = serializeValue(value);
			data.push({ key, value: serializedValue, expiresAt });
		}
		fs.writeFileSync(cacheFilePath, JSON.stringify({ savedAt: now, data }, null, 2));
		console.log(`Cache saved with ${data.length} entries`);
	} catch (error) {
		console.error("Failed to save cache:", error);
	}
}

function loadCache(myCache) {
	try {
		if (!fs.existsSync(cacheFilePath)) {
			console.log("No cache file found, skipping load");
			return;
		}
		const raw = fs.readFileSync(cacheFilePath);
		const { savedAt, data } = JSON.parse(raw);
		const now = Date.now();
		let loaded = 0;
		let expired = 0;
		for (const entry of data) {
			let ttl = null;
			if (entry.expiresAt !== null) {
				const remaining = entry.expiresAt - now;
				if (remaining <= 0) {
					expired++;
					continue;
				}
				ttl = remaining / 1000;
			}
			const deserializedValue = deserializeValue(entry.value);
			const success = myCache.set(entry.key, deserializedValue, ttl);
			if (success) loaded++;
		}
		console.log(`Cache loaded: ${loaded} entries restored, ${expired} expired`);
	} catch (error) {
		console.error("Failed to load cache:", error);
	}
}

module.exports = { saveCache, loadCache };

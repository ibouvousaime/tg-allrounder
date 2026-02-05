import sanitizeHtml from "sanitize-html";

export function sanitizeTelegramHtml(input) {
	return sanitizeHtml(input, {
		allowedTags: ["b", "strong", "i", "em", "u", "ins", "s", "strike", "del", "span", "tg-spoiler", "a", "tg-emoji", "code", "pre"],

		allowedAttributes: {
			span: ["class"],
			a: ["href"],
			"tg-emoji": ["emoji-id"],
			code: ["class"],
		},

		allowedClasses: {
			span: ["tg-spoiler"],
			code: [/^language-\w+$/],
		},

		allowProtocolRelative: true,

		disallowedTagsMode: "discard",
	});
}

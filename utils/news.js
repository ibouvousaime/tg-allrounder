import axios from "axios";

export async function getLocalNews(city) {
	const apiKey = process.env.GNEWS_KEY;

	try {
		const response = await axios.get("https://gnews.io/api/v4/search", {
			params: {
				q: city,
				lang: "en",
				max: 5,
				apikey: apiKey,
			},
		});
		console.log(response.data.articles[0]);
		return (
			`<blockquote expandable>` +
			response.data.articles
				.map((article) => ({
					title: article.title,
					url: article.url,
					source: article.source.name,
					publishedAt: article.publishedAt,
				}))
				.map((element) => `<a href='${element.url}'>${element.title} (${element.source})</a>`)
				.join("\n") +
			`</blockquote>`
		);
	} catch (err) {
		console.error("Error fetching news:", err.response?.data || err.message);
		return [];
	}
}

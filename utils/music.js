function formatStatsForTelegram(stats) {
	if (!stats) {
		return "<i>No statistics available.</i>";
	}
	const topArtistsList = stats.topArtists.map((artist, index) => `  ${index + 1}. <b>${artist.artist}</b> (${artist.count} songs)`).join("\n");
	const topSendersList = stats.topSenders.map((sender, index) => `  ${index + 1}. <i>${sender.sender}</i> (${sender.songsPosted} songs)`).join("\n");

	return `
🎵 <b>Music Stats</b> 🎵

<b>Total Songs:</b> ${stats.totalSongs}

<b>Top 5 Artists:</b>
${topArtistsList}

<b>Top 5 Senders:</b>
${topSendersList}

    `;
}

async function getMusicStats(collection, chatId) {
	const totalSongs = await collection.countDocuments({ chatId });

	const topArtistsPipeline = [
		{ $match: { chatId } },
		{ $group: { _id: "$performer", count: { $sum: 1 } } },
		{ $sort: { count: -1 } },
		{ $limit: 5 },
		{ $project: { _id: 0, artist: "$_id", count: 1 } },
	];
	const topArtists = await collection.aggregate(topArtistsPipeline).toArray();

	const topSendersPipeline = [
		{ $match: { chatId } },
		{ $group: { _id: "$sender", count: { $sum: 1 } } },
		{ $sort: { count: -1 } },
		{ $limit: 5 },
		{ $project: { _id: 0, sender: "$_id", songsPosted: "$count" } },
	];
	const topSenders = await collection.aggregate(topSendersPipeline).toArray();

	const stats = {
		totalSongs,
		topArtists,
		topSenders,
	};

	return formatStatsForTelegram(stats);
}

module.exports = { getMusicStats };

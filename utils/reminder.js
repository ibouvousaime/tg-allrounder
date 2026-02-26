const { DateTime } = require("luxon");
const { sleepQuotes, goingToClassQuotes } = require("./sleepQuotes");
Array.prototype.random = function () {
	return this[Math.floor(Math.random() * this.length)];
};
const TIMEZONE = "Australia/Melbourne";

const reminders = [
	{
		key: "sleep",
		startHour: 0,
		endHour: 6,
		weekendsOnly: true,
		getMessage: () => sleepQuotes.random(),
	},
	{
		key: "class",
		startHour: 8,
		endHour: 9,
		weekendsOnly: false,
		getMessage: () => goingToClassQuotes.random(),
	},
];

async function handleTimeReminders(msg, antCollection, bot) {
	const antIDs = process.env.ANT_ID?.split(" ").map(Number) ?? [];
	if (!antIDs.includes(msg.from.id)) return;

	const now = DateTime.now().setZone(TIMEZONE);
	const hour = now.hour;
	const today = now.toISODate();

	const isWeekend = now.weekday >= 6;

	const ant = (await antCollection.findOne({ userId: msg.from.id })) ?? {};

	for (const reminder of reminders) {
		const shouldRunToday = reminder.weekendsOnly === undefined ? true : reminder.weekendsOnly ? isWeekend : !isWeekend;

		if (!shouldRunToday) continue;

		const isInWindow = hour >= reminder.startHour && hour < reminder.endHour;

		const alreadySentToday = ant?.lastSent?.[reminder.key] === today;

		if (isInWindow && !alreadySentToday) {
			await bot.sendMessage(msg.chat.id, reminder.getMessage());

			await antCollection.updateOne(
				{ userId: msg.from.id },
				{
					$set: {
						[`lastSent.${reminder.key}`]: today,
					},
				},
				{ upsert: true },
			);
		}
	}
}

module.exports = { handleTimeReminders };

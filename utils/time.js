function findTimezones(query) {
	const q = query.toLowerCase();
	return Intl.supportedValuesOf("timeZone").filter((tz) => tz.toLowerCase().includes(q));
}
function getTimeAtLocation(timeZone) {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).format(new Date());
}

module.exports = {
	findTimezones,
	getTimeAtLocation,
};

const { getAstroSeekChart } = require('./astroseektest');

const testSubject = {
    name: "Test",
    city: "New York",
    year: 1990,
    month: 5,
    day: 15,
    hour: 12,
    minute: 30,
    longitude: -74.006,
    latitude: 40.7128,
    timezone: "America/New_York",
    houses_system_identifier: "W",
    nation: "US"
};

console.log('Testing getAstroSeekChart with CommonJS...');
getAstroSeekChart(testSubject).then(result => {
    console.log('Result:', result ? 'Has buffer:' + (result.buffer ? 'yes' : 'no') : 'null');
    if (result && result.url) console.log('URL:', result.url);
}).catch(err => {
    console.error('Error:', err);
});
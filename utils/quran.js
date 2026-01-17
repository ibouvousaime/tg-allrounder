export async function getRandomQuranVerse() {
	const verseNumber = Math.floor(Math.random() * 6236) + 1;
	const res = await fetch(`https://api.alquran.cloud/v1/ayah/${verseNumber}/editions/quran-simple,en.asad`);
	const json = await res.json();
	const arabic = json.data.find((v) => v.edition.language === "ar");
	const english = json.data.find((v) => v.edition.language === "en");
	const verseData = {
		surah: arabic.surah.englishName,
		ayah: arabic.numberInSurah,
		arabic: arabic.text,
		translation: english.text,
	};
	return `<blockquote expandable>${verseData.surah} ${verseData.ayah} - ${verseData.arabic} (${verseData.translation})</blockquote>`;
}

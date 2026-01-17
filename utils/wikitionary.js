const puppeteer = require("puppeteer");

const wiktionary = require("wiktionary-node");
function renderDictionaryEntryHTML(entry) {
	const { word, language, definitions } = entry;

	const defsHTML = definitions
		.map((def) => {
			const linesHTML = def.lines
				.map((line) => {
					const examplesHTML = line.examples.length
						? `<ul class="examples">
            ${line.examples.map((ex) => `<li>${escapeHTML(ex)}</li>`).join("")}
           </ul>`
						: "";

					return `
        <div class="line">
          <div class="define">${escapeHTML(line.define)}</div>
          ${examplesHTML}
        </div>
      `;
				})
				.join("");

			return `
      <section class="speech-block">
        <h2>${escapeHTML(def.speech)}</h2>
        ${linesHTML}
      </section>
    `;
		})
		.join("");

	return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHTML(word)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f6f7f9;
      color: #222;
      padding: 32px;
    }

    .card {
      max-width: 900px;
      margin: auto;
      background: #fff;
      border-radius: 12px;
      padding: 28px 32px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    }

    header {
      border-bottom: 1px solid #eee;
      margin-bottom: 24px;
      padding-bottom: 12px;
    }

    h1 {
      font-size: 36px;
      margin: 0;
    }

    .meta {
      color: #666;
      font-size: 14px;
      margin-top: 4px;
    }

    .speech-block {
      margin-top: 28px;
    }

    .speech-block h2 {
      font-size: 22px;
      color: #2b5cff;
      margin-bottom: 14px;
    }

    .line {
      margin-bottom: 16px;
    }

    .define {
      font-size: 16px;
      line-height: 1.5;
    }

    .examples {
      margin-top: 6px;
      padding-left: 18px;
      color: #555;
      font-size: 15px;
    }

    .examples li {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="card">
    <header>
      <h1>${escapeHTML(word)}</h1>
      <div class="meta">Language: ${escapeHTML(language)}</div>
    </header>

    ${defsHTML}
  </div>
</body>
</html>
`;
}

function escapeHTML(str) {
	return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function getWiktionaryPages(query) {
	const result = await wiktionary(query);
	return await renderHtml(renderDictionaryEntryHTML(result));
}

async function renderHtml(html) {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.setContent(html, { waitUntil: "load" });
	const buffer = await page.screenshot({});
	await browser.close();
	return buffer;
}

module.exports = { getWiktionaryPages };

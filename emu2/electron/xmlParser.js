const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

async function parseExoXML(xmlFile, exoBasePath) {
    const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);

    const games = [];
    const gameNodes = result.LaunchBox?.Game || [];

    for (const game of gameNodes) {
        const title = game.Title?.[0] || 'Unknown';
        const appPath = game.ApplicationPath?.[0] || '';

        // Find the game folder in eXo/eXoDOS/!dos or eXo/eXoWin3x/!win3x
        let gamePath = '';
        if (appPath) {
            const gameFolder = path.dirname(appPath).split(path.sep).pop();
            const dosPath = path.join(exoBasePath, 'eXo', 'eXoDOS', '!dos', gameFolder);
            const winPath = path.join(exoBasePath, 'eXo', 'eXoWin3x', '!win3x', gameFolder);

            if (fs.existsSync(dosPath)) {
                gamePath = dosPath;
            } else if (fs.existsSync(winPath)) {
                gamePath = winPath;
            }
        }

        if (!gamePath) continue;

        games.push({
            title,
            developer: game.Developer?.[0] || '',
            publisher: game.Publisher?.[0] || '',
            releaseDate: game.ReleaseDate?.[0] || '',
            genre: game.Genre?.[0] || '',
            series: game.Series?.[0] || '',
            notes: game.Notes?.[0] || '',
            path: gamePath,
            coverImage: game.CoverImagePath?.[0] || '',
            backgroundImage: game.BackgroundImagePath?.[0] || ''
        });
    }

    return games;
}

function parseDosBoxConf(confPath) {
    const content = fs.readFileSync(confPath, 'utf-8');
    const conf = {};
    let currentSection = '';

    for (const line of content.split('\n')) {
        const trimmed = line.trim();

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            currentSection = trimmed.slice(1, -1).toLowerCase();
            conf[currentSection] = {};
        } else if (trimmed && !trimmed.startsWith('#') && currentSection) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length) {
                conf[currentSection][key.trim()] = valueParts.join('=').trim();
            }
        }
    }

    return conf;
}

module.exports = { parseExoXML, parseDosBoxConf };

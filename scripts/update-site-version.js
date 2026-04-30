import { readFileSync, writeFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const d = new Date();
const releaseDate = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

const htmlPath = 'docs/index.html';
let html = readFileSync(htmlPath, 'utf8');

// Hero eyebrow: v1.2.3  ·  Apr 28, 2026  ·
html = html.replace(
  /(<span>v)[\d.]+( {2}· {2})[A-Za-z]+ \d+, \d+( {2}· {2}<\/span>)/,
  `$1${version}$2${releaseDate}$3`
);
// Download spec: version number
html = html.replace(/(<span class="v accent">)[\d.]+(<\/span>)/, `$1${version}$2`);
// Download spec: release date
html = html.replace(/(<span class="v rel-date">)[^<]+(<\/span>)/, `$1${releaseDate}$2`);

// Download URLs
const base = `https://github.com/Kinburg/Purl/releases/download/v${version}`;
html = html.replace(
  /https:\/\/github\.com\/Kinburg\/Purl\/releases\/download\/v[\d.]+\/Purl\.Setup\.[\d.]+\.exe/g,
  `${base}/Purl.Setup.${version}.exe`
);
html = html.replace(
  /https:\/\/github\.com\/Kinburg\/Purl\/releases\/download\/v[\d.]+\/Purl-[\d.]+-win\.zip/g,
  `${base}/Purl-${version}-win.zip`
);
html = html.replace(
  /https:\/\/github\.com\/Kinburg\/Purl\/releases\/download\/v[\d.]+\/Purl-[\d.]+-arm64\.dmg/g,
  `${base}/Purl-${version}-arm64.dmg`
);
html = html.replace(
  /https:\/\/github\.com\/Kinburg\/Purl\/releases\/download\/v[\d.]+\/Purl-[\d.]+\.AppImage/g,
  `${base}/Purl-${version}.AppImage`
);

writeFileSync(htmlPath, html, 'utf8');
console.log(`Site updated → v${version}  (${releaseDate})`);

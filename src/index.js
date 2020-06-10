import { promises as fs } from 'fs';
import axios from 'axios';
import path from 'path';

const resources = [
  'https://images.puzzle-english.com/words/campbridge_UK/',
  'https://images.puzzle-english.com/words/macmillan_UK/',
  'https://images.puzzle-english.com/words/howjsay_UK/',
];

/* reserve URLs for phrase with spaces between words
https://images.puzzle-english.com/words/vocalware_hugh_UK/grow%20up.mp3
*/

async function getFile(url) {
  return axios({
    method: 'get',
    url,
    responseType: 'stream',
  });
}

async function getData(links) {
  const promises = links.map((link) => getFile(link));

  return Promise.all(promises);
}

async function downloadFiles(links) {
  const stat = {};
  const files = await getData(links);

  console.log('Added files:');

  files.forEach((response) => {
    if (response.status === 200) {
      const url = new URL(response.config.url);
      const basename = path.basename(url.pathname, '.mp3');
      stat[basename] = (stat[basename] !== undefined) ? stat[basename] + 1 : 1;
      const filePath = `./data/mp3/${basename}${stat[basename]}.mp3`;

      response.data.pipe(fs.createWriteStream(filePath));

      console.log(filePath);
    }
  });
}

async function run() {
  const dictionaryPath = path.resolve('./data/dictionaries', 'dictionary_en.txt');
  const newWordsPath = path.resolve('./data', 'new_words.txt');

  try {
    const [data1, data2] = await Promise.all([fs.readFile(dictionaryPath, 'utf8'), fs.readFile(newWordsPath, 'utf8')]);

    const dictionary = new Set(data1.split('\n'));
    const newWords = data2.split('\n').map((word) => word.trim());

    const links = newWords
      .map((word) => word.replace(' ', '%20'))
      .filter((word) => !dictionary.has(word))
      .map((word) => (
        resources.map((resource) => `${resource}${word}.mp3`)
      ));

    console.log(links);
    // downloadFiles(links.flat());
  } catch (err) {
    console.log(err.message);
  }
}

export default run;

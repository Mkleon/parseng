import fs from 'fs';
import axios from 'axios';
import path from 'path';

const resources = [
  'https://images.puzzle-english.com/words/campbridge_UK/',
  'https://images.puzzle-english.com/words/macmillan_UK/',
  'https://images.puzzle-english.com/words/howjsay_UK/',
];

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

  files.forEach((response) => {
    if (response.status === 200) {
      const url = new URL(response.config.url);
      const fileName = path.basename(url.pathname, '.mp3');
      stat[fileName] = (stat[fileName] !== undefined) ? stat[fileName] + 1 : 1;

      response.data.pipe(fs.createWriteStream(`./data/${fileName}${stat[fileName]}.mp3`));
    }
  });
}

async function run() {
  const newWords = ['someone', 'bowl'];

  const links = newWords.map((word) => (
    resources.map((resource) => `${resource}${word}.mp3`)
  ));

  downloadFiles(links.flat());
}

export default run;

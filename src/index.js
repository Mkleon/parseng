import fs from 'fs';
import axios from 'axios';

const resources = [
  'https://images.puzzle-english.com/words/campbridge_UK/',
  // 'https://images.puzzle-english.com/words/macmillan_UK/',
  // 'https://images.puzzle-english.com/words/howjsay_UK/',
];

async function getFiles(url) {
  return axios({
    method: 'get',
    url,
    responseType: 'stream',
  });
}

const run = () => {
  const newWords = ['someone'];

  const links = newWords.map((word) => (
    resources.map((resource) => `${resource}${word}.mp3`)
  ));

  const result = getFiles(links.flat()[0]);
  result
    .then((response) => {
      if (response.status === 200) {
        response.data.pipe(fs.createWriteStream('./data/someone.mp3'));
      }
    });
};

export default run;

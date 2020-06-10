import fs from 'fs';
import axios from 'axios';
import path from 'path';

const config = {
  resources: [
    'https://images.puzzle-english.com/words/campbridge_UK/',
    'https://images.puzzle-english.com/words/macmillan_UK/',
    'https://images.puzzle-english.com/words/howjsay_UK/',
    'https://images.puzzle-english.com/words/vocalware_hugh_UK/',
  ],
  dictionaryPath: path.resolve('./data/dictionaries', 'dictionary_en.txt'),
  newWordsPath: path.resolve('./data', 'new_words.txt'),
  targetDirectory: './data/mp3/',
};

async function getFile(url) {
  return axios({
    method: 'get',
    url,
    responseType: 'stream',
  });
}

async function getData(links) {
  const promises = links.map((link) => getFile(link));

  return Promise.allSettled(promises)
    .then((results) => results.filter(({ status }) => status === 'fulfilled'));
}

async function downloadFiles(state) {
  const { counter } = state.download;

  const links = state.newWords
    .map((word) => word.replace(' ', '%20'))
    .filter((word) => !state.dictionary.has(word))
    .map((word) => (
      config.resources.map((resource) => `${resource}${word}.mp3`)
    ))
    .flat();

  const files = await getData(links);

  console.log('Downloaded files:');

  files.forEach(({ value: response }) => {
    if (response.status === 200) {
      const url = new URL(response.config.url);
      const basename = path.basename(url.pathname, '.mp3').replace('%20', '_');

      counter[basename] = (counter[basename] !== undefined) ? counter[basename] + 1 : 1;
      const filePath = `${config.targetDirectory}${basename}${counter[basename]}.mp3`;

      response.data.pipe(fs.createWriteStream(filePath));

      console.log(filePath);
    }
  });
}

async function run() {
  const state = {
    download: {
      counter: {},
    },
  };

  try {
    const [data1, data2] = await Promise.all([
      fs.promises.readFile(config.dictionaryPath, 'utf8'),
      fs.promises.readFile(config.newWordsPath, 'utf8'),
    ]);

    state.dictionary = new Set(data1.split('\n'));
    state.newWords = data2.split('\n').map((word) => word.trim());

    downloadFiles(state);
  } catch (err) {
    console.log(err.message);
  }
}

export default run;

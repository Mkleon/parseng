/* eslint-disable max-len */
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import jsdom from 'jsdom';

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
  translatedWords: path.resolve('./data', 'translated_words.csv'),
};

const getData = (urls) => {
  const promises = urls.map((url) => axios({ url, responseType: 'stream' }));

  return Promise.allSettled(promises)
    .then((results) => results.filter(({ status }) => status === 'fulfilled'));
};

const downloadFiles = async (state) => {
  const { counter } = state.download;

  const links = state.newWords
    .map((word) => word.replace(' ', '%20'))
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
};

const getTranslate = async (state) => {
  const { newWords, translate } = state;
  const links = newWords
    .map((word) => (
      {
        dirCode: 'en-ru',
        template: 'General',
        text: `${word}`,
        lang: 'ru',
        limit: '3000',
        useAutoDetect: true,
        key: '123',
        ts: 'MainSite',
        tid: '',
        IsMobile: false,
      }
    ))
    .map((obj) => axios.post('https://www.translate.ru/services/soap.asmx/GetTranslation', obj));

  const translateWords = await Promise.allSettled(links)
    .then((results) => results.filter(({ status }) => status === 'fulfilled'));

  translateWords.forEach(({ value: response }) => {
    if (response.status === 200) {
      const { JSDOM } = jsdom;

      const dom = new JSDOM(response.data.d.result);
      const rus = dom.window.document.querySelector('[class="sourceTxt"]').textContent;

      translate.set(response.data.d.formSeek, rus);
    }
  });
};


/* "Bulk Add" is a function in Memrise.com
Quickly add lots of words by pasting in from a spreadsheet or CSV file. Words should be one per line - blank lines will be ignored. There is a limit of 1000
Only text columns will be added to, therefore each line should contain: English, Russian, Pronunciation, Part of Speech, Gender. Any missing fields will be blank.
*/
const saveTranslateToFileForMemrise = async (state) => {
  const { translate } = state;
  const words = [];

  translate.forEach((value, key) => {
    words.push(`${key}\t${value}`);
  });

  await fs.promises.writeFile(config.translatedWords, words.join('\n'), 'utf8');
};


const addWordsToMemrise = async (state) => {
  const { translate } = state;
  const urlMemrise = 'https://www.memrise.com/ajax/level/thing/add/';

  const links = [];

  translate.forEach((value, key) => {
    links.push({
      columns: {
        1: key.replace(/\s/gi, '+'),
        2: value.replace(/\s/gi, '+'),
      },
      level_id: 12647091,
    });
  });

  links.map((obj) => axios.post(urlMemrise, obj));

  const addedWords = await Promise.allSettled(links)
    .then((results) => results.filter(({ status }) => status === 'fulfilled'));

  console.log(addedWords);
};

const run = async () => {
  const state = {
    download: {
      counter: {},
    },
    translate: new Map(),
  };

  try {
    const [data1, data2] = await Promise.all([
      fs.promises.readFile(config.dictionaryPath, 'utf8'),
      fs.promises.readFile(config.newWordsPath, 'utf8'),
    ]);

    state.dictionary = new Set(data1.split('\n'));
    state.newWords = data2
      .split('\n')
      .map((word) => word.trim())
      .filter((word) => !state.dictionary.has(word));
  } catch (err) {
    console.log(err.message);
  }

  await downloadFiles(state);
  await getTranslate(state);
  // await addWordsToMemrise(state);
  await saveTranslateToFileForMemrise(state);
};

export default run;

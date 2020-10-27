/* eslint-disable max-len */
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import jsdom from 'jsdom';
import _ from 'lodash';
import util from 'util';

const getData = (urls) => {
  const promises = urls.map((url) => axios({ url, responseType: 'stream' }));

  return Promise.allSettled(promises)
    .then((results) => results.filter(({ status }) => status === 'fulfilled'));
};

const downloadFiles = async (state, targetDirectory, resources) => {
  const { counter } = state.download;

  const links = state.newWords
    .map((word) => word.replace(/\s/, '%20'))
    .map((word) => (
      resources.map((resource) => `${resource}${word}.mp3`)
    ))
    .flat();

  const files = await getData(links);

  files.forEach(({ value: response }) => {
    if (response.status === 200) {
      const url = new URL(response.config.url);
      const basename = path.basename(url.pathname, '.mp3').replace('%20', '_');

      counter[basename] = (counter[basename] !== undefined) ? counter[basename] + 1 : 1;
      const filePath = `${targetDirectory}${basename}${counter[basename]}.mp3`;

      response.data.pipe(fs.createWriteStream(filePath));
    }
  });
};

const setTimeoutPromise = util.promisify(setTimeout);

const getRussianWord = (response) => {
  const { JSDOM } = jsdom;
  const dom = new JSDOM(response.data.d.result);

  return dom.window.document.querySelector('[class="sourceTxt"]').textContent;
};

const getTranslations = async (state) => {
  const url = 'https://www.translate.ru/services/soap.asmx/GetTranslation';
  const options = (text) => ({
    dirCode: 'en-ru',
    template: 'General',
    text: `${text}`,
    lang: 'ru',
    limit: '3000',
    useAutoDetect: false,
    key: '123',
    ts: 'MainSite',
    tid: '',
    IsMobile: false,
  });

  let translations = [];
  const parts = _.chunk(state.newWords, 10);

  // eslint-disable-next-line no-restricted-syntax
  for await (const part of parts) {
    const links = part.map((word) => axios.post(url, options(word)));

    const res = await Promise.allSettled(links)
      .then((results) => results.filter(({ status }) => status === 'fulfilled'))
      .catch((err) => new Error(err));

    translations = [...translations, ...res];

    await setTimeoutPromise(5000);
  }

  let result = [];

  translations.flat().forEach(({ value }) => {
    if (value.status === 200) {
      const { data } = value.config;
      const eng = JSON.parse(data).text;

      const responseData = value.data.d;
      const rus = responseData.formSeek === '' ? responseData.result : getRussianWord(value);

      result = [...result, [eng, rus]];
    }
  });

  return result;
};

/* "Bulk Add" is a function in Memrise.com
Quickly add lots of words by pasting in from a spreadsheet or CSV file. Words should be one per line - blank lines will be ignored. There is a limit of 1000
Only text columns will be added to, therefore each line should contain: English, Russian, Pronunciation, Part of Speech, Gender. Any missing fields will be blank.
*/
const saveTranslationsToCsvFile = async (state, translatedWordsPath) => {
  const words = [];

  // In this release each line contains "English  Russian" only.
  state.translation.forEach((value, key) => {
    words.push(`${key}\t${value}`);
  });

  await fs.promises.writeFile(translatedWordsPath, words.join('\n'), 'utf8');
};

/* const addWordsToMemrise = async (state) => {
  const urlMemrise = 'https://www.memrise.com/ajax/level/thing/add/';

  const links = [];

  state.translation.forEach((value, key) => {
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
}; */

const getDataFromFile = async (source) => {
  const data = await fs.promises.readFile(source, 'utf8');

  return data.split('\n')
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
};

export const app = async (config) => {
  const state = {
    download: {
      counter: {},
    },
    dictionary: new Set(),
    newWords: [],
    translation: new Map(),
  };

  const dictionaryPath = path.resolve(config.dictionaryPath);
  const newWordsPath = path.resolve(config.newWordsPath);
  const translatedWordsPath = path.resolve(config.translatedWordsPath);
  const { targetDirectory, resources } = config;

  try {
    const data1 = await getDataFromFile(dictionaryPath);
    data1.forEach((word) => {
      state.dictionary.add(word);
    });

    // TODO: непонятно почему только 29 слов считывается из 35
    const dirtyList = await getDataFromFile(newWordsPath);
    const duplicates = dirtyList.filter((word) => state.dictionary.has(word));
    const cleanedList = dirtyList.filter((word) => !state.dictionary.has(word));
    state.newWords = state.newWords.concat(cleanedList);

    if (duplicates.length > 0) {
      console.log(`These words are already in the dictionary (${duplicates.length} duplicates):\n${duplicates.map((word) => `  - ${word}`).join('\n')}\n`);
    }

    if (state.newWords.length === 0) {
      throw Error('New words not found.');
    }

    console.log(`New words (${state.newWords.length}):\n${state.newWords.map((word) => `  - ${word}`).join('\n')}\n`);

    const translations = await getTranslations(state);
    translations.forEach(([eng, rus]) => {
      state.translation.set(eng, rus);
    });

    console.log(`Found translations (${translations.length}):\n${translations.map(([eng, rus]) => `   ${eng} - ${rus}`).join('\n')}`);

    saveTranslationsToCsvFile(state, translatedWordsPath);
    console.log(`\nWords list have saved to csv file ${translatedWordsPath}.`);

    await downloadFiles(state, targetDirectory, resources);
    console.log(`All sound files have saved to directory ${path.resolve(targetDirectory)}.`);

    // await addWordsToMemrise(state);

    // TODO: в конце нужно добавлять новые слова в словарь
    // TODO: Очищать список переведенных слов
  } catch (err) {
    console.log(err.message);
  }

  return 'Finished!';
};

export const checkDuplicate = async (config) => {
  const dictionaryPath = path.resolve(config.dictionaryPath);
  const newWordsPath = path.resolve(config.newWordsPath);

  try {
    const data1 = await getDataFromFile(dictionaryPath);
    const dictionary = new Set();

    data1.forEach((word) => {
      dictionary.add(word);
    });

    const dirtyList = await getDataFromFile(newWordsPath);
    const duplicates = dirtyList.filter((word) => dictionary.has(word));
    const cleanedList = dirtyList.filter((word) => !dictionary.has(word));

    if (duplicates.length > 0) {
      console.log(`These words are already in the dictionary (${duplicates.length} duplicates):\n${duplicates.map((word) => `  - ${word}`).join('\n')}\n`);
    }
    if (cleanedList.length > 0) {
      console.log(`New words (${cleanedList.length}):\n${cleanedList.map((word) => `  - ${word}`).join('\n')}\n`);
    }
  } catch (err) {
    console.log(err.message);
  }
};

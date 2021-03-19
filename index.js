/* eslint-disable no-console,no-await-in-loop */

'use strict';

const TelegramBot = require('node-telegram-bot-api');
const config = require('config');
const blueBird = require('bluebird');
const debug = require('debug')('domovoy');
const devicesAlive = require('./plugins/devicesAlive');
const temperature = require('./plugins/temperature');

const plugins = {devicesAlive, temperature};
const pluginsToRun = Object.entries(plugins).filter(([name])=>config[name]);

let messagePool = {};

function makeBot() {
  const bot = new TelegramBot(config.telegram.token, {polling: true});

  bot.on('polling_error', (error) => {
    debug('Polling error', error);  // => 'EFATAL'
    debug(error);
  });

  bot.on('webhook_error', (error) => {
    debug('Webhook error', error);  // => 'EPARSE'
  });

  bot.onText(/\/start/, async (msg) => {
    debug('start message from user');
    const chatId = msg.chat.id || msg.from.id;
    debug(`chatId: ${chatId}`);
    await bot.sendMessage(chatId, 'Please use /status or wait for info', {
      reply_markup: JSON.stringify({
        remove_keyboard: true,
      }),
    });
  });
  bot.onText(/\/status/, async (msg) => {
    debug('status message from user');
    const chatId = msg.chat.id || msg.from.id;
    debug(`chatId: ${chatId}`);
    if (config.telegram.chatId !== chatId) {
      await bot.sendMessage(chatId, 'Sorry, Mario, your princess is another castle!', {
        reply_markup: JSON.stringify({
          remove_keyboard: true,
        }),
      });
      return;
    }
    const pluginsStatus = pluginsToRun.map(([name, module])=>module.status());
    await Promise.all(pluginsStatus);
  });
  return bot;
}

function sendMessage(botName, text) {
  if (!messagePool[botName]) {
    messagePool[botName] = [];
  }
  messagePool[botName].push(text);
}

async function sendMessageLoop() {
  const bot = makeBot();
  while (true) {
    await blueBird.delay(10000);
    const text = Object.entries(messagePool).reduce((acc, [pluginName, messages])=>{
      return acc.concat(`*${pluginName}*:\n${messages.join('\n')}`);
    }, []).join('\n\n');
    messagePool = {};
    if (text) {
      try {
        await bot.sendMessage(config.telegram.chatId, text, {parse_mode: 'Markdown'});
      } catch (err) {
        debug(err);
      }
    }
  }
}

async function run() {
  if (!config) {
    console.log('Config not found!');
    process.exit(1);
  }
  const startPlugins = pluginsToRun.map(([name, module])=>module.run(config[name], (text)=>sendMessage(name, text)));
  const startJobs = startPlugins.concat(sendMessageLoop());
  await Promise.all(startJobs);
}

run();

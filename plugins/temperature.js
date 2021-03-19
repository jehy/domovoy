/* eslint-disable no-await-in-loop */

'use strict';

const axios = require('axios');
const blueBird = require('bluebird');
const {DateTime} = require('luxon');

const stats = ['ppm', 'temp', 'humidity'];
let statusData;
let sendMessage;

async function fetchData()
{
  const requests = stats.map((stat)=>`http://co2.jehy.ru/json.php?stat=${stat}&limit=1`);
  const reply = await Promise.all(requests.map((request)=>axios(request)));
  const now = Date.now();
  const numbers = reply.map((el, index)=>{
    if (!el.data || !el.data.length) {
      return null;
    }
    const measureTime = DateTime.fromFormat(el.data[0].date, 'yyyy-LL-dd HH:mm');
    if (now - measureTime.toMillis() > 1000 * 60 * 30) {
      sendMessage(`Too old data in API, ${measureTime.toISOTime()} vs now (${now})`);
      return null;
    }
    return el.data[0][stats[index]];
  });
  return stats.reduce((res, stat, index)=>{
    return Object.assign(res, {[stat]: numbers[index]});
  }, {});
}

function getMessage(data, required) {
  const messages = Object.entries(data).reduce((res, [stat, value])=>{
    if (!value) {
      res.push(`${stat} is not provided!`);
    }
    else if (value < required[stat][0]) {
      res.push(`${stat} is too low! (${value})`);
    }
    else if (value > required[stat][1]) {
      res.push(`${stat} is too high! (${value})`);
    }
    return res;
  }, []);
  return messages.length ? messages.join('\n') : false;
}

async function run(config, sendMessageFunc) {
  sendMessage = sendMessageFunc;
  sendMessage('temperature monitor started');
  let lastNotified = 0;
  while (true) {
    let data;
    try {
      data = await fetchData();
    } catch (err) {
      sendMessage(`Failed to get temperature: ${err.message} ${err.stack}`);
      await blueBird.delay(1000 * 60 * 60);
      continue;
    }
    statusData = data;
    const text = getMessage(data, config.required);
    const now = Date.now();
    if (text &&  (now - lastNotified > config.notifyInterval)) {
      lastNotified = now;
      sendMessage(text);
    }
    await blueBird.delay(config.interval);
  }
}

async function status() {
  sendMessage(JSON.stringify(statusData, null, 2));
}

module.exports = {run, status};

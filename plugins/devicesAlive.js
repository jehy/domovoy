/* eslint-disable no-console,no-await-in-loop */

'use strict';

const ping = require('ping').promise.probe;
const blueBird = require('bluebird');

let statusData;
let sendMessage;

function prepareConfig(hostConfig) {
  const defaults = {
    timeout: 5000,
    // interval: 1000 * 60 * 5,
    interval: 1000,
    maxDeadCount: 2,
  };
  return {...defaults, ...hostConfig};
}

function setStatusData(current, options) {
  Object.assign(statusData.find((el)=>el.address === current.address), options);
}

async function pingHost(hostConfig) {
  const conf = prepareConfig(hostConfig);
  let alive;
  let deadCount = 0;
  while (true) {
    let aliveNow = false;
    try {
      const res = await ping(conf.address, {timeout: conf.timeout});
      // console.log(`${conf.name} : `, res);
      aliveNow = res.alive;
    } catch (err) {
      console.log(err);
      aliveNow = false;
    }
    setStatusData(conf, {alive: aliveNow});
    if (alive === undefined) {
      alive = aliveNow;
      sendMessage(`${conf.name} is ${alive ? 'alive' : 'dead'} on startup`);
    } else if (!aliveNow) {
      deadCount++; // i suppose we won't have overflow here, huh
      if (deadCount === conf.maxDeadCount && alive) {
        sendMessage(`${conf.name} is dead`);
        alive = false;
      }
    } else if (!alive && aliveNow) {
      sendMessage(`${conf.name} is alive`);
      deadCount = 0;
      alive = true;
    }
    await blueBird.delay(conf.interval);
  }
}

async function run(config, sendMessageFunc) {
  sendMessage = sendMessageFunc;
  sendMessage('ping monitor started');
  statusData = JSON.parse(JSON.stringify(config.hosts));
  await Promise.all(config.hosts.map((conf) => pingHost(conf)));
}

async function status() {
  sendMessage(JSON.stringify(statusData, null, 2));
}

module.exports = {run, status};

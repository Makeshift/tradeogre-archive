const prefix = "https://tradeogre.com/api/v1";
const outputFile = process.env.outputFile || "./out.json";

const axiosIn = require("axios");
const fs = require("fs").promises;

// Fuck axios rejecting promises on non-200 responses it's super dumb
const axios = async (method, ...args) => {
  try {
    return await axiosIn[method](...args);
  } catch (e) {
    if (e.isAxiosError && e.response.status[0] !== 2) {
      return e.response;
    }
    throw e;
  }
};

async function listMarkets() {
  let data = (await axios("get", `${prefix}/markets`)).data;
  let out = data.reduce((acc, cur) => {
    acc[Object.keys(cur)[0]] = Object.values(cur)[0];
    return acc;
  }, {});
  return out;
}

function appendToFile(obj) {
  const date = new Date();
  obj.timestamp = Math.floor(date.getTime() / 1000);
  obj.isoString = date.toISOString();
  let string = JSON.stringify(obj);
  console.log(`${obj.isoString}: Writing summary output`);
  return fs.appendFile(outputFile, string + "\n");
}

async function go() {
  let markets = await listMarkets();
  await appendToFile(markets);
}

//Once on startup to check everything works
go().then(() => {
  //Then every minute, disregarding the promise returned from go
  setInterval(go, 60 * 1000);
});

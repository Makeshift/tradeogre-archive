const prefix = "https://tradeogre.com/api/v1";
const outputPrefix = process.env.outputPrefix || "./outputs/";
const orderList = process.env.orderList?.split(",") || ["LTC-XLA", "BTC-XMR"];

const axiosIn = require("axios");
const fs = require("fs").promises;
const WS = require("ws");
const ReconnectingWebSocket = require("reconnecting-websocket");

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

function appendToFile(obj, file, type) {
  const date = new Date();
  obj.timestamp = Math.floor(date.getTime() / 1000);
  obj.isoString = date.toISOString();
  let string = JSON.stringify(obj);
  console.log(`${obj.isoString}: Writing ${type} output`);
  return fs.appendFile(outputPrefix + file, string + "\n");
}

async function getMarketSummary() {
  let markets = await listMarkets();
  await appendToFile(markets, "out.json", "market summary");
}

function websocketOrders() {
  orderList.forEach((market) => {
    console.log("Opening websocket connection to market " + market);
    const ws = new ReconnectingWebSocket("wss://tradeogre.com:8443/", [], { WebSocket: WS });
    ws.addEventListener("open", function open() {
      console.log("Websocket connection established to market " + market);
      ws.send(
        JSON.stringify({
          a: "submarket",
          name: market,
        })
      );
    });
    ws.addEventListener("message", async (event) => {
      let data = JSON.parse(event.data);
      if (data.a === "newhistory") {
        let parsedData = {
          serverTimestamp: data.d[0],
          isSell: data.d[1] === 1,
          price: data.d[2],
          quantity: data.d[3],
        };
        console.log(`New order in market ${market}: ${JSON.stringify(parsedData)}`);
        await appendToFile(parsedData, `${market}_orders.json`, `${market} orders`);
      } else {
        //console.log(data);
      }
    });
  });
}

//Once on startup to check everything works
getMarketSummary().then(() => {
  //Then every minute, disregarding the promise returned from go
  setInterval(getMarketSummary, 60 * 1000);
  //Also start polling websockets now
  websocketOrders();
});

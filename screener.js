const dfd = require('danfojs-node');
const superagent = require('superagent');
const fs = require('fs');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken)

const { createChartData, plotChart } = require('./chart');

const sendNotification = (stock) => {
    const twilioNumber = process.env.TWILIO_NUMBER;
    const yourPersonalNumber = process.env.YOUR_PERSONAL_NUMBER;
    const message = `Breakout found : ${stock.name} - ${stock.symbol}`;

    client.messages
        .create({ body: message, from: twilioNumber, to: yourPersonalNumber })
        .then((msg) => console.log(msg.sid));
};


const detectBreakout = (levels, previousCandle, lastCandle) => {
    for (const level of levels) {
        const cond1 = previousCandle.column('o').values[0] < level[1];
        const cond2 = lastCandle.column('o').values[0] > level[1];
        if (cond1 && cond2) {
            return true;
        }
    }
    return false;
};


const findLevels = (df) => {
    const high = df.column('h').max();
    const low = df.column('l').min();
    const distance = high - low;

    const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786].map((level) => level * distance + low);

    const levels = [];
    for (let i = 1; i < fibLevels.length; i++) {
        const level = fibLevels[i];
        const prevLevel = fibLevels[i - 1];
        df.column('c').values.map((close, j) => {
            if ((close >= level && close <= prevLevel) || (close <= level && close >= prevLevel)) {
                const levelArray = [j, level];
                const found = levels.some((arr) => arr[1] === levelArray[1]);
                if (!found) {
                    levels.push(levelArray);
                }
            }
        });
    }
    console.log('levels', levels);
    return levels;

};


const getHistoricalData = async (ticker) => {
    return new Promise((resolve) => {
        console.log('ticker', ticker);
        const today = new Date();
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
        const formattedToday = today.toISOString().substring(0, 10);
        const formattedSixMonthsAgo = sixMonthsAgo.toISOString().substring(0, 10);

        const from = formattedSixMonthsAgo;
        const to = formattedToday;
        const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=320&apiKey=${process.env.POLYGON_API_KEY}`;


        superagent.get(url).end((err, res) => {
            if (err) {
                console.error(err);
                resolve(undefined);
            }

            const { results } = res.body;
            resolve(results);
        });
    });
};


const main = async () => {
    const stocks = JSON.parse(fs.readFileSync('S&P500.json'));

    for (const stock of stocks) {
        const ticker = stock.symbol;
        const OHLCData = await getHistoricalData(ticker);

        if (OHLCData !== undefined) {
            let df = new dfd.DataFrame(OHLCData);
            const dateFormat = {
                timeZone: 'UTC',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            };

            const dateColumn = df.column('t').values.map((x) => new Date((x)).toLocaleDateString('en-UK', dateFormat));
            df.addColumn('d', dateColumn, { inplace: true });
            df = df.loc({ columns: ['d', 'o', 'h', 'l', 'c'] });
            df.print();


            const levels = findLevels(df);

            const previousCandle = df.iloc({ rows: [df.shape[0] - 2] });
            const lastCandle = df.iloc({ rows: [df.shape[0] - 1] });
            const hasBreakout = detectBreakout(levels, previousCandle, lastCandle);


            if (hasBreakout) {
                const { chartData, chartLayout } = createChartData(df, levels, ticker);
                await plotChart(chartData, chartLayout, ticker);
                sendNotification(stock);
            }



        }

        await new Promise((r) => setTimeout(r, 15000));
    }
};

main();


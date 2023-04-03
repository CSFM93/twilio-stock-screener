const puppeteer = require('puppeteer');
const fs = require('fs');

const createChartData = (df, levels, ticker) => {
    const trace = {
        type: 'candlestick',
        x: df.column('d').values,
        open: df.column('o').values,
        close: df.column('c').values,
        high: df.column('h').values,
        low: df.column('l').values,
        decreasing: { line: { color: 'red' } },
        increasing: { line: { color: 'green' } },
        line: { color: 'rgba(31,119,180,1)' },
        xaxis: 'x',
        yaxis: 'y',
    };

    const shapes = levels.map((level) => ({
        type: 'line',
        x0: df.iloc({ rows: [level[0]] }).column('d').values[0],
        y0: level[1],
        x1: df.column('d').values[df.column('d').values.length - 1],
        y1: level[1],
        line: {
            color: 'blue',
            width: 2,
            dash: 'dash',
        },
    }));

    const chartLayout = {
        title: `${ticker} Candlestick Chart`,
        width: 1300,
        height: 700,
        xaxis: {
            nticks: 20,
            rangeslider: {
                visible: false,
            },
        },
        yaxis: {
            fixedrange: false,
        },
        shapes: shapes,
    };
    const chartData = [trace];

    return {
        chartData, chartLayout,
    };


};


const plotChart = async (chartData, chartLayout, ticker) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    await page.setContent(`
      <html>
        <head>
          <script src="https://cdn.plot.ly/plotly-2.18.2.min.js"></script>
        </head>
        <body>
          <div id="chart"></div>
        </body>
      </html>
    `);

    await page.evaluate((data, layout) => {
        const chartDiv = document.getElementById('chart');
        Plotly.newPlot(chartDiv, data, layout);
    }, chartData, chartLayout);

    const chartDiv = await page.$('#chart');
    const chartScreenshot = await chartDiv.screenshot({ type: 'png' });
    fs.writeFileSync(`./breakouts/${ticker}.png`, chartScreenshot);
    console.log('chart image saved');

    await browser.close();

}

module.exports = { createChartData, plotChart };
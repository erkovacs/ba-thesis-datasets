const puppeteer = require('puppeteer');
const fs = require('fs');
require("dotenv").config();

const INPUT_PATH = './data/attractions.csv';
const OUTPUT_PATH = './data/attractions-processed.csv';
const SEARCH_URL = 'https://www.google.com/search?q=';

const scraper = {};

scraper.execute = async rows => {
    const csv = fs.createWriteStream(OUTPUT_PATH, {
        flags: 'a' // 'a' means appending (old data will be preserved)
    });
    
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    
    for(let i = 0; i < rows.length; i++){
        const row = rows[i];
        const items = row.split(/","/gi);
        if(items[3] === "N/A"){
            await page.waitFor(3000);
            await page.goto(SEARCH_URL + items[0].replace(/"/, ''));
            try{
                await page.waitForSelector(".r a", {timeout: 5000});
                await page.click(".r a");
                const p = await page.$eval('p', el => el.innerText); 
                if(p) {
                    items[3] = `${p.replace(/"/gi)}`;
                }
                await page.goBack();
            } catch(e){
                console.error(e);
            }
        }
        csv.write(items.join('","')+"\n");
    };
    await browser.close();
    csv.end();
}

fs.readFile(INPUT_PATH, 'utf-8', (err, data) => {
    if(err) throw err;
    const rows = data.split(/\n/gi);
    scraper.execute(rows);
}); 

const puppeteer = require('puppeteer');
const fetch = require("node-fetch");
require("dotenv").config();

const { APP_ID, APP_CODE, APP_COORDS_AT } = process.env;
const scraper = {};

// Start at page with counties of romania, and get all 
scraper.START_URL = "https://en.wikipedia.org/wiki/Counties_of_Romania";
scraper.SEARCH_URL = "https://en.wikipedia.org/w/index.php?profile=advanced&fulltext=1&search=";
scraper.GEOCODING_API_URL = `https://places.cit.api.here.com/places/v1/autosuggest?app_id=${APP_ID}&app_code=${APP_CODE}&at=${APP_COORDS_AT}&q=`;
scraper.BASE_OUTPUT = "./output/";
scraper.ALLOWED_EXTENSIONS = ['', 'htm', 'html', 'php', 'asp', 'aspx', 'do'];
scraper.DELAY_MILLIS = 1001;

scraper.isValidLink = function(url){
    const parsedURL = new URL(url);
    const pathParts = parsedURL.pathname.split(/\./);
    if(pathParts.length === 2){
        if(this.ALLOWED_EXTENSIONS.indexOf(pathParts[1]) > -1){
            return true;
        }
        return false;
    }
    return true;
}

scraper.execute = async function(){
  const allAttractions = [];
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(this.START_URL);
  const countyLinks = await page.evaluate(() => {
      const out = [];
      const links = document.querySelectorAll(".wikitable tr th a");
      for(link of links){
        out.push(link.href);
      }
      return out;
  });
  if(countyLinks && countyLinks.length > 0){
    for(countyLink of countyLinks){
        if(this.isValidLink(countyLink) && /county/i.test(countyLink)){
            await page.waitFor(this.DELAY_MILLIS);
            await page.goto(countyLink);
            const countyData = await page.evaluate(() => {
                const countyName = document.getElementById("firstHeading").innerText || "";
                const attractions = [];
                // Search for the appropriate paragraph
                const pars = document.querySelectorAll('p');
                let found = -1;
                for(let i = 0; i < pars.length; i++){
                    if(/touris|attraction/i.test(pars[i].innerText.toLowerCase())){
                        found = i;
                    }
                }
                // Then find the list
                if(found > -1){
                    const list = pars[found].nextElementSibling;
                    for(let item of list.children){
                        if(/\n/.test(item.innerText)){
                            for(let subItem of item.innerText.split(/\n/)){
                                attractions.push(subItem);
                            }
                        } else {
                            attractions.push(item.innerText);
                        }
                    }
                }
                return {countyName, attractions};
            });
            if(countyData.attractions.length > 0){
                for(let attraction of countyData.attractions){
                    const regex = /\.|\,|the\s|\sthe|\sthe\s/gi;
                    const maxLength = 35;
                    let searchTerm = attraction.toLowerCase().replace(regex, '');
                    if(searchTerm.length > maxLength){
                        let i = maxLength;
                        while(searchTerm[i] !== ' ' && i < searchTerm.length){
                            i++;
                        }
                        searchTerm = searchTerm.substring(0, i);
                    }
                    // Get some basic description data
                    await page.waitFor(this.DELAY_MILLIS);
                    await page.goto(this.SEARCH_URL + encodeURI(searchTerm), {waitUntil: 'networkidle2'});
                    console.log(searchTerm);
                    let description = "";
                    try{
                        await page.click(".mw-search-result a");
                        description = await page.evaluate(() => {
                            const firstParagraph = document.querySelector('p');
                            return firstParagraph ? firstParagraph.innerText : "";
                        });
                    } catch (e) {
                        console.error(e);
                    }

                    try{
                        const res = await fetch(this.GEOCODING_API_URL + encodeURI(searchTerm));
                        const json = await res.json();
                        console.log(this.GEOCODING_API_URL + encodeURI(searchTerm), json);
                    } catch (e){
                        console.error(e);
                    }
                    allAttractions.push({
                        name: attraction,
                        description: description || "N/A",
                        county: countyData.countyName
                    });
                }
            }
            console.log(allAttractions);
        }
    };
  }
  await browser.close();
}

scraper.execute();
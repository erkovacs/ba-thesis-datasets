const puppeteer = require('puppeteer');
const fetch = require("node-fetch");
const fs = require('fs');
require("dotenv").config();

const { 
    APP_ID, 
    APP_CODE, 
    APP_COORDS_AT,
    MIN_LONGITUDE,
    MAX_LONGITUDE,
    MIN_LATITUDE,
    MAX_LATITUDE } = process.env;

const scraper = {};

// Start at page with counties of romania, and get all 
scraper.START_URL = "https://en.wikipedia.org/wiki/Counties_of_Romania";
scraper.SEARCH_URL = "https://en.wikipedia.org/w/index.php?profile=advanced&fulltext=1&search=";
scraper.GEOCODING_API_URL = `https://places.cit.api.here.com/places/v1/autosuggest?app_id=${APP_ID}&app_code=${APP_CODE}&at=${APP_COORDS_AT}&q=`;
scraper.BASE_OUTPUT = "./output/";
scraper.ALLOWED_EXTENSIONS = ['', 'htm', 'html', 'php', 'asp', 'aspx', 'do'];
scraper.DELAY_MILLIS = 2005;

const CSV_HEADER = "NAME,ADDRESS,CATEGORY,DESCRIPTION,COUNTY,LATITUDE,LONGITUDE,RATING";

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

  // Write to a csv
  const csv = fs.createWriteStream(this.BASE_OUTPUT + "attractions.csv", {
    flags: 'a' // 'a' means appending (old data will be preserved)
  });
  csv.write(CSV_HEADER + "\n") // append string to your file

  const browser = await puppeteer.launch({headless: false});
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
  console.log(countyLinks);
  if(countyLinks && countyLinks.length > 0){
    for(countyLink of countyLinks){
        console.log('tick');
        if(this.isValidLink(countyLink) && /county/i.test(countyLink)){
            console.log(countyLink);
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
            // the issue is here, somewhere...
            console.log(countyData.attractions);
            if(countyData.attractions.length > 0){
                const parsedCountyName = countyData.countyName.replace(/county|\"/ig, '').trim();
                for(let attraction of countyData.attractions){
                    console.log(attraction);
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
                    await page.goto(this.SEARCH_URL + encodeURI(searchTerm));
                    let description = "";
                    try{
                        await page.waitFor(".mw-search-result a");
                        await page.click(".mw-search-result a");
                        description = await page.evaluate(() => {
                            const firstParagraph = document.querySelector('p');
                            return firstParagraph ? firstParagraph.innerText : "";
                        });
                    } catch (e) {
                        console.error(e);
                    }
                    const medianCoords = [];
                    medianCoords[0] = 0;
                    medianCoords[1] = 0;
                    try{
                        const res = await fetch(this.GEOCODING_API_URL + encodeURI(searchTerm));
                        const json = await res.json();
                        console.log("GOT RESULTS: " + json.results.length);
                        const placesInRomania = json.results.filter(place => {
                            return (
                                place.position &&
                                place.position[0] >= MIN_LATITUDE && 
                                place.position[0] <= MAX_LATITUDE &&
                                place.position[1] >= MIN_LONGITUDE &&
                                place.position[1] <= MAX_LONGITUDE 
                                );
                            });
                        placesInRomania.map(place => {
                            medianCoords[0] += place.position[0];
                            medianCoords[1] += place.position[1];
                            const newAttraction = {
                                name: place.title.replace(/\"/ig, ""),
                                address: place.vicinity ? place.vicinity.replace(/(<([^>]+)>)/ig," ") : "N/A",
                                category: place.categoryTitle,
                                description: "N/A",
                                county: parsedCountyName,
                                latitude: place.position[0],
                                longitude: place.position[1],
                                rating: 0
                            };

                            allAttractions.push(newAttraction);
                            const {name,
                                address,
                                category,
                                description,
                                county,
                                latitude,
                                longitude,
                                rating} = newAttraction;
                            const line =`"${name}","${address}","${category}","${description}","${county}",${latitude},${longitude},${rating}`.replace(/\n/ig, '');
                            csv.write(line + "\n");
                            console.log(newAttraction.name + " written");
                        });
                        medianCoords[0] /= placesInRomania.length || 1;
                        medianCoords[1] /= placesInRomania.length || 1;
                    } catch (e){
                        console.error(e);
                    }
                    const newAttraction = {
                            name: attraction.replace(/\"/ig, ""),
                            address: parsedCountyName + ", Romania",
                            category: "Attraction",
                            description: description ? description.replace(/\"/ig, "") : "N/A",
                            county: parsedCountyName,
                            latitude: medianCoords[0],
                            longitude: medianCoords[1],
                            rating: 0
                        };
                    allAttractions.push(newAttraction);
                    const {name,
                        address,
                        category,
                        county,
                        latitude,
                        longitude,
                        rating} = newAttraction;
                    const line = `"${name}","${address}","${category}","${newAttraction.description}","${county}",${latitude},${longitude},${rating}`.replace(/\n/ig, '');
                    csv.write(line + "\n");
                    console.log(newAttraction.name + " written");
                }
            }
        } else {
            console.log("Invalid link: " + countyLink);
        }
    };
  }
  await browser.close();
  csv.end();
}

scraper.execute();
import {
  AllPages,
  EventListing,
  parseAllDetailPages,
  parseAllListingsPages,
  parseListingPage,
  requestDetailPage,
  URL_PREFIX,
} from './scraper-utli';
import * as express from 'express';
import * as fs from 'fs';
import * as request from 'request';
import * as cheerio from 'cheerio';
import * as _ from 'underscore';
import { WorkBook, WorkSheet, utils, writeFile } from 'xlsx';


const app: express.Application = express();

app.get('/test-detail', function (req, res) {
  requestDetailPage('https://playaevents.burningman.org/2017/playa_event/23699')
  .then(data=>{res.json(data)})
  .catch(err=>{res.json(err)});
});

app.get('/scrape', function (req, res) {
  // The URL we will scrape from - in our example Anchorman 2.
  const startPage = '1';
  const url = `${URL_PREFIX}2017/playa_events/`;

  const pagesStr = fs.readFileSync('files/pages.json', 'utf8');
  if(pagesStr) {
    try {
      const pages = JSON.parse(pagesStr);
      console.log('Existing page parsed');
      parseAllDetailPages(pages)
      .then(modifiedPages => {
        fs.writeFileSync('files/all-pages.json', JSON.stringify(modifiedPages, null, 2));
        res.json(modifiedPages);
      })
      .catch(err => {
        fs.writeFileSync('files/error.json', JSON.stringify(err));
        res.status(400);
        res.json(err);
      });
    } catch (ex) {
      console.log('error parsing page');
      res.status(400);
      res.json({message: 'Error parsing pages file, please delete and start over!', ex});
    }
  } else {
    // No pages exist, get all pages
    parseAllListingsPages(url)
    .then(pages => {
      fs.writeFileSync('files/pages.json', JSON.stringify(pages, null, 2));
      res.json(pages);
    })
    .catch(err => {
      fs.writeFileSync('files/error.json', JSON.stringify(err));
      res.status(400);
      res.json(err);
    });
  }




})

app.get('/reduce-file', function (req, res) {

  const pagesStr = fs.readFileSync('files/all-pages.json', 'utf8');
  if(pagesStr) {
    try {
      const pages = <AllPages> JSON.parse(pagesStr);
      const newObj = Object.keys(pages).reduce((newObj, key) => {
        pages[key].forEach(page => {
          const eventNo = page.link.split('/').splice(-1)[0];
          if(!newObj[eventNo]) {
            const altTime = page.time
            newObj[eventNo] = {
              name: page.name,
              time: page.detail.dateAndTimes || page.time,
              description: page.detail.description,
              type: page.detail.type,
              hostedByCamp: page.detail.hostedByCamp,
              hostUrl: page.detail.URL,
              pageUrl: page.fullUrl,
              contactEmail: page.detail.contactEmail,
            };
          }
        });
        return newObj;
      }, {})
      fs.writeFileSync('files/all-events.json', JSON.stringify(newObj, null, 2));
      res.json(newObj);
    } catch (ex) {
      console.log('error parsing page');
      res.status(400);
      res.json({message: 'Error parsing pages file, please delete and start over!', ex});
    }
  } else {
    res.json({message: 'files/pages.json - file not found'})
  }
});

app.get('/create-xlsx', function (req, res) {
  
  const pagesStr = fs.readFileSync('files/all-events.json', 'utf8');
  try {
    const allPages = <any> JSON.parse(pagesStr);
    const events = Object.keys(allPages).reduce((arr, key) => {
      const page = allPages[key];
      arr.push({
        eventNumber: key,
        name: page.name,
        time: page.time,
        type: page.type,
        hostedByCamp: page.hostedByCamp,
        description: page.description,
        pageUrl: page.pageUrl,
        contactEmail: page.contactEmail
      });
      return arr;
    }, []);


    utils.json_to_sheet(events);
    var wb: WorkBook = {
      Sheets: {
        playaEvents: utils.json_to_sheet(events)
      },
      SheetNames: ['playaEvents']
    };
    writeFile(wb, 'files/playa-events.xlsx', {bookSST: true, });

    res.json(events);
  } catch (ex) {
    console.log('error parsing page');
    res.status(400);
    res.json({message: 'Error parsing pages file, please delete and start over!', ex});
  }

  
});


app.listen('8081')
console.log('Magic happens on port 8081');
export default app;

// first page:
// class: listing
//   ui:
//     li:
//       a: href / text

// second page:
// only h2 is name of event - <h2 class="text-center">Polegasms, Get Yours!</h2>
// items contain a class called "whitepage"
//   row: col (name) / col (description)
//     dates and timestamp
//     type
//     location
//     hosted by camp
//     url
//     contant email
//     description

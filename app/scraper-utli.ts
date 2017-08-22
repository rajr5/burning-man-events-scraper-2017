import * as cheerio from 'cheerio';
export const URL_PREFIX = 'https://playaevents.burningman.org/';
import * as request from 'request';
import { queue } from 'async';

export interface AllPages {
  [page: string]: EventListing[];
}

export interface EventListing {
  fullUrl: string;
  link: string;
  name: string;
  time: string;
  detail?: EventDetail;
}

export interface EventDetail {
  dateAndTimes?: string;
  type?: string;
  location?: string;
  hostedByCamp?: string;
  URL?: any;
  contactEmail?: any;
  description?: any;
}

const keyMap = {
  'Date and Time(s):': 'dateAndTimes',
  'Type:': 'type',
  'Location:': 'location',
  'Hosted by Camp:': 'hostedByCamp',
  'URL': 'url',
  'Contact Email:': 'contactEmail',
  'Description:': 'description',
}

export function parseListingPage($: CheerioStatic): Promise<EventListing[]> {
  return new Promise((resolve, reject) => {
      let events: EventListing[] = [];
    
      $('a[class=gold-flame]').each((i: number, el: CheerioElement) => {
        // const link = el.attribs['href'];
        let link, name, time;
        try {
          link = el.attribs.href;
        } catch (ex) { }
        try {
          name = el.children[0]['data'].trim();
        } catch (ex) { }
        try {
          time = el.children[1].children[0]['data'].trim();
        } catch (ex) { }
    
        events.push({ fullUrl: `${URL_PREFIX}${link}`, link, name, time, detail: {} })
      });
      resolve(events);
  });
}

export function requestListingPage(url): Promise<EventListing[]> {
  return new Promise((resolve, reject) => {
    request(url, function (error, response, html) {
      // First we'll check to make sure no errors occurred when making the request
      if (!error) {
        // Next, we'll utilize the cheerio library on the returned html which will essentially give us jQuery functionality
        const $ = cheerio.load(html);
        parseListingPage($)
        .then((eventListing: EventListing[]) => {
          console.error('finished parsing listing page');
          resolve(eventListing);
        })
        .catch(err => {
          // error loading page
          console.error('error loading page', err);
          resolve([]);
        });
      }
    })
  });
}

export function parseDetailPage($: CheerioStatic): Promise<EventDetail> {
  return new Promise((resolve, reject) => {
      let eventDetail: EventDetail = {};
    
      $('div[class*=whitepage] > div[class=row]')
      .each((i: number, el: CheerioElement) => {
        const filteredChildren = el.children.filter(el => el.tagName === 'div');

        let key, val;
        try {
          if(filteredChildren[0].children.length > 1) {
            // this is for "description"
            key = filteredChildren[0].children.filter(el => el.type === 'tag')[0].children[0]['data'];
          } else {
            let keyTag = filteredChildren[0].children[0];
            if(keyTag.type = 'text') {
              key = keyTag['data'].trim();
            } else {
              key.children[0]['data'].trim();
            }
          }

          // key = filteredChildren[0].children[0]['data'].trim();

        } catch(ex) { }
        try {
          if(filteredChildren[1].children.length > 1) {
            if(filteredChildren[1].children.length === 3 && filteredChildren[1].children[1].tagName !== null && filteredChildren[1].children[1].tagName !== 'br') {
              val = filteredChildren[1].children[1].children[0]['data'];
            } else {
              val = filteredChildren[1].children.filter(el => el.type == 'text').map(el => el['data'].replace(/\n/g,'').replace(/\s+/g, ' ').trim()).join('\n').replace(/\n$/, '');
            }            
          } else {
            val = filteredChildren[1].children[0]['data'].trim();
          }
        } catch(ex) { }
        
        if(keyMap[key]) {
          eventDetail[keyMap[key]] = val;
        } else {
          eventDetail[key || 'unknown'] = val;
        }

      });
      resolve(eventDetail);
  });
}

export function requestDetailPage(url): Promise<EventDetail> {
  return new Promise((resolve, reject) => {
    request(url, function (error, response, html) {
      // First we'll check to make sure no errors occurred when making the request
      if (!error) {
        // Next, we'll utilize the cheerio library on the returned html which will essentially give us jQuery functionality
        const $ = cheerio.load(html);
        parseDetailPage($)
        .then((eventDetail: EventDetail) => {
          console.log('finished parsing detail page');
          resolve(eventDetail);
        })
        .catch(err => {
          // error loading page
          console.error('error loading page', err);
          resolve(null);
        });
      } else {
        console.error('error loading page', error);
        resolve(null);
      }
    })
  });
}


export function parseAllDetailPages(pages: AllPages): Promise<any> {
  return new Promise((resolve, reject) => {
    
    
    const q = queue((task: EventListing, callback) => {
      requestDetailPage(task.fullUrl)
      .then(results => {
        task.detail = results;
        callback();
      })
      .catch(err => {
        callback(err);
      });
    }, 50);
  
    // assign a callback
    q.drain = () => {
      console.log('all items have been processed');
      resolve(pages);
    };

    Object.keys(pages).forEach(key => {
      pages[key].forEach(listing => {
        listing.fullUrl
        console.log('adding request for page: ', listing.link);
        q.push(listing, (err) => {
          console.log('finished request for page: ', listing.link);
        });
      });
    })

  });
}

export function parseAllListingsPages(startUrl: string): Promise<AllPages> {
  return new Promise((resolve, reject) => {

    const pages: AllPages = {};

    const q = queue((task: {url: string, page: number}, callback) => {
      requestListingPage(task.url)
      .then((results: EventListing[]) => {
        pages[`page-${task.page}`] = results;
        callback();
      })
      .catch(err => {
        callback(err);
      });
    }, 5);
  
    // assign a callback
    q.drain = () => {
      console.log('all items have been processed');
      resolve(pages);
    };

    for(let i = 1; i < 10; i ++) {
      const url = `${startUrl}${i}`
      console.log('adding request for page: ', url);
      q.push({url, page: i}, (err) => {
        console.log('finished request for page: ', url);
      });
    }

  });
}
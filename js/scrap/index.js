const axios = require('axios');
const fs = require('fs');
const path = require('path');

const settings = {
    startURL: 'https://www.google.de/search?as_q=bitcoin&lr=lang_de',
    maxGooglePages: 1, // set to 1, if you dont use Google Pages as start URL
    maxLoops: -1, // -1 = unlimited
    directory: {
        links: path.join(__dirname, '../../links'),
        blacklist: path.join(__dirname, '../../blacklist')
    },
    allowed: {
        subDomain: ['www'],
        topLevelDomain: ['de']
    }
}

// our array for all found and valid links
let anchors = [];

let blacklist = [];
let blacklistLinksFound = 0;

async function init() {

    console.log('Loading Blacklist ...');
    await loadBlacklist();
    resetFiles();

    // first get our "root links"
    // basically, we need a bunch of links to loop on
    await getStartURLs();

    // for every link we find, get the associated page and find new links
    // limit is either, if we looped through them all, and we cant find more,
    // or we reached the max loops, set by "maxLoops"
    let loops = 0;
    while (anchors.length !== loops && (loops === -1 || loops !== settings.maxLoops)) {

        const page = await getPage(anchors[loops].domain, anchors[loops].source);
        console.log(`Loop Nr.: ${loops}, Links Found: ${anchors.length}, Blacklist Links: ${blacklistLinksFound}`);

        // some pages are restriced to scrapping
        if (!page) {
            loops++;
            continue;
        };

        getAnchors(page, anchors[loops].domain);
        loops++;
    }
}

// function to get links from root URL
function getStartURLs() {

    return new Promise(async resolve => {
        let promises = [];

        for (let index = 0; index < settings.maxGooglePages; index++) {
            promises.push(await getPage(`${settings.startURL}${settings.maxGooglePages > 1 ? `&start=${index}0` : ''}`, 'Root'));
        }

        await Promise.all(promises).then(pages => {
            for (let index = 0; index < settings.maxGooglePages; index++) {
                getAnchors(pages[index], 'Root');
            }

            resolve();
        })
    })
}

// function to get the page as object
function getPage(url, source) {
    return new Promise(async resolve => {
        try {
            console.log(` Getting: ${url}\n  Source: ${source}\n`)
            resolve(await axios.get(url, {
                timeout: 2500
            }));
        } catch (err) {
            console.log(`   Error: ${url}\n`)
            resolve(false);
        }
    });
}

// handler to get anchors, based on given page
function getAnchors(page, source) {
    const LINK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

    for (let key in page) {
        if (typeof page[key] !== 'string') continue;

        const links = page[key].match(LINK_REGEX);
        for (let link in links) {

            const { valid, domain, subDomain, domainName, topLevelDomain } = linkValid(links[link]);
            if (valid) {
                anchors.push({
                    domain: `https://${domain}`,
                    subDomain: subDomain,
                    domainName: domainName,
                    topLevelDomain: topLevelDomain,
                    source: `${source}`
                });

                writeToFile(anchors[anchors.length - 1]);
            }
        }
    }
}

// validate the given link, based on the allowed list and if the given link is unique
function linkValid(link) {
    if (link === null) return;

    let valid = true;
    const domain = getDomain(link);
    const subDomain = getSubDomain(domain);
    const domainName = getDomainName(domain);
    const topLevelDomain = getTopLevelDomain(domain);

    let subDomainFound = false;
    for (let index = 0; index < settings.allowed.subDomain.length; index++) {
        if (subDomain === settings.allowed.subDomain[index]) {
            subDomainFound = true;
            break;
        }
    }

    let topLevelDomainFound = false;
    for (let index = 0; index < settings.allowed.topLevelDomain.length; index++) {
        if (topLevelDomain === settings.allowed.topLevelDomain[index]) {
            topLevelDomainFound = true;
            break;
        }
    }

    let blacklistFound = false;
    for (let index = 0; index < blacklist.length; index++) {
        if (blacklist[index] === domain) {
            blacklistFound = true;
            blacklistLinksFound++;
            break;
        }
    }

    if (subDomainFound && topLevelDomainFound && !blacklistFound) {
        for (let index = 0; index < anchors.length; index++) {
            let target = anchors[index].domain;
            if (target.includes(domain)) {
                valid = false;
                break;
            }
        }
    } else valid = false;

    return { valid, domain, subDomain, topLevelDomain, domainName, subDomainFound, topLevelDomainFound };
}

// helper for the validation
const getDomain = url => url.split(/\/{1}/)[2];
const getTopLevelDomain = domain => {
    const URL = domain.split('.');
    const topLevel = URL[URL.length - 1];
    return topLevel;
}
const getDomainName = domain => {
    const URL = domain.split('.');
    const domainName = URL[URL.length - 2];
    return domainName;
}
const getSubDomain = domain => domain.split('.')[0];

// delete directory
const resetFiles = () => fs.rmSync(settings.directory.links, { recursive: true, force: true });


// write link to file
function writeToFile(link) {
    if (typeof link?.domainName === 'undefined') return;

    if (!fs.existsSync(settings.directory.links)) {
        fs.mkdirSync(settings.directory.links);
    }

    const char = link.domainName.charAt(0).toLowerCase();
    const filePath = path.join(settings.directory.links, `${char}.txt`);

    fs.appendFileSync(filePath, `${link.domain}\n`, function (err) {
        console.log(err.message);
    });
}

// load all relevant links into our blacklist array
function loadBlacklist() {
    return new Promise(resolve => {

        // read all files in the blacklist directory
        fs.readdir(settings.directory.blacklist, (err, files) => {

            // for every file:
            const readFilePromises = files

                // proceed, if the filetype
                .filter(file => path.extname(file) === '.tar')
                .map(file => {

                    // looop through the file
                    const blacklistFile = path.join(settings.directory.blacklist, file);

                    // if done, return a promise
                    return new Promise(resolve => {

                        fs.readFile(blacklistFile, 'utf-8', (err, data) => {

                            if (err) console.log(err);
                            else {

                                // split the string by line break /n, so we can loop through each line
                                data.split('\n').forEach(link => {

                                    // check, if the domain is in the allowed list
                                    // if so, push the line in our array
                                    const domain = getDomain(`https://www.${link}`);
                                    const topLevelDomain = getTopLevelDomain(domain);

                                    let topLevelDomainFound = false;
                                    for (let index = 0; index < settings.allowed.topLevelDomain.length; index++) {
                                        if (topLevelDomain === settings.allowed.topLevelDomain[index]) {
                                            topLevelDomainFound = true;
                                            break;
                                        }
                                    }

                                    if (topLevelDomainFound) blacklist.push(domain);
                                });

                                resolve();
                            }
                        });
                    });
                });

            // if we looped through every file, resolve 
            Promise.all(readFilePromises).then(result => resolve(result));
        });
    })
}

init();
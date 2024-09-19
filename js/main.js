import { starPath, path, type, list, resetTimer } from "./config.js";
import { getStats, increaseRoulette, increaseClick, addRating } from "./firebase/index.js";
export const roulette = () => {
    'use strict';

    const version = '1.0.0';

    const settings = {
        css: {
            background_font_distance: window.getComputedStyle(document.documentElement).getPropertyValue('--background-font-distance').replace('rem', '') * 16,
            background_font_transtion: window.getComputedStyle(document.documentElement).getPropertyValue('--background-font-transtion').replace('s', '') * 1000,
            background_hero_left: window.getComputedStyle(document.documentElement).getPropertyValue('--background-hero-left'),
            breakpoint_mobile: window.getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-mobile').replace('px', ''),
            font_color: window.getComputedStyle(document.documentElement).getPropertyValue('--font-color'),
            default_star_border_color: window.getComputedStyle(document.documentElement).getPropertyValue('--star-color-border')
        }
    }

    // elements to update after every shuffle
    const pickerButton = document.querySelectorAll('.url-pick-button');
    const pickText = document.querySelectorAll('.url-pick-string');
    const countEL = document.querySelectorAll('.count');
    const clicksEl = document.querySelectorAll('.clicks');
    const ratingEl = document.querySelectorAll('.avg_rating');

    let files = {};
    let fileKeys = [];
    let intervalls = [];

    let blockReset = false; // block all reset querys. 
    let isOnRest = false; // if we are currently in a reset event, block other querys

    // current URL
    let currULR;

    // used by the intervall to reset everything after a certain time
    let time = {
        now: Date.now(),
        then: undefined,
        stop: false
    }

    async function _init() {
        const links = await loadLinks();
        document.querySelector('#link_count').innerHTML = links;

        createText();
        initEvents();
        let star = await loadStars();
        star = star.replace(/(\r\n|\n|\r)/gm, '');

        createStars(star);
    }

    function loadLinks() {
        return new Promise(resolve => {
            createObject();
            let promises = [];
            let links = 0;

            for (let char in files) {
                promises.push(
                    fetch(files[char].path)
                        .then(result => result.text())
                        .then(text => {
                            const array = text.split('\n').filter(i => i)
                            files[char].urls = array;
                            files[char].length = array.length
                            links += array.length
                        })
                )
            }

            Promise.all(promises).then(result => resolve(links));
        });
    }

    function loadStars() {
        return new Promise(resolve => {
            fetch(starPath)
                .then(result => {
                    const text = result.text();
                    resolve(text);
                });
        });
    }

    // create the object we use, to create the background text + to find our final link
    function createObject() {
        for (let index = 0; index <= 9; index++) {
            files[index] = {
                index: 0,
                length: undefined,
                path: `${path}/${index}.${type}`,
                urls: []
            };
            fileKeys.push(index);
        }

        for (let i = 0; i < 26; i++) {
            const char = (i + 10).toString(36);
            files[char] = {
                index: 0,
                length: undefined,
                path: `${path}/${char}.${type}`,
                urls: []
            }

            fileKeys.push(char);
        }
    }

    // create rows and cols + fill with url text
    async function createText() {
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        let currWidth = 0, currHeight = 0;
        let leftCarousell = true;

        while (screenHeight > currHeight) {
            const row = document.createElement('div');
            row.classList.add('carousell');
            row.classList.add(leftCarousell ? 'left' : 'right');
            document.querySelector('#hero--right').appendChild(row);

            while (screenWidth > currWidth) {
                const col = document.createElement('div');
                col.classList.add('url');
                const { url } = getRandomURL();
                col.innerText = url;
                row.appendChild(col);

                currWidth += col.getBoundingClientRect().width + settings.css.background_font_distance;
            }

            currWidth = 0;
            currHeight += row.getBoundingClientRect().height + settings.css.background_font_distance;
            leftCarousell = !leftCarousell;
        }

        const carousells = document.querySelectorAll('.carousell');
        carousells.forEach(element => {
            element.classList.add('showText');
        });
    }


    function initEvents() {
        window.addEventListener('resize', function () {
            blockReset = false;
            resetText();
            setState(2)
        }, true);

        registerIntervalls();

        document.querySelector('#roulette').addEventListener('click', async () => {
            blockReset = true;

            const { url } = getRandomURL();
            currULR = url; // we need to save the current URL, to update the db later. Docs are name by url
            const urlLink = `https://www.${url}`

            pickerButton.forEach(element => element.href = urlLink);
            pickText.forEach(element => element.innerHTML = url);
            const { roulette, clicks, rating } = await getStats(url);
            increaseRoulette(url);

            countEL.forEach(element => element.innerHTML = roulette + 1);
            clicksEl.forEach(element => element.innerHTML = clicks);

            let avgRating = 0;
            if (rating.length > 0) {
                rating.forEach(rating => {
                    avgRating += rating;
                });

                avgRating = (avgRating / rating.length).toFixed(2).replace('.', ',');

            } else avgRating = '-'
            ratingEl.forEach(element => element.innerHTML = avgRating);


            const carousells = document.querySelectorAll('.carousell');
            carousells.forEach(element => {
                element.classList.remove('showText');
            });

            await setState(0);

            // after x seconds we reset everything
            setTimer();
            const x = setInterval(function () {
                if (Date.now() >= time.then && !time.stop) {
                    clearInterval(x);
                    blockReset = false;
                    resetText();
                }
            }, 1000);
        });

        window.addEventListener('mousemove', () => setTimer());

        pickerButton.forEach(element => {
            element.addEventListener('click', function () {
                time.stop = true;
                window.open(
                    this.href,
                    '_blank' // <- This is what makes it open in a new window.
                );
                increaseClick(currULR);
                setState(1);
            });
        })
    }

    // reset everything
    // 1. moving background on the right on desktop
    // 2. chosen URL
    // 3. Rating
    // then recreate moving background
    async function resetText() {
        if (!blockReset && !isOnRest) {
            isOnRest = true;

            const carousells = document.querySelectorAll('.carousell');
            carousells.forEach(element => {
                element.classList.remove('showText');
            });

            await setState(2);

            carousells.forEach(element => {
                element.remove();
            })
            createText();
            registerIntervalls();

            isOnRest = false;
        }
    }

    // every view seconds we want to check, if we have to redraw the moving text
    // to do so, we first want to unregister any previous intervalls
    // and secondly register the new intervalls with the new created rows by createText()
    function registerIntervalls() {
        intervalls.forEach(element => {
            clearInterval(element);
        })
        const left = document.querySelectorAll('.carousell');
        left.forEach(row => {
            intervalls.push(setInterval(handleText, 1000, row));
        });
    }

    // called by registered intervalls
    // it checks, if we need to reset the text, based on the max width of the rows and how far it has moved
    function handleText(row) {
        const width = row.getBoundingClientRect().width / 2;
        const moved = getComputedStyle(row).getPropertyValue('left').replace('px', '') * -1;

        if (width <= moved) {
            resetText();
        }
    }

    // the function to get a new random url
    function getRandomURL() {
        const newListIndex = Math.floor((Math.random() * Object.keys(list).length - 1) + 1);
        const newCharIndex = Math.floor((Math.random() * list[newListIndex].linked.length - 1) + 1);
        const newCharString = list[newListIndex].linked[newCharIndex];

        let keyToChar;
        for (let keys in fileKeys) {
            if (fileKeys[keys].toString() === newCharString) {
                keyToChar = keys;
                break;
            }
        }
        const newChar = fileKeys[keyToChar];
        const newURLIndex = Math.floor((Math.random() * files[newChar].length - 1) + 1);

        const url = files[newChar].urls[newURLIndex].replace('https://www.', '');

        // Test URL
        // const url = files['b'].urls[98].replace('https://www.', '');

        return {
            linkedIndex: newListIndex,
            linkedString: list[newListIndex].string,
            newChar,
            url
        };
    }

    // build all five stars in both forms
    // also register the events
    function createStars(star) {
        const form = document.querySelectorAll('.rating');

        // five stars
        for (let index = 1; index <= 5; index++) {

            // two forms
            // we know the first form is the left one ->desktop
            for (let formNr = 0; formNr < 2; formNr++) {
                let device = formNr === 0 ? 'mobile' : 'desktop';

                const input = document.createElement('input');
                input.type = 'radio';
                input.classList.add('rating__input');
                input.classList.add(`rating__input-${index}`);
                input.id = `rating_${index}--${device}`;
                input.setAttribute('star', index);
                input.setAttribute('device', device);
                input.name = 'rating';

                input.addEventListener('change', updateRating);

                const label = document.createElement('label');
                label.classList.add('rating__label');
                label.htmlFor = `rating_${index}--${device}`;
                label.id = `rating_${index}--${device}--label`;
                label.innerHTML = star;

                form[formNr].appendChild(input);
                form[formNr].appendChild(label);
            }
        }
    }

    // update the rating visually + in db
    async function updateRating(e) {
        disableRadioButton(true);

        const starNr = e.target.getAttribute('star');
        addRating(currULR, starNr);

        const labels = document.querySelectorAll('.rating__label');
        labels.forEach((element, index) => {

            if (index + 1 > starNr) {
                element.classList.remove(`rating__label--delay${index + 1}`);
                const starStroke = element.querySelector('.rating__star-stroke');
                const starFill = element.querySelector('.rating__star-fill');
                const starRing = element.querySelector('.rating__star-ring');
                const starLines = element.querySelectorAll('.rating__star-line');

                starStroke.style.fill = '';
                starStroke.style.stroke = settings.css.default_star_border_color;
                starFill.style.fill = '';
                starFill.style.stroke = '';
                starRing.style.fill = '';
                starRing.style.stroke = '';

                starLines.forEach(element => {
                    element.style.fill = ''
                    element.style.stroke = ''
                });
            }
        });

        for (let index = 1; index <= starNr; index++) {
            const target = document.querySelector(`#rating_${index}--${e.target.getAttribute('device')}--label`);
            const starStroke = target.querySelector('.rating__star-stroke');
            const starFill = target.querySelector('.rating__star-fill');
            const starRing = target.querySelector('.rating__star-ring');
            const starLines = target.querySelectorAll('.rating__star-line');

            // mobile we use the left side, with the black background
            // we need therefore another color for our stars
            starStroke.style.fill = isMobile() ? settings.css.font_color : settings.css.background_hero_left;
            starStroke.style.stroke = isMobile() ? settings.css.font_color : settings.css.background_hero_left;
            starFill.style.fill = isMobile() ? settings.css.font_color : settings.css.background_hero_left;
            starFill.style.stroke = isMobile() ? settings.css.font_color : settings.css.background_hero_left;
            starRing.style.fill = isMobile() ? settings.css.font_color : settings.css.background_hero_left;
            starRing.style.stroke = isMobile() ? settings.css.font_color : settings.css.background_hero_left;

            starLines.forEach(element => {
                element.style.fill = isMobile() ? settings.css.font_color : settings.css.background_hero_left
                element.style.stroke = isMobile() ? settings.css.font_color : settings.css.background_hero_left
            });
        }

        await delay(settings.css.background_font_transtion * 2);
        blockReset = false;
        resetText();
        disableRadioButton(false);

        for (let index = 1; index <= 5; index++) {
            const target = document.querySelector(`#rating_${index}--${e.target.getAttribute('device')}--label`);
            const starStroke = target.querySelector('.rating__star-stroke');
            const starFill = target.querySelector('.rating__star-fill');
            const starRing = target.querySelector('.rating__star-ring');
            const starLines = target.querySelectorAll('.rating__star-line');

            starStroke.style.fill = '';
            starStroke.style.stroke = settings.css.default_star_border_color;
            starFill.style.fill = '';
            starFill.style.stroke = '';
            starRing.style.fill = '';
            starRing.style.stroke = '';

            starLines.forEach(element => {
                element.style.fill = ''
                element.style.stroke = ''
            });
        }
        e.target.checked = false;
    }

    // 0 = show link with stats
    // 1 = hide links with state and show rating
    // 2 = hide both
    function setState(state) {
        return new Promise(async resolve => {
            const deviceClass = isMobile() ? 'mobile' : 'desktop';

            const pickWrapper = document.querySelectorAll(`.url-pick.${deviceClass}`);
            const ratingWrapper = document.querySelectorAll(`.rating__wrapper.${deviceClass}`);
            const rouletteFrame = document.querySelector('#cta');

            if (state === 0) {
                ratingWrapper.forEach(element => element.classList.remove('show'));
                pickWrapper.forEach(element => element.style.display = 'block');
                rouletteFrame.classList.add('active');

                await delay(settings.css.background_font_transtion);

                pickWrapper.forEach(element => element.classList.add('show'));
                ratingWrapper.forEach(element => element.style.display = '');
                if (isMobile()) rouletteFrame.style.display = 'none';
                else rouletteFrame.style.display = '';

                resolve(state);

            } else if (state === 1) {
                pickWrapper.forEach(element => element.classList.remove('show'));
                ratingWrapper.forEach(element => {
                    element.style.display = 'block';
                });

                await delay(settings.css.background_font_transtion);

                ratingWrapper.forEach(element => element.classList.add('show'));
                pickWrapper.forEach(element => element.style.display = '');

                resolve(state);

            } else if (state === 2) {
                pickWrapper.forEach(element => element.classList.remove('show'));
                ratingWrapper.forEach(element => element.classList.remove('show'));
                rouletteFrame.style.display = '';

                await delay(settings.css.background_font_transtion);

                pickWrapper.forEach(element => element.style.display = '');
                ratingWrapper.forEach(element => element.style.display = '');
                rouletteFrame.classList.remove('active');

                resolve(state);
            }
        })
    }

    // helper to see if we are on a mobile device, or not
    const isMobile = () => {
        const mobileWidth = settings.css.breakpoint_mobile;
        const screenWidth = window.screen.width;
        return screenWidth < mobileWidth;
    }


    // enable/disable radio buttons (rating), based on if we are submitting or not
    const disableRadioButton = enable => {
        const radioBtn = document.querySelectorAll('input[type="radio"]');
        radioBtn.forEach(element => {
            element.disabled = enable;
        });
    }

    // helper to wait for certain animations
    const delay = ms => new Promise(res => setTimeout(res, ms));

    // helper to set timer, befor we reset everything to default
    const setTimer = () => {
        const now = Date.now();
        time = {
            then: now + resetTimer * 1000,
            stop: false
        }
    }

    _init();

    return {
        init: _init,
        version: version
    }
}
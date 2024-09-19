import { getData, saveData } from "./functions.js";
'use strict';

let data = {
    roulette: 0, clicks: 0, rating: []
}


// the doc we are working on
// updated by getStats
let doc;

const getStats = async url => {
    return new Promise(async resolve => {
        doc = await getData(url);

        if (doc.exists()) {
            data.roulette = doc.data().roulette;
            data.clicks = doc.data().clicks;
            data.rating = doc.data().rating;
        } else {
            data.roulette = 0;
            data.clicks = 0;
            data.rating = [];
        }

        resolve({
            roulette: data.roulette, clicks: data.clicks, rating: data.rating
        });

    })
}

const increaseRoulette = url => {
    data.roulette = data.roulette + 1;
    saveData(url, data);
}

const increaseClick = url => {
    data.clicks = data.clicks + 1;
    saveData(url, data);
}

const addRating = (url, rating) => {
    data.rating.push(rating);
    saveData(url, data);
}

export { getStats, increaseRoulette, increaseClick, addRating }
// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { firebaseConfig, collectionID } from './config.js';

'use strict';
const app = initializeApp(firebaseConfig);
const db = getFirestore();
const collectionRef = collection(db, 'User');

export { app, db, collectionRef };

export const docRef = url => {
    return doc(db, collectionID, url)
}
export const getData = (url) => {
    return new Promise(async resolve => {
        const data = await getDoc(docRef(url));
        resolve(data);
    });
}

// we dont need this to awaitm async is fine
export const saveData = async (url, data) => {
    const documentRef = docRef(url);
    await setDoc(documentRef, data); // Erstellt das Dokument, wenn es nicht existiert
}
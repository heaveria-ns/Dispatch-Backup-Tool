console.log('Loaded: index.js')

const fs = require("fs");
const parseString = require('xml2js').parseString;
const { ipcRenderer } = require('electron')


/* Global Variables */
let url = "https://www.nationstates.net/cgi-bin/api.cgi?";
let xmlResult;
let jsonResult;
let queue = [];
let dispatchContent = [];

async function onSubmit() {
    document.getElementById('submitButton').disabled = true;
    let uAgent = document.getElementById('uAgent').value,
        nName = document.getElementById('nName').value,
        throttle = parseInt(document.getElementById('throttle').value),
        check = true;

    // uAgent
    if (uAgent === '' || uAgent.length < 3) {
        document.getElementById('uAgent').style.outline = "3px solid red"
        check = false;
    } else {
        document.getElementById('uAgent').style.outline = "none"
    }

    // nName
    if (nName === '') {
        document.getElementById('nName').style.outline = "3px solid red"
        check = false;
    } else {
        document.getElementById('nName').style.outline = "none"
    }

    let result = await checkIfNationExists(nName);
    try {
        if (result.NATION.FIRSTLOGIN === undefined) {
            document.getElementById('nName').style.outline = "3px solid red"
            check = false;
        } else {
            document.getElementById('nName').style.outline = "none"
        }
    } catch (err) {
        document.getElementById('nName').style.outline = "3px solid red"
        check = false;
    }

    if (throttle < 650) {
        throttle = 650;
        document.getElementById('throttle').value = 650;
    }

    if (document.getElementById('progress').value > 0) {document.getElementById('progress').value = 0};
    if (check === true) {controller(uAgent, nName, throttle).then();}
}

async function checkIfNationExists(nName) {
    let json;
    await fetch(`${url}nation=${nName}`)
        .then(res => res.text())
        .then(data => {
            parseString(data, function (err, result) {
                json = result;
            });
        })
    document.getElementById('submitButton').disabled = false;
    return json;
}

async function controller(uAgent, nName, throttle) {
    document.getElementById('submitButton').disabled = true;
    let listUrl = stringBuilder("dispatchList", uAgent, nName);
    await getDispatchList(listUrl);
    await xmlToJSON(xmlResult);
    document.getElementById('progress').value += 20;
    let listID = createDispatchList(jsonResult);
    await getDispatchContent(listID, uAgent, throttle);
    saveContent(nName);
    // Clean Up:
    queue = [];
    dispatchContent.length = 0;
    document.getElementById('submitButton').disabled = false;
}


function stringBuilder(type, uAgent, nNameOrID) {
    switch(type) {
        case "dispatchList":
            return `${url}userAgent=dispatch.js%20%28Developed%20by%20Heaveria.%29%20In%20use%20by%20${uAgent}&nation=${nNameOrID}&q=dispatchlist`;
        case "dispatchContent":
            // noinspection SpellCheckingInspection
            return `${url}userAgent=dispatch.js%20%28Developed%20by%20Heaveria.%29%20In%20use%20by%20${uAgent}&q=dispatch;dispatchid=${nNameOrID}`;
    }
}

async function getDispatchList(listUrl) {
    await console.log(`Sending GET request to ${listUrl}`);
    await fetch(listUrl)
        .then(res => res.text())
        .then(data => {
            xmlResult = data;
        });
}

function createDispatchList(jsonResult) {
    let array = [];
    // noinspection JSUnresolvedVariable
    for(let i = 0; i < jsonResult.NATION.DISPATCHLIST[0].DISPATCH.length; i++) {
        // noinspection JSUnresolvedVariable
        array.push(jsonResult.NATION.DISPATCHLIST[0].DISPATCH[i].$.id)
    }
    console.log('\x1b[35m', `Dispatches:\n${array}`);
    return array;
}

async function getDispatchContent(listID, uAgent, throttle) {
    // Build URL for each request.
    for(let i = 0; i < listID.length; i++) {
        queue.push(stringBuilder("dispatchContent", uAgent, listID[i]));
    }
    let progressSize = 80 / queue.length; // For the progress bar.
    /* Sends a request for each dispatch:
    * To meet the rate limit of 50 requests per 30 seconds, if there are less than 49 requests, all are sent quickly.
    * If there are more than 49, the program will sleep for 650 ms between each request. Extra time is factored in just to be safer.*/
    for(let i = 0; i < queue.length; i++) {
        console.log(`Request ${i + 1} of ${queue.length}`);
        console.log(`Sending GET request to ${queue[i]}`);
        await fetch(queue[i])
            .then(res => res.text())
            .then(data => {
                xmlResult = data;
            });
        await xmlToJSON(xmlResult);
        dispatchContent.push(`/*--------DISPATCH---------*/\nTitle: ${jsonResult.WORLD.DISPATCH[0].TITLE[0]}\nCategory: ${jsonResult.WORLD.DISPATCH[0].CATEGORY[0]}\nSubcategory: ${jsonResult.WORLD.DISPATCH[0].SUBCATEGORY[0]}\nText:\n${jsonResult.WORLD.DISPATCH[0].TEXT[0]}`);
        document.getElementById('progress').value += progressSize;
        await sleep(throttle);
    }
}

function saveContent(nName) {
    let date_ob = new Date();
    let fullDate = {
        day: date_ob.getDate(),
        month: date_ob.getMonth()+1,
        year: date_ob.getFullYear()
    };
    let dir = (ipcRenderer.sendSync('select-dirs'));
    console.log(dir[0]);
    fs.writeFileSync(`${dir}\\backup_${nName}_${fullDate.day}-${fullDate.month}-${fullDate.year}.txt`, dispatchContent.join('\n'));
    console.log(`Backup saved with the name: backup_${nName}_${fullDate.day}-${fullDate.month}-${fullDate.year}.txt`);
}

function xmlToJSON(xml) {
    parseString(xml, function (err, result) {
        jsonResult = result;
    });
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

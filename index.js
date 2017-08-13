/*
    Copyright (c) 2017 Unify Inc.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the Software
    is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
    OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*jshint node:true */

// usage: node index.js --from 2017-08-02 --to 2017-08-03 --file qos_items.json

'use strict';

process.env['TZ'] = 'utc';

const fs = require('fs');
const assert = require('assert');
const commandLineArgs = require('command-line-args');
const  babar = require('babar');

//*********************************************************
//* initReport
//*********************************************************
function initReport(calls, hours) {
    for (let i = 0; i < hours; i++) {
        calls.push([i, 0]);
    }
}

//*********************************************************
//* updatePeakCallsPerHour
//*********************************************************
function updatePeakCallsPerHour(hours, counter, calls) {
    if (counter > calls[hours][1]) {
        calls[hours][1] = counter;
    }
}

//*********************************************************
//* plotpeakAudioStreamsPerHour
//*********************************************************
function plotpeakAudioStreamsPerHour(calls, caption, color = 'green') {
    console.log(babar(
        calls,
         {
            color: color,
            caption: caption,
            width: 96
        }
    ));
}

const optionDefinitions = [
  { name: 'from', type: String },
  { name: 'to', type: String },
  { name: 'file', type: String }
];

const options = commandLineArgs(optionDefinitions);
console.log(options);

let hits = [];
let files = options.file.replace(/\s/g,'').split(',');

files.forEach(file => {
    hits = hits.concat(require(`./${file}`).hits.hits);
    console.log(file, hits.length);
});

let begins = [];
let ends = [];
let durations = [];
let activeCallslPerMinute = new Map();
let rtcIds = new Map();

hits.forEach( item => {
    begins.push(item._source.qosItems.TB);
    ends.push(item._source.qosItems.TE);
    durations.push(item._source.duration);

    let ridCounter = rtcIds.get(item._source.qosItems.RID);
    rtcIds.set( item._source.qosItems.RID, (ridCounter) ? ++ridCounter : 1);
});

begins.sort();
ends.sort();
durations.sort();

let begin = (options.from) ? new Date(options.from).getTime() : begins[0];
let end = (options.to) ? new Date(options.to).getTime() : ends[ends.length-1];
assert.ok(end > begin);

console.log('first RTP stream starts at', begin, new Date(begin).toUTCString(), begins.length);
console.log('last RTP stream ends at', end, new Date(end).toUTCString(), ends.length);
console.log('longest RTP stream is', durations[durations.length-1] / 60000, "minutes");
console.log('unique rtcIds', rtcIds.size);
console.log('max streams for an rtcId', Math.max(...Array.from(rtcIds.values())));

const SAMPLE_INTERVAL = 60000;  // one minute
const AUDIO_BW = 64;            // opus kbps
const VIDEO_BW = 256;           // vp8 video kps
const SREEN_SHARE_BW = 120;     // vp8 screeen share kps

let samples = Math.ceil((end - begin) / (SAMPLE_INTERVAL));
let start = begin - (begin % SAMPLE_INTERVAL);
let hours = (samples * SAMPLE_INTERVAL) / (3600 * 1000)

console.log('time samples', samples, 'time SAMPLE_INTERVAL [ms]', SAMPLE_INTERVAL, 'report duration [h]', hours);

// try babbar command line graph
// determine peak call values every hour

let reports = {
    peakAudioStreamsPerHour: [],
    peakVideoStreamsPerHour: [],
    peakScreenSahreStreamsPerHour: [],
    estimatedBandwidthPerHour: []
};

for (let key in reports) {
    initReport(reports[key], hours);
}

// for time slot count the number of concurrent calls
for (let i = 0; i < samples; i++) {

    let time = start + (i * SAMPLE_INTERVAL);
    let hour = Math.floor((i * SAMPLE_INTERVAL) / (3600 * 1000)); // hour since start

    let audioCounter = 0;
    let videoCounter = 0;
    let screenShareCounter = 0;

    hits.forEach( item => {
        if (
            item._source.qosItems.TB < time &&
            item._source.qosItems.TE > time &&
            item._source.duration > 10000 &&
            item._source.qosItems.OR > 0        // estimate downstream BW
            // item._source.qosItems.OS > 0     // estimate upstream BW
        ) {
            switch (item._source.rtcQosMediaType) {
                case "AUDIO":
                    audioCounter++;
                    break;
                case "VIDEO":
                    videoCounter++;
                    break;
                case "SCREEN_SHARING":
                    screenShareCounter++;
                    break;
             }
        }
    });

    let bandwidth = ((audioCounter * AUDIO_BW) + (videoCounter * VIDEO_BW) + (screenShareCounter * SREEN_SHARE_BW)) / 1000;
    bandwidth = Math.ceil(bandwidth * 10) / 10;

    activeCallslPerMinute.set(time, {
        audioCounter: audioCounter,
        videoCounter: videoCounter,
        screenShareCounter: screenShareCounter,
        bandwidth: bandwidth
    });

     updatePeakCallsPerHour( hour, audioCounter, reports.peakAudioStreamsPerHour);  //new Date(time).getHours(),
     updatePeakCallsPerHour(hour, videoCounter, reports.peakVideoStreamsPerHour);
     updatePeakCallsPerHour(hour, screenShareCounter, reports.peakScreenSahreStreamsPerHour);
     updatePeakCallsPerHour(hour, bandwidth, reports.estimatedBandwidthPerHour);
}

// dump to csv
let wstream = fs.createWriteStream('output.csv');

wstream.write('Date, Audio, Video, ScreenShare, Bandwidth');
activeCallslPerMinute.forEach((value, key) => {
    wstream.write(`${new Date(key).toUTCString().replace(/,/,"")},${value.audioCounter},${value.videoCounter},${value.screenShareCounter},${value.bandwidth} \n`);
});

wstream.end();
console.log('created output.csv');

// plot on cmd line
plotpeakAudioStreamsPerHour(reports.peakAudioStreamsPerHour, 'Peak Concurrent Audio Streams');
// plotpeakAudioStreamsPerHour(reports.peakVideoStreamsPerHour, 'Peak Concurrent Video Streams');
plotpeakAudioStreamsPerHour(reports.peakScreenSahreStreamsPerHour, 'Peak Concurrent ScreenShare Streams');
plotpeakAudioStreamsPerHour(reports.estimatedBandwidthPerHour, 'Estimated Average Downstream Bandwidth [Mbps]', 'red');
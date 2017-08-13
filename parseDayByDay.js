/*
    Copyright (c) 2016 Unify Inc.

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

// usage: node parseDayByDay.js --file qos_values-day-by-day.txt

'use strict';
const commandLineArgs = require('command-line-args');
const optionDefinitions = [
    { name: 'file', type: String }
  ];

const options = commandLineArgs(optionDefinitions);
 console.log(options);
let fileName = options.file.split('.')[0];

const fs = require('fs');
const readline = require('readline');
const stream = require('stream');
let instream = fs.createReadStream(options.file);
let rl = readline.createInterface(instream, null);

let wstream = null;
let skip = false;
rl.on('line', function(line) {
    if (skip){
        skip = false;         // skip line after the date line
        return;
    }
    if (line.match(/^2017-[0-9]{2}-[0-9]{2}$/)) {
        skip = true;         // date line - skip the next line
        wstream = fs.createWriteStream(`${fileName}-${line}.json`);
        return;
     }
     wstream.write(`${line}\n`);
});


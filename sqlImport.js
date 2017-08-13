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

// usage: node sqlImport.js --file qos_items.json  or node.js  --file "`ls -m qos_items-day-by-day*.json`"

'use strict';

/**
 * return a string with an SQL CREATE TABLE statement for the given object
 * @param {string} name - the name of the table
 * @param {Object} schema - the object for which the table should be created. No columns will be created for properties with null values.
 */
function createTableStatement(name, schema) {
    let stmt = `CREATE TABLE ${name} ( \n`;
    stmt += getColumnsNames(schema);
    stmt += ');';
    return stmt;
}

/**
 * return a string with a comma separated list of SQL column names for the given object
 * @param {Object} schema - the object for which the table should be created. No columns will be created for properties with null values.
 * @param {string} type - return the SQL type for each column, defaults to true
 * @param {string} prefix - string to prefix the column name, defaults to ''
 */
function getColumnsNames(schema, type = true, prefix = '') {
    let columns = '';
    for (let prop in schema) {

        switch (typeof(schema[prop])) {

            case 'object':
                if (schema[prop] === null){
                    continue;
                }
                columns += ((columns === '') ?'' : ',\n') + (getColumnsNames(schema[prop], type  /*,prop*/ )); // skip the prefix as long as there are no clashes
                break;

            case 'function':
                continue;

            default:
                let sqlType = jsToSqlType(schema[prop]);
                if (!sqlType) {
                    console.log('NULL type for ', prop);
                    continue;
                }
                columns += ((columns === '') ? '' : ',\n' ) + `\`${prop}\`${(type) ? (' ' + sqlType) : ''}`; // ${prefix}_ skip the prefix as long as there are no clashes
                break;
        }
    }
    return columns;
};

/**
 * return a string with an SQL CREATE TABLE statement for the given object
 * @param {string} name - the name of the table
 * @param {Object} record - the object for which the table should be created. No columns will be created for properties with null values.
 */
function createInsertStatement(name, record) {
    insertDerivedProperties(record);
    let namesAndValues = getColumnsNamesAndValues(record);
    let stmt = `INSERT INTO ${name} ( \n`;
    stmt += namesAndValues.names;
    stmt += ') VALUES (\n';
    stmt += namesAndValues.values;
    stmt += ');'
    return stmt;
}

/**
 * return a string with a comma separated list of SQL column names for the given object
 * @param {Object} record - the object for which the table should be created. No columns will be created for properties with null values.
 * @param {string} type - return the SQL type for each column, defaults to true
 * @param {string} prefix - string to prefix the column name, defaults to ''
 */
function getColumnsNamesAndValues(record,  prefix = '') {
    let names = '';
    let values = '';
    for (let prop in record) {
        switch (typeof(record[prop])) {
            case 'object':
                if (record[prop] === null){
                    continue;
                }
                let namesAndValues = getColumnsNamesAndValues(record[prop],  prop );
                if (namesAndValues.names === ''){
                    continue;
                }
                names += ((names === '') ?'' : ',\n') + namesAndValues.names;
                values += ((values === '') ?'' : ',\n') + namesAndValues.values;
                break;
            case 'function':
                continue;
            default:
                let value = getSqlValue(record[prop]);
                if (value === null){
                    console.log(value,prop, record[prop]);
                    continue;
                }
                names += ((names === '') ? '' : ',\n' ) + `\`${prop}\``;                // skip the prefix ${prefix}_ as long as there are no clashed
                values += ((values === '') ? '' : ',\n' ) + `${value}`;
                break;
        }
    }
    return {names:names, values:values};
};

/**
 * add computed properties to the record
 * @param  value - the value to be converted to sql representation
 */
function insertDerivedProperties(record) {
    record.derived = {};
    record.derived.p_loss_rcvd = (record.qosItems.PLL && record.qosItems.PR && record.qosItems.PR > 0) ? record.qosItems.PLL/record.qosItems.PR : null;
    record.derived.p_loss_sent = (record.qosItems.PLR && record.qosItems.PS && record.qosItems.PS > 0) ? record.qosItems.PLR/record.qosItems.PS : null;
};

/**
 * return  value for an sql insert statement
 * @param  value - the value to be converted to sql representation
 */
function getSqlValue(value) {
    switch (jsToSqlType(value)) {
        case 'NUMERIC':
            return (value) ? 1 : 0;
        case 'TEXT':
            return `'${value}'`;
        case null:
           return null;
        default:
            return value;
    }
}

/**
 * return a string with the SQL type for the passed value
 * @param {Object} value - variable or object property
 */
function jsToSqlType(value){
    switch( typeof(value)){
        case 'undefined':
            return null;
        case 'object':
            return null;
        case 'boolean':
            return 'NUMERIC';
        case 'number':
            if (Number.isInteger(value)){
                return 'INTEGER';
            } else {
                return 'REAL';
            }
        case 'string':
            return 'TEXT';
        case 'symbol':
            return null;
        case 'object':
            return null;
        case 'function':
            return null;
    }
}

/**
 * run db queries
 * @param {Object} db - db to run the queries against
 */
function runQueries(db) {
    console.log('... running queries');

    let queries = [
        "SELECT COUNT() FROM qos",
        "SELECT COUNT(DISTINCT rtcInstanceId) FROM qos",
        "SELECT COUNT(DISTINCT rtcSessionId) FROM qos",
        "SELECT COUNT(DISTINCT userId) FROM qos",
        "SELECT INFO, COUNT(*) from qos GROUP BY INFO",
        "SELECT COUNT(*) FROM qos WHERE (`OR` > 0)",
        "SELECT COUNT(*) FROM qos WHERE (OS > 0)",
        "SELECT COUNT(*) FROM qos WHERE (MT = 'audio') AND (`OR` > 0)",
        "SELECT COUNT(*) FROM qos WHERE (MT = 'screen share')  AND (`OR` > 0)",
        "SELECT COUNT(*) FROM qos WHERE (MT = 'video')  AND (`OR` > 0)"
    ];

    let tasks = [];

    queries.forEach(query => {
        tasks.push(new Promise((resolve,reject) => {
            db.all(query, function(err, rows) {
                console.log(query,'\n,', rows,'\n\n');
                resolve();
            });
        }));
    });

    return new Promise((resolve, reject) => {
        Promise.all(tasks).then(_ => resolve(db));
    });
}

/**
 * import a file with qos items
 * @param {string} file - path to file (including file name)
 */
function importQosFile(db, file) {
    return new Promise((resolve,reject)=>{
        let qosItems = require(file);
        let rowCounter = 0;

        if (qosItems.hits.total === 0){
            console.log(`imported ${file} with ${rowCounter} records`);
            resolve(db);
        }

        qosItems.hits.hits.forEach( item => {
            let stmt = createInsertStatement('qos', item._source);
            db.run(stmt,(e) => {
                rowCounter++;
                if (e) {
                    console.error( item._source, stmt, e);
                    process.exit(1);
                }
                if (rowCounter === qosItems.hits.hits.length) {
                    console.log(`imported ${file} with ${rowCounter} records`);
                    resolve(db);
                }
            });
        });
    });
}

/**
 * run cmd line
 * @param {object} options
 */
function runCmdLine(db, options){
    console.log('... starting cmd line');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.setPrompt('sql> ');
    rl.prompt();

    rl.on('line', cmd => {
        //console.log(cmd);
        if (cmd === 'bye' || cmd === 'quit' || cmd === ' exit'){
            rl.close();
            return;
        }

        if (!cmd) {
            rl.prompt();
            return;
        }

        db.all(cmd, (err, rows) => {
            if (err) {
                console.log(err);
            }
            console.log(rows);
            console.log('\n');
            rl.prompt();
        });
    });

    rl.on('close', () => {
        console.log('terminating ...');
        process.exit(0);
    });
}

/**
 * create db schema
 * @param {object} options
 */
function createDbSchema(db) {
    return new Promise((resolve,reject) => {
        let schema = require('./schema.json');
        let stmt = createTableStatement('qos', schema);
        //console.log(stmt);
        db.run(stmt, e => {
            if (e) {
                console.error(e);
                reject(e);
                return;
            }
            resolve(db);
        });
    });
}

/**
 * import rows
 * @param {object} options
 */
function importRows(db){
    console.log('... importing rows');
    let tasks = [];
    files.forEach(file =>{
        tasks.push(importQosFile(db, `./${file}`));
    });
    return new Promise((resolve,reject) => {
        Promise.all(tasks).then(_ => {
            resolve(db);
        })
    });
};

// console.log(createTableStatement('qos', record));
// console.log(createInsertStatement('qos', record));

const commandLineArgs = require('command-line-args');
const optionDefinitions = [
    { name: 'file', type: String }
  ];

const options = commandLineArgs(optionDefinitions);
//console.log(options);

let files = options.file.replace(/\s/g,'').split(',');
//console.log(files);

var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':memory:');

db.serialize();

createDbSchema(db)
.then(importRows)
.then(runQueries)
.then(runCmdLine)
.catch(e => {console.error(e)});
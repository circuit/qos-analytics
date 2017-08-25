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
'use strict';

const readline = require('readline');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const sqlite3 = require('sqlite3').verbose();
const { exec, spawn } = require('child_process');
const fs = require('fs');

/**
 * Command line usage description
  */
const sections = [
  {
    header: 'sqlImport',
    content: 'Import QoS items or Sessions records  into and sqlite3 db file.'
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'client',
        typeLabel: '[underline]{file[s]}',
        description: 'Client qos json files. To import multiple files use: `ls -m qos*.json`.'
      },
      {
        name: 'server',
        typeLabel: '[underline]{file[s]}',
        description: 'Server qos json files. To import multiple files use: `ls -m server-qos*.json`.'
      },
      {
        name: 'session',
        typeLabel: '[underline]{file[s]}',
        description: 'Session record json files. To import multiple files use: `ls -m sessions*.json`.'
      },
      {
        name: 'loadtest',
        typeLabel: '[underline]{file[s]}',
        description: 'Loadtest log files. To import multiple files use: `ls -m media*.log`.'
      },
      {
        name: 'db',
        typeLabel: '[underline]{file}',
        description: 'The db file.'
      },
      {
        name: 'clean',
        description: 'Deletes the db content before importing data.'
      },
      {
        name: 'help',
        description: 'Print this usage guide.'
      }
    ]
  },
  {
    header: 'Synopsis',
    content: [
      '$ node sqlImport [bold]{--client} [underline]{file}  [[bold]{--server} [underline]{file}]  [[bold]{--session} [underline]{file}]   [[bold]{--db} [underline]{file}] [[bold]{--clean}]',
      '$ node sqlImport [bold]{--help}'
    ]
  },
  {
    header: 'Examples',
    content: [
      {
        desc: 'Import multiple client qos files to mydb.db.',
        example: '$ node sqlImport --client "`ls -m qos-day-by-day*.json`" --db mydb.db'
      },
      {
        desc: 'Import single file.',
        example: '$ example --client qos-2017-08-10.json'
      }
    ]
  },
];

/**
 * return a string with an SQL CREATE TABLE statement for the given object
 * @param {string} name - the name of the table
 * @param {Object} schema - the object for which the table should be created. No columns will be created for properties with null values.
 */
function createTableStatement(name, schema) {
    let stmt = `CREATE TABLE IF NOT EXISTS ${name} ( \n`;
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
 * @param {string} tableName - the tableName of the table
 * @param {Object} record - the object for which the table should be created. No columns will be created for properties with null values.
 */
function createInsertStatement(tableName, record) {
    insertDerivedProperties(tableName, record);
    let namesAndValues = getColumnsNamesAndValues(record);
    let stmt = `INSERT INTO ${tableName} ( \n`;
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
                if (namesAndValues.names === '') {
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
                    //console.log(value,prop, record[prop]);
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
function insertDerivedProperties(tableName, record) {
    if ( tableName  === ' session' || tableName === 'session_user' )  {
        return;
    }
    record.derived = {};
    record.derived.p_loss_rcvd = (record.qosItems && record.qosItems.PLL && record.qosItems.PR && record.qosItems.PR > 0) ? record.qosItems.PLL/record.qosItems.PR : null;
    record.derived.p_loss_sent = (record.qosItems && record.qosItems.PLR && record.qosItems.PS && record.qosItems.PS > 0) ? record.qosItems.PLR/record.qosItems.PS : null;
};

function removeQuotes(str){
    return str.replace(/'/g, "&#39;").replace(/"/g,"&quot;");
}

/**
 * return  value for an sql insert statement
 * @param  value - the value to be converted to sql representation
 */
function getSqlValue(value) {
    switch (jsToSqlType(value)) {
        case 'NUMERIC':
            return (value) ? 1 : 0;
        case 'TEXT':
            return `'${removeQuotes(value)}'`;
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
 * import a file with qos items
 * @param {string} file - path to file (including file name)
 * @param {string} type - type of items: client or server
 */
function importQosFile(file, type) {
    let qosItems = require(file);
    let tasks = [];
    qosItems.hits.hits.forEach( item => {
        tasks.push(dbRun(createInsertStatement(type, item._source)));
    });
    console.log(`importing ${file} with ${qosItems.hits.hits.length} records, created ${tasks.length} tasks`);
    return Promise.all(tasks);
}

/**
 * import a file with session records
 * @param {string} file - path to file (including file name)
 */
function importSessionFile(file) {
    let sessionRecords = require(file);
    let tasks = [];

    sessionRecords.hits.hits.forEach(item => {

        let sessionRecord = item._source;
        sessionRecord.userStatList.forEach( user => {
            delete user.audioTimes;  // remove data that goes into the session record
            delete user.videoTimes;
            delete user.screenTimes;
            user.tenantId = sessionRecord.tenantId;
            user.sessionId = sessionRecord.sessionId;
            user.sessionInstanceId = sessionRecord.sessionInstanceId;
            tasks.push(dbRun(createInsertStatement('session_user', user)));
        });

        delete sessionRecord.userStatList; // remove the data that went into the user records
        tasks.push(dbRun(createInsertStatement('session', sessionRecord)));
    });

    console.log(`importing ${file} with ${sessionRecords.hits.hits.length} records, created ${tasks.length} tasks`);
    return Promise.all(tasks);
}

/**
 * import a loadtest log file
 * @param {string} file - path to file (including file name)
 */
function importLoadtestFile(file) {
    let userMediaEntries = {};
    var str = fs.readFileSync(file, 'utf8');
    var lines = str.match(/[^\r\n]+/g);
    lines.forEach(line => {
        var found = line.match(/.*UserId (.*): (audio|video).*receiveStreamStatistic: get(.*): (.*)/i);
        if (found && found.length >= 5) {
            let key = `${found[1]}|${found[2]}`;
            if (!userMediaEntries[key]) {
                userMediaEntries[key] = {
                    userId: found[1],
                    media: found[2]
                };
            }
            userMediaEntries[key][found[3]] = found[4];
        }
    });

    let tasks = [];
    Object.keys(userMediaEntries).forEach(key => {
        let obj = userMediaEntries[key];
        tasks.push(dbRun(createInsertStatement('loadtest', obj)));
    });

    console.log(`importing ${file} with ${userMediaEntries.length} records, created ${userMediaEntries.length} tasks`);
    return Promise.all(tasks);
}

/**
 * Promise warpper for executing an SQL statement
 * @param {string} statement
 */
function dbRun(stmt) {
    return new Promise((resolve,reject) => {
        db.run(stmt, e => {
            if (e) {
                console.error(e);
                reject(e);
                return;
            }
            resolve();
            return;
        });
    })
}

/**
 * create db schema
 * @param {object} options
 */
function createDbSchema() {
    console.log('... creating the db schema');

    let tasks = [];

    if (clientFiles) {
        let schema = require('./qos-schema.json');
        let stmt = createTableStatement('client', schema);
        //console.log(stmt);
        tasks.push(dbRun(stmt));
    }

    if (serverFiles) {
        let schema = require('./qos-schema.json');
        let stmt = createTableStatement('server', schema);
        //console.log(stmt);
        tasks.push(dbRun(stmt));
    }

    if (sessionFiles) {
        let schema = require('./session-schema.json');
        let stmt = createTableStatement('session', schema);
        //console.log(stmt);
        tasks.push(dbRun(stmt));

        schema = require('./session-user-schema.json');
        stmt = createTableStatement('session_user', schema);
        //console.log(stmt);
        tasks.push(dbRun(stmt));
    }

    if (loadtestFiles) {
        let schema = require('./loadtest-schema.json');
        let stmt = createTableStatement('loadtest', schema);
        //console.log(stmt);
        tasks.push(dbRun(stmt));
    }

    return Promise.all(tasks);
}

/**
 * import rows from the  provided files
 */
function importRows() {
    console.log('... importing rows');

    let tasks = [];

    clientFiles && clientFiles.forEach(file => tasks.push(importQosFile(`./${file}`,'client')));
    serverFiles && serverFiles.forEach(file => tasks.push(importQosFile(`./${file}`,'server')));
    sessionFiles && sessionFiles.forEach(file => tasks.push(importSessionFile(`./${file}`)));
    loadtestFiles && loadtestFiles.forEach(file => tasks.push(importLoadtestFile(`./${file}`)));

    return Promise.all(tasks);
}

/**
 * main
 */
const argsDefinition = [
    { name: 'client', alias: 'c', type: String },
    { name: 'server', alias: 's', type: String },
    { name: 'session', alias: 'S', type: String },
    { name: 'loadtest', alias: 'l', type: String },
    { name: 'db', alias: 'd', type: String },
    { name: 'clean', alias: 'C', type: Boolean },
    { name: 'help', alias: 'h', type: Boolean }
];
const args = commandLineArgs(argsDefinition);

console.log(args);

if (args.help || !(args.client || args.server || args.session || args.loadtest)) {
    console.log(getUsage(sections));
    return;
}

//globals
let clientFiles = (args.client) ? args.client.replace(/\s/g,'').split(',') : null;
let serverFiles = (args.server) ? args.server.replace(/\s/g,'').split(',') : null;
let sessionFiles = (args.session) ? args.session.replace(/\s/g,'').split(',') : null;
let loadtestFiles = (args.loadtest) ? args.loadtest.replace(/\s/g,'').split(',') : null;
let dbName = args.db || './tmp.db';

if (args.clean) {
    fs.unlinkSync(dbName);
}

let db = new sqlite3.Database(dbName);

createDbSchema()
.then(importRows)
.then(() => spawn('sqlite3', [dbName], { stdio: 'inherit', shell: true }))
.catch(console.error);


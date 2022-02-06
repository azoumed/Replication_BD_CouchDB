'use strict';

const fs = require('fs');
const couchbackup = require('@cloudant/couchbackup');
const moment = require('moment');
var child_process = require('child_process');
const ENV = require('./env.json');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const env = new Map();
function init() {
    ENV.forEach((entry) => {
        const key = Object.keys(entry)[0];
        const value = entry[key];
        env.set(key, value);
    });
}

function createBackupFile(sourceUrl, backupTmpFilePath) {
    return new Promise((resolve, reject) => {
        couchbackup.backup(
            sourceUrl,
            fs.createWriteStream(backupTmpFilePath),
            {
                mode: 'shallow',
                // parallelism: 10,
                bufferSize: 500,
            },
            (err) => {
                if (err) {
                    return reject(new Error(err, 'CouchBackup process failed'));
                }
                resolve('creating backup file complete');
            }
        ).on('changes', (batch) => {
            console.log('Total batches received:', batch + 1);
        }).on('written', (obj) => {
            console.log('Written batch ID:', obj.batch, 'Total document revisions written:', obj.total, 'Time:', obj.time);
        });
    });
}

function restore(targetUrl, backupTmpFilePath) {
    return new Promise((resolve, reject) => {
        couchbackup.restore(
            fs.createReadStream(backupTmpFilePath),
            targetUrl,
            // {
            //     parallelism: 1,
            //     bufferSize: 250,
            // },
            (err, data) => {
                if (err) {
                    reject(new Error(err, 'CouchBackup process failed'));
                }
                resolve('creating backup file complete');
            }
        ).on('restored', (batch) => {
            console.log('Total batches received:', batch.total);
        }).on('finished', (obj) => {
            console.log('Document restored:', obj.total,);
        }).on('error', (err) => {
            console.log(err.message);
        });
    });
}

function runCmd(cmd) {
    var resp = child_process.execSync(cmd);
    var result = resp.toString('UTF8');
    return result;
}

(async function main() {
    init();
    const argv = require('yargs')
        .usage('Usage: $0 [options]')
        .example('$0 -s res-prd -d res-rec --db device_referential -t res -o device_referential-bis')
        .options({
            source: { alias: 's', nargs: 1, demandOption: false, describe: 'Source database env' },
            destination: { alias: 'd', nargs: 1, demandOption: false, describe: 'Destination database env' },
            database: { alias: 'db', nargs: 1, demandOption: true, describe: 'Name of database to backup' },
            trigrame: { alias: 't', nargs: 1, demandOption: true, describe: 'Trigrame of instance' },
            output: { alias: 'o', nargs: 1, demandOption: false, describe: 'Target database name' },
        })
        .help('h').alias('h', 'help')
        .argv

    let { source, destination, database, trigrame, output } = argv;
    const databaseName = /\/?/.test(database) ? database.replace('/', '-') : database;
    database = /\/?/.test(database) ? database.replace('/', '%2F') : database
    if (output)
        output = /\/?/.test(output) ? output.replace('/', '%2F') : output
    const now = moment().format('DD-MM-YYYY');
    const directory = `backup_${now}`;
    if (!fs.existsSync(directory))
        fs.mkdirSync(directory);
    if (source)
        await createBackupFile(`${env.get(source)}/${database}`, `${directory}/${trigrame}_${databaseName}`);
    if (destination && output) {
        const cmd = `curl -k -XPUT ${env.get(destination)}/${output ? output : database}`;
        const result = runCmd(cmd);
        console.log(result);
        try {
            await restore(`${env.get(destination)}/${output}`, `${directory}/${trigrame}_${databaseName}`)
        } catch (error) {
            console.log(error);
        }
    }
})()
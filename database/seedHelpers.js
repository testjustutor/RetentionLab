/**
 * root/database/seedHelpers.js
 */
const crypto = require('crypto');
const { db } = require('./db');

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
    });
});

const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
    });
});

const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
    });
});

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const secretKey = process.env.PASSWORD_SECRET_KEY || '';
    const pepperedPassword = secretKey + password;
    const derived = crypto.scryptSync(pepperedPassword, salt, 64).toString('hex');
    return `${salt}:${derived}`;
};

module.exports = { db, runAsync, getAsync, allAsync, hashPassword };

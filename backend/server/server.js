require('dotenv').config('.env');
const express = require('express');
const session = require('express-session');
const router = require('./api/routes');

const port = process.env.BACKEND_HTTP_PORT;
const api_url = process.env.API_URL;

const server = express();

let salt;
if (!process.env.COOKIE_SALT) {
    console.log('Missing env. variable COOKIE_SALT');
    process.exit();
}
else if (process.env.COOKIE_SALT.length < 32) {
    console.log('Shutting down, env. variable COOKIE_SALT too short.')
    process.exit();
}
else {
    salt = process.env.COOKIE_SALT;
}

const conObject = {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    port: process.env.DATABASE_PORT,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
}
const conString = `${process.env.DATABASE_USER}://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`;

const store = new (require('connect-pg-simple')(session))(
    { conObject, conString: conString }
);

server.use(session({
    secret: salt,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: 'auto' },
    store: store
}));

server.use(express.json({ limit: '20KB' }));
server.use(api_url, router);

server.listen(port, () => console.log(`Server live at port ${port}`));
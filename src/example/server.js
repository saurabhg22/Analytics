
const { init } = require('../../dist/index');
const express = require('express');
const { server } = require('sinon');

const app = express();

server = app.listen(3000);

init({
    MONGO_URI: 'mongodb://localhost:27017/eventtoollocal',
    setupSocket:true
}, server)

const { init } = require('../../dist/index');
const express = require('express');

const app = express();

server = app.listen(3000);

init(server, {
    MONGO_URI: 'mongodb://localhost:27017/eventtoollocal',
})
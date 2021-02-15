import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import express from 'express';
import io from 'socket.io-client';
import { init, createEvent, getMongoClient } from '../src/index';

chai.use(chaiAsPromised);
const expect = chai.expect;

let server, db;
before(async () => {
    const app = express();

    server = app.listen(3000);

    db = await init(server, {
        MONGO_URI: 'mongodb://localhost:27017/eventtoollocal',
    });
});

describe('createEvent', function () {
    it('should pass', async () => {
        return expect(createEvent('testevent', {})).to.be.fulfilled;
    });
});

describe('socket', () => {
    let socket;

    beforeEach((done) => {
        socket = io.connect('http://localhost:3000', {
            reconnection: false,
        });
        socket.on('connect', async () => {
            done();
        });
    });

    it(`should create event 'socketEvent'`, (done) => {
        socket.emit('createEvent', { name: 'socketEvent', data: { email: "test@email.com" } }, () => {
            done();
        });
    });

    afterEach((done) => {
        console.log('afterEach');
        if (socket.connected) {
            socket.disconnect();
        }
        done();
    });
});
// describe('disConnectSocket', function () {
//     it('should pass', async () => {
//         const socket = io('http://localhost:3000');
//         socket.on('connect', () => {
//             console.log('s', socket.id);
//             socket.disconnect();
//         });
//     });
// });

after(async () => {
    const mongoClient = await getMongoClient();
    server.close();
    return mongoClient.close();
});

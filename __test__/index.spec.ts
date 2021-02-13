import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import express from 'express';
import { Server } from 'mongodb';
import io from 'socket.io-client';
import { init, createEvent, getMongoClient } from '../src/index';

const should = chai.should();

let server;
chai.use(chaiAsPromised);
before(async () => {
    const app = express();

    app.get('/', function (req, res) {
        res.send('hello world');
    });

    server = app.listen(3000);

    await init(server, {
        MONGO_URI: 'mongodb://localhost:27017/eventtoollocal',
    });
});

describe('createEvent', function () {
    it('should pass', async () => {
        return createEvent('testevent', {}).should.be.fulfilled;
    });
});

describe('socket', function () {
    let socket;

    beforeEach(function (done) {
        socket = io.connect('http://localhost:3000', {
            reconnection: false,
        });

        socket.on('connect', () => {
            done();
        });

        socket.on('disconnect', () => {
            console.log('disconnected...');
        });
    });
    it('should communicate', (done) => {
        done();
    });
    afterEach((done) => {
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

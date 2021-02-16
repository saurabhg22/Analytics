import chai from 'chai';
import { ObjectId } from 'mongodb';
import io from 'socket.io-client';
import { init, createEvent, getMongoClient } from '../src/index';

const expect = chai.expect;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let server, db;
before(async () => {
    const initResp = await init(
        {
            MONGO_URI: 'mongodb://localhost:27017/analytictestdb',
            setupSocket: true,
            PORT: 3000,
        }
        // server
    );
    db = initResp.db;
    server = initResp.io;
});

describe('createEvent', function () {
    it('should pass', async () => {
        const createdAnalyticEventId = await createEvent('testevent', {
            data: { testData: '1234' },
        });
        expect(createdAnalyticEventId).to.exist;
        expect(createdAnalyticEventId).to.be.string;
        const analyticEvent = await db.collection('AnalyticEvent').findOne({
            name: 'testevent',
            'data.testData': '1234',
            _id: new ObjectId(createdAnalyticEventId),
        });
        expect(analyticEvent).to.exist;
    });
});

describe('socket-connected event', () => {
    let socket;
    it(`should create event for socket-connected`, (done) => {
        socket = io.connect('http://localhost:3000', {
            reconnection: false,
        });
        socket.on('connect', async () => {
            try {
                const analyticEvent = await db
                    .collection('AnalyticEvent')
                    .findOne({
                        clientId: socket.id,
                        name: 'socket-connected',
                    });
                expect(analyticEvent).to.exist;
                done();
            } catch (error) {
                done(error);
            }
        });
    });
    afterEach((done) => {
        if (socket.connected) {
            socket.disconnect();
        }
        done();
    });
});

describe('socket-disconnected event', () => {
    let socket;
    beforeEach((done) => {
        socket = io.connect('http://localhost:3000', {
            reconnection: false,
        });
        socket.on('connect', async () => {
            done();
        });
    });
    it(`should create event for socket-disconnected`, (done) => {
        const socketId = socket.id;
        socket.on('disconnect', async () => {
            try {
                await wait(50);
                const analyticEvent = await db
                    .collection('AnalyticEvent')
                    .findOne({
                        clientId: socketId,
                        name: 'socket-disconnected',
                    });
                expect(analyticEvent).to.exist;
                done();
            } catch (error) {
                done(error);
            }
        });

        socket.disconnect();
    });
    afterEach((done) => {
        if (socket.connected) {
            socket.disconnect();
        }
        done();
    });
});

describe('socket events', () => {
    let socket;

    beforeEach((done) => {
        socket = io.connect('http://localhost:3000', {
            reconnection: false,
        });
        socket.on('connect', async () => {
            done();
        });
    });

    it(`should create event socketEvent`, (done) => {
        socket.emit(
            'createEvent',
            { name: 'socketEvent', data: { email: 'test@gmail.com' } },
            async () => {
                try {
                    const analyticEvent = await db
                        .collection('AnalyticEvent')
                        .findOne({
                            clientId: socket.id,
                            name: 'socketEvent',
                            'data.email': 'test@gmail.com',
                        });
                    expect(analyticEvent).to.exist;
                    done();
                } catch (error) {
                    done(error);
                }
            }
        );
    });

    afterEach((done) => {
        if (socket.connected) {
            socket.disconnect();
        }
        done();
    });
});

after(async () => {
    const mongoClient = await getMongoClient();
    await wait(500);
    server.close();
    return mongoClient.close();
});

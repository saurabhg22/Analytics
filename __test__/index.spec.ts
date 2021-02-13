import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import express from 'express';
import { init, createEvent, getMongoClient } from '../src/index';

const should = chai.should();
chai.use(chaiAsPromised);
before(async () => {
    const app = express();

    app.get('/', function (req, res) {
        res.send('hello world');
    });

    const server = app.listen(3000);

    await init(server, {
        MONGO_URI: 'mongodb://localhost:27017/eventtoollocal',
    });
});

describe('createEvent', function () {
    it('should pass', async () => {
        return createEvent('testevent', {}).should.be.fulfilled;
    });
});

after(async () => {
    const mongoClient = await getMongoClient();
    return mongoClient.close();
});

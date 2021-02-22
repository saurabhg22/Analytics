import faker from 'faker';
import { ObjectId } from 'mongodb';
import { TEvent, generateClientId, init, getMongoClient } from '../src/index';

export const withEvent = (event?: Partial<TEvent>) => {
    const sentTime = event?.sentTime || faker.date.past();
    const receivedTime = faker.date.between(
        sentTime,
        new Date(sentTime.getTime() + 2000)
    );
    const created = faker.date.between(
        receivedTime,
        new Date(receivedTime.getTime() + 500)
    );
    return {
        name: faker.name.jobArea(),
        clientId: generateClientId(),
        page: faker.internet.url(),
        sentTime,
        receivedTime,
        created,
        context: {
            'user-agent': faker.internet.userAgent(),
            ip: faker.internet.ip(),
            origin: faker.internet.domainName(),
            locale: faker.random.locale(),
        },
        ...(event || {}),
        data: {
            ...(event?.data || {}),
        },
    };
};

const withSessionEvents = async () => {
    const { db } = await init({
        MONGO_URI: 'mongodb://localhost:27017/analyticdblocal',
    });
    await db.collection('AnalyticEvent').deleteMany({});

    const TOTAL_EVENTS = 1;
    const TOTAL_USERS = 20;
    const users = new Array(TOTAL_USERS).fill(0).map(() => ({
        id: new ObjectId(),
        clientIds: new Array(faker.random.number(5))
            .fill(0)
            .map(() => generateClientId()),
    }));

    for (let eventIndex = 0; eventIndex < TOTAL_EVENTS; eventIndex++) {
        const eventId = new ObjectId();
        const TOTAL_SESSIONS = faker.random.number(5);
        for (
            let sessionIndex = 0;
            sessionIndex < TOTAL_SESSIONS;
            sessionIndex++
        ) {
            const sessionId = new ObjectId();
            const TOTAL_CLIENTS = faker.random.number(10);
            for (
                let clientIndex = 0;
                clientIndex < TOTAL_CLIENTS;
                clientIndex++
            ) {
                const user = users[faker.random.number(TOTAL_USERS - 1)];
                const clientId =
                    user.clientIds[
                        faker.random.number(user.clientIds.length - 1)
                    ];

                const connectSentTime = faker.date.past();

                const connectEvent = withEvent({
                    name: 'socket-connected',
                    clientId,
                    sentTime: connectSentTime,
                });

                const joinSessionSentTime = faker.date.between(
                    connectSentTime,
                    new Date(connectSentTime.getTime() + 5 * 60 * 1000)
                );
                const joinSessionEvent = withEvent({
                    name: 'joinSession',
                    clientId,
                    userId: user.id,
                    sentTime: joinSessionSentTime,
                    data: {
                        eventId,
                        sessionId,
                    },
                });
                const exitSessionSentTime = faker.date.between(
                    joinSessionSentTime,
                    new Date(joinSessionSentTime.getTime() + 10 * 60 * 1000)
                );

                const exitSessionEvent = withEvent({
                    name: 'exitSession',
                    clientId,
                    userId: user.id,
                    sentTime: exitSessionSentTime,
                    data: {
                        eventId,
                        sessionId,
                    },
                });

                const disconnectSentTime = faker.date.between(
                    exitSessionSentTime,
                    new Date(exitSessionSentTime.getTime() + 60 * 1000)
                );
                const disconnectEvent = withEvent({
                    name: 'socket-disconnected',
                    clientId,
                    sentTime: disconnectSentTime,
                });

                await db.collection('AnalyticEvent').insertOne(connectEvent);
                let lastEvent = connectEvent;
                if (faker.random.number(100) < 90) {
                    await db
                        .collection('AnalyticEvent')
                        .insertOne(joinSessionEvent);
                    lastEvent = joinSessionEvent;
                    if (faker.random.number(100) < 70) {
                        await db
                            .collection('AnalyticEvent')
                            .insertOne(exitSessionEvent);
                        lastEvent = exitSessionEvent;
                    }
                }
                delete (lastEvent as any)._id;
                await db.collection('AnalyticEvent').insertOne({
                    ...lastEvent,
                    ...disconnectEvent,
                    data: lastEvent.data,
                });
            }
            console.log(
                `Done: ${(
                    ((eventIndex + sessionIndex / TOTAL_SESSIONS) * 100) /
                    TOTAL_EVENTS
                ).toFixed(1)}%`
            );
        }
    }

    const mongoClient = await getMongoClient();
    mongoClient.close();
};

withSessionEvents();

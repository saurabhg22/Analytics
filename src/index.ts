'use strict';

import { ObjectId, MongoClient, Db } from 'mongodb';
import SocketIO from 'socket.io';

let db: Db, mongoClient: MongoClient;
export type TEvent = {
    name: string;
    sentTime?: Date;
    receivedTime?: Date;
    created: Date;
    userId?: ObjectId;
    page?: string;
    data: Record<string, any>;
    clientId: string;
    context?: {
        'user-agent'?: string;
        locale?: string;
        origin?: string;
        ip?: string;
    };
};
export const init = async (
    config?: { MONGO_URI?: string; setupSocket?: boolean; PORT?: number },
    server?
): Promise<{ db: Db; io: SocketIO.Server }> => {
    const MONGO_URI = config?.MONGO_URI ?? process.env.MONGO_URI;
    await new Promise<void>((resolve, reject) => {
        MongoClient.connect(
            MONGO_URI,
            { useUnifiedTopology: true },
            function (err, client) {
                if (err) {
                    return reject(err);
                }
                console.info(`Analytics successfully to ${MONGO_URI}`);

                mongoClient = client;
                db = client.db();
                return resolve();
            }
        );
    });
    let io: SocketIO.Server;
    if (config?.setupSocket) {
        io = await setUpSocket(server || config.PORT);
    }
    return { db, io };
};

const setUpSocket = async (
    serverOrPort: import('http').Server | import('https').Server | number
) => {
    const io = SocketIO(
        serverOrPort as import('http').Server | import('https').Server
    );
    io.sockets.on('connection', async (client) => {
        try {
            const handshake: any = client.handshake || {};
            const headers = handshake.headers || {};
            await createEvent('socket-connected', {
                clientId: client.id,
                sentTime: handshake.time ? new Date(handshake.time) : undefined,
                receivedTime: new Date(),
                context: {
                    'user-agent': headers['user-agent'],
                    ip: handshake.address,
                    origin: headers.origin,
                    locale: headers.locale,
                },
            });
        } catch (error) {
            console.log(error);
        }

        client.on('createEvent', async (event: Partial<TEvent>, ackFn) => {
            const handshake: any = client.handshake || {};
            const headers = handshake.headers || {};
            await createEvent(event.name, {
                clientId: client.id,
                sentTime: event.sentTime ? new Date(event.sentTime) : undefined,
                receivedTime: new Date(),
                context: {
                    'user-agent': headers['user-agent'],
                    ip: handshake.address,
                    origin: headers.origin,
                    locale: headers.locale,
                },
                userId: event.userId,
                data: event.data,
                page: event.page,
            });
            return ackFn({ statusCode: 202 });
        });

        client.on('disconnect', async () => {
            const handshake: any = client.handshake || {};
            const headers = handshake.headers || {};
            const lastClientEvent = (
                await db
                    .collection('AnalyticEvent')
                    .find({
                        clientId: client.id,
                    })
                    .sort({ created: -1 })
                    .limit(1)
                    .toArray()
            )[0];
            if (lastClientEvent) {
                delete lastClientEvent._id;
            }

            const disconnectEvent = {
                ...(lastClientEvent || {}),
                clientId: client.id,
                receivedTime: new Date(),
                context: {
                    'user-agent': headers['user-agent'],
                    ip: handshake.address,
                    origin: headers.origin,
                    locale: headers.locale,
                },
            };
            await createEvent('socket-disconnected', disconnectEvent);
        });
    });
    return io;
};

export const getDB = async (): Promise<Db> => {
    if (db) return db;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return getDB();
};
export const getMongoClient = async (): Promise<MongoClient> => {
    if (mongoClient) return mongoClient;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return getMongoClient();
};

export const generateClientId = () => {
    const charSet =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
    let clientId = '';
    for (let i = 0; i < 20; i++) {
        clientId += charSet[Math.floor(Math.random() * charSet.length)];
    }
    return clientId;
};

export const createEvent = async (
    name: string,
    event: Partial<TEvent> = {}
) => {
    if (!name) {
        return Promise.reject('name is required');
    }
    const db = await getDB();

    delete (event as any)._id;
    const insertAck = await db.collection('AnalyticEvent').insertOne({
        ...event,
        name,
        created: new Date(),
    });
    return insertAck.insertedId;
};

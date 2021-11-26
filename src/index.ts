'use strict';

import { ObjectId, MongoClient, Db } from 'mongodb';
import SocketIO from 'socket.io';

let db: Db, mongoClient: MongoClient;
export type TEvent = {
    name: string;
    sentTime?: Date;
    receivedTime?: Date;
    created: Date;
    userId?: ObjectId | string;
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
    io?
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

    if (config?.setupSocket) {
        io = await setUpSocket(io, config.PORT);
    }
    return { db, io };
};

const setUpSocket = async (io, port: number = 3000) => {
    io = io || SocketIO(port);

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
            const receivedTime = new Date();
            let sentTime = event.sentTime;
            if (sentTime) {
                if (typeof sentTime === 'string') {
                    sentTime = new Date(sentTime);
                }
                if (receivedTime < sentTime) {
                    sentTime = receivedTime;
                }
            }
            await createEvent(event.name, {
                clientId: client.id,
                sentTime,
                receivedTime,
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
                        name: {
                            $nin: ['socket-connected', 'socket-disconnected'],
                        },
                    })
                    .sort({ sentTime: -1 })
                    .limit(1)
                    .toArray()
            )[0];
            if (lastClientEvent) {
                delete lastClientEvent._id;
            }

            const disconnectEvent = {
                ...(lastClientEvent || {}),
                sentTime: new Date(),
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
    const data = event.data || {};
    for (let key in data) {
        if (isValidObjectId(data[key])) {
            data[key] = convertToObjectId(data[key]);
        }
    }
    const insertAck = await db.collection('AnalyticEvent').insertOne({
        ...event,
        name,
        userId: event.userId ? convertToObjectId(event.userId) : undefined,
        data,
        created: new Date(),
    });
    return insertAck.insertedId;
};

const isValidObjectId = (id: string) => {
    if (typeof id !== 'string') return false;
    try {
        return new ObjectId(id).toString() === id;
    } catch (error) {
        return false;
    }
};

const convertToObjectId = (id: string | ObjectId) => {
    id = id.toString();
    if (!isValidObjectId(id)) throw new Error(`${id} is not a valid ObjectId`);
    return new ObjectId(id);
};

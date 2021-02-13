'use strict';

import { ObjectId, MongoClient, Db } from 'mongodb';
import SocketIO, { Socket } from 'socket.io';

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
export const init = async (server, config?: { MONGO_URI?: string }) => {
    const MONGO_URI = config?.MONGO_URI ?? process.env.MONGO_URI;
    await new Promise<void>((resolve, reject) => {
        MongoClient.connect(MONGO_URI, function (err, client) {
            if (err) {
                return reject(err);
            }
            console.info(`Analytics successfully to ${MONGO_URI}`);

            mongoClient = client;
            db = client.db();
            return resolve();
        });
    });
    await setUpSocket(server);
};

const setUpSocket = async (server) => {
    const io = SocketIO(server);
    io.sockets.on('connection', async (client) => {
        console.log('server:connected');
        client.emit('abc');
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

        client.on('createEvent', async (event: Partial<TEvent>) => {
            const handshake: any = client.handshake || {};
            const headers = handshake.headers || {};
            createEvent(event.name, {
                clientId: client.id,
                sentTime: handshake.time ? new Date(handshake.time) : undefined,
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
        });

        client.on('disconnect', async () => {
            const handshake: any = client.handshake || {};
            const headers = handshake.headers || {};
            createEvent('socket-disconnected', {
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
        });
        console.log('server:returning');
    });
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
    db.collection('Analytics').insertOne({
        name,
        ...event,
        created: new Date(),
    });
};

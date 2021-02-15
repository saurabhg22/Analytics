db.AnalyticEvent.ensureIndex({ clientId: 1 });
db.AnalyticEvent.ensureIndex({ userId: 1 });
db.AnalyticEvent.ensureIndex({ 'data.sessionId': 1 });

const arrayElemAt = (array, index) => ({
    $arrayElemAt: [array, index],
});
const sub = (a, b) => ({
    $subtract: [a, b],
});

const extractField = (doc, field) => ({
    $let: {
        vars: {
            doc,
        },
        in: `$$doc.${field}`,
    },
});
const aggQuery = [
    {
        $match: {
            $or: [
                { name: 'joinSession' },
                { name: 'exitSession' },
                { name: 'socket-disconnected' },
            ],
        },
    },
    { $sort: { sentTime: 1 } },
    {
        $group: {
            _id: {
                clientId: '$clientId',
                sessionId: '$data.sessionId',
            },
            userId: { $first: '$userId' },
            events: {
                $push: {
                    name: '$name',
                    sentTime: '$sentTime',
                },
            },
        },
    },
    {
        $addFields: {
            durations: {
                $reduce: {
                    input: { $range: [0, { $size: '$events' }] },
                    initialValue: [],
                    in: {
                        $switch: {
                            branches: [
                                {
                                    case: {
                                        $or: [
                                            {
                                                $eq: [
                                                    extractField(
                                                        arrayElemAt(
                                                            '$events',
                                                            '$$this'
                                                        ),
                                                        'name'
                                                    ),
                                                    'exitSession',
                                                ],
                                            },
                                            {
                                                $eq: [
                                                    extractField(
                                                        arrayElemAt(
                                                            '$events',
                                                            '$$this'
                                                        ),
                                                        'name'
                                                    ),
                                                    'socket-disconnected',
                                                ],
                                            },
                                        ],
                                    },
                                    then: {
                                        $cond: {
                                            if: {
                                                $eq: [
                                                    extractField(
                                                        arrayElemAt(
                                                            '$events',
                                                            sub('$$this', 1)
                                                        ),
                                                        'name'
                                                    ),
                                                    'joinSession',
                                                ],
                                            },
                                            then: {
                                                $concatArrays: [
                                                    '$$value',
                                                    [
                                                        {
                                                            $divide: [
                                                                sub(
                                                                    extractField(
                                                                        arrayElemAt(
                                                                            '$events',
                                                                            '$$this'
                                                                        ),
                                                                        'sentTime'
                                                                    ),
                                                                    extractField(
                                                                        arrayElemAt(
                                                                            '$events',
                                                                            sub(
                                                                                '$$this',
                                                                                1
                                                                            )
                                                                        ),
                                                                        'sentTime'
                                                                    )
                                                                ),
                                                                1000 * 60,
                                                            ],
                                                        },
                                                    ],
                                                    // [
                                                    //     {
                                                    //         start: arrayElemAt(
                                                    //             '$events',
                                                    //             sub('$$this', 1)
                                                    //         ),
                                                    //         end: arrayElemAt(
                                                    //             '$events',
                                                    //             '$$this'
                                                    //         ),
                                                    //     },
                                                    // ],
                                                ],
                                            },
                                            else: '$$value',
                                        },
                                    },
                                },
                            ],
                            default: '$$value',
                        },
                    },
                },
            },
        },
    },
    { $unwind: '$durations' },
    {
        $group: {
            _id: {
                userId: '$userId',
                sessionId: '$_id.sessionId',
            },
            duration: { $sum: '$durations' },
            watchRequests: { $sum: 1 },
        },
    },
    {
        $group: {
            _id: '$_id.sessionId',
            durations: { $push: '$duration' },
            totalNumberOfWatchRequests: { $sum: '$watchRequests' },
        },
    },
    {
        $project: {
            totalWatchTime: { $sum: '$durations' },
            averageWatchTime: { $avg: '$durations' },
            maxWatchTime: { $max: '$durations' },
            users: { $size: '$durations' },
            totalNumberOfWatchRequests: '$totalNumberOfWatchRequests',
        },
    },
];
const results = db.AnalyticEvent.aggregate(aggQuery).toArray();

printjson(results);
// print(JSON.stringify(aggQuery));
// Count of all total joinSession for particular session
// Count of unique joinSession for particular session
// Avergage Time spent on join session
//

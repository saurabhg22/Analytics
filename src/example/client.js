
const socket = io('http://localhost:3000');
socket.connect();
socket.on('connect', () => {
    console.log("connected", socket.id);
    socket.emit('createEvent', { name: 'clientEvent', data: { email: "test@email.com" } }, (resp) => {
        console.log("createEvent:clientEvent", resp) // TODO: This is not working
    });
});

setInterval(() => {
    console.log("socket.connected", socket.connected)
}, 1000)



socket.on('disconnect', () => {
    console.log("disconnected")
});

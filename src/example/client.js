
const socket = io('http://localhost:3000');
socket.connect();
socket.on('connect', () => {
    console.log("connected");
    socket.emit('createEvent', { name: 'clientEvent', data: { email: "test@email.com" } }, (resp) => {
        console.log("createEvent:clientEvent", resp) // TODO: This is not working
    });
});


socket.on('disconnect', () => {
    console.log("disconnected")
});

socket.on('error', (error) => {
    console.log("error", error)
})
import { io } from 'socket.io-client';

const socket1 = io('http://localhost:3000');

socket1.on('connect', () => {
  console.log('Socket 1 connected:', socket1.id);
  socket1.emit('create_room', { profile: { name: 'HostPlayer' } }, (res) => {
    console.log('Create room result:', res);
    const roomId = res.roomId;

    const socket2 = io('http://localhost:3000');
    socket2.on('connect', () => {
      console.log('Socket 2 connected:', socket2.id);
      socket2.emit('join_room', { roomId, profile: { name: 'FriendPlayer' } }, (joinRes) => {
        console.log('Join room result:', joinRes);
        setTimeout(() => {
          socket1.disconnect();
          socket2.disconnect();
          process.exit(0);
        }, 1000);
      });
    });
  });
});

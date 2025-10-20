// test-socket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  // for Node client set Origin via extraHeaders so server sees it
  extraHeaders: {
    Origin: 'https://kratin-tan.vercel.app'
  }
});

socket.on('connect', () => {
  console.log('[Tester] Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Tester] Disconnected');
});

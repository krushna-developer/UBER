// socket.js
const { Server } = require('socket.io');
const userModel    = require('./models/user.model');
const captainModel = require('./models/captain.model');

let io; // will hold the Socket.IO server instance

/* -------------------------------------------------------------------------- */
/*                          Initialize Socket.IO                              */
/* -------------------------------------------------------------------------- */
function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',              // replace with your frontend URL in prod
      methods: ['GET', 'POST']
    }
  });

  /* -------------------------- Connection handler ------------------------- */
  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    /* ----------------------------- Join event ---------------------------- */
    socket.on('join', async ({ userId, userType }) => {
      try {
        if (userType === 'user') {
          await userModel.findByIdAndUpdate(userId, { socketId: socket.id });
          console.log(`👤 User ${userId} joined with socket ${socket.id}`);
        } else if (userType === 'captain') {
          await captainModel.findByIdAndUpdate(userId, { socketId: socket.id });
          socket.join('captains'); // put all captains in one room
          console.log(`🚕 Captain ${userId} joined room "captains" (${socket.id})`);
        }
      } catch (err) {
        console.error('Join error:', err.message);
      }
    });

    /* --------------------- Captain location updates ---------------------- */
    socket.on('update-location-captain', async ({ userId, location }) => {
      if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        return socket.emit('error', { message: 'Invalid location data' });
      }
      try {
        await captainModel.findByIdAndUpdate(userId, {
          location: {
            lat: location.lat,
            lng: location.lng
          }
        });
      } catch (err) {
        console.error('Location update error:', err.message);
      }
    });

    /* ----------------------------- Disconnect ---------------------------- */
    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
      // Optional: remove socketId from DB here if you like
    });
  });
}

/* -------------------------------------------------------------------------- */
/*                     Helper: emit to a single socketId                      */
/* -------------------------------------------------------------------------- */
function sendMessageToSocketId(socketId, { event, data }) {
  if (!io) {
    console.warn('Socket.IO not initialized.');
    return;
  }

  const target = io.sockets.sockets.get(socketId);
  if (target) {
    target.emit(event, data);
  } else {
    console.warn(`Socket ${socketId} is not currently connected`);
  }
}

module.exports = { initializeSocket, sendMessageToSocketId };

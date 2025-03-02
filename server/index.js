const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Add a route for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Game state
const players = {};
const bullets = [];
const powerUps = [];
const mapSize = { width: 2000, height: 2000 }; // Large map that will shrink
let mapRadius = Math.min(mapSize.width, mapSize.height) / 2;
const shrinkRate = 0.9999; // How quickly the map shrinks
const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];

// Game loop
const FPS = 60;
setInterval(() => {
  // Shrink the map slowly
  mapRadius *= shrinkRate;
  
  // Update bullet positions
  bullets.forEach((bullet, index) => {
    bullet.x += bullet.velocityX;
    bullet.y += bullet.velocityY;
    
    // Remove bullets that are out of bounds or have traveled too far
    const distanceFromCenter = Math.sqrt(
      Math.pow(bullet.x - mapSize.width/2, 2) + 
      Math.pow(bullet.y - mapSize.height/2, 2)
    );
    
    if (distanceFromCenter > mapRadius || bullet.distance > bullet.range) {
      bullets.splice(index, 1);
      return;
    }
    
    bullet.distance += Math.sqrt(Math.pow(bullet.velocityX, 2) + Math.pow(bullet.velocityY, 2));
    
    // Check for collisions with players
    Object.keys(players).forEach(id => {
      const player = players[id];
      if (player.id !== bullet.playerId) {
        const dx = player.x - bullet.x;
        const dy = player.y - bullet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.radius + bullet.radius) {
          player.health -= bullet.damage;
          bullets.splice(index, 1);
          
          if (player.health <= 0) {
            // Player died
            io.to(player.id).emit('dead');
            delete players[id];
            
            // Check if only one player remains
            const remainingPlayers = Object.keys(players);
            if (remainingPlayers.length === 1) {
              io.to(remainingPlayers[0]).emit('winner');
              resetGame();
            }
          }
        }
      }
    });
  });
  
  // Check if players are outside the safe zone and damage them
  Object.keys(players).forEach(id => {
    const player = players[id];
    const distanceFromCenter = Math.sqrt(
      Math.pow(player.x - mapSize.width/2, 2) + 
      Math.pow(player.y - mapSize.height/2, 2)
    );
    
    if (distanceFromCenter > mapRadius) {
      player.health -= 1; // Damage players outside the safe zone
      
      if (player.health <= 0) {
        io.to(player.id).emit('dead');
        delete players[id];
        
        // Check if only one player remains
        const remainingPlayers = Object.keys(players);
        if (remainingPlayers.length === 1) {
          io.to(remainingPlayers[0]).emit('winner');
          resetGame();
        }
      }
    }
  });
  
  // Randomly spawn power-ups
  if (Math.random() < 0.005 && powerUps.length < 10) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * mapRadius * 0.8; // Keep within 80% of the safe zone
    
    powerUps.push({
      id: Date.now(),
      x: mapSize.width/2 + Math.cos(angle) * distance,
      y: mapSize.height/2 + Math.sin(angle) * distance,
      type: Math.random() < 0.5 ? 'health' : 'ammo',
      radius: 15
    });
  }
  
  // Send game state to all players
  io.emit('gameState', { players, bullets, powerUps, mapRadius, mapSize });
}, 1000 / FPS);

function resetGame() {
  // Reset game state
  Object.keys(players).forEach(id => {
    players[id].health = 100;
    players[id].ammo = 30;
    
    // Randomize position within the safe zone
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * mapRadius * 0.8;
    
    players[id].x = mapSize.width/2 + Math.cos(angle) * distance;
    players[id].y = mapSize.height/2 + Math.sin(angle) * distance;
  });
  
  // Clear bullets and power-ups
  bullets.length = 0;
  powerUps.length = 0;
  
  // Reset map size
  mapRadius = Math.min(mapSize.width, mapSize.height) / 2;
  
  // Notify all players
  io.emit('gameReset');
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Handle player joining
  socket.on('join', (name) => {
    // Create a new player
    const colorIndex = Object.keys(players).length % colors.length;
    
    // Randomize position within the safe zone
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * mapRadius * 0.8;
    
    players[socket.id] = {
      id: socket.id,
      name: name || 'Player',
      x: mapSize.width/2 + Math.cos(angle) * distance,
      y: mapSize.height/2 + Math.sin(angle) * distance,
      radius: 20,
      color: colors[colorIndex],
      health: 100,
      ammo: 30,
      score: 0
    };
    
    // Send initial game state to the new player
    socket.emit('gameState', { players, bullets, powerUps, mapRadius, mapSize });
    socket.emit('selfId', socket.id);
  });
  
  // Handle player movement
  socket.on('move', (data) => {
    const player = players[socket.id];
    if (player) {
      player.x = data.x;
      player.y = data.y;
    }
  });
  
  // Handle player shooting
  socket.on('shoot', (data) => {
    const player = players[socket.id];
    if (player && player.ammo > 0) {
      player.ammo--;
      
      bullets.push({
        x: data.x,
        y: data.y,
        velocityX: data.velocityX,
        velocityY: data.velocityY,
        playerId: socket.id,
        damage: 10,
        radius: 5,
        range: 1000,
        distance: 0
      });
    }
  });
  
  // Handle power-up collection
  socket.on('collectPowerUp', (powerUpId) => {
    const powerUpIndex = powerUps.findIndex(p => p.id === powerUpId);
    const player = players[socket.id];
    
    if (powerUpIndex !== -1 && player) {
      const powerUp = powerUps[powerUpIndex];
      
      if (powerUp.type === 'health') {
        player.health = Math.min(player.health + 25, 100);
      } else if (powerUp.type === 'ammo') {
        player.ammo += 15;
      }
      
      // Remove the collected power-up
      powerUps.splice(powerUpIndex, 1);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    
    // Check if only one player remains
    const remainingPlayers = Object.keys(players);
    if (remainingPlayers.length === 1) {
      io.to(remainingPlayers[0]).emit('winner');
      resetGame();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Try with a different port if 3000 is in use
    const newPort = PORT + 1;
    console.log(`Port ${PORT} is busy, trying with port ${newPort}...`);
    server.listen(newPort, () => {
      console.log(`Server running on port ${newPort}`);
    });
  } else {
    console.error('Server error:', err);
  }
}); 
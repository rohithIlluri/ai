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
const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];

// Game loop configuration
const FPS = 60;

// Shrinking map configuration
let shrinkPhase = 0;
const shrinkPhases = [
  { duration: 60, shrinkRate: 1.0 },      // Phase 0: No shrinking for 60 seconds
  { duration: 45, shrinkRate: 0.998 },    // Phase 1: Slow shrinking for 45 seconds
  { duration: 45, shrinkRate: 0.996 },    // Phase 2: Medium shrinking for 45 seconds
  { duration: 30, shrinkRate: 0.994 },    // Phase 3: Fast shrinking for 30 seconds
  { duration: 30, shrinkRate: 0.992 },    // Phase 4: Very fast shrinking for 30 seconds
  { duration: -1, shrinkRate: 0.990 }     // Phase 5: Final phase, continuous fast shrinking
];
let phaseTimer = 0;
let currentShrinkRate = 1.0;
let lastPhaseAnnouncement = -1;

// Next circle data (for PUBG-style random circle)
let nextCircleCenter = { x: mapSize.width / 2, y: mapSize.height / 2 };
let nextCircleRadius = mapRadius;
let currentCircleCenter = { x: mapSize.width / 2, y: mapSize.height / 2 };
let isCircleMoving = false;
let circleTransitionProgress = 0;
let circleTransitionDuration = 45 * FPS; // 45 seconds to move to new circle (reduced from 60)

// Game loop
setInterval(() => {
  // Update phase timer and check for phase changes
  phaseTimer++;
  
  // Check if we need to advance to the next phase
  if (shrinkPhase < shrinkPhases.length - 1 && 
      phaseTimer >= shrinkPhases[shrinkPhase].duration * FPS) {
    shrinkPhase++;
    phaseTimer = 0;
    currentShrinkRate = shrinkPhases[shrinkPhase].shrinkRate;
    
    // Generate a new random circle for the next phase
    if (shrinkPhase > 0) {
      generateNextCircle();
      isCircleMoving = true;
      circleTransitionProgress = 0;
      
      // Announce phase change to all players with next circle info
      io.emit('phaseChange', {
        phase: shrinkPhase,
        message: `Phase ${shrinkPhase}: The safe zone is ${getShrinkRateDescription(currentShrinkRate)}!`,
        nextCircleCenter: nextCircleCenter,
        nextCircleRadius: nextCircleRadius
      });
    } else {
      // First phase just announces
      io.emit('phaseChange', {
        phase: shrinkPhase,
        message: `Phase ${shrinkPhase}: The safe zone is ${getShrinkRateDescription(currentShrinkRate)}!`
      });
    }
    
    lastPhaseAnnouncement = Date.now();
  }
  
  // Announce remaining time in current phase every 10 seconds
  const currentTime = Date.now();
  if (shrinkPhase < shrinkPhases.length - 1 && 
      currentTime - lastPhaseAnnouncement >= 10000) {
    const remainingSeconds = Math.ceil((shrinkPhases[shrinkPhase].duration * FPS - phaseTimer) / FPS);
    
    if (remainingSeconds > 0 && remainingSeconds % 10 === 0) {
      io.emit('phaseUpdate', {
        phase: shrinkPhase,
        remainingSeconds: remainingSeconds,
        message: `Phase ${shrinkPhase}: ${remainingSeconds} seconds until next shrink!`
      });
      
      lastPhaseAnnouncement = currentTime;
    }
  }
  
  // Handle circle transition if active
  if (isCircleMoving) {
    circleTransitionProgress++;
    
    // Calculate progress as a percentage
    const progress = Math.min(1, circleTransitionProgress / circleTransitionDuration);
    
    // Interpolate between current and next circle with improved smoothing factor
    currentCircleCenter.x = lerp(currentCircleCenter.x, nextCircleCenter.x, progress * 0.03); // Increased from 0.02
    currentCircleCenter.y = lerp(currentCircleCenter.y, nextCircleCenter.y, progress * 0.03); // Increased from 0.02
    mapRadius = lerp(mapRadius, nextCircleRadius, progress * 0.03); // Increased from 0.02
    
    // Check if transition is complete
    if (progress >= 1) {
      isCircleMoving = false;
      currentCircleCenter = { ...nextCircleCenter };
      mapRadius = nextCircleRadius;
    }
  } else {
    // Apply normal shrinking based on current phase when not in transition
    mapRadius *= currentShrinkRate;
  }
  
  // Update bullet positions
  bullets.forEach((bullet, index) => {
    bullet.x += bullet.velocityX;
    bullet.y += bullet.velocityY;
    
    // Remove bullets that are out of bounds or have traveled too far
    const distanceFromCenter = Math.sqrt(
      Math.pow(bullet.x - currentCircleCenter.x, 2) + 
      Math.pow(bullet.y - currentCircleCenter.y, 2)
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
            
            // Credit kill to shooter
            if (players[bullet.playerId]) {
              players[bullet.playerId].score++;
            }
            
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
      Math.pow(player.x - currentCircleCenter.x, 2) + 
      Math.pow(player.y - currentCircleCenter.y, 2)
    );
    
    if (distanceFromCenter > mapRadius) {
      // Damage increases with distance from safe zone and current phase
      const damageMultiplier = 1 + (shrinkPhase * 0.5);
      const distanceFactor = (distanceFromCenter - mapRadius) / 100;
      const damage = Math.max(1, Math.floor(damageMultiplier * (1 + distanceFactor)));
      
      player.health -= damage;
      
      // Send damage notification to the player
      io.to(player.id).emit('zoneDamage', {
        damage: damage,
        message: 'You are taking damage from the zone!'
      });
      
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
      x: currentCircleCenter.x + Math.cos(angle) * distance,
      y: currentCircleCenter.y + Math.sin(angle) * distance,
      type: Math.random() < 0.5 ? 'health' : 'ammo',
      radius: 15
    });
  }
  
  // Send game state to all players
  io.emit('gameState', { 
    players, 
    bullets, 
    powerUps, 
    mapRadius, 
    mapSize,
    shrinkPhase,
    nextPhaseIn: shrinkPhase < shrinkPhases.length - 1 ? 
      Math.ceil((shrinkPhases[shrinkPhase].duration * FPS - phaseTimer) / FPS) : 0,
    nextCircleCenter: isCircleMoving ? nextCircleCenter : null,
    nextCircleRadius: isCircleMoving ? nextCircleRadius : null,
    currentCircleCenter: currentCircleCenter
  });
}, 1000 / FPS);

// Helper function to get a description of the shrink rate
function getShrinkRateDescription(rate) {
  if (rate >= 0.999) return 'stable';
  if (rate >= 0.997) return 'shrinking slowly';
  if (rate >= 0.995) return 'shrinking';
  if (rate >= 0.993) return 'shrinking quickly';
  return 'shrinking rapidly';
}

// Linear interpolation helper
function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

// Generate a random next circle within the current circle
function generateNextCircle() {
  // Calculate the maximum distance the new center can be from the current center
  // This ensures the new circle is at least partially within the current circle
  const maxOffset = mapRadius * 0.6;
  
  // Generate a random angle and distance for the new center
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * maxOffset;
  
  // Calculate the new center coordinates
  const newCenterX = currentCircleCenter.x + Math.cos(angle) * distance;
  const newCenterY = currentCircleCenter.y + Math.sin(angle) * distance;
  
  // Make sure the new center is within the map bounds
  const boundedX = Math.max(mapSize.width * 0.1, Math.min(mapSize.width * 0.9, newCenterX));
  const boundedY = Math.max(mapSize.height * 0.1, Math.min(mapSize.height * 0.9, newCenterY));
  
  // Set the next circle center
  nextCircleCenter = { x: boundedX, y: boundedY };
  
  // Calculate the new radius (between 40% and 70% of the current radius)
  const shrinkFactor = 0.4 + Math.random() * 0.3;
  nextCircleRadius = mapRadius * shrinkFactor;
  
  console.log(`Generated new circle: center (${nextCircleCenter.x.toFixed(0)}, ${nextCircleCenter.y.toFixed(0)}), radius ${nextCircleRadius.toFixed(0)}`);
}

function resetGame() {
  // Reset game state
  Object.keys(players).forEach(id => {
    players[id].health = 100;
    players[id].ammo = 30;
    players[id].score = 0;
    
    // Randomize position within the safe zone
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * mapRadius * 0.8;
    
    players[id].x = currentCircleCenter.x + Math.cos(angle) * distance;
    players[id].y = currentCircleCenter.y + Math.sin(angle) * distance;
  });
  
  // Clear bullets and power-ups
  bullets.length = 0;
  powerUps.length = 0;
  
  // Reset map size and shrink phases
  mapRadius = Math.min(mapSize.width, mapSize.height) / 2;
  currentCircleCenter = { x: mapSize.width / 2, y: mapSize.height / 2 };
  nextCircleCenter = { x: mapSize.width / 2, y: mapSize.height / 2 };
  nextCircleRadius = mapRadius;
  isCircleMoving = false;
  
  shrinkPhase = 0;
  phaseTimer = 0;
  currentShrinkRate = shrinkPhases[0].shrinkRate;
  lastPhaseAnnouncement = -1;
  
  // Notify all players
  io.emit('gameReset');
  
  // Announce game start
  setTimeout(() => {
    io.emit('phaseChange', {
      phase: 0,
      message: 'Game started! The safe zone will begin shrinking soon.'
    });
  }, 2000);
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
      x: currentCircleCenter.x + Math.cos(angle) * distance,
      y: currentCircleCenter.y + Math.sin(angle) * distance,
      radius: 20,
      color: colors[colorIndex],
      health: 100,
      ammo: 30,
      score: 0
    };
    
    // Send initial game state to the new player
    socket.emit('gameState', { 
      players, 
      bullets, 
      powerUps, 
      mapRadius, 
      mapSize,
      shrinkPhase,
      nextPhaseIn: shrinkPhase < shrinkPhases.length - 1 ? 
        Math.ceil((shrinkPhases[shrinkPhase].duration * FPS - phaseTimer) / FPS) : 0,
      nextCircleCenter: isCircleMoving ? nextCircleCenter : null,
      nextCircleRadius: isCircleMoving ? nextCircleRadius : null,
      currentCircleCenter: currentCircleCenter
    });
    socket.emit('selfId', socket.id);
    
    // Inform the player about the current phase
    socket.emit('phaseChange', {
      phase: shrinkPhase,
      message: `Phase ${shrinkPhase}: The safe zone is ${getShrinkRateDescription(currentShrinkRate)}!`,
      nextCircleCenter: isCircleMoving ? nextCircleCenter : null,
      nextCircleRadius: isCircleMoving ? nextCircleRadius : null
    });
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

// Start the server with proper port handling
const PORT = process.env.PORT || 3000;

function startServer(port) {
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const newPort = port + 1;
      console.log(`Port ${port} is busy, trying with port ${newPort}...`);
      startServer(newPort);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
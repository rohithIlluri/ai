// Connect to the server
const socket = io(window.location.origin, {
  reconnectionAttempts: 5,
  timeout: 10000
});

// Connection status handling
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  alert('Failed to connect to the game server. Please try again later.');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // the disconnection was initiated by the server, reconnect manually
    socket.connect();
  }
});

// Game elements
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const joinScreen = document.getElementById('joinScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const winnerScreen = document.getElementById('winnerScreen');
const nameInput = document.getElementById('nameInput');
const joinButton = document.getElementById('joinButton');
const restartButton = document.getElementById('restartButton');
const winRestartButton = document.getElementById('winRestartButton');
const healthFill = document.getElementById('healthFill');
const ammoCount = document.getElementById('ammoCount');
const playerCount = document.getElementById('playerCount');

// Game state
let gameState = {
    players: {},
    bullets: [],
    powerUps: [],
    mapRadius: 1000,
    mapSize: { width: 2000, height: 2000 }
};
let playerId = null;
let playerName = '';
let keys = {};
let mousePosition = { x: 0, y: 0 };
let camera = { x: 0, y: 0 };

// Set canvas size
function resizeCanvas() {
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
    minimapCanvas.width = 150;
    minimapCanvas.height = 150;
}

// Initialize the game
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Join game when button is clicked
    joinButton.addEventListener('click', joinGame);
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    
    // Restart game
    restartButton.addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        joinScreen.style.display = 'flex';
    });
    
    winRestartButton.addEventListener('click', () => {
        winnerScreen.style.display = 'none';
        joinScreen.style.display = 'flex';
    });
    
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
    
    // Mouse controls
    gameCanvas.addEventListener('mousemove', (e) => {
        mousePosition.x = e.clientX;
        mousePosition.y = e.clientY;
    });
    
    gameCanvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click
            shoot();
        }
    });
    
    // Game loop
    setInterval(gameLoop, 1000 / 60);
}

// Join the game
function joinGame() {
    playerName = nameInput.value.trim() || 'Player';
    socket.emit('join', playerName);
    joinScreen.style.display = 'none';
}

// Handle player movement
function handleMovement() {
    if (!playerId || !gameState.players[playerId]) return;
    
    const player = gameState.players[playerId];
    const speed = 5;
    let dx = 0;
    let dy = 0;
    
    if (keys['w'] || keys['arrowup']) dy -= speed;
    if (keys['s'] || keys['arrowdown']) dy += speed;
    if (keys['a'] || keys['arrowleft']) dx -= speed;
    if (keys['d'] || keys['arrowright']) dx += speed;
    
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        const factor = 1 / Math.sqrt(2);
        dx *= factor;
        dy *= factor;
    }
    
    // Update player position
    player.x += dx;
    player.y += dy;
    
    // Keep player within the map bounds
    const mapCenter = {
        x: gameState.mapSize.width / 2,
        y: gameState.mapSize.height / 2
    };
    
    const distanceFromCenter = Math.sqrt(
        Math.pow(player.x - mapCenter.x, 2) + 
        Math.pow(player.y - mapCenter.y, 2)
    );
    
    // Allow player to move outside the safe zone, but not too far
    const maxDistance = gameState.mapRadius * 1.2;
    
    if (distanceFromCenter > maxDistance) {
        const angle = Math.atan2(player.y - mapCenter.y, player.x - mapCenter.x);
        player.x = mapCenter.x + Math.cos(angle) * maxDistance;
        player.y = mapCenter.y + Math.sin(angle) * maxDistance;
    }
    
    // Send position to server
    socket.emit('move', { x: player.x, y: player.y });
    
    // Update camera position
    camera.x = player.x - gameCanvas.width / 2;
    camera.y = player.y - gameCanvas.height / 2;
    
    // Check for power-up collection
    gameState.powerUps.forEach(powerUp => {
        const dx = player.x - powerUp.x;
        const dy = player.y - powerUp.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.radius + powerUp.radius) {
            socket.emit('collectPowerUp', powerUp.id);
        }
    });
}

// Shoot function
function shoot() {
    if (!playerId || !gameState.players[playerId]) return;
    
    const player = gameState.players[playerId];
    
    // Calculate direction
    const worldMouseX = mousePosition.x + camera.x;
    const worldMouseY = mousePosition.y + camera.y;
    
    const dx = worldMouseX - player.x;
    const dy = worldMouseY - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize direction
    const velocityX = dx / distance * 10; // Bullet speed
    const velocityY = dy / distance * 10;
    
    // Send shoot event to server
    socket.emit('shoot', {
        x: player.x,
        y: player.y,
        velocityX: velocityX,
        velocityY: velocityY
    });
}

// Draw the game
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Draw background grid
    drawGrid();
    
    // Draw safe zone
    drawSafeZone();
    
    // Draw power-ups
    drawPowerUps();
    
    // Draw bullets
    drawBullets();
    
    // Draw players
    drawPlayers();
    
    // Draw minimap
    drawMinimap();
    
    // Update UI
    updateUI();
}

// Draw background grid
function drawGrid() {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    const gridSize = 100;
    const offsetX = -camera.x % gridSize;
    const offsetY = -camera.y % gridSize;
    
    for (let x = offsetX; x < gameCanvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gameCanvas.height);
        ctx.stroke();
    }
    
    for (let y = offsetY; y < gameCanvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(gameCanvas.width, y);
        ctx.stroke();
    }
}

// Draw safe zone
function drawSafeZone() {
    const mapCenter = {
        x: gameState.mapSize.width / 2 - camera.x,
        y: gameState.mapSize.height / 2 - camera.y
    };
    
    // Draw safe zone circle
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, gameState.mapRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw danger zone
    ctx.beginPath();
    ctx.arc(mapCenter.x, mapCenter.y, gameState.mapRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(231, 76, 60, 0.1)';
    ctx.fill();
}

// Draw power-ups
function drawPowerUps() {
    gameState.powerUps.forEach(powerUp => {
        const screenX = powerUp.x - camera.x;
        const screenY = powerUp.y - camera.y;
        
        // Skip if off screen
        if (screenX < -50 || screenX > gameCanvas.width + 50 ||
            screenY < -50 || screenY > gameCanvas.height + 50) {
            return;
        }
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, powerUp.radius, 0, Math.PI * 2);
        
        if (powerUp.type === 'health') {
            ctx.fillStyle = '#2ecc71';
        } else {
            ctx.fillStyle = '#f1c40f';
        }
        
        ctx.fill();
        
        // Draw icon
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (powerUp.type === 'health') {
            ctx.fillText('+', screenX, screenY);
        } else {
            ctx.fillText('⦿', screenX, screenY);
        }
    });
}

// Draw bullets
function drawBullets() {
    gameState.bullets.forEach(bullet => {
        const screenX = bullet.x - camera.x;
        const screenY = bullet.y - camera.y;
        
        // Skip if off screen
        if (screenX < -20 || screenX > gameCanvas.width + 20 ||
            screenY < -20 || screenY > gameCanvas.height + 20) {
            return;
        }
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    });
}

// Draw players
function drawPlayers() {
    Object.values(gameState.players).forEach(player => {
        const screenX = player.x - camera.x;
        const screenY = player.y - camera.y;
        
        // Skip if off screen
        if (screenX < -50 || screenX > gameCanvas.width + 50 ||
            screenY < -50 || screenY > gameCanvas.height + 50) {
            return;
        }
        
        // Draw player circle
        ctx.beginPath();
        ctx.arc(screenX, screenY, player.radius, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.fill();
        
        // Draw player name
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(player.name, screenX, screenY - player.radius - 5);
        
        // Draw health bar
        const healthBarWidth = player.radius * 2;
        const healthBarHeight = 5;
        const healthPercentage = player.health / 100;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(
            screenX - healthBarWidth / 2,
            screenY + player.radius + 5,
            healthBarWidth,
            healthBarHeight
        );
        
        ctx.fillStyle = healthPercentage > 0.5 ? '#2ecc71' : healthPercentage > 0.2 ? '#f39c12' : '#e74c3c';
        ctx.fillRect(
            screenX - healthBarWidth / 2,
            screenY + player.radius + 5,
            healthBarWidth * healthPercentage,
            healthBarHeight
        );
        
        // Draw direction indicator if this is the current player
        if (player.id === playerId) {
            const worldMouseX = mousePosition.x + camera.x;
            const worldMouseY = mousePosition.y + camera.y;
            
            const dx = worldMouseX - player.x;
            const dy = worldMouseY - player.y;
            const angle = Math.atan2(dy, dx);
            
            const indicatorLength = player.radius + 10;
            const endX = screenX + Math.cos(angle) * indicatorLength;
            const endY = screenY + Math.sin(angle) * indicatorLength;
            
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

// Draw minimap
function drawMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Draw background
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Calculate scale factor
    const scaleFactor = minimapCanvas.width / gameState.mapSize.width;
    
    // Draw safe zone
    const mapCenterX = gameState.mapSize.width / 2 * scaleFactor;
    const mapCenterY = gameState.mapSize.height / 2 * scaleFactor;
    const safeZoneRadius = gameState.mapRadius * scaleFactor;
    
    minimapCtx.beginPath();
    minimapCtx.arc(mapCenterX, mapCenterY, safeZoneRadius, 0, Math.PI * 2);
    minimapCtx.strokeStyle = '#3498db';
    minimapCtx.lineWidth = 2;
    minimapCtx.stroke();
    
    // Draw players
    Object.values(gameState.players).forEach(player => {
        const minimapX = player.x * scaleFactor;
        const minimapY = player.y * scaleFactor;
        
        minimapCtx.beginPath();
        minimapCtx.arc(minimapX, minimapY, 3, 0, Math.PI * 2);
        
        if (player.id === playerId) {
            minimapCtx.fillStyle = 'white';
        } else {
            minimapCtx.fillStyle = player.color;
        }
        
        minimapCtx.fill();
    });
    
    // Draw power-ups
    gameState.powerUps.forEach(powerUp => {
        const minimapX = powerUp.x * scaleFactor;
        const minimapY = powerUp.y * scaleFactor;
        
        minimapCtx.beginPath();
        minimapCtx.arc(minimapX, minimapY, 2, 0, Math.PI * 2);
        
        if (powerUp.type === 'health') {
            minimapCtx.fillStyle = '#2ecc71';
        } else {
            minimapCtx.fillStyle = '#f1c40f';
        }
        
        minimapCtx.fill();
    });
    
    // Draw camera view area
    const viewX = camera.x * scaleFactor;
    const viewY = camera.y * scaleFactor;
    const viewWidth = gameCanvas.width * scaleFactor;
    const viewHeight = gameCanvas.height * scaleFactor;
    
    minimapCtx.strokeStyle = 'white';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(viewX, viewY, viewWidth, viewHeight);
}

// Update UI elements
function updateUI() {
    if (playerId && gameState.players[playerId]) {
        const player = gameState.players[playerId];
        
        // Update health bar
        healthFill.style.width = `${player.health}%`;
        if (player.health > 50) {
            healthFill.style.backgroundColor = '#2ecc71';
        } else if (player.health > 20) {
            healthFill.style.backgroundColor = '#f39c12';
        } else {
            healthFill.style.backgroundColor = '#e74c3c';
        }
        
        // Update ammo count
        ammoCount.textContent = `Ammo: ${player.ammo}`;
    }
    
    // Update player count
    const count = Object.keys(gameState.players).length;
    playerCount.textContent = `Players: ${count}`;
}

// Game loop
function gameLoop() {
    if (playerId && gameState.players[playerId]) {
        handleMovement();
    }
    draw();
}

// Socket.IO event handlers
socket.on('selfId', (id) => {
    playerId = id;
});

socket.on('gameState', (state) => {
    gameState = state;
});

socket.on('dead', () => {
    gameOverScreen.style.display = 'flex';
});

socket.on('winner', () => {
    winnerScreen.style.display = 'flex';
});

socket.on('gameReset', () => {
    // Game has been reset
});

// Initialize the game
init(); 
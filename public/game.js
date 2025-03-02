// Check if THREE is already defined when the script loads
let threeIsLoaded = typeof THREE !== 'undefined';

// Function to wait for THREE to load
function waitForThree(callback) {
  if (threeIsLoaded) {
    console.log("THREE is already loaded, proceeding immediately.");
    // THREE is already loaded, immediately call the callback
    callback();
    return;
  }
  
  console.log("Waiting for THREE to load...");
  // Check every 100ms if THREE is defined
  const interval = setInterval(() => {
    if (typeof THREE !== 'undefined') {
      clearInterval(interval);
      threeIsLoaded = true;
      console.log("THREE is now loaded, proceeding...");
      callback();
    }
  }, 100);
}

// Start the game once THREE is available
waitForThree(() => {
// Connect to the server
const socket = io(window.location.origin, {
  reconnectionAttempts: 5,
  timeout: 10000
});

  // Now we can safely use THREE
  console.log("Using THREE:", typeof THREE);
  
  // Directly use PointerLockControls from THREE global
  // This works because we defined it in index.html

// Game elements
  const gameContainer = document.getElementById('gameContainer');
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
  const loadingScreen = document.getElementById('loadingScreen');
  const loadingProgress = document.getElementById('loadingProgress');
  const mapViewScreen = document.getElementById('mapViewScreen');
  const closeMapViewButton = document.getElementById('closeMapViewButton');

  // Camera mode settings
  let isTppMode = true; // Start in TPP mode
  let tppDistance = 7; // Distance behind player in TPP mode (reduced from 10)
  let tppHeight = 3; // Height above player in TPP mode (reduced from 5)
  let isMapViewActive = false; // Track if map view is active
  let cameraSmoothing = 0.1; // Camera smoothing factor for TPP mode
  let lastCameraPosition = new THREE.Vector3(); // Store last camera position for smoothing

  // Three.js setup
  let scene, camera, renderer, controls;
  let playerMeshes = {}; // Store player 3D objects
  let bulletMeshes = []; // Store bullet 3D objects
  let powerUpMeshes = []; // Store power-up 3D objects
  let terrainMesh; // Store terrain mesh
  let skybox; // Store skybox
  let playerModel; // Player model template

// Game state
let gameState = {
    players: {},
    bullets: [],
    powerUps: [],
    mapRadius: 1000,
    mapSize: { width: 2000, height: 2000 },
    shrinkPhase: 0,
    nextPhaseIn: 0
};
let playerId = null;
let playerName = '';
let keys = {};
let keyCodes = {}; // Track key codes separately for Windows compatibility
let mousePosition = { x: 0, y: 0 };
let lastUpdateTime = 0;
let canShoot = true; // Shooting cooldown flag
let lastShootTime = 0; // Last time player shot
const SHOOT_COOLDOWN = 250; // Cooldown in milliseconds
let isWindowsOS = navigator.userAgent.indexOf('Windows') !== -1;
let debugInfo = document.createElement('div');
  let isPointerLocked = false;

  // Asset loading tracking
  let assetsToLoad = 0;
  let assetsLoaded = 0;

// Add debug info for troubleshooting
if (isWindowsOS) {
    debugInfo.style.position = 'absolute';
    debugInfo.style.top = '10px';
    debugInfo.style.left = '10px';
    debugInfo.style.color = 'white';
    debugInfo.style.backgroundColor = 'rgba(0,0,0,0.5)';
    debugInfo.style.padding = '5px';
    debugInfo.style.fontFamily = 'monospace';
    debugInfo.style.zIndex = '1000';
    document.body.appendChild(debugInfo);
}

// Add notification system
const notifications = [];
const notificationContainer = document.createElement('div');
notificationContainer.style.position = 'absolute';
notificationContainer.style.top = '100px';
notificationContainer.style.right = '20px';
notificationContainer.style.width = '300px';
notificationContainer.style.zIndex = '100';
document.body.appendChild(notificationContainer);

// Function to add a notification
function addNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.backgroundColor = type === 'warning' ? 'rgba(231, 76, 60, 0.8)' : 'rgba(52, 152, 219, 0.8)';
    notification.style.color = 'white';
    notification.style.padding = '10px';
    notification.style.marginBottom = '10px';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.transition = 'all 0.3s ease';
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    notifications.push({
        element: notification,
        expires: Date.now() + duration
    });
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        // Remove from DOM after animation
        setTimeout(() => {
            notification.remove();
            const index = notifications.findIndex(n => n.element === notification);
            if (index !== -1) {
                notifications.splice(index, 1);
            }
        }, 300);
    }, duration);
}

// Update notifications in game loop
function updateNotifications() {
    const now = Date.now();
    for (let i = notifications.length - 1; i >= 0; i--) {
        if (now >= notifications[i].expires) {
            notifications[i].element.style.transform = 'translateX(100%)';
            notifications[i].element.style.opacity = '0';
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (notifications[i] && notifications[i].element) {
                    notifications[i].element.remove();
                    notifications.splice(i, 1);
                }
            }, 300);
        }
    }
}

// Initialize the game
function init() {
      console.log("Game initialization started");
      
      // Force loading screen to be visible first
      loadingScreen.style.display = 'flex';
      
      // Force loading screen to close after a short delay
      // This is a failsafe in case the normal loading process fails
      setTimeout(() => {
          console.log("Forcing loading screen to close (failsafe)");
          if (loadingScreen) {
              loadingScreen.style.display = 'none';
          }
          if (joinScreen) {
              joinScreen.style.display = 'flex';
          }
      }, 3000);
      
      // Initialize Three.js
      initThreeJS();
      
      // Load game assets
      loadAssets();
    
    // Join game when button is clicked
    joinButton.addEventListener('click', joinGame);
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinGame();
    });
    
    // Restart game
    restartButton.addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        joinScreen.style.display = 'flex';
        // Reset any game state as needed
        resetGameState();
    });
    
    winRestartButton.addEventListener('click', () => {
        winnerScreen.style.display = 'none';
        joinScreen.style.display = 'flex';
        // Reset any game state as needed
        resetGameState();
    });
    
      // Keyboard controls
    window.addEventListener('keydown', (e) => {
        // Store both the key and keyCode for maximum compatibility
        keys[e.key.toLowerCase()] = true;
        keyCodes[e.code] = true;
        keyCodes[e.keyCode] = true;
        
        // Debug key press info
        if (isWindowsOS) {
            debugInfo.innerHTML = `Key down: ${e.key} (${e.keyCode}) [${e.code}]<br>` + debugInfo.innerHTML;
            if (debugInfo.innerHTML.length > 1000) {
                debugInfo.innerHTML = debugInfo.innerHTML.substring(0, 1000);
            }
        }
        
        // Handle map toggle
        if (e.key.toLowerCase() === 'm') {
            toggleMapView();
            addNotification('Map view toggled with M key', 'info', 2000);
        }
        
        // Handle camera mode toggle
        if (e.key.toLowerCase() === 'v') {
            toggleCameraMode();
        }
        
        // Space bar for shooting
        if (e.key === ' ' || e.code === 'Space' || e.keyCode === 32) {
            shoot();
        }
        
        // Handle escape key for map and menu
        if (e.key === 'Escape') {
            if (mapViewScreen.style.display === 'flex') {
                mapViewScreen.style.display = 'none';
                if (isPointerLocked) {
                    requestPointerLock();
                }
            } else if (menuVisible) {
                hideMenu();
                if (isPointerLocked) {
                    requestPointerLock();
                }
            } else {
                showMenu();
            }
        }
        
        // Prevent default behavior for arrow keys to avoid page scrolling
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) {
            e.preventDefault();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        // Clear both the key and keyCode for maximum compatibility
        keys[e.key.toLowerCase()] = false;
        keyCodes[e.code] = false;
        keyCodes[e.keyCode] = false;
        
        // Debug key release info
        if (isWindowsOS) {
            debugInfo.innerHTML = `Key up: ${e.key} (${e.keyCode}) [${e.code}]<br>` + debugInfo.innerHTML;
            if (debugInfo.innerHTML.length > 1000) {
                debugInfo.innerHTML = debugInfo.innerHTML.substring(0, 1000);
            }
        }
    });
    
      // Mouse controls for shooting
      document.addEventListener('mousedown', (e) => {
          if (e.button === 0 && isPointerLocked) { // Left click
            shoot();
        }
    });
      
      // Handle window resize
      window.addEventListener('resize', onWindowResize);
      
      // Add minimap click handler for map view
      minimapCanvas.addEventListener('click', toggleMapView);
      
      // Add close map view button handler
      if (closeMapViewButton) {
          closeMapViewButton.addEventListener('click', () => {
              console.log("Close map button clicked");
              if (isMapViewActive) {
                  toggleMapView();
              }
          });
      }
    
    // Game loop with timestamp for smoother animation
    lastUpdateTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Toggle between TPP and FPS camera modes
function toggleCameraMode() {
    isTppMode = !isTppMode;
    console.log(`Camera mode switched to: ${isTppMode ? 'TPP' : 'FPS'}`);
    
    // Reset camera position immediately when switching modes
    if (playerId && gameState.players[playerId] && playerMeshes[playerId]) {
        const player = gameState.players[playerId];
        const playerMesh = playerMeshes[playerId];
        const mapCenter = {
            x: gameState.mapSize.width / 2,
            y: gameState.mapSize.height / 2
        };
        
        // Get current camera direction
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        
        if (isTppMode) {
            // Switch to TPP - position camera behind player
            const cameraOffset = direction.clone().multiplyScalar(-tppDistance);
            camera.position.set(
                playerMesh.position.x + cameraOffset.x,
                playerMesh.position.y + tppHeight,
                playerMesh.position.z + cameraOffset.z
            );
            
            // Store initial camera position for smoothing
            lastCameraPosition.copy(camera.position);
        } else {
            // Switch to FPS - position camera at player's head
            // Store the current look direction
            const lookDirection = direction.clone();
            
            // Set camera position to player's head
            camera.position.set(
                playerMesh.position.x,
                playerMesh.position.y + 3,
                playerMesh.position.z
            );
            
            // Calculate a point to look at that maintains the same direction
            const lookAtPoint = new THREE.Vector3();
            lookAtPoint.addVectors(camera.position, lookDirection);
            camera.lookAt(lookAtPoint);
        }
    }
    
    addNotification(`Camera mode: ${isTppMode ? 'Third Person' : 'First Person'}`, 'info', 2000);
}

// Toggle map view
function toggleMapView() {
    isMapViewActive = !isMapViewActive;
    
    if (isMapViewActive) {
        // Show full-screen map view
        mapViewScreen.style.display = 'flex';
        
        // Make sure the canvas is properly sized
        const fullMapCanvas = document.getElementById('fullMapCanvas');
        if (fullMapCanvas) {
            // Set canvas size to match its display size
            const displayWidth = fullMapCanvas.clientWidth;
            const displayHeight = fullMapCanvas.clientHeight;
            
            if (fullMapCanvas.width !== displayWidth || fullMapCanvas.height !== displayHeight) {
                fullMapCanvas.width = displayWidth;
                fullMapCanvas.height = displayHeight;
                console.log(`Resized map canvas to ${displayWidth}x${displayHeight}`);
            }
        }
        
        // Draw detailed map
        drawDetailedMap();
        
        // Unlock pointer when viewing map
        if (isPointerLocked) {
            controls.unlock();
            isPointerLocked = false;
        }
        
        // Add keyboard listener for map view
        document.addEventListener('keydown', handleMapViewKeydown);
        
        addNotification('Map view opened. Press M or ESC to return to game.', 'info', 3000);
    } else {
        // Hide map view
        mapViewScreen.style.display = 'none';
        
        // Remove keyboard listener for map view
        document.removeEventListener('keydown', handleMapViewKeydown);
        
        // Lock pointer again when returning to game if we're in an active game
        if (!isPointerLocked && playerId && 
            gameOverScreen.style.display !== 'flex' && 
            winnerScreen.style.display !== 'flex') {
            controls.lock();
        }
    }
}

// Handle keyboard events in map view
function handleMapViewKeydown(e) {
    const key = e.key.toLowerCase();
    const code = e.code;
    const keyCode = e.keyCode;
    
    // Close map view with M or Escape
    if (key === 'm' || code === 'KeyM' || keyCode === 77 || 
        key === 'escape' || code === 'Escape' || keyCode === 27) {
        toggleMapView();
        e.preventDefault();
    }
}

// Draw detailed map for map view
function drawDetailedMap() {
    const mapCanvas = document.getElementById('fullMapCanvas');
    if (!mapCanvas) return;
    
    const mapCtx = mapCanvas.getContext('2d');
    const width = mapCanvas.width;
    const height = mapCanvas.height;
    
    // Clear canvas
    mapCtx.clearRect(0, 0, width, height);
    
    // Draw background
    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    mapCtx.fillRect(0, 0, width, height);
    
    // Calculate scale factor
    const scaleFactor = Math.min(width, height) / Math.max(gameState.mapSize.width, gameState.mapSize.height);
    
    // Draw map border
    mapCtx.strokeStyle = '#ffffff';
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect(0, 0, gameState.mapSize.width * scaleFactor, gameState.mapSize.height * scaleFactor);
    
    // Get current circle center from game state (if available)
    const circleCenter = gameState.currentCircleCenter || {
        x: gameState.mapSize.width / 2,
        y: gameState.mapSize.height / 2
    };
    
    // Draw current safe zone
    const mapCenterX = circleCenter.x * scaleFactor;
    const mapCenterY = circleCenter.y * scaleFactor;
    const safeZoneRadius = gameState.mapRadius * scaleFactor;
    
    // Draw danger zone with red color
    mapCtx.beginPath();
    mapCtx.arc(mapCenterX, mapCenterY, safeZoneRadius + 10, 0, Math.PI * 2);
    mapCtx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
    mapCtx.lineWidth = 20;
    mapCtx.stroke();
    
    // Draw current safe zone
    mapCtx.beginPath();
    mapCtx.arc(mapCenterX, mapCenterY, safeZoneRadius, 0, Math.PI * 2);
    mapCtx.strokeStyle = '#3498db';
    mapCtx.lineWidth = 3;
    mapCtx.stroke();
    
    // Fill safe zone with slight blue tint
    mapCtx.beginPath();
    mapCtx.arc(mapCenterX, mapCenterY, safeZoneRadius, 0, Math.PI * 2);
    mapCtx.fillStyle = 'rgba(52, 152, 219, 0.1)';
    mapCtx.fill();
    
    // Draw next safe zone if available
    if (gameState.nextCircleCenter && gameState.nextCircleRadius) {
        const nextCenterX = gameState.nextCircleCenter.x * scaleFactor;
        const nextCenterY = gameState.nextCircleCenter.y * scaleFactor;
        const nextRadius = gameState.nextCircleRadius * scaleFactor;
        
        // Draw next safe zone with white dashed line
        mapCtx.beginPath();
        mapCtx.setLineDash([5, 5]);
        mapCtx.arc(nextCenterX, nextCenterY, nextRadius, 0, Math.PI * 2);
        mapCtx.strokeStyle = 'white';
        mapCtx.lineWidth = 2;
        mapCtx.stroke();
        mapCtx.setLineDash([]); // Reset line dash
        
        // Fill next safe zone with slight white tint
        mapCtx.beginPath();
        mapCtx.arc(nextCenterX, nextCenterY, nextRadius, 0, Math.PI * 2);
        mapCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        mapCtx.fill();
        
        // Draw an arrow pointing from current center to next center
        const arrowStartX = mapCenterX;
        const arrowStartY = mapCenterY;
        const arrowEndX = nextCenterX;
        const arrowEndY = nextCenterY;
        
        // Only draw arrow if centers are different
        if (Math.abs(arrowStartX - arrowEndX) > 5 || Math.abs(arrowStartY - arrowEndY) > 5) {
            // Calculate arrow direction
            const angle = Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX);
            
            // Draw arrow line
            mapCtx.beginPath();
            mapCtx.moveTo(arrowStartX, arrowStartY);
            mapCtx.lineTo(arrowEndX, arrowEndY);
            mapCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            mapCtx.lineWidth = 1;
            mapCtx.stroke();
            
            // Draw arrowhead
            const headLength = 15;
            mapCtx.beginPath();
            mapCtx.moveTo(arrowEndX, arrowEndY);
            mapCtx.lineTo(
                arrowEndX - headLength * Math.cos(angle - Math.PI/6),
                arrowEndY - headLength * Math.sin(angle - Math.PI/6)
            );
            mapCtx.lineTo(
                arrowEndX - headLength * Math.cos(angle + Math.PI/6),
                arrowEndY - headLength * Math.sin(angle + Math.PI/6)
            );
            mapCtx.closePath();
            mapCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            mapCtx.fill();
        }
    }
    
    // Draw grid lines
    mapCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    mapCtx.lineWidth = 1;
    
    // Vertical grid lines
    for (let x = 0; x <= gameState.mapSize.width; x += 200) {
        mapCtx.beginPath();
        mapCtx.moveTo(x * scaleFactor, 0);
        mapCtx.lineTo(x * scaleFactor, gameState.mapSize.height * scaleFactor);
        mapCtx.stroke();
    }
    
    // Horizontal grid lines
    for (let y = 0; y <= gameState.mapSize.height; y += 200) {
        mapCtx.beginPath();
        mapCtx.moveTo(0, y * scaleFactor);
        mapCtx.lineTo(gameState.mapSize.width * scaleFactor, y * scaleFactor);
        mapCtx.stroke();
    }
    
    // Draw power-ups
    gameState.powerUps.forEach(powerUp => {
        const mapX = powerUp.x * scaleFactor;
        const mapY = powerUp.y * scaleFactor;
        
        mapCtx.beginPath();
        mapCtx.arc(mapX, mapY, 6, 0, Math.PI * 2);
        
        if (powerUp.type === 'health') {
            mapCtx.fillStyle = '#2ecc71';
        } else {
            mapCtx.fillStyle = '#f1c40f';
        }
        
        mapCtx.fill();
        
        // Add glow effect
        mapCtx.beginPath();
        mapCtx.arc(mapX, mapY, 10, 0, Math.PI * 2);
        if (powerUp.type === 'health') {
            mapCtx.fillStyle = 'rgba(46, 204, 113, 0.3)';
        } else {
            mapCtx.fillStyle = 'rgba(241, 196, 15, 0.3)';
        }
        mapCtx.fill();
    });
    
    // Draw players with names
    Object.values(gameState.players).forEach(player => {
        const mapX = player.x * scaleFactor;
        const mapY = player.y * scaleFactor;
        
        // Draw player direction indicator
        if (player.id === playerId) {
            // Draw a larger indicator for the current player
            mapCtx.beginPath();
            mapCtx.arc(mapX, mapY, 12, 0, Math.PI * 2);
            mapCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            mapCtx.fill();
            
            // Get player mesh to determine facing direction
            const playerMesh = playerMeshes[playerId];
            if (playerMesh) {
                // Use player mesh rotation for direction
                const angle = playerMesh.rotation.y;
                
                // Draw direction indicator (triangle pointing in movement direction)
                const triangleSize = 15;
                
                // IMPORTANT: In Three.js, rotation.y represents rotation around the Y axis
                // where 0 is looking down the negative Z axis. In 2D canvas, 0 is pointing right (positive X)
                // So we need to add PI/2 to convert between coordinate systems
                const canvasAngle = angle + Math.PI/2;
                
                mapCtx.beginPath();
                mapCtx.moveTo(
                    mapX + triangleSize * Math.cos(canvasAngle),
                    mapY + triangleSize * Math.sin(canvasAngle)
                );
                mapCtx.lineTo(
                    mapX + triangleSize * 0.5 * Math.cos(canvasAngle + Math.PI * 0.8),
                    mapY + triangleSize * 0.5 * Math.sin(canvasAngle + Math.PI * 0.8)
                );
                mapCtx.lineTo(
                    mapX + triangleSize * 0.5 * Math.cos(canvasAngle - Math.PI * 0.8),
                    mapY + triangleSize * 0.5 * Math.sin(canvasAngle - Math.PI * 0.8)
                );
                mapCtx.closePath();
                mapCtx.fillStyle = 'white';
                mapCtx.fill();
                
                // Debug angle info if on Windows
                if (isWindowsOS) {
                    debugInfo.innerHTML += `<br>Player angle: ${(angle * 180 / Math.PI).toFixed(2)}°, Canvas angle: ${(canvasAngle * 180 / Math.PI).toFixed(2)}°`;
                }
            }
        }
        
        // Draw player dot
        mapCtx.beginPath();
        mapCtx.arc(mapX, mapY, 8, 0, Math.PI * 2);
        
        if (player.id === playerId) {
            mapCtx.fillStyle = 'white';
        } else {
            mapCtx.fillStyle = player.color;
        }
        
        mapCtx.fill();
        
        // Draw player name
        mapCtx.font = '14px Arial';
        mapCtx.fillStyle = 'white';
        mapCtx.textAlign = 'center';
        mapCtx.fillText(player.name, mapX, mapY - 15);
        
        // Draw player score
        if (player.score > 0) {
            mapCtx.fillText(`Kills: ${player.score}`, mapX, mapY + 20);
        }
        
        // Draw player health bar
        const healthBarWidth = 40;
        const healthBarHeight = 4;
        mapCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        mapCtx.fillRect(mapX - healthBarWidth/2, mapY + 25, healthBarWidth, healthBarHeight);
        
        // Health fill
        let healthColor = '#2ecc71'; // Green
        if (player.health < 50) healthColor = '#f39c12'; // Orange
        if (player.health < 25) healthColor = '#e74c3c'; // Red
        
        mapCtx.fillStyle = healthColor;
        mapCtx.fillRect(
            mapX - healthBarWidth/2, 
            mapY + 25, 
            healthBarWidth * (player.health / 100), 
            healthBarHeight
        );
    });
    
    // Draw shrinking zone info
    mapCtx.font = '18px Arial';
    mapCtx.fillStyle = 'white';
    mapCtx.textAlign = 'left';
    mapCtx.fillText(`Safe Zone Radius: ${gameState.mapRadius.toFixed(0)}`, 10, height - 70);
    mapCtx.fillText(`Phase: ${gameState.shrinkPhase}`, 10, height - 45);
    
    if (gameState.nextPhaseIn > 0) {
        mapCtx.fillText(`Next phase in: ${gameState.nextPhaseIn}s`, 10, height - 20);
    } else if (gameState.shrinkPhase < 5) {
        mapCtx.fillText(`Zone shrinking...`, 10, height - 20);
    } else {
        mapCtx.fillText(`Final phase - zone shrinking rapidly!`, 10, height - 20);
    }
    
    // Draw compass directions
    mapCtx.font = '16px Arial';
    mapCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    mapCtx.textAlign = 'center';
    mapCtx.fillText('N', mapCenterX, 20);
    mapCtx.fillText('S', mapCenterX, height - 10);
    mapCtx.fillText('W', 20, mapCenterY);
    mapCtx.fillText('E', width - 20, mapCenterY);
    
    // Draw keyboard hint
    mapCtx.font = '16px Arial';
    mapCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    mapCtx.textAlign = 'center';
    mapCtx.fillText('Press M or ESC to close map', mapCenterX, 50);
}

// Initialize Three.js
function initThreeJS() {
    console.log("Initializing Three.js...");
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 30, 0); // Start above ground
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    gameContainer.appendChild(renderer.domElement);
    
    // Create pointer lock controls
    console.log("Creating PointerLockControls, type:", typeof THREE.PointerLockControls);
    try {
        controls = new THREE.PointerLockControls(camera, renderer.domElement);
        console.log("PointerLockControls created successfully:", controls);
    } catch (error) {
        console.error("Error creating PointerLockControls:", error);
        // Create a fallback if PointerLockControls fails
        controls = {
            lock: function() { console.log("Fallback lock called"); },
            unlock: function() { console.log("Fallback unlock called"); }
        };
    }
    
    // Add event listener for pointer lock changes
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
        console.log("Pointer lock changed, isLocked:", isPointerLocked);
    });
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1000, 1000, 1000);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 3000;
    directionalLight.shadow.camera.left = -1500;
    directionalLight.shadow.camera.right = 1500;
    directionalLight.shadow.camera.top = 1500;
    directionalLight.shadow.camera.bottom = -1500;
    scene.add(directionalLight);
    
    // Create ground
    createTerrain();
    
    // Create skybox
    createSkybox();
}

// Create terrain
function createTerrain() {
    // Create a large ground plane
    const groundGeometry = new THREE.CircleGeometry(gameState.mapRadius, 64);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3a7e4f, // Green color for grass
        roughness: 0.8,
        metalness: 0.2
    });
    terrainMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    terrainMesh.rotation.x = -Math.PI / 2; // Rotate to be flat on XZ plane
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
    
    // Add a grid for reference
    const gridHelper = new THREE.GridHelper(gameState.mapRadius * 2, 20, 0x000000, 0x000000);
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
    
    // Add a boundary circle to show the safe zone
    const safeZoneGeometry = new THREE.RingGeometry(gameState.mapRadius - 5, gameState.mapRadius, 64);
    const safeZoneMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x3498db,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });
    const safeZone = new THREE.Mesh(safeZoneGeometry, safeZoneMaterial);
    safeZone.rotation.x = -Math.PI / 2;
    safeZone.position.y = 1; // Slightly above ground to avoid z-fighting
    scene.add(safeZone);
}

// Create skybox
function createSkybox() {
    const skyGeometry = new THREE.BoxGeometry(10000, 10000, 10000);
    const skyMaterials = [
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Right
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Left
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Top
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Bottom
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Front
        new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide })  // Back
    ];
    skybox = new THREE.Mesh(skyGeometry, skyMaterials);
    scene.add(skybox);
}

// Load game assets
function loadAssets() {
    // Track loading progress
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        const progress = (itemsLoaded / itemsTotal) * 100;
        if (loadingProgress) {
            loadingProgress.style.width = `${progress}%`;
        }
        console.log(`Loading progress: ${progress.toFixed(0)}%`);
    };
    
    loadingManager.onLoad = () => {
        // Hide loading screen when all assets are loaded
        console.log("All assets loaded, hiding loading screen");
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        if (joinScreen) {
            joinScreen.style.display = 'flex';
        }
    };
    
    // Force the loading to complete since we're not actually loading any external assets
    setTimeout(() => {
        console.log("Forcing loading screen to close");
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        if (joinScreen) {
            joinScreen.style.display = 'flex';
        }
    }, 1000);
    
    // Load player model
    // For now, we'll use a simple box as the player model
    // In a real game, you'd load a GLTF model here
    const boxGeometry = new THREE.BoxGeometry(2, 4, 2);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    playerModel = new THREE.Mesh(boxGeometry, boxMaterial);
    playerModel.castShadow = true;
    
    // Create a simple bullet model
    const bulletGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    bulletModel = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    // Manually trigger the loading manager's onLoad
    loadingManager.onLoad();
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Join the game
function joinGame() {
    playerName = nameInput.value.trim() || 'Player';
    socket.emit('join', playerName);
    joinScreen.style.display = 'none';
      
    // Lock pointer for FPS controls
    setTimeout(() => {
        controls.lock();
    }, 100);
      
    // Listen for pointer lock events
    renderer.domElement.addEventListener('click', () => {
        // Only lock pointer if we're in the game (not in menus or map view)
        if (!isPointerLocked && playerId && 
            gameOverScreen.style.display !== 'flex' && 
            winnerScreen.style.display !== 'flex' &&
            !isMapViewActive) {
            controls.lock();
        }
    });
}

// Handle player movement
function handleMovement(deltaTime) {
    if (!playerId || !gameState.players[playerId]) return;
    
    const player = gameState.players[playerId];
    const speed = 0.5 * (deltaTime / 16.67); // Normalize speed based on frame time
    const rotationSpeed = 0.03 * (deltaTime / 16.67); // Rotation speed
    let moveUp = 0;
    let moveDown = 0;
    let moveLeft = 0;
    let moveRight = 0;
    
    // Multi-layered movement detection for maximum compatibility
    // First check keyCodes (most reliable for Windows)
    if (keyCodes['ArrowUp'] || keyCodes['KeyW'] || keyCodes[87] || keyCodes[38]) moveUp = 1;
    if (keyCodes['ArrowDown'] || keyCodes['KeyS'] || keyCodes[83] || keyCodes[40]) moveDown = 1;
    if (keyCodes['ArrowLeft'] || keyCodes['KeyA'] || keyCodes[65] || keyCodes[37]) moveLeft = 1;
    if (keyCodes['ArrowRight'] || keyCodes['KeyD'] || keyCodes[68] || keyCodes[39]) moveRight = 1;
    
    // Then check keys as fallback (more reliable for Mac OS)
    if (moveUp === 0 && moveDown === 0 && moveLeft === 0 && moveRight === 0) {
        if (keys['w'] || keys['arrowup'] || keys['W'] || keys['ArrowUp']) moveUp = 1;
        if (keys['s'] || keys['arrowdown'] || keys['S'] || keys['ArrowDown']) moveDown = 1;
        if (keys['a'] || keys['arrowleft'] || keys['A'] || keys['ArrowLeft']) moveLeft = 1;
        if (keys['d'] || keys['arrowright'] || keys['D'] || keys['ArrowRight']) moveRight = 1;
    }
    
    // Update debug info for Windows users
    if (isWindowsOS) {
        debugInfo.innerHTML = `
            Keys: ${JSON.stringify(keys)}<br>
            KeyCodes: ${JSON.stringify(keyCodes)}<br>
            Movement: up=${moveUp}, down=${moveDown}, left=${moveLeft}, right=${moveRight}<br>
            Position: x=${player.x.toFixed(0)}, z=${player.y.toFixed(0)}<br>
            Camera Mode: ${isTppMode ? 'TPP' : 'FPS'}<br>
            Pointer Locked: ${isPointerLocked}
        `;
    }
    
    // Only process movement if keys are pressed
    if (moveUp === 0 && moveDown === 0 && moveLeft === 0 && moveRight === 0) return;
    
    // Get current camera direction for reference
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep movement on the XZ plane
    cameraDirection.normalize();
    
    // Calculate forward and right vectors based on camera orientation
    const forward = cameraDirection.clone();
    
    // Calculate right vector correctly (camera's right)
    // Using UP vector (0,1,0) cross forward gives us the right vector
    const right = new THREE.Vector3();
    right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
    
    // Debug right vector
    if (isWindowsOS) {
        debugInfo.innerHTML += `<br>Right vector: x=${right.x.toFixed(2)}, z=${right.z.toFixed(2)}`;
    }
    
    // Calculate movement direction based on key inputs
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    // Add movement components based on key presses
    if (moveUp) {
        moveDirection.add(forward);
    }
    if (moveDown) {
        moveDirection.add(forward.clone().negate());
    }
    if (moveRight) {
        // Right is positive on the right vector
        moveDirection.add(right);
    }
    if (moveLeft) {
        // Left is negative on the right vector
        moveDirection.add(right.clone().negate());
    }
    
    // Normalize the movement direction if moving diagonally
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
    }
    
    // Apply movement
    player.x += moveDirection.x * speed;
    player.y += moveDirection.z * speed; // Note: player.y is actually Z in 3D space
    
    // Get current circle center from game state (if available)
    const circleCenter = gameState.currentCircleCenter || {
        x: gameState.mapSize.width / 2,
        y: gameState.mapSize.height / 2
    };
    
    // Keep player within the map bounds
    const distanceFromCenter = Math.sqrt(
        Math.pow(player.x - circleCenter.x, 2) + 
        Math.pow(player.y - circleCenter.y, 2)
    );
    
    // Allow player to move outside the safe zone, but not too far
    const maxDistance = gameState.mapRadius * 1.2;
    
    if (distanceFromCenter > maxDistance) {
        const angle = Math.atan2(player.y - circleCenter.y, player.x - circleCenter.x);
        player.x = circleCenter.x + Math.cos(angle) * maxDistance;
        player.y = circleCenter.y + Math.sin(angle) * maxDistance;
    }
    
    // Send position to server (throttled to reduce network traffic)
    if (moveDirection.length() > 0.01) {
        socket.emit('move', { x: player.x, y: player.y });
    }
    
    // Update camera position based on camera mode
    if (playerMeshes[playerId]) {
        const playerMesh = playerMeshes[playerId];
        
        // Calculate position relative to map center for rendering
        const mapCenter = {
            x: gameState.mapSize.width / 2,
            y: gameState.mapSize.height / 2
        };
        
        playerMesh.position.set(player.x - mapCenter.x, playerMesh.position.y, player.y - mapCenter.y);
        
        // Rotate player mesh to face the direction of movement if moving
        if (moveDirection.length() > 0) {
            const movementAngle = Math.atan2(moveDirection.x, moveDirection.z);
            playerMesh.rotation.y = movementAngle;
            
            // Debug movement angle
            if (isWindowsOS) {
                const angleDegrees = (movementAngle * 180 / Math.PI).toFixed(2);
                debugInfo.innerHTML += `<br>Movement angle: ${angleDegrees}°`;
                debugInfo.innerHTML += `<br>Movement vector: x=${moveDirection.x.toFixed(2)}, z=${moveDirection.z.toFixed(2)}`;
            }
        }
        
        if (isTppMode) {
            // TPP mode - position camera behind player with smoothing
            const cameraOffset = cameraDirection.clone().multiplyScalar(-tppDistance);
            const targetPosition = new THREE.Vector3(
                playerMesh.position.x + cameraOffset.x,
                playerMesh.position.y + tppHeight,
                playerMesh.position.z + cameraOffset.z
            );
            
            // Apply smoothing to camera movement
            camera.position.lerp(targetPosition, cameraSmoothing);
            
            // Store last position for next frame
            lastCameraPosition.copy(camera.position);
            
            // Make camera look at player with slight offset for better view
            camera.lookAt(
                playerMesh.position.x,
                playerMesh.position.y + 2,
                playerMesh.position.z
            );
        } else {
            // FPS mode - position camera at player's head
            // Store the current look direction
            const lookDirection = new THREE.Vector3();
            camera.getWorldDirection(lookDirection);
            
            // Set camera position to player's head
            camera.position.set(
                playerMesh.position.x,
                playerMesh.position.y + 3,
                playerMesh.position.z
            );
            
            // Calculate a point to look at that maintains the same direction
            const lookAtPoint = new THREE.Vector3();
            lookAtPoint.addVectors(camera.position, lookDirection);
            camera.lookAt(lookAtPoint);
        }
    }
    
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
    if (!playerId || !gameState.players[playerId] || !isPointerLocked) return;
    
    const player = gameState.players[playerId];
    const currentTime = performance.now();
    
    // Check if player has ammo and cooldown has passed
    if (player.ammo <= 0) {
        // Visual feedback for no ammo
        ammoCount.style.color = 'red';
        setTimeout(() => { ammoCount.style.color = 'white'; }, 300);
        return;
    }
    
    if (!canShoot || currentTime - lastShootTime < SHOOT_COOLDOWN) {
        return;
    }
    
    // Set cooldown
    canShoot = false;
    lastShootTime = currentTime;
    setTimeout(() => { canShoot = true; }, SHOOT_COOLDOWN);
    
    // Get direction from camera
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Send shoot event to server
    socket.emit('shoot', {
        x: player.x,
        y: player.y,
        velocityX: direction.x * 10, // Bullet speed
        velocityY: direction.z * 10  // Using z for y in 2D space
    });
    
    // Add muzzle flash effect
    const flash = new THREE.PointLight(0xffff00, 1, 10);
    flash.position.set(
        camera.position.x + direction.x * 2,
        camera.position.y + direction.y * 2,
        camera.position.z + direction.z * 2
    );
    scene.add(flash);
    
    // Remove flash after a short time
    setTimeout(() => {
        scene.remove(flash);
    }, 50);
    
    // Add recoil effect
    camera.position.y += 0.05; // Small upward recoil
    setTimeout(() => {
        camera.position.y -= 0.05; // Return to original position
    }, 100);
}

// Update 3D objects based on game state
function updateObjects() {
    const mapCenter = {
        x: gameState.mapSize.width / 2,
        y: gameState.mapSize.height / 2
    };
    
    // Update player meshes
    Object.values(gameState.players).forEach(player => {
        // Create new player mesh if it doesn't exist
        if (!playerMeshes[player.id]) {
            const newPlayerMesh = playerModel.clone();
            newPlayerMesh.material = new THREE.MeshStandardMaterial({ color: player.color });
            
            // Add player name label
            const nameCanvas = document.createElement('canvas');
            const nameContext = nameCanvas.getContext('2d');
            nameCanvas.width = 256;
            nameCanvas.height = 64;
            nameContext.font = '24px Arial';
            nameContext.fillStyle = 'white';
            nameContext.textAlign = 'center';
            nameContext.fillText(player.name, 128, 32);
            
            const nameTexture = new THREE.CanvasTexture(nameCanvas);
            const nameMaterial = new THREE.SpriteMaterial({ map: nameTexture });
            const nameSprite = new THREE.Sprite(nameMaterial);
            nameSprite.position.y = 3; // Position above player
            nameSprite.scale.set(5, 1.25, 1);
            
            newPlayerMesh.add(nameSprite);
            scene.add(newPlayerMesh);
            playerMeshes[player.id] = newPlayerMesh;
        }
        
        // Update player mesh position
        const playerMesh = playerMeshes[player.id];
        playerMesh.position.set(player.x - mapCenter.x, 2, player.y - mapCenter.y);
        
        // Note: We don't update rotation here anymore as it's handled in handleMovement
        // This prevents overriding the movement-based rotation
        
        // Update health bar
        if (player.id === playerId) {
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
    });
    
    // Remove player meshes for players no longer in the game
    Object.keys(playerMeshes).forEach(id => {
        if (!gameState.players[id]) {
            scene.remove(playerMeshes[id]);
            delete playerMeshes[id];
        }
    });
    
    // Update bullet meshes
    // First remove all existing bullet meshes
    bulletMeshes.forEach(mesh => scene.remove(mesh));
    bulletMeshes = [];
    
    // Create new bullet meshes
    gameState.bullets.forEach(bullet => {
        const bulletGeometry = new THREE.SphereGeometry(bullet.radius, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bulletMesh.position.set(bullet.x - mapCenter.x, 2, bullet.y - mapCenter.y);
        scene.add(bulletMesh);
        bulletMeshes.push(bulletMesh);
    });
    
    // Update power-up meshes
    // First remove all existing power-up meshes
    powerUpMeshes.forEach(mesh => scene.remove(mesh));
    powerUpMeshes = [];
    
    // Create new power-up meshes
    gameState.powerUps.forEach(powerUp => {
        const powerUpGeometry = new THREE.SphereGeometry(powerUp.radius, 16, 16);
        const powerUpMaterial = new THREE.MeshBasicMaterial({ 
            color: powerUp.type === 'health' ? 0x2ecc71 : 0xf1c40f,
            transparent: true,
            opacity: 0.8
        });
        const powerUpMesh = new THREE.Mesh(powerUpGeometry, powerUpMaterial);
        powerUpMesh.position.set(powerUp.x - mapCenter.x, 2, powerUp.y - mapCenter.y);
        
        // Add floating animation
        powerUpMesh.userData = { 
            originalY: 2,
            animationOffset: Math.random() * Math.PI * 2 // Random starting phase
        };
        
        scene.add(powerUpMesh);
        powerUpMeshes.push(powerUpMesh);
    });
    
    // Update safe zone
    if (terrainMesh) {
        terrainMesh.geometry.dispose();
        terrainMesh.geometry = new THREE.CircleGeometry(gameState.mapRadius, 64);
    }
    
    // Update player count
    const count = Object.keys(gameState.players).length;
    playerCount.textContent = `Players: ${count}`;
}

// Draw minimap
function drawMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Draw background
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Draw border
    minimapCtx.strokeStyle = '#3498db';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Calculate scale factor
    const scaleFactor = minimapCanvas.width / gameState.mapSize.width;
    
    // Get current circle center from game state (if available)
    const circleCenter = gameState.currentCircleCenter || {
        x: gameState.mapSize.width / 2,
        y: gameState.mapSize.height / 2
    };
    
    // Draw safe zone
    const mapCenterX = circleCenter.x * scaleFactor;
    const mapCenterY = circleCenter.y * scaleFactor;
    const safeZoneRadius = gameState.mapRadius * scaleFactor;
    
    // Draw danger zone with red color
    minimapCtx.beginPath();
    minimapCtx.arc(mapCenterX, mapCenterY, safeZoneRadius + 3, 0, Math.PI * 2);
    minimapCtx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
    minimapCtx.lineWidth = 3;
    minimapCtx.stroke();
    
    // Draw safe zone
    minimapCtx.beginPath();
    minimapCtx.arc(mapCenterX, mapCenterY, safeZoneRadius, 0, Math.PI * 2);
    minimapCtx.strokeStyle = '#3498db';
    minimapCtx.lineWidth = 2;
    minimapCtx.stroke();
    
    // Fill safe zone with slight blue tint
    minimapCtx.beginPath();
    minimapCtx.arc(mapCenterX, mapCenterY, safeZoneRadius, 0, Math.PI * 2);
    minimapCtx.fillStyle = 'rgba(52, 152, 219, 0.1)';
    minimapCtx.fill();
    
    // Draw next safe zone if available
    if (gameState.nextCircleCenter && gameState.nextCircleRadius) {
        const nextCenterX = gameState.nextCircleCenter.x * scaleFactor;
        const nextCenterY = gameState.nextCircleCenter.y * scaleFactor;
        const nextRadius = gameState.nextCircleRadius * scaleFactor;
        
        // Draw next safe zone with white dashed line
        minimapCtx.beginPath();
        minimapCtx.setLineDash([3, 3]);
        minimapCtx.arc(nextCenterX, nextCenterY, nextRadius, 0, Math.PI * 2);
        minimapCtx.strokeStyle = 'white';
        minimapCtx.lineWidth = 1;
        minimapCtx.stroke();
    }
    
    // Draw players
    Object.values(gameState.players).forEach(player => {
        const minimapX = player.x * scaleFactor;
        const minimapY = player.y * scaleFactor;
        
        minimapCtx.beginPath();
        minimapCtx.arc(minimapX, minimapY, 3, 0, Math.PI * 2);
        
        if (player.id === playerId) {
            minimapCtx.fillStyle = 'white';
            
            // Draw direction indicator
            // Get player mesh to determine facing direction
            const playerMesh = playerMeshes[playerId];
            if (playerMesh) {
                // Use player mesh rotation for direction
                const angle = playerMesh.rotation.y;
                
                // Draw a triangle pointing in the direction of movement
                const triangleSize = 6;
                
                // IMPORTANT: In Three.js, rotation.y represents rotation around the Y axis
                // where 0 is looking down the negative Z axis. In 2D canvas, 0 is pointing right (positive X)
                // So we need to add PI/2 to convert between coordinate systems
                const canvasAngle = angle + Math.PI/2;
                
                minimapCtx.beginPath();
                minimapCtx.moveTo(
                    minimapX + triangleSize * Math.cos(canvasAngle),
                    minimapY + triangleSize * Math.sin(canvasAngle)
                );
                minimapCtx.lineTo(
                    minimapX + triangleSize * 0.5 * Math.cos(canvasAngle + Math.PI * 0.8),
                    minimapY + triangleSize * 0.5 * Math.sin(canvasAngle + Math.PI * 0.8)
                );
                minimapCtx.lineTo(
                    minimapX + triangleSize * 0.5 * Math.cos(canvasAngle - Math.PI * 0.8),
                    minimapY + triangleSize * 0.5 * Math.sin(canvasAngle - Math.PI * 0.8)
                );
                minimapCtx.closePath();
                minimapCtx.fillStyle = 'white';
                minimapCtx.fill();
                
                // Debug angle info if on Windows
                if (isWindowsOS) {
                    debugInfo.innerHTML += `<br>Player angle: ${(angle * 180 / Math.PI).toFixed(2)}°, Canvas angle: ${(canvasAngle * 180 / Math.PI).toFixed(2)}°`;
                }
            }
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
    
    // Add "Press M for Map" text
    minimapCtx.font = '10px Arial';
    minimapCtx.fillStyle = 'white';
    minimapCtx.textAlign = 'center';
    minimapCtx.fillText('Press M for Map', minimapCanvas.width / 2, minimapCanvas.height - 5);
    
    // Show phase info
    minimapCtx.font = '10px Arial';
    minimapCtx.fillStyle = 'white';
    minimapCtx.textAlign = 'center';
    minimapCtx.fillText(`Phase: ${gameState.shrinkPhase}`, minimapCanvas.width / 2, 12);
    
    // Show player position
    if (playerId && gameState.players[playerId]) {
        const player = gameState.players[playerId];
        minimapCtx.font = '8px Arial';
        minimapCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        minimapCtx.textAlign = 'left';
        minimapCtx.fillText(`X: ${Math.floor(player.x)}, Y: ${Math.floor(player.y)}`, 5, minimapCanvas.height - 5);
    }
}

// Animate power-ups
function animatePowerUps(time) {
    powerUpMeshes.forEach(mesh => {
        const floatHeight = 0.5;
        const floatSpeed = 1.5;
        // Calculate floating animation
        mesh.position.y = mesh.userData.originalY + 
            Math.sin(time * 0.001 * floatSpeed + mesh.userData.animationOffset) * floatHeight;
        
        // Add rotation
        mesh.rotation.y += 0.01;
    });
}

// Game loop
function gameLoop(timestamp) {
    // Calculate delta time for smooth animation
    const deltaTime = timestamp - lastUpdateTime;
    lastUpdateTime = timestamp;
    
    if (playerId && gameState.players[playerId]) {
        handleMovement(deltaTime);
    }
    
    // Update 3D objects
    updateObjects();
    
    // Animate power-ups
    animatePowerUps(timestamp);
    
    // Update notifications
    updateNotifications();
    
    // Draw minimap
    drawMinimap();
    
    // Update full map view if active
    if (isMapViewActive) {
        drawDetailedMap();
    }
    
    // Render scene
    renderer.render(scene, camera);
    
    // Use requestAnimationFrame for smoother animation
    requestAnimationFrame(gameLoop);
}

// Socket.IO event handlers
socket.on('selfId', (id) => {
    playerId = id;
});

socket.on('gameState', (state) => {
    // Store previous state for circle transition
    const previousState = gameState;
    gameState = state;
    
    // If the circle has changed, animate the transition
    if (previousState && previousState.mapRadius !== state.mapRadius) {
        animateCircleTransition(previousState.mapRadius, state.mapRadius);
    }
    
    // If the circle center has changed, update the visual representation
    if (previousState && 
        (previousState.nextCircleCenter?.x !== state.nextCircleCenter?.x || 
         previousState.nextCircleCenter?.y !== state.nextCircleCenter?.y)) {
        updateNextCircleIndicator();
    }
});

// Animate circle transition
function animateCircleTransition(oldRadius, newRadius) {
    // Create a visual effect for the circle shrinking
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100vw';
    flash.style.height = '100vh';
    flash.style.backgroundColor = 'rgba(52, 152, 219, 0.2)';
    flash.style.zIndex = '50';
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 1s';
    document.body.appendChild(flash);
    
    // Fade out and remove
    setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => {
            flash.remove();
        }, 1000);
    }, 100);
}

// Update next circle indicator
function updateNextCircleIndicator() {
    // Only show next circle indicator if we have next circle data
    if (!gameState.nextCircleCenter || !gameState.nextCircleRadius) return;
    
    // If we already have a next circle indicator, remove it
    const existingIndicator = scene.getObjectByName('nextCircleIndicator');
    if (existingIndicator) {
        scene.remove(existingIndicator);
    }
    
    // Create a new indicator for the next safe zone
    const mapCenter = {
        x: gameState.mapSize.width / 2,
        y: gameState.mapSize.height / 2
    };
    
    const nextCircleGeometry = new THREE.RingGeometry(
        gameState.nextCircleRadius - 2, 
        gameState.nextCircleRadius, 
        64
    );
    const nextCircleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
        depthWrite: false
    });
    
    const nextCircle = new THREE.Mesh(nextCircleGeometry, nextCircleMaterial);
    nextCircle.rotation.x = -Math.PI / 2;
    nextCircle.position.set(
        gameState.nextCircleCenter.x - mapCenter.x, 
        1.5, // Slightly above ground
        gameState.nextCircleCenter.y - mapCenter.y
    );
    nextCircle.name = 'nextCircleIndicator';
    scene.add(nextCircle);
    
    // Add a pulsing animation to make it more visible
    const pulseAnimation = () => {
        if (!nextCircle) return;
        
        nextCircle.material.opacity = 0.3 + 0.2 * Math.sin(Date.now() * 0.003);
        requestAnimationFrame(pulseAnimation);
    };
    
    pulseAnimation();
    
    // Add notification about the new safe zone
    addNotification('New safe zone marked on map!', 'info', 5000);
}

// Handle phase changes
socket.on('phaseChange', (data) => {
    addNotification(data.message, 'info', 8000);
    
    // Visual effect for phase change
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100vw';
    flash.style.height = '100vh';
    flash.style.backgroundColor = 'rgba(52, 152, 219, 0.3)';
    flash.style.zIndex = '50';
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 2s';
    document.body.appendChild(flash);
    
    // Fade out and remove
    setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => {
            flash.remove();
        }, 2000);
    }, 100);
    
    // If this is a new phase with a new circle, show it on the minimap
    if (data.nextCircleCenter && data.nextCircleRadius) {
        // Store next circle data in game state
        gameState.nextCircleCenter = data.nextCircleCenter;
        gameState.nextCircleRadius = data.nextCircleRadius;
        
        // Update the visual indicator
        updateNextCircleIndicator();
    }
});

// Handle phase updates
socket.on('phaseUpdate', (data) => {
    if (data.remainingSeconds <= 10) {
        addNotification(data.message, 'warning');
    }
});

// Handle zone damage
socket.on('zoneDamage', (data) => {
    // Visual effect for taking damage
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100vw';
    flash.style.height = '100vh';
    flash.style.backgroundColor = 'rgba(231, 76, 60, 0.3)';
    flash.style.zIndex = '50';
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 0.5s';
    document.body.appendChild(flash);
    
    // Fade out and remove
    setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => {
            flash.remove();
        }, 500);
    }, 100);
    
    // Show damage notification if significant
    if (data.damage >= 3) {
        addNotification(`${data.message} (${data.damage} damage)`, 'warning', 2000);
    }
});

// Reset game state when restarting
function resetGameState() {
    // Reset camera mode to TPP
    isTppMode = true;
    
    // Reset map view
    isMapViewActive = false;
    mapViewScreen.style.display = 'none';
    
    // Make sure pointer is unlocked
    if (isPointerLocked) {
        controls.unlock();
        isPointerLocked = false;
    }
    
    // Clear any existing notifications
    while (notifications.length > 0) {
        const notification = notifications.pop();
        if (notification.element) {
            notification.element.remove();
        }
    }
    
    // Reset player ID
    playerId = null;
}

// Add back the event handlers that were accidentally removed
socket.on('dead', () => {
    // Ensure pointer is unlocked when player dies
    if (isPointerLocked) {
        controls.unlock();
        isPointerLocked = false;
    }
    
    // Make sure map view is closed if open
    if (isMapViewActive) {
        isMapViewActive = false;
        mapViewScreen.style.display = 'none';
        document.removeEventListener('keydown', handleMapViewKeydown);
    }
    
    gameOverScreen.style.display = 'flex';
    addNotification('Game Over! Click Play Again to restart.', 'warning', 5000);
});

socket.on('winner', () => {
    // Ensure pointer is unlocked when player wins
    if (isPointerLocked) {
        controls.unlock();
        isPointerLocked = false;
    }
    
    // Make sure map view is closed if open
    if (isMapViewActive) {
        isMapViewActive = false;
        mapViewScreen.style.display = 'none';
        document.removeEventListener('keydown', handleMapViewKeydown);
    }
    
    winnerScreen.style.display = 'flex';
    addNotification('Victory Royale! You won!', 'info', 5000);
});

socket.on('gameReset', () => {
    // Game has been reset
    addNotification('Game has been reset!', 'info');
});

// Initialize the game
init();

}); // Add the missing closing brace for waitForThree callback 
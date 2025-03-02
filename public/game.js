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
    mapSize: { width: 2000, height: 2000 }
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

// Initialize the game
function init() {
    // Show loading screen
    loadingScreen.style.display = 'flex';
    
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
    });
    
    winRestartButton.addEventListener('click', () => {
        winnerScreen.style.display = 'none';
        joinScreen.style.display = 'flex';
    });
    
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        // Log key events for debugging on Windows
        if (isWindowsOS) {
            console.log('KeyDown:', e.key, e.code, e.keyCode);
        }
        
        // Store both key and keyCode for maximum compatibility
        const key = e.key.toLowerCase();
        const code = e.code;
        const keyCode = e.keyCode;
        
        keys[key] = true;
        keyCodes[code] = true;
        
        // Also store numeric keyCodes for maximum compatibility
        if (keyCode) {
            keyCodes[keyCode] = true;
        }
        
        // Prevent scrolling with arrow keys and space
        if(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key) || 
           ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code) ||
           [32, 37, 38, 39, 40].includes(keyCode)) {
            e.preventDefault();
        }
        
        // Space bar for shooting
        if (key === ' ' || code === 'Space' || keyCode === 32) {
            shoot();
        }
    });
    
    window.addEventListener('keyup', (e) => {
        // Log key events for debugging on Windows
        if (isWindowsOS) {
            console.log('KeyUp:', e.key, e.code, e.keyCode);
        }
        
        const key = e.key.toLowerCase();
        const code = e.code;
        const keyCode = e.keyCode;
        
        keys[key] = false;
        keyCodes[code] = false;
        
        // Also clear numeric keyCodes
        if (keyCode) {
            keyCodes[keyCode] = false;
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
    
    // Game loop with timestamp for smoother animation
    lastUpdateTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Initialize Three.js
function initThreeJS() {
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
    controls = new THREE.PointerLockControls(camera, document.body);
    
    // Add event listener for pointer lock changes
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockState === 'locked';
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
        loadingProgress.style.width = `${progress}%`;
    };
    
    loadingManager.onLoad = () => {
        // Hide loading screen when all assets are loaded
        loadingScreen.style.display = 'none';
        joinScreen.style.display = 'flex';
    };
    
    // Load player model
    const gltfLoader = new THREE.GLTFLoader(loadingManager);
    
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
    controls.lock();
    
    // Listen for pointer lock events
    document.addEventListener('click', () => {
        if (!isPointerLocked) {
            controls.lock();
        }
    });
}

// Handle player movement
function handleMovement(deltaTime) {
    if (!playerId || !gameState.players[playerId] || !isPointerLocked) return;
    
    const player = gameState.players[playerId];
    const speed = 0.5 * (deltaTime / 16.67); // Normalize speed based on frame time
    let moveForward = 0;
    let moveRight = 0;
    
    // Multi-layered movement detection for maximum compatibility
    // First check keyCodes (most reliable for Windows)
    if (keyCodes['ArrowUp'] || keyCodes['KeyW'] || keyCodes[87] || keyCodes[38]) moveForward = 1;
    if (keyCodes['ArrowDown'] || keyCodes['KeyS'] || keyCodes[83] || keyCodes[40]) moveForward = -1;
    if (keyCodes['ArrowLeft'] || keyCodes['KeyA'] || keyCodes[65] || keyCodes[37]) moveRight = -1;
    if (keyCodes['ArrowRight'] || keyCodes['KeyD'] || keyCodes[68] || keyCodes[39]) moveRight = 1;
    
    // Then check keys as fallback
    if (moveForward === 0 && moveRight === 0) {
        if (keys['w'] || keys['arrowup']) moveForward = 1;
        if (keys['s'] || keys['arrowdown']) moveForward = -1;
        if (keys['a'] || keys['arrowleft']) moveRight = -1;
        if (keys['d'] || keys['arrowright']) moveRight = 1;
    }
    
    // Update debug info for Windows users
    if (isWindowsOS) {
        debugInfo.innerHTML = `
            Keys: ${JSON.stringify(keys)}<br>
            KeyCodes: ${JSON.stringify(keyCodes)}<br>
            Movement: forward=${moveForward}, right=${moveRight}<br>
            Position: x=${player.x.toFixed(0)}, z=${player.y.toFixed(0)}
        `;
    }
    
    // Calculate movement direction based on camera orientation
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0; // Keep movement on the XZ plane
    direction.normalize();
    
    // Calculate forward and right vectors
    const forward = direction.clone();
    const right = new THREE.Vector3();
    right.crossVectors(camera.up, forward).normalize();
    
    // Apply movement
    if (moveForward !== 0) {
        player.x += forward.x * moveForward * speed;
        player.y += forward.z * moveForward * speed; // Note: player.y is actually Z in 3D space
    }
    
    if (moveRight !== 0) {
        player.x += right.x * moveRight * speed;
        player.y += right.z * moveRight * speed;
    }
    
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
    
    // Send position to server (throttled to reduce network traffic)
    if (Math.abs(moveForward) > 0.01 || Math.abs(moveRight) > 0.01) {
        socket.emit('move', { x: player.x, y: player.y });
    }
    
    // Update camera position
    if (playerMeshes[playerId]) {
        const playerMesh = playerMeshes[playerId];
        playerMesh.position.set(player.x - mapCenter.x, playerMesh.position.y, player.y - mapCenter.y);
        camera.position.set(playerMesh.position.x, playerMesh.position.y + 3, playerMesh.position.z);
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
            
            // Draw direction indicator
            if (isPointerLocked) {
                const direction = new THREE.Vector3();
                camera.getWorldDirection(direction);
                
                const indicatorLength = 8;
                const endX = minimapX + direction.x * indicatorLength;
                const endY = minimapY + direction.z * indicatorLength;
                
                minimapCtx.moveTo(minimapX, minimapY);
                minimapCtx.lineTo(endX, endY);
                minimapCtx.strokeStyle = 'white';
                minimapCtx.lineWidth = 1;
                minimapCtx.stroke();
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
}

// Animate power-ups
function animatePowerUps(time) {
    powerUpMeshes.forEach(mesh => {
        const floatHeight = 0.5;
        const floatSpeed = 1.5;
        mesh.position.y = mesh.userData.originalY + Math.sin(time * 0.001 * floatSpeed + mesh.userData.animationOffset) * floatHeight;
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
    
    // Draw minimap
    drawMinimap();
    
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
    gameState = state;
});

socket.on('dead', () => {
    controls.unlock();
    gameOverScreen.style.display = 'flex';
});

socket.on('winner', () => {
    controls.unlock();
    winnerScreen.style.display = 'flex';
});

socket.on('gameReset', () => {
    // Game has been reset
});

// Initialize the game
init(); 
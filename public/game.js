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
    console.log('Game initialization started');
    
    try {
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
            if (e.button === 0) { // Left click, removed pointer lock requirement
                shoot();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', onWindowResize);
        
        // Game loop with timestamp for smoother animation
        lastUpdateTime = performance.now();
        requestAnimationFrame(gameLoop);
        
        console.log('Game initialization completed');
    } catch (error) {
        console.error('Error during game initialization:', error);
        alert('There was an error initializing the game. Please refresh the page or try a different browser.');
        
        // Force hide loading screen and show join screen as fallback
        loadingScreen.style.display = 'none';
        joinScreen.style.display = 'flex';
    }
}

// Initialize Three.js
function initThreeJS() {
    console.log('Initializing Three.js');
    
    // Check if THREE is defined
    if (typeof THREE === 'undefined') {
        console.error('THREE is not defined! Cannot initialize the game.');
        alert('Error loading Three.js. Please refresh the page or try a different browser.');
        return;
    }
    
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
    
    // Check if PointerLockControls is available
    if (typeof THREE.PointerLockControls === 'undefined') {
        console.error('PointerLockControls is not defined! Using fallback controls.');
        // Create a simple fallback for controls
        controls = {
            lock: function() { 
                console.log('Fallback lock called'); 
                isPointerLocked = true;
            },
            unlock: function() { 
                console.log('Fallback unlock called'); 
                isPointerLocked = false;
            }
        };
    } else {
        console.log('Creating PointerLockControls');
        // Create pointer lock controls
        controls = new THREE.PointerLockControls(camera, renderer.domElement);
        
        // Add event listener for pointer lock changes
        document.addEventListener('pointerlockchange', () => {
            isPointerLocked = document.pointerLockElement === renderer.domElement;
            console.log('Pointer lock state changed:', isPointerLocked);
        });
        
        // Add event listener for pointer lock errors
        document.addEventListener('pointerlockerror', (event) => {
            console.error('Pointer lock error:', event);
            alert('Could not lock pointer. Please try again or check browser permissions.');
        });
    }
    
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
    
    console.log('Three.js initialization complete');
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
    console.log('Starting asset loading process');
    
    try {
        // Track loading progress
        const loadingManager = new THREE.LoadingManager();
        loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal) * 100;
            loadingProgress.style.width = `${progress}%`;
            console.log(`Loading progress: ${progress.toFixed(0)}%`);
        };
        
        loadingManager.onLoad = () => {
            // Hide loading screen when all assets are loaded
            console.log('All assets loaded successfully');
            loadingScreen.style.display = 'none';
            joinScreen.style.display = 'flex';
        };
        
        loadingManager.onError = (url) => {
            console.error('Error loading asset:', url);
        };
        
        // Load player model
        // For now, we'll use a simple box as the player model
        const boxGeometry = new THREE.BoxGeometry(2, 4, 2);
        const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        playerModel = new THREE.Mesh(boxGeometry, boxMaterial);
        playerModel.castShadow = true;
        
        // Create a simple bullet model
        const bulletGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        bulletModel = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        console.log('Basic models created');
    } catch (error) {
        console.error('Error in asset loading:', error);
    }
    
    // Force completion after a timeout to ensure the game proceeds
    // This ensures the loading screen disappears even if there are issues
    setTimeout(() => {
        console.log('Forcing completion of asset loading process');
        loadingScreen.style.display = 'none';
        joinScreen.style.display = 'flex';
    }, 2000);
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
    
    console.log('Attempting to lock pointer');
    
    // Lock pointer for FPS controls
    controls.lock();
    
    // Listen for pointer lock events
    renderer.domElement.addEventListener('click', () => {
        if (!isPointerLocked) {
            console.log('Clicked on game, attempting to lock pointer');
            controls.lock();
        }
    });
}

// Handle player movement
function handleMovement(deltaTime) {
    if (!playerId || !gameState.players[playerId]) return;
    
    const player = gameState.players[playerId];
    const speed = 0.5 * (deltaTime / 16.67); // Normalize speed based on frame time
    let moveForward = 0;
    let moveBackward = 0;
    let moveLeft = 0;
    let moveRight = 0;
    
    // Multi-layered movement detection for maximum compatibility
    // First check keyCodes (most reliable for Windows)
    if (keyCodes['ArrowUp'] || keyCodes['KeyW'] || keyCodes[87] || keyCodes[38]) moveForward = 1;
    if (keyCodes['ArrowDown'] || keyCodes['KeyS'] || keyCodes[83] || keyCodes[40]) moveBackward = 1;
    if (keyCodes['ArrowLeft'] || keyCodes['KeyA'] || keyCodes[65] || keyCodes[37]) moveLeft = 1;
    if (keyCodes['ArrowRight'] || keyCodes['KeyD'] || keyCodes[68] || keyCodes[39]) moveRight = 1;
    
    // Then check keys as fallback (more reliable for Mac OS)
    if (moveForward === 0 && moveBackward === 0 && moveLeft === 0 && moveRight === 0) {
        if (keys['w'] || keys['arrowup'] || keys['W'] || keys['ArrowUp']) moveForward = 1;
        if (keys['s'] || keys['arrowdown'] || keys['S'] || keys['ArrowDown']) moveBackward = 1;
        if (keys['a'] || keys['arrowleft'] || keys['A'] || keys['ArrowLeft']) moveLeft = 1;
        if (keys['d'] || keys['arrowright'] || keys['D'] || keys['ArrowRight']) moveRight = 1;
    }
    
    // Only process movement if keys are pressed
    if (moveForward === 0 && moveBackward === 0 && moveLeft === 0 && moveRight === 0) return;
    
    // Get current camera direction for reference
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep movement on the XZ plane
    cameraDirection.normalize();
    
    // Calculate forward and right vectors based on camera orientation
    const forward = cameraDirection.clone();
    
    // Calculate right vector correctly (camera's right)
    const right = new THREE.Vector3();
    right.crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
    
    // Calculate movement direction based on key inputs
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    // Add movement components based on key presses
    if (moveForward) {
        moveDirection.add(forward);
    }
    if (moveBackward) {
        moveDirection.add(forward.clone().negate());
    }
    if (moveRight) {
        moveDirection.add(right);
    }
    if (moveLeft) {
        moveDirection.add(right.clone().negate());
    }
    
    // Normalize the movement direction if moving diagonally
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
    }
    
    // Apply movement
    player.x += moveDirection.x * speed;
    player.y += moveDirection.z * speed; // Note: player.y is actually Z in 3D space
    
    // Keep player within the map bounds
    const distanceFromCenter = Math.sqrt(
        Math.pow(player.x - gameState.mapSize.width / 2, 2) + 
        Math.pow(player.y - gameState.mapSize.height / 2, 2)
    );
    
    if (distanceFromCenter > gameState.mapRadius) {
        const angle = Math.atan2(player.y - gameState.mapSize.height / 2, player.x - gameState.mapSize.width / 2);
        player.x = gameState.mapSize.width / 2 + Math.cos(angle) * gameState.mapRadius;
        player.y = gameState.mapSize.height / 2 + Math.sin(angle) * gameState.mapRadius;
    }
    
    // Send position to server (throttled to reduce network traffic)
    if (moveDirection.length() > 0.01) {
        socket.emit('move', { x: player.x, y: player.y });
    }
    
    // Update camera position based on player position
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
    if (!playerId || !gameState.players[playerId]) return;
    
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
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Draw border
    minimapCtx.strokeStyle = '#3498db';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
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
            // Get player mesh to determine facing direction
            const playerMesh = playerMeshes[playerId];
            if (playerMesh) {
                // Use player mesh rotation for direction
                const angle = playerMesh.rotation.y;
                
                // Draw a triangle pointing in the direction of movement
                const triangleSize = 6;
                
                // In Three.js, rotation.y represents rotation around the Y axis
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
    
    // Show player position
    if (playerId && gameState.players[playerId]) {
        const player = gameState.players[playerId];
        minimapCtx.font = '8px Arial';
        minimapCtx.fillStyle = 'white';
        minimapCtx.textAlign = 'left';
        minimapCtx.fillText(`X: ${Math.floor(player.x)}, Y: ${Math.floor(player.y)}`, 5, minimapCanvas.height - 5);
    }
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
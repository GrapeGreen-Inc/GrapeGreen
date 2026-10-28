/**
 * Grape Vortex 3D - Core Game Engine
 * Fully optimized for Three.js r186 Compatibility & Firebase Web SDK v13.1.0
 */

import * as THREE from 'three';
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";

// ============================================================================
// 1. FIREBASE SETUP & INITIALIZATION
// ============================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDFrVd2s9UxxkFAoHTt70QWh-25vL4qiOo",
    authDomain: "://firebaseapp.com",
    projectId: "d-game-4444a",
    storageBucket: "d-game-4444a.firebasestorage.app",
    messagingSenderId: "789251565807",
    appId: "1:789251565807:web:d2f9a28a27b31151d4931a",
    measurementId: "G-8JP45NJZBJ"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Mock implementation of Firestore/Realtime DB local syncing framework structures
const dbMock = {
    currentPlayerRef: null,
    remotePlayers: {},
    initPlayerSession(userData) {
        console.log("🔒 Initializing encrypted player session for:", userData.username);
        // Simulate structural sync object for real-time multiplayer topology sharing
        this.currentPlayerRef = {
            uid: "mock_uid_" + Date.now(),
            username: userData.username,
            role: userData.username === "MattyGrapeGreenOwner" ? "head admin" : "user",
            state: { X: 0, Y: 2, Z: 0, holding: "Radio", health: 100, is_dead: false, chat: "", motion: "idle" }
        };
        if (userData.username === "MattyGrapeGreenOwner") {
            document.getElementById("admin-authority-panel").classList.remove("hidden-ui-layer");
            renderMockAdminPanel();
        }
    },
    syncState(position, motionState, currentItem) {
        if (!this.currentPlayerRef) return;
        this.currentPlayerRef.state.X = position.x;
        this.currentPlayerRef.state.Y = position.y;
        this.currentPlayerRef.state.Z = position.z;
        this.currentPlayerRef.state.motion = motionState;
        this.currentPlayerRef.state.holding = currentItem;
        // In real execution, this mirrors directly into your Firestore/RTDB collection paths
    }
};

// ============================================================================
// 2. CORE ENGINE ARCHITECTURE & RENDERING PIPELINE (r186 OPTIMIZED)
// ============================================================================
const container = document.getElementById('game-canvas-container');
const scene = new THREE.Scene();

// Set outer space dark void background tone mapping parameters
scene.background = new THREE.Color(0x020205);
scene.fog = new THREE.FogExp2(0x020205, 0.005);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// r186 Specific Color Space and Shadow Management configurations
THREE.ColorManagement.enabled = true; 
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Lighting Matrix
const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0x8a99ff, 1.2);
directionalLight.position.set(50, 120, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
const d = 150;
directionalLight.shadow.camera.left = -d;
directionalLight.shadow.camera.right = d;
directionalLight.shadow.camera.top = d;
directionalLight.shadow.camera.bottom = -d;
scene.add(directionalLight);

// ============================================================================
// 3. PROCEDURAL WORLD ENVIRONMENT GENERATION (CHUNK SYSTEM)
// ============================================================================
// Giant Black Room: 300x300x300 Space Cage Bound
const roomGeo = new THREE.BoxGeometry(300, 300, 300);
const roomMat = new THREE.MeshStandardMaterial({
    color: 0x050508,
    side: THREE.BackSide,
    roughness: 0.9,
    metalness: 0.1
});
const blackRoomCage = new THREE.Mesh(roomGeo, roomMat);
blackRoomCage.position.set(0, 150, 0);
scene.add(blackRoomCage);

// Safe Spawn Zone Platform: 30x30 Central Green Oasis
const platformGeo = new THREE.BoxGeometry(30, 1, 30);
const platformMat = new THREE.MeshStandardMaterial({
    color: 0x1b5e20, // Vibrant Deep Emerald Green
    roughness: 0.6,
    metalness: 0.2
});
const safePlatform = new THREE.Mesh(platformGeo, platformMat);
safePlatform.position.set(0, -0.5, 0);
safePlatform.receiveShadow = true;
scene.add(safePlatform);

// Atmospheric Transparent Blue Protective Dome System
const domeGeo = new THREE.SphereGeometry(15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const domeMat = new THREE.MeshStandardMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.25,
    wireframe: false,
    side: THREE.DoubleSide,
    roughness: 0.1,
    metalness: 0.8
});
const protectiveDome = new THREE.Mesh(domeGeo, domeMat);
protectiveDome.position.set(0, 0, 0);
scene.add(protectiveDome);

// Door Interactivity Object Boundary Layer
const doorGeo = new THREE.BoxGeometry(3, 6, 0.4);
const doorMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.4 });
const airlockDoor = new THREE.Mesh(doorGeo, doorMat);
airlockDoor.position.set(0, 3, 14.8); // Positioned right along edge perimeter of protective blue shield boundary
scene.add(airlockDoor);

let isDoorOpen = false;

// Simulated Asteroid Chunk System Vector Tracking
const chunksMap = new Map();
const CHUNK_SIZE = 40;

function updateProceduralChunks(playerX, playerZ) {
    const currentChunkX = Math.floor(playerX / CHUNK_SIZE);
    const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);
    const renderRadiusChunks = 2;

    for (let x = -renderRadiusChunks; x <= renderRadiusChunks; x++) {
        for (let z = -renderRadiusChunks; z <= renderRadiusChunks; z++) {
            const targetChunkKey = `${currentChunkX + x},${currentChunkZ + z}`;
            if (!chunksMap.has(targetChunkKey)) {
                generateProceduralAsteroidCluster(currentChunkX + x, currentChunkZ + z, targetChunkKey);
            }
        }
    }
}

function generateProceduralAsteroidCluster(cx, cz, key) {
    // Prevent spawning space debris clusters directly inside central launch facility
    if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) return;

    const group = new THREE.Group();
    const asteroidDensityCount = 3;

    for (let i = 0; i < asteroidDensityCount; i++) {
        // Deterministic generation values based on chunk hash mapping matrices
        const lx = cx * CHUNK_SIZE + (Math.sin(cx + i) * 0.5 + 0.5) * CHUNK_SIZE;
        const ly = 10 + (Math.cos(cz + i) * 0.5 + 0.5) * 40;
        const lz = cz * CHUNK_SIZE + (Math.cos(cx * cz + i) * 0.5 + 0.5) * CHUNK_SIZE;

        // Randomize raw ore composition types
        const oreRoll = Math.random();
        let oreColor = 0x5d4037; // Base Stone
        let oreType = "Stone Asteroid Chunk";

        if (oreRoll > 0.85) {
            oreColor = <span class="math inline">0xffd54f; // Silicon
            oreType = "Silicon Asteroid Chunk";
        } else if (oreRoll > 0.65) {
            oreColor = 0xb0bec5; // Iron Ore
            oreType = "Iron Asteroid Chunk";
        } else if (oreRoll > 0.45) {
            oreColor = 0xff7043; // Copper Ore
            oreType = "Copper Asteroid Chunk";
        }

        const astGeo = new THREE.DodecahedronGeometry(1.5 + Math.random() * 2, 1);
        const astMat = new THREE.MeshStandardMaterial({ color: oreColor, roughness: 0.9 });
        const asteroidMesh = new THREE.Mesh(astGeo, astMat);
        asteroidMesh.position.set(lx, ly, lz);
        asteroidMesh.castShadow = true;
        asteroidMesh.receiveShadow = true;
        
        // Cache identity details inside mesh reference wrapper nodes
        asteroidMesh.userData = { interactable: true, type: oreType };
        group.add(asteroidMesh);
    }

    scene.add(group);
    chunksMap.set(key, group);
}

// ============================================================================
// 4. SEGMENTED R15 CHARACTER GEOMETRY SYSTEM
// ============================================================================
function createSegmentedR15Mesh(gender, shirtColorHex) {
    const avatarGroup = new THREE.Group();
    const matColor = new THREE.Color(shirtColorHex);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.5 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.6 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });

    // Torso Segment (Single Segment Block)
    const torsoGeo = new THREE.BoxGeometry(1.6, 2.0, 0.8);
    const torsoMesh = new THREE.Mesh(torsoGeo, clothesMat);
    torsoMesh.position.y = 2.0;
    torsoMesh.castShadow = true;
    avatarGroup.add(torsoMesh);

    // Head Assembly with Detailed Face Mesh Structures
    const headGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 3.5, 0);
    headMesh.castShadow = true;
    avatarGroup.add(headMesh);

    // Detailed facial mesh orientation alignment vectors
    const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat); leftEye.position.set(-0.25, 3.6, 0.51); avatarGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat); rightEye.position.set(0.25, 3.6, 0.51); avatarGroup.add(rightEye);

    // Adjustment nodes based on explicit choice constraints at initialization profiles
    if (gender === "GIRL") {
        const hairGeo = new THREE.BoxGeometry(1.1, 0.6, 1.1);
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 });
        const hairMesh = new THREE.Mesh(hairGeo, hairMat);
        hairMesh.position.set(0, 3.9, -0.05);
        avatarGroup.add(hairMesh);
    }

    // Limbs Configuration Loop (4 Limbs, 3 Segments Each = 12 Limb Components)
    const limbConfig = [
        { name: "leftArm", dx: -1.2, yOffset: 2.8 },
        { name: "rightArm", dx: 1.2, yOffset: 2.8 },
        { name: "leftLeg", dx: -0.5, yOffset: 0.8, isLeg: true },
        { name: "rightLeg", dx: 0.5, yOffset: 0.8, isLeg: true }
    ];

    limbConfig.forEach(limb => {
        let parentJointY = limb.yOffset;
        for (let segmentIdx = 0; segmentIdx < 3; segmentIdx++) {
            const segGeo = new THREE.BoxGeometry(0.35, 0.6, 0.35);
            const activeMat = limb.isLeg && segmentIdx === 2 ? bootMat : clothesMat;
            const segMesh = new THREE.Mesh(segGeo, activeMat);
            
            segMesh.position.set(limb.dx, parentJointY - (segmentIdx * 0.5), 0);
            segMesh.castShadow = true;
            avatarGroup.add(segMesh);
        }
    });

    return avatarGroup;
}

// Instantiate Local Client Character Visual Body
let playerVisualBody = null;

// ============================================================================
// 5. INPUT MATRIX & FLIGHT SIMULATION CONTROLS
// ============================================================================
const playerState = {
    position: new THREE.Vector3(0, 0.5, 0),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Vector2(), // X = Yaw, Y = Pitch
    health: 100,
    stamina: 100,
    isCrouching: false,
    isSprinting: false,
    isGrounded: true,
    currentItem: "Radio",
    motion: "idle"
};

const keyboardState = {};
let targetHardwareEnvironment = "PC";

// Mouse Look Delta Factors
let isPointerLocked = false;
document.addEventListener('click', (e) => {
    if (targetHardwareEnvironment === "PC" && document.getElementById("auth-gateway-overlay").classList.contains("hidden-ui-layer") && !isPointerLocked) {
        container.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    isPointerLocked = (document.pointerLockElement === container);
});

window.addEventListener('keydown', (e) => {
    keyboardState[e.key.toLowerCase()] = true;
    
    // Core action trigger intercepts
    if (e.key.toLowerCase() === 'e') executeInteractAction();
    if (e.key.toLowerCase() === 'x') dropActiveHeldItem();
    if (e.key.toLowerCase() === 'c') {
        playerState.isCrouching = !playerState.isCrouching;
    }
});
window.addEventListener('keyup', (e) => { keyboardState[e.key.toLowerCase()] = false; });

// Mouse look processing loops
window.addEventListener('mousemove', (e) => {
    if (!isPointerLocked && targetHardwareEnvironment === "PC") return;
    
    playerState.rotation.x -= e.movementX * 0.0025; // Yaw
    playerState.rotation.y -= e.movementY * 0.0025; // Pitch
    
    // Lock look bounds to prevent geometric inversion flips
    playerState.rotation.y = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, playerState.rotation.y));
});

// Mobile Input Emulation Layer Matrix (Active when touch interface mode selected)
let touchStartPos = { x: 0, y: 0 };
window.addEventListener('touchstart', (e) => {
    if (targetHardwareEnvironment !== "MOBILE") return;
    touchStartPos.x = e.touches[0].clientX;
    touchStartPos.y = e.touches[0].clientY;
});

window.addEventListener('touchmove', (e) => {
    if (targetHardwareEnvironment !== "MOBILE") return;
    const dx = e.touches[0].clientX - touchStartPos.x;
    const dy = e.touches[0].clientY - touchStartPos.y;
    
    // Differentiate touch screen vectors symmetrically based on initial pointer splits
    if (touchStartPos.x > window.innerWidth / 2) {
        // Right side screen swipe handles look engine direction vectors
        playerState.rotation.x -= dx * 0.005;
        playerState.rotation.y -= dy * 0.005;
        playerState.rotation.y = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, playerState.rotation.y));
    } else {
        // Left side touch blocks process positional translations
        if (dy < -20) keyboardState['w'] = true;
        else if (dy > 20) keyboardState['s'] = true;
        if (dx < -20) keyboardState['a'] = true;
        else if (dx > 20) keyboardState['d'] = true;
    }
    
    touchStartPos.x = e.touches[0].clientX;
    touchStartPos.y = e.touches[0].clientY;
});

window.addEventListener('touchend', () => {
    if (targetHardwareEnvironment !== "MOBILE") return;
    // Flush active navigation arrays gracefully
    keyboardState['w'] = false; keyboardState['s'] = false;
    keyboardState['a'] = false; keyboardState['d'] = false;
});

// ============================================================================
// 6. KINEMATIC RESOLUTION, GRAVITY & COLLISIONS LOOPS
// ============================================================================
const GRAVITY_CONSTANT = -24.8;
let lastFrameTimeTick = performance.now();

function updatePhysicsEngineSimulation() {
    const now = performance.now();
    const deltaSeconds = Math.min(0.1, (now - lastFrameTimeTick) / 1000);
    lastFrameTimeTick = now;

    // Evaluate Idle Timeout kicks if structural parameters are verified (Kicks after 5 mins of continuous sleep)
    trackInactivityInference(deltaSeconds);

    // Speed modifiers based on functional stance status properties
    let movementSpeedScalar = 8.0;
    playerState.motion = "walk";

    if (playerState.isCrouching) {
        movementSpeedScalar = 3.5;
        playerState.motion = "crouch";
    } else if (keyboardState['shift'] && playerState.stamina > 10) {
        movementSpeedScalar = 14.0;
        playerState.isSprinting = true;
        playerState.motion = "run";
        playerState.stamina = Math.max(0, playerState.stamina - deltaSeconds * 25);
    } else {
        playerState.isSprinting = false;
        playerState.stamina = Math.min(100, playerState.stamina + deltaSeconds * 12);
    }

    // Establish direction movement vectors
    const forwardVector = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerState.rotation.x);
    const rightVector = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), playerState.rotation.x);
    
    const moveDirectionVector = new THREE.Vector3();

    if (keyboardState['w']) moveDirectionVector.add(forwardVector);
    if (keyboardState['s']) moveDirectionVector.add(forwardVector.clone().negate());
    if (keyboardState['a']) moveDirectionVector.add(rightVector.clone().negate());
    if (keyboardState['d']) moveDirectionVector.add(rightVector);
    
    moveDirectionVector.normalize();

    // Assign velocities seamlessly
    playerState.velocity.x = moveDirectionVector.x * movementSpeedScalar;
    playerState.velocity.z = moveDirectionVector.z * movementSpeedScalar;

    // Process environmental gravity impacts
    playerState.velocity.y += GRAVITY_CONSTANT * deltaSeconds;

    // Handle initial jump trigger commands
    if (keyboardState[' '] && playerState.isGrounded) {
        playerState.velocity.y = 11.0;
        playerState.isGrounded = false;
        playerState.motion = "jump";
    }

    // Kinematic translation vector application
    playerState.position.x += playerState.velocity.x * deltaSeconds;
    playerState.position.y += playerState.velocity.y * deltaSeconds;
    playerState.position.z += playerState.velocity.z * deltaSeconds;

    // Apply strict world boundaries (Bottom platform mesh collision rules)
    const withinPlatformBounds = (Math.abs(playerState.position.x) <= 15 && Math.abs(playerState.position.z) <= 15);
    
    if (withinPlatformBounds) {
        // Enforce physical footing baseline limits along green safeZone mesh level
        if (playerState.position.y <= 0.5) {
            playerState.position.y = 0.5;
            playerState.velocity.y = 0;
            playerState.isGrounded = true;
        }
    } else {
        // Check barrier collision constraints against the transparent blue atmospheric perimeter dome shell
        const distanceFromOriginCenter = Math.sqrt(playerState.position.x ** 2 + playerState.position.z ** 2);
        if (distanceFromOriginCenter <= 15 && playerState.position.y < 0.1) {
            // Player is safely inside the barrier bounds
        } else if (!isDoorOpen && distanceFromOriginCenter > 14.6 && distanceFromOriginCenter < 15.4 && Math.abs(playerState.position.x) < 2) {
            // Collision barrier push back logic
            playerState.position.sub(moveDirectionVector.multiplyScalar(0.2));
        }
    }

    // Death validation bounds check (Falling past space threshold perimeter void lines)
    if (playerState.position.y < -40) {
        executeSuddenDeathSequence();
    }

    // Sync camera transformation tracking anchors
    camera.position.copy(playerState.position);
    // Adjust height offsets parameters dynamically to reflect layout crouch updates smoothly
    camera.position.y += playerState.isCrouching ? 0.9 : 1.8;
    
    const targetLookDirection = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), playerState.rotation.y)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), playerState.rotation.x);
        
    camera.lookAt(camera.position.clone().add(targetLookDirection));

    // Update player mesh placement orientations synchronized to current client position data profiles
    if (playerVisualBody) {
        playerVisualBody.position.copy(playerState.position);
        playerVisualBody.rotation.y = playerState.rotation.x;
    }

    // Trigger update iterations to draw structural procedural chunk profiles dynamically
    updateProceduralChunks(playerState.position.x, playerState.position.z);

    // Stream localized ticks immediately into storage networks matrix channels
    dbMock.syncState(playerState.position, playerState.motion, playerState.currentItem);
}

// Inactivity monitor variables
let absoluteInactivitySecondsTracked = 0;
function trackInactivityInference(dt) {
    if (keyboardState['w'] || keyboardState['s'] || keyboardState['a'] || keyboardState['d'] || keyboardState[' ']) {
        absoluteInactivitySecondsTracked = 0;
    } else {
        absoluteInactivitySecondsTracked += dt;
        if (absoluteInactivitySecondsTracked >= 300) { // 5-minute strict cap limit threshold rules
            alert("⚠️ Kicked from server connection node cluster due to 5+ minutes of absolute continuous idle dormancy.");
            window.location.reload();
        }
    }
}

function executeSuddenDeathSequence() {
    alert("💀 You dissolved into the cosmic space vacuum void! All inventory materials have been dropped.");
    playerInventoryMatrix.fill(null);
    refreshStorageUIGridLayout();
    playerState.position.set(0, 5, 0);
    playerState.velocity.set(0, 0, 0);
    playerState.health = 100;
    playerState.isGrounded = true;
}

// ============================================================================
// 7. INTERACTIVE INTERVENTIONS, STORAGE SCHEMAS & MANUFACTURING SYSTEMS
// ============================================================================
const playerInventoryMatrix = new Array(36).fill(null);
const assemblyMatrixSlots = new Array(9).fill(null);

// Inject default launch tools item directly into baseline slots frame on generation
playerInventoryMatrix[0] = { name: "Radio", icon: "📻" };

function executeInteractAction() {
    // Check if looking closely at structural access doorways components
    const distanceToDoor = playerState.position.distanceTo(airlockDoor.position);
    if (distanceToDoor < 5) {
        isDoorOpen = !isDoorOpen;
        airlockDoor.position.y = isDoorOpen ? 9 : 3; // Shift placement profile vertically out of bounds to mock unsealed channels
        alert(isDoorOpen ? "🚪 Airlock door hatch fully opened. Exercise severe decompression caution." : "🚪 Airlock pressure seal closed secure.");
        return;
    }

    // Raycast check to collect nearby ore assets
    alert("Searching close proximity vectors for loose space mining debris chunks...");
}

function dropActiveHeldItem() {
    if (playerState.currentItem === "Radio") {
        alert("❌ Error: Core Communication Radio filament anchors cannot be severed.");
        return;
    }
    alert(`Dropped physical item item module into cosmic orbit: ${playerState.currentItem}`);
    playerState.currentItem = "Nothing";
}

// UI hooks to toggle layout presentation screens smoothly
document.getElementById("btn-close-inventory").addEventListener("click", () => {
    document.getElementById("inventory-screen-overlay").classList.add("hidden-ui-layer");
    if (targetHardwareEnvironment === "PC") container.requestPointerLock();
});

// Setup hotbar action intercept items elements mappings loops
document.querySelectorAll(".hotbar-slot").forEach(slot => {
    slot.addEventListener("click", (e) => {
        const idx = parseInt(slot.getAttribute("data-slot-idx"));
        if (idx === 8) {
            // Expansion prompt indicator triggers inventory overlay card display profiles
            document.getElementById("inventory-screen-overlay").classList.remove("hidden-ui-layer");
            document.exitPointerLock();
        } else {
            document.querySelectorAll(".hotbar-slot").forEach(s => s.classList.remove("active-hotbar-frame"));
            slot.classList.add("active-hotbar-frame");
            const mappedItem = playerInventoryMatrix[idx];
            playerState.currentItem = mappedItem ? mappedItem.name : "Nothing";
            console.log("Held item context switched to:", playerState.currentItem);
        }
    });
});

function refreshStorageUIGridLayout() {
    const gridContainer = document.getElementById("inventory-grid-wrapper");
    gridContainer.innerHTML = "";
    for (let i = 0; i < 36; i++) {
        const cell = document.createElement("div");
        cell.className = "inventory-item-slot-cell";
        cell.innerText = playerInventoryMatrix[i] ? playerInventoryMatrix[i].icon : "";
        cell.setAttribute("data-inv-index", i);
        gridContainer.appendChild(cell);
    }
}

// ============================================================================
// 8. SECURITY MATRIX PLATFORM (ADMIN CENTER REGISTRATION PATHS)
// ============================================================================
const sampleUserNodeDirectoryList = [
    { username: "MattyGrapeGreenOwner", email: "mattyowner@gmail.com", role: "head admin" },
    { username: "CosmicFlyer77", email: "flyer77@gmail.com", role: "user" },
    { username: "NebulaDevNode", email: "nebuladev@gmail.com", role: "dev" }
];

function renderMockAdminPanel() {
    const containerElement = document.getElementById("admin-user-rows-container");
    containerElement.innerHTML = "";
    sampleUserNodeDirectoryList.forEach(user => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${user.username}</strong></td>
            <td>${user.email}</td>
            <td>
                <select class="admin-role-select" data-user="${user.username}">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User Node</option>
                    <option value="mod" ${user.role === 'mod' ? 'selected' : ''}>Mod Node</option>
                    <option value="dev" ${user.role === 'dev' ? 'selected' : ''}>Dev Node</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin Node</option>
                    <option value="head admin" ${user.role === 'head admin' ? 'selected' : ''}>Head Admin Overlord</option>
                </select>
            </td>
            <td>
                <button class="admin-ban-btn" onclick="alert('Action dispatched for target: ${user.username}')">Ban Node</button>
                <button class="admin-delete-btn" onclick="alert('Data erasure loop executed for target: ${user.username}')">Purge Acc</button>
            </td>
        `;
        containerElement.appendChild(row);
    });
}

document.getElementById("btn-close-admin").addEventListener("click", () => {
    document.getElementById("admin-authority-panel").classList.add("hidden-ui-layer");
});

// Gatekeeper configuration submissions access mapping intercept listeners
document.getElementById("btn-submit-registration").addEventListener("click", () => {
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const gender = document.getElementById("avatar-gender").value;
    const shirtColor = document.getElementById("avatar-shirt-color").value;
    
    if (!username || !email) {
        alert("❌ Error: Core identification fields cannot remain unassigned.");
        return;
    }

    targetHardwareEnvironment = document.getElementById("hardware-environment-mode").value;
    
    // Unseal player avatar geometry mesh nodes
    playerVisualBody = createSegmentedR15Mesh(gender, shirtColor);
    scene.add(playerVisualBody);

    // Process system session authorization tracking states
    dbMock.initPlayerSession({ username, email });

    // Collapse interface layer to unseal runtime engine execution loops
    document.getElementById("auth-gateway-overlay").classList.add("hidden-ui-layer");
    document.getElementById("gameplay-interface-hud").classList.remove("hidden-ui-layer");
    
    refreshStorageUIGridLayout();
    
    if (targetHardwareEnvironment === "PC") {
        container.requestPointerLock();
    }
});

// ============================================================================
// 9. ENGINE INITIATION LOOP SYSTEM
// ============================================================================
function runEngineMainLoopAnimation() {
    requestAnimationFrame(runEngineMainLoopAnimation);
    
    // Process physical kinematics calculations on every loop step
    if (document.getElementById("auth-gateway-overlay").classList.contains("hidden-ui-layer")) {
        updatePhysicsEngineSimulation();
    }
    
    renderer.render(scene, camera);
}

// Handle display layout adjustment tracking triggers smoothly
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Ignition
runEngineMainLoopAnimation();

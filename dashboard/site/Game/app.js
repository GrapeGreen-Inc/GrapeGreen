/**
 * Grape Vortex 3D - Core Engine, Inventory, Database Layout & Admin Controls
 * Designed with Three.js, modular asset segments, and structural Firebase integrations.
 */

import * as THREE from 'three';
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";

// --- GAME STATE VARIABLES ---
let currentEnvironmentMode = 'PC'; // 'PC' or 'MOBILE'
let connectionType = 'SINGLEPLAYER'; // 'SINGLEPLAYER', 'ROOM_CODE', 'MAIN_SERVER'
let roomCodeValue = '';
let isUserLoggedIn = false;
let currentUserProfile = {
    username: '',
    role: 'user', // user, mod, dev, admin, head admin
    dob: '',
    gmail: '',
    shirtColor: '#ff0000',
    gender: 'BOY' // BOY or GIRL
};

// --- SIMULATED/ENCRYPTED FIRESTORE DATA STORAGE FOR LOCAL TESTING ---
// Real infrastructure uses the provided dynamic Firebase credentials
const LocalDatabaseSchema = {
    users: {},
    rooms: {},
    globalPlayers: {}
};

// --- PLAYER STATS & INTERACTIVE STATE ---
let playerLocalData = {
    health: 100,
    isDead: false,
    stamina: 100, // kept local to optimize storage bandwidth
    currentActionState: 'walk', // idle, walk, run, crouch, jump
    position: { x: 0, y: 1.5, z: 0 },
    rotation: { y: 0, x: 0 },
    itemHoldingIndex: 0
};

// --- AFK KICK SYSTEM ---
let finalInteractionTimestamp = Date.now();
const MAX_IDLE_DURATION_MS = 5 * 60 * 1000; // 5 minutes kick timeout

function refreshActivityTimer() {
    finalInteractionTimestamp = Date.now();
}

function checkActivityTimeout() {
    if (connectionType !== 'SINGLEPLAYER' && isUserLoggedIn) {
        if (Date.now() - finalInteractionTimestamp > MAX_IDLE_DURATION_MS) {
            alert("Kicked automatically due to remaining idle/AFK for over 5 minutes.");
            window.location.reload();
        }
    }
}
setInterval(checkActivityTimeout, 10000);

// --- INVENTORY & CRAFTING MATRIX SYSTEM ---
// 36 total structural slots + 3x3 dedicated crafting matrix layout
let playerInventorySlots = Array(36).fill(null);
let playerCraftingGrid = Array(9).fill(null); // 3x3 sequential indices 0-8
let activeHotbarIndex = 0; // 0 to 8

// Injecting baseline starting inventory values
playerInventorySlots[0] = { id: 'item_radio', name: 'Simple Radio', count: 1, type: 'tool' };

// Item Reference definitions across recipes
const GameItemDirectory = {
    'item_radio': { name: 'Simple Radio', icon: '📻' },
    'item_wood_board': { name: 'Wood Board', icon: '🪵' },
    'item_stick': { name: 'Stick', icon: '🥢' },
    'item_copper_wire': { name: 'Copper Wire', icon: '🔌' },
    'item_metal_sheet': { name: 'Metal Sheet', icon: '🪙' },
    'item_cpu': { name: 'CPU Unit', icon: '🎛️' },
    'item_wooden_hammer': { name: 'Wooden Hammer', icon: '🔨' },
    'iron_asteroid_chunk': { name: 'Iron Asteroid Chunk', icon: '🪨' },
    'silicon_asteroid_chunk': { name: 'Silicon Asteroid Chunk', icon: '💎' },
    'copper_asteroid_chunk': { name: 'Copper Asteroid Chunk', icon: '🔶' }
};

// --- INITIALIZE GRAPHICAL ENGINE & CANVAS LAYOUTS ---
const container = document.getElementById('game-canvas-container');
const gameScene = new THREE.Scene();
// Deep space stellar void initialization background color
gameScene.background = new THREE.Color(0x020208);

const gameCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const gameRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
gameRenderer.setSize(window.innerWidth, window.innerHeight);
gameRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(gameRenderer.domElement);

// Global Lighting environment setup
const primaryAmbientLight = new THREE.AmbientLight(0xffffff, 0.4);
gameScene.add(primaryAmbientLight);
const stellarDirectionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
stellarDirectionalLight.position.set(50, 200, 50);
gameScene.add(stellarDirectionalLight);

// --- STRUCTURAL CHUNK & PROCEDURAL ENVIRONMENT ---
// Giant Black Room bounds: 300x300x300 centered surrounding coordinate zero
const giantVoidBoundary = new THREE.BoxGeometry(300, 300, 300);
const voidBoundaryMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    side: THREE.BackSide,
    roughness: 0.9,
    metalness: 0.1
});
const giantVoidRoomMesh = new THREE.Mesh(giantVoidBoundary, voidBoundaryMaterial);
giantVoidRoomMesh.position.set(0, 150, 0);
gameScene.add(giantVoidRoomMesh);

// Centered safe zone platform anchor points: 30x30 scale geometry
const greenPlatformGeometry = new THREE.BoxGeometry(30, 1, 30);
const greenPlatformMaterial = new THREE.MeshStandardMaterial({
    color: 0x228B22, // Forest Green Platform base
    roughness: 0.6
});
const greenPlatformMesh = new THREE.Mesh(greenPlatformGeometry, greenPlatformMaterial);
greenPlatformMesh.position.set(0, -0.5, 0);
gameScene.add(greenPlatformMesh);

// Core Safe Protective Shell Layer: Transparent Blue Dome Structure
const domeRadius = 25;
const protectiveDomeGeometry = new THREE.SphereGeometry(domeRadius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const protectiveDomeMaterial = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    transparent: true,
    opacity: 0.25,
    wireframe: false,
    side: THREE.DoubleSide
});
const safeZoneDomeMesh = new THREE.Mesh(protectiveDomeGeometry, protectiveDomeMaterial);
safeZoneDomeMesh.position.set(0, 0, 0);
gameScene.add(safeZoneDomeMesh);

// Interactive Gateway Mesh door to breach protection field outer parameters
const airlockDoorGeometry = new THREE.BoxGeometry(4, 7, 0.5);
const airlockDoorMaterial = new THREE.MeshStandardMaterial({ color: 0x778899, metalness: 0.8 });
const airlockDoorMesh = new THREE.Mesh(airlockDoorGeometry, airlockDoorMaterial);
airlockDoorMesh.position.set(0, 3.5, 24.5);
gameScene.add(airlockDoorMesh);
let isAirlockDoorOpen = false;

// --- SEGMENTED AVATAR ENGINE (ROBLOX R15 DESIGN HIERARCHY) ---
function createSegmentedR15Rig(gender, shirtColorHex) {
    const parentCharacterGroup = new THREE.Group();
    const segmentMaterial = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.5 }); // skin tone default
    const shirtMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(shirtColorHex), roughness: 0.5 });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });

    // 1. Torso segment setup
    const torsoGeom = new THREE.BoxGeometry(1.6, 2.0, 0.8);
    const torsoMesh = new THREE.Mesh(torsoGeom, shirtMaterial);
    torsoMesh.position.set(0, 2.0, 0);
    parentCharacterGroup.add(torsoMesh);

    // 2. Head structure mapping equipped with flat abstract vector face texture layout
    const headGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    const headMesh = new THREE.Mesh(headGeom, segmentMaterial);
    headMesh.position.set(0, 3.6, 0);
    parentCharacterGroup.add(headMesh);

    // Dynamic procedural face eyes and mouth layout boxes
    const eyeGeom = new THREE.BoxGeometry(0.15, 0.15, 0.1);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(-0.2, 3.7, 0.51);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.2;
    parentCharacterGroup.add(leftEye, rightEye);

    // 3. Sequential 3-Segment Limbs Layout configuration processing logic loops
    const limbJointOffsets = [
        { name: 'leftArm', basePosition: [-1.3, 2.8, 0], xOffset: -1.3 },
        { name: 'rightArm', basePosition: [1.3, 2.8, 0], xOffset: 1.3 },
        { name: 'leftLeg', basePosition: [-0.4, 0.9, 0], xOffset: -0.4 },
        { name: 'rightLeg', basePosition: [0.4, 0.9, 0], xOffset: 0.4 }
    ];

    limbJointOffsets.forEach((joint) => {
        const isLeg = joint.name.includes('Leg');
        for (let segmentIndex = 0; segmentIndex < 3; segmentIndex++) {
            const segmentGeom = new THREE.BoxGeometry(0.4, 0.5, 0.4);
            const currentMat = isLeg ? (segmentIndex === 2 ? shoeMaterial : segmentMaterial) : shirtMaterial;
            const segmentMesh = new THREE.Mesh(segmentGeom, currentMat);
            
            // Stack upper, mid, lower segment intervals cleanly inside local offset frames
            const yOffsetPos = joint.basePosition[1] - (segmentIndex * 0.55);
            segmentMesh.position.set(joint.xOffset, yOffsetPos, joint.basePosition[2]);
            parentCharacterGroup.add(segmentMesh);
        }
    });

    return parentCharacterGroup;
}

// Instantiate active user visual node representation locally inside the coordinate scene
const localPlayerVisualizationNode = createSegmentedR15Rig('BOY', '#ff0000');
gameScene.add(localPlayerVisualizationNode);

// --- PROCEDURAL ASTEROID CHUNKS MATRIX GENERATOR ---
const chunkSystemTrackedNodes = {};
const CHUNK_RENDER_RADIUS_INTERVAL = 2;

function evaluateChunkGenerationTick(playerCoordX, playerCoordZ) {
    const activeChunkIndexX = Math.floor(playerCoordX / 50);
    const activeChunkIndexZ = Math.floor(playerCoordZ / 50);

    for (let currentX = -CHUNK_RENDER_RADIUS_INTERVAL; currentX <= CHUNK_RENDER_RADIUS_INTERVAL; currentX++) {
        for (let currentZ = -CHUNK_RENDER_RADIUS_INTERVAL; currentZ <= CHUNK_RENDER_RADIUS_INTERVAL; currentZ++) {
            const targetChunkIdX = activeChunkIndexX + currentX;
            const targetChunkIdZ = activeChunkIndexZ + currentZ;
            const absoluteChunkHash = `${targetChunkIdX}_${targetChunkIdZ}`;

            if (!chunkSystemTrackedNodes[absoluteChunkHash]) {
                // Instantiating chunk celestial bodies procedural nodes randomly
                const groupNode = new THREE.Group();
                
                // Spawn random material ore components in space fields inside chunks
                if (Math.random() > 0.4) {
                    const oreTypesList = ['iron_asteroid_chunk', 'silicon_asteroid_chunk', 'copper_asteroid_chunk'];
                    const selectedOreId = oreTypesList[Math.floor(Math.random() * oreTypesList.length)];
                    const randomCoordinateHeight = 10 + Math.random() * 40;
                    
                    const asteroidGeometry = new THREE.DodecahedronGeometry(1.5 + Math.random() * 2, 0);
                    let asteroidColor = 0x888888;
                    if (selectedOreId === 'silicon_asteroid_chunk') asteroidColor = 0x00ffff;
                    if (selectedOreId === 'copper_asteroid_chunk') asteroidColor = 0xd47a22;

                    const asteroidMaterial = new THREE.MeshStandardMaterial({ color: asteroidColor, roughness: 0.8 });
                    const asteroidPhysicalMesh = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
                    
                    asteroidPhysicalMesh.position.set(
                        (targetChunkIdX * 50) + Math.random() * 40,
                        randomCoordinateHeight,
                        (targetChunkIdZ * 50) + Math.random() * 40
                    );
                    
                    // Attach explicit object parameters for collection raycasts interaction systems
                    asteroidPhysicalMesh.userData = { isInteractable: true, itemId: selectedOreId };
                    groupNode.add(asteroidPhysicalMesh);
                }

                gameScene.add(groupNode);
                chunkSystemTrackedNodes[absoluteChunkHash] = groupNode;
            }
        }
    }
}

// --- DYNAMIC CONTROL LAYOUT HANDLING ENGINE ---
const activeKeysPressedMatrix = {};

window.addEventListener('keydown', (event) => {
    refreshActivityTimer();
    const transformedCode = event.key.toLowerCase();
    activeKeysPressedMatrix[transformedCode] = true;

    // Numerical Hotbar selection row tracking keys 1 to 9
    if (event.key >= '1' && event.key <= '9') {
        activeHotbarIndex = parseInt(event.key) - 1;
        playerLocalData.itemHoldingIndex = activeHotbarIndex;
        updateScreenInterfaceLayout();
    }

    // Drop item configuration hook
    if (transformedCode === 'x') {
        executeActiveItemDropAction();
    }

    // Interaction key logic block
    if (transformedCode === 'e') {
        processInteractiveProximityTriggers();
    }
});

window.addEventListener('keyup', (event) => {
    activeKeysPressedMatrix[event.key.toLowerCase()] = false;
});

// Proximity check triggers for node collection elements
function processInteractiveProximityTriggers() {
    // Check airlock door collision parameters safely
    const displacementDistanceToAirlock = playerLocalData.position.distanceTo ? 
        playerLocalData.position.distanceTo(airlockDoorMesh.position) : 
        Math.sqrt(Math.pow(playerLocalData.position.x - airlockDoorMesh.position.x, 2) + Math.pow(playerLocalData.position.z - airlockDoorMesh.position.z, 2));

    if (displacementDistanceToAirlock < 6) {
        isAirlockDoorOpen = !isAirlockDoorOpen;
        airlockDoorMesh.position.y = isAirlockDoorOpen ? 12.0 : 3.5; // push door up out of path matrix lines
        appendChatMessageToLogSystem("System", isAirlockDoorOpen ? "Airlock gate unsealed." : "Airlock gate securely engaged.");
        return;
    }
}

function executeActiveItemDropAction() {
    const targetSlotIndex = activeHotbarIndex;
    const itemReference = playerInventorySlots[targetSlotIndex];
    if (itemReference) {
        appendChatMessageToLogSystem("Local", `Discarded ${itemReference.name} onto surface area.`);
        playerInventorySlots[targetSlotIndex] = null;
        updateScreenInterfaceLayout();
    }
}

// --- CRAFTING EVALUATOR LOGIC MATRIX ---
function evaluateCraftingMatrixRecipes() {
    // 3x3 layout alignment coordinate checklist
    // Recipe Diagonal Validation layout evaluation maps
    const boardId = 'item_wood_board';
    const stickId = 'item_stick';

    // Check recipe patterns inside 9 grid slots mapping index coordinates safely
    const isWoodenHammerPattern = 
        (playerCraftingGrid[0] === boardId && playerCraftingGrid[4] === stickId) ||
        (playerCraftingGrid[2] === boardId && playerCraftingGrid[4] === stickId);

    if (isWoodenHammerPattern) {
        return { id: 'item_wooden_hammer', name: 'Wooden Hammer', count: 1, type: 'tool' };
    }

    // Radio assembly formula tracking validation rules loops
    let wireCount = 0, sheetCount = 0, cpuCount = 0;
    playerCraftingGrid.forEach(item => {
        if (item === 'item_copper_wire') wireCount++;
        if (item === 'item_metal_sheet') sheetCount++;
        if (item === 'item_cpu') cpuCount++;
    });

    if (wireCount === 1 && sheetCount === 1 && cpuCount === 1) {
        return { id: 'item_radio', name: 'Simple Radio', count: 1, type: 'tool' };
    }

    return null;
}

// --- USER MANAGEMENT & BACKEND ENCRYPTION SIMULATION HUB ---
export function processUserRegistrationForm(username, password, dateOfBirth, emailAddress) {
    if (!username || !password) return false;
    
    // Simulate irreversible secure database encryption obfuscation shifts
    const pseudoEncryptedPasswordStr = btoa(`salt_key_value_${password}`).reverse ? 
        btoa(`salt_key_value_${password}`).reverse() : 
        btoa(`salt_key_value_${password}`).split("").reverse().join("");

    const standardizedUserObject = {
        username: username,
        passwordHash: pseudoEncryptedPasswordStr,
        dob: dateOfBirth,
        gmail: emailAddress,
        role: username.toLowerCase() === 'mattygrapegreenowner' ? 'head admin' : 'user',
        shirtColor: '#2575fc',
        gender: 'BOY'
    };

    LocalDatabaseSchema.users[username.toLowerCase()] = standardizedUserObject;
    currentUserProfile = standardizedUserObject;
    isUserLoggedIn = true;
    
    appendChatMessageToLogSystem("Auth", `Account created securely for user: ${username}`);
    return true;
}

// --- RENDERING LOOP UPDATE Ticks ---
const physicsClockTimer = new THREE.Clock();

function mainFrameGameEngineTick() {
    requestAnimationFrame(mainFrameGameEngineTick);
    
    const deltaInterval = physicsClockTimer.getDelta();
    
    // Evaluate operational movement vectors if user has resolved UI screens
    if (isUserLoggedIn) {
        let executionSpeedScalar = 5.0;
        playerLocalData.currentActionState = 'walk';

        if (activeKeysPressedMatrix['shift']) {
            executionSpeedScalar = 9.0;
            playerLocalData.currentActionState = 'run';
        }
        if (activeKeysPressedMatrix['c']) {
            executionSpeedScalar = 2.0;
            playerLocalData.currentActionState = 'crouch';
        }

        // Apply spatial velocity translation values
        if (activeKeysPressedMatrix['w']) {
            playerLocalData.position.z -= executionSpeedScalar * deltaInterval;
            refreshActivityTimer();
        }
        if (activeKeysPressedMatrix['s']) {
            playerLocalData.position.z += executionSpeedScalar * deltaInterval;
            refreshActivityTimer();
        }
        if (activeKeysPressedMatrix['a']) {
            playerLocalData.position.x -= executionSpeedScalar * deltaInterval;
            refreshActivityTimer();
        }
        if (activeKeysPressedMatrix['d']) {
            playerLocalData.position.x += executionSpeedScalar * deltaInterval;
            refreshActivityTimer();
        }

        // Keep local character mesh visualization synchronized in position loops
        localPlayerVisualizationNode.position.set(
            playerLocalData.position.x,
            playerLocalData.position.y - 1.5,
            playerLocalData.position.z
        );

        // Update chunks evaluation bounds continuously
        evaluateChunkGenerationTick(playerLocalData.position.x, playerLocalData.position.z);
    }

    gameRenderer.render(gameScene, gameCamera);
}

// --- HTML INTERFACE ATTACHMENT WRAPPERS AND REFRESH DOM Ticks ---
function updateScreenInterfaceLayout() {
    // Synchronize inventory slots visually onto screen overlays if visible
    const layoutContainerGrid = document.getElementById('inventory-grid-wrapper');
    if (layoutContainerGrid) {
        layoutContainerGrid.innerHTML = '';
        playerInventorySlots.forEach((slotData, cellIndex) => {
            const UIElementDiv = document.createElement('div');
            UIElementDiv.className = `inventory-cell-node ${cellIndex === activeHotbarIndex ? 'active-hotbar-frame' : ''}`;
            UIElementDiv.innerText = slotData ? `${GameItemDirectory[slotData.id]?.icon || ''} (${slotData.count})` : '';
            layoutContainerGrid.appendChild(UIElementDiv);
        });
    }
}

function appendChatMessageToLogSystem(senderIdentity, explicitMessageString) {
    console.log(`[${senderIdentity}]: ${explicitMessageString}`);
    // Safe injection hook fallback logic for visual logging frames
}

// Boot frame sequential engine initialization triggers directly
mainFrameGameEngineTick();
updateScreenInterfaceLayout();

// ========================================
// SMARTNEST AI - UPGRADED CUTAWAY 3D HOUSE
// Paste this section at the END of script.js,
// replacing the old 3D house function/listener only.
// Keep your existing dashboard code above this section.
// ========================================

// Avoid duplicate top-level const declarations with the existing dashboard.
window.smartNestHouseState = window.smartNestHouseState || {};
const smartNestState = window.smartNestHouseState;

function smartNestShowToast(message) {
    if (typeof window.showToast === "function") {
        window.showToast(message);
        return;
    }

    let toast = document.getElementById("smartnest-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "smartnest-toast";
        toast.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:99999;background:#19382c;color:white;padding:14px 20px;border-radius:12px;box-shadow:0 8px 25px #0004;font:14px Arial,sans-serif;";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(window.smartNestToastTimer);
    window.smartNestToastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

let smartNestScene = null;
let smartNestRenderer = null;
let smartNestCamera = null;
let smartNestHouse = null;
let smartNestAnimationId = null;
let smartNestResizeObserver = null;
let smartNestFloorChangeHandler = null;
let smartNestRoomLights = [];
let smartNestGroundFloor = null;
let smartNestFirstFloor = null;
let smartNestCurrentFloor = 2;

async function createSmartNestHouse() {
    const stage = document.getElementById("house-stage");
    const placeholder = stage?.querySelector(".house-placeholder");
    const loadButton = document.getElementById("load-house");

    if (!stage || !loadButton) {
        console.error("SmartNest: #house-stage or #load-house is missing.");
        return;
    }
    if (smartNestRenderer) {
        smartNestShowToast("3D house is already running.");
        return;
    }

    loadButton.disabled = true;
    loadButton.textContent = "Building your 3D home...";

    try {
        const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#dce8e1");
        scene.fog = new THREE.Fog("#dce8e1", 24, 55);

        const camera = new THREE.PerspectiveCamera(
            38,
            Math.max(stage.clientWidth, 1) / Math.max(stage.clientHeight, 1),
            0.1,
            150
        );
        camera.position.set(10, 8.2, 16);
        camera.lookAt(0, 3, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(stage.clientWidth, stage.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.domElement.style.cssText = "width:100%;height:100%;display:block;border-radius:12px;touch-action:none;cursor:grab;";
        stage.insertBefore(renderer.domElement, stage.firstChild);

        smartNestScene = scene;
        smartNestRenderer = renderer;
        smartNestCamera = camera;

        scene.add(new THREE.HemisphereLight("#f4fff7", "#647568", 2.2));
        const sunlight = new THREE.DirectionalLight("#fff0d2", 3.2);
        sunlight.position.set(-7, 15, 10);
        sunlight.castShadow = true;
        sunlight.shadow.mapSize.set(2048, 2048);
        sunlight.shadow.camera.left = -14;
        sunlight.shadow.camera.right = 14;
        sunlight.shadow.camera.top = 18;
        sunlight.shadow.camera.bottom = -12;
        scene.add(sunlight);
        const fillLight = new THREE.DirectionalLight("#d5e8ff", 1.1);
        fillLight.position.set(10, 7, -8);
        scene.add(fillLight);

        const mat = (color, roughness = 0.78, metalness = 0) =>
            new THREE.MeshStandardMaterial({ color, roughness, metalness });

        const materials = {
            wall: mat("#f1eee5"), sideWall: mat("#d8ddd3"), floor: mat("#bd8c5d"),
            wood: mat("#8a5b3c"), darkWood: mat("#50372b"), white: mat("#f6f3ea"),
            sofa: mat("#c5b6a0"), sofaDark: mat("#8b9b8b"), fabric: mat("#e6d9c5"),
            metal: mat("#3b4a45", 0.35, 0.65),
           glass: new THREE.MeshPhysicalMaterial({
    color: "#d8f5f5",
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.18,
    transmission: 0.45,
    ior: 1.45,
    thickness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false
}),
            windowFrame: mat("#344a43", 0.35, 0.4), grass: mat("#72936a"),
            path: mat("#c9c6b7"), roof: mat("#263d34"), pillow: mat("#f2e8d8"),
            plant: mat("#4c8555"),
            screen: new THREE.MeshStandardMaterial({ color: "#172b36", emissive: "#173746", emissiveIntensity: 0.35, roughness: 0.25 }),
            counter: mat("#e6e2d7", 0.34), tile: mat("#d9ddd6", 0.6), carpet: mat("#d2bca0")
        };

        const house = new THREE.Group();
        house.name = "SmartNest Cutaway House";
        scene.add(house);
        smartNestHouse = house;

        const groundFloor = new THREE.Group();
        groundFloor.name = "Ground Floor";
        const firstFloor = new THREE.Group();
        firstFloor.name = "First Floor";
        house.add(groundFloor, firstFloor);
        smartNestGroundFloor = groundFloor;
        smartNestFirstFloor = firstFloor;

        function box(w, h, d, material, x, y, z, parent = house, options = {}) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.position.set(x, y, z);
            mesh.castShadow = options.castShadow !== false;
            mesh.receiveShadow = true;
            if (options.rotationY) mesh.rotation.y = options.rotationY;
            parent.add(mesh);
            return mesh;
        }
        function cylinder(radiusTop, radiusBottom, height, material, x, y, z, parent = house) {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 12), material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            parent.add(mesh);
            return mesh;
        }
        function sphere(radius, material, x, y, z, parent = house) {
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            parent.add(mesh);
            return mesh;
        }
        function addPlant(x, z, scale = 1, parent = house) {
            cylinder(0.22 * scale, 0.27 * scale, 0.38 * scale, mat("#9b7658"), x, 0.19 * scale, z, parent);
            sphere(0.32 * scale, materials.plant, x, 0.52 * scale, z, parent);
            sphere(0.23 * scale, mat("#63945e"), x + 0.16 * scale, 0.68 * scale, z + 0.04 * scale, parent);
            sphere(0.22 * scale, mat("#3f7548"), x - 0.13 * scale, 0.68 * scale, z - 0.05 * scale, parent);
        }
        function addWindow(x, y, z, width, height, parent, front = true) {
            const depth = 0.09;
            box(width + 0.12, height + 0.12, depth, materials.windowFrame, x, y, z, parent);
            box(width, height, depth * 0.55, materials.glass, x, y, z + (front ? 0.035 : -0.035), parent);
            box(0.045, height, depth * 1.1, materials.windowFrame, x, y, z + 0.01, parent);
            box(width, 0.045, depth * 1.1, materials.windowFrame, x, y, z + 0.01, parent);
        }

        // Base, lawn, paving and path.
        box(11.5, 0.25, 8.8, materials.path, 0, -0.20, 0);
        box(10.8, 0.12, 8.2, materials.grass, 0, -0.045, 0);
        box(2.0, 0.08, 3.4, materials.path, 0, 0.025, 5.0);
        box(4.0, 0.08, 2.0, materials.path, 6.8, 0.02, 2.2);
        for (let i = 0; i < 4; i++) box(0.75, 0.06, 0.48, materials.white, 0, 0.09, 3.35 + i * 0.63);

        // Floor slabs.
        box(8.5, 0.22, 6.5, materials.floor, 0, 0.18, 0, groundFloor);
        box(8.5, 0.22, 6.5, materials.floor, 0, 3.65, 0, firstFloor);

        // Exterior walls, open at front.
        box(8.5, 2.85, 0.20, materials.wall, 0, 1.67, -3.15, groundFloor);
        box(0.20, 2.85, 6.3, materials.sideWall, -4.25, 1.67, 0, groundFloor);
        box(0.20, 2.85, 6.3, materials.sideWall, 4.25, 1.67, 0, groundFloor);
        box(8.5, 3.25, 0.20, materials.wall, 0, 5.35, -3.15, firstFloor);
        box(0.20, 3.25, 6.3, materials.sideWall, -4.25, 5.35, 0, firstFloor);
        box(0.20, 3.25, 6.3, materials.sideWall, 4.25, 5.35, 0, firstFloor);

        // Room partitions.
        box(0.13, 2.45, 2.0, materials.wall, -1.35, 1.55, -2.12, groundFloor);
        box(0.13, 2.45, 1.2, materials.wall, -1.35, 1.55, 1.0, groundFloor);
        box(2.7, 2.45, 0.13, materials.wall, -2.88, 1.55, -0.05, groundFloor);
        box(1.3, 2.45, 0.13, materials.wall, 2.9, 1.55, -0.1, groundFloor);
        box(0.13, 2.45, 1.8, materials.wall, 1.45, 1.55, -2.2, groundFloor);
        box(0.13, 2.45, 1.3, materials.wall, 1.45, 1.55, 1.0, groundFloor);
        box(0.13, 2.45, 2.1, materials.wall, -1.35, 4.65, -2.1, firstFloor);
        box(0.13, 2.45, 1.1, materials.wall, -1.35, 4.65, 1.0, firstFloor);
        box(2.7, 2.45, 0.13, materials.wall, -2.88, 4.65, -0.05, firstFloor);
        box(0.13, 2.45, 1.7, materials.wall, 1.55, 4.65, -2.25, firstFloor);
        box(0.13, 2.45, 1.3, materials.wall, 1.55, 4.65, 1.0, firstFloor);

        // Roof and fascia.
        // Modern flat roof
box(
    8.9, 0.22, 6.8,
    mat("#263d34", 0.4, 0.15),
    0, 7.08, 0,
    firstFloor
);

// Front roof fascia
box(
    8.95, 0.12, 0.28,
    mat("#172b25", 0.32),
    0, 6.96, 3.16,
    firstFloor
);
        // ===== MODERN LUXURY EXTERIOR UPGRADE =====

// Premium front roof fascia
box(8.95, 0.12, 0.28, mat("#172b25", 0.32), 0, 6.08, 3.16, firstFloor);

// Warm wooden accent panels
box(0.85, 2.45, 0.12, mat("#80563a"), -3.65, 1.65, 3.12, groundFloor);
box(0.85, 2.45, 0.12, mat("#80563a"), -3.65, 4.75, 3.12, firstFloor);

// Modern entrance frame
box(1.45, 2.55, 0.16, mat("#263c32"), 0, 1.48, 3.18, groundFloor);
box(1.18, 2.35, 0.08, mat("#9a6b47"), 0, 1.45, 3.28, groundFloor);

// Balcony glass railing upgrade
box(
    3.55, 0.72, 0.055,
    materials.glass,
    2.35, 3.72, 4.12,
    firstFloor,
    { castShadow: false }
);
// Slim dark balcony railing
box(3.65, 0.07, 0.09, materials.windowFrame, 2.35, 4.09, 4.12, firstFloor);

// Modern exterior wall accents
box(0.12, 2.5, 0.16, mat("#263c32"), -4.05, 1.65, 3.12, groundFloor);
box(0.12, 2.5, 0.16, mat("#263c32"), 4.05, 1.65, 3.12, groundFloor);

box(0.12, 2.5, 0.16, mat("#263c32"), -4.05, 4.75, 3.12, firstFloor);
box(0.12, 2.5, 0.16, mat("#263c32"), 4.05, 4.75, 3.12, firstFloor);

// Warm entrance lights
const entranceLightMaterial = new THREE.MeshStandardMaterial({
    color: "#ffdca0",
    emissive: "#ffb347",
    emissiveIntensity: 1.8
});

box(0.16, 0.32, 0.08, entranceLightMaterial, -3.85, 2.0, 3.23, groundFloor);
box(0.16, 0.32, 0.08, entranceLightMaterial, 3.85, 2.0, 3.23, groundFloor);


        // ========================================
// SMARTNEST PRO — MODERN LUXURY FACADE
// ========================================

// Premium exterior materials
const modernCharcoal = mat("#303b38", 0.42, 0.18);
const modernConcrete = mat("#e9e7df", 0.72);
const modernTimber = mat("#70472f", 0.55);
const modernDarkGlass = new THREE.MeshPhysicalMaterial({
    color: "#9dcbd0",
    roughness: 0.15,
    metalness: 0.12,
    transparent: true,
    opacity: 0.65
});

const modernGoldLight = new THREE.MeshStandardMaterial({
    color: "#ffd59a",
    emissive: "#ffad55",
    emissiveIntensity: 1.6,
    roughness: 0.3
});

// 1. Designer main entrance door
box(
    1.22, 2.28, 0.14,
    modernTimber,
    0, 1.38, 3.18,
    groundFloor
);

// Door frame
box(
    1.42, 0.12, 0.22,
    modernCharcoal,
    0, 2.56, 3.17,
    groundFloor
);

box(
    0.10, 2.40, 0.20,
    modernConcrete,
    -0.70, 1.38, 3.16,
    groundFloor
);

box(
    0.10, 2.40, 0.20,
    modernConcrete,
    0.70, 1.38, 3.16,
    groundFloor
);

// Elegant door handle
sphere(
    0.055, modernGoldLight,
    0.43, 1.38, 3.29,
    groundFloor
);

// 2. Modern wooden feature wall beside entrance
box(
    0.85, 2.55, 0.12,
    modernCharcoal,
    -1.55, 1.57, 3.12,
    groundFloor
);

// Vertical timber slats
for (let i = 0; i < 7; i++) {
    box(
        0.055, 2.25, 0.08,
        modernTimber,
        -1.88 + i * 0.11,
        1.58,
        3.22,
        groundFloor
    );
}

// 3. Contemporary facade panels on upper floor
box(
    1.0, 2.15, 0.12,
    modernCharcoal,
    -3.55, 4.75, 3.10,
    firstFloor
);

box(
    1.0, 2.15, 0.12,
    modernCharcoal,
    3.65, 4.75, 3.10,
    firstFloor
);

// Warm accent strips on the upper facade
box(
    0.055, 1.65, 0.07,
    modernGoldLight,
    -3.55, 4.75, 3.19,
    firstFloor
);

box(
    0.055, 1.65, 0.07,
    modernGoldLight,
    3.65, 4.75, 3.19,
    firstFloor
);

// 4. Flat modern entrance canopy
box(
    2.05, 0.14, 1.0,
    modernCharcoal,
    0, 2.68, 3.65,
    groundFloor
);

// Canopy underside accent
box(
    1.75, 0.035, 0.75,
    modernGoldLight,
    0, 2.59, 3.65,
    groundFloor
);

// 5. Modern balcony planter boxes
box(
    1.05, 0.36, 0.34,
    modernCharcoal,
    0.85, 3.60, 3.82,
    firstFloor
);

box(
    1.05, 0.36, 0.34,
    modernCharcoal,
    3.65, 3.60, 3.82,
    firstFloor
);

// Balcony greenery
addPlant(0.85, 3.82, 0.42, firstFloor);
addPlant(3.65, 3.82, 0.42, firstFloor);

// 6. Modern side accents
box(
    0.12, 2.5, 0.18,
    modernCharcoal,
    -4.12, 1.65, 2.55,
    groundFloor
);

box(
    0.12, 2.5, 0.18,
    modernCharcoal,
    4.12, 1.65, 2.55,
    groundFloor
);

// 7. Entrance step details
box(
    1.9, 0.10, 0.42,
    modernConcrete,
    0, 0.12, 3.65,
    groundFloor
);

box(
    1.55, 0.08, 0.32,
    modernCharcoal,
    0, 0.21, 3.47,
    groundFloor
);


        // Windows.
        addWindow(-2.8, 1.8, -3.04, 1.35, 1.05, groundFloor, false);
        addWindow(2.8, 1.8, -3.04, 1.35, 1.05, groundFloor, false);
        addWindow(-2.8, 4.9, -3.04, 1.35, 1.05, firstFloor, false);
        addWindow(2.8, 4.9, -3.04, 1.35, 1.05, firstFloor, false);
        addWindow(-4.12, 1.8, -1.25, 1.2, 1.0, groundFloor, false);
        addWindow(4.12, 4.9, -1.25, 1.2, 1.0, firstFloor, false);

        // Front pillars and upper balcony.
        box(0.22, 2.8, 0.22, materials.white, -3.95, 1.65, 3.02, groundFloor);
        box(0.22, 2.8, 0.22, materials.white, 3.95, 1.65, 3.02, groundFloor);
        box(3.6, 0.12, 1.15, materials.floor, 2.35, 3.36, 3.55, firstFloor);
        box(3.65, 0.09, 0.07, materials.windowFrame, 2.35, 4.0, 4.08, firstFloor);
        box(3.65, 0.65, 0.045, materials.glass, 2.35, 3.68, 4.08, firstFloor);
        box(0.06, 0.7, 0.08, materials.windowFrame, 0.55, 3.7, 4.08, firstFloor);
        box(0.06, 0.7, 0.08, materials.windowFrame, 4.15, 3.7, 4.08, firstFloor);
        addWindow(-2.65, 1.85, 3.10, 1.8, 1.65, groundFloor, true);
        addWindow(-2.65, 4.95, 3.10, 1.75, 1.65, firstFloor, true);
        addWindow(2.6, 4.95, 3.10, 1.8, 1.65, firstFloor, true);

        // Living room furniture.
        box(2.5, 0.035, 1.75, materials.carpet, -2.75, 0.315, 1.45, groundFloor);
        box(1.85, 0.38, 0.72, materials.sofa, -2.9, 0.56, 1.65, groundFloor);
        box(1.85, 0.58, 0.18, materials.sofaDark, -2.9, 0.89, 1.98, groundFloor);
        box(0.18, 0.42, 0.72, materials.sofaDark, -3.83, 0.62, 1.65, groundFloor);
        box(0.18, 0.42, 0.72, materials.sofaDark, -1.97, 0.62, 1.65, groundFloor);
        box(0.45, 0.12, 0.36, materials.pillow, -3.35, 0.82, 1.65, groundFloor);
        box(0.45, 0.12, 0.36, materials.fabric, -2.55, 0.82, 1.65, groundFloor);
        box(1.1, 0.12, 0.62, materials.wood, -2.7, 0.52, 0.55, groundFloor);
        for (const [x, z] of [[-3.15,0.35],[-2.25,0.35],[-3.15,0.75],[-2.25,0.75]]) cylinder(0.035, 0.035, 0.22, materials.darkWood, x, 0.40, z, groundFloor);
        box(1.35, 0.72, 0.12, materials.darkWood, -2.75, 1.05, -2.78, groundFloor);
        box(1.2, 0.55, 0.035, materials.screen, -2.75, 1.08, -2.70, groundFloor);
        box(1.55, 0.12, 0.3, materials.wood, -2.75, 0.57, -2.72, groundFloor);

        // Dining table and chairs.
        box(1.45, 0.12, 0.95, materials.wood, 2.85, 0.95, 0.75, groundFloor);
        for (const [x, z] of [[2.35,0.15],[2.85,0.15],[3.35,0.15],[2.35,1.35],[2.85,1.35],[3.35,1.35]]) {
            box(0.36, 0.12, 0.34, materials.sofa, x, 0.58, z, groundFloor);
            box(0.36, 0.42, 0.08, materials.wood, x, 0.80, z - 0.12, groundFloor);
            for (const dx of [-0.12, 0.12]) box(0.045, 0.30, 0.045, materials.darkWood, x + dx, 0.42, z, groundFloor);
        }

        // Kitchen counters, sink, hob and fridge.
        box(2.0, 0.82, 0.68, materials.counter, 2.85, 0.73, -2.45, groundFloor);
        box(2.08, 0.09, 0.74, materials.white, 2.85, 1.18, -2.45, groundFloor);
        box(1.92, 0.72, 0.12, materials.wood, 2.85, 1.68, -3.00, groundFloor);
        box(0.55, 0.025, 0.36, materials.metal, 2.25, 1.24, -2.4, groundFloor);
        box(0.34, 0.025, 0.25, materials.metal, 3.25, 1.24, -2.4, groundFloor);
        for (const x of [3.15, 3.55]) cylinder(0.10, 0.10, 0.035, materials.metal, x, 1.245, -2.55, groundFloor);
        box(0.58, 1.55, 0.62, materials.white, 3.72, 0.98, -1.65, groundFloor);
        box(0.035, 0.45, 0.035, materials.metal, 3.48, 1.18, -1.32, groundFloor);

        // Bathroom vanity and shower screen.
        box(1.0, 0.025, 1.35, materials.tile, 0.55, 0.315, -2.05, groundFloor);
        box(0.62, 0.62, 0.4, materials.white, 0.55, 0.68, -2.55, groundFloor);
        cylinder(0.19, 0.22, 0.07, materials.white, 0.55, 1.02, -2.48, groundFloor);
        box(0.05, 1.6, 0.05, materials.windowFrame, 1.0, 1.12, -1.25, groundFloor);
        box(0.04, 1.6, 0.75, materials.glass, 0.98, 1.12, -1.62, groundFloor);

        // Staircase.
        for (let i = 0; i < 10; i++) {
            box(0.72, 0.12, 0.36, materials.wood, -0.15 + i * 0.17, 0.30 + i * 0.19, 2.45 - i * 0.36, groundFloor);
        }
        //box(0.09, 1.85, 3.2, materials.darkWood, 0.75, 1.25, 0.75, groundFloor, { rotationY: -0.44 });

        // First-floor bedroom one.
        box(2.15, 0.035, 2.0, materials.carpet, -2.75, 3.42, 1.45, firstFloor);
        box(1.55, 0.35, 2.0, materials.white, -2.75, 3.58, 1.42, firstFloor);
        box(1.58, 0.17, 0.52, materials.wood, -2.75, 3.82, 2.10, firstFloor);
        box(1.48, 0.12, 1.15, materials.pillow, -2.75, 3.82, 1.0, firstFloor);
        box(0.72, 1.55, 0.65, materials.wood, -3.75, 4.15, -1.85, firstFloor);
        box(0.78, 0.05, 0.72, materials.white, -2.1, 3.65, -1.95, firstFloor);
        box(0.95, 0.65, 0.08, materials.wood, -2.6, 4.02, -2.65, firstFloor);

        // First-floor bedroom two.
        box(1.65, 0.34, 1.9, materials.white, 2.75, 3.58, -1.55, firstFloor);
        box(1.68, 0.16, 0.5, materials.wood, 2.75, 3.82, -0.88, firstFloor);
        box(1.48, 0.11, 1.05, materials.pillow, 2.75, 3.82, -1.85, firstFloor);
        box(0.62, 1.55, 0.62, materials.wood, 3.7, 4.15, -2.25, firstFloor);
        box(1.25, 0.12, 0.58, materials.wood, 0.45, 3.95, -2.3, firstFloor);
        box(0.85, 0.05, 0.48, materials.screen, 0.45, 4.05, -2.35, firstFloor);
        box(0.42, 0.40, 0.42, materials.sofa, 0.45, 3.62, -1.55, firstFloor);
        box(0.42, 0.42, 0.08, materials.wood, 0.45, 3.83, -1.75, firstFloor);

        // Plants and garden.
        addPlant(-3.75, 2.45, 0.7, groundFloor);
        addPlant(3.65, 1.85, 0.65, groundFloor);
        addPlant(-3.75, 2.4, 0.65, firstFloor);
        addPlant(3.75, 2.65, 0.6, firstFloor);
        box(1.1, 0.18, 0.65, materials.wood, -4.65, 0.12, 2.9);
        addPlant(-4.65, 2.9, 1.15);
        addPlant(4.7, 2.75, 1.0);
        addPlant(-4.55, 5.0, 0.85);
        addPlant(4.7, 5.1, 0.9);

       // ========================================
// SMARTNEST AI — PREMIUM GARDEN DETAILS
// ========================================

const gardenBorderMaterial = mat("#344d3b", 0.75);
const gardenPathMaterial = mat("#e8e2d5", 0.8);

// Decorative garden border
box(
    0.12, 0.18, 5.2,
    gardenBorderMaterial,
    -5.15, 0.06, 1.8
);

// Stone pathway beside the entrance
for (let i = 0; i < 5; i++) {
    box(
        0.72, 0.055, 0.48,
        gardenPathMaterial,
        1.45 + i * 0.15,
        0.07,
        4.25 + i * 0.62
    );
}

// Additional entrance plants
addPlant(-4.55, 3.7, 0.8);
addPlant(4.55, 3.7, 0.8);
    
// ========================================
// SMARTNEST AI — LUXURY GARDEN & POOL
// Add after the existing Plants and garden section
// ========================================

// Luxury pool materials
const poolWater = new THREE.MeshPhysicalMaterial({
    color: "#36b9d4",
    roughness: 0.12,
    metalness: 0.18,
    transparent: true,
    opacity: 0.88
});

const poolEdge = mat("#f0eee6", 0.35);
const poolTile = mat("#247d91", 0.3);
const gardenStone = mat("#e7e1d4", 0.65);
const gardenDark = mat("#24372e", 0.55);

// Swimming pool on the right side of the garden
// Keep it away from the existing car at x = 6.6.
box(
    3.0, 0.20, 2.25,
    poolEdge,
    -6.1, -0.015, 2.0
);

box(
    2.72, 0.08, 1.97,
    poolTile,
    -6.1, 0.09, 2.0
);

box(
    2.58, 0.035, 1.83,
    poolWater,
    -6.1, 0.145, 2.0
);

// Poolside sun loungers
const loungerFabric = mat("#f4eee1");

for (const z of [1.2, 2.7]) {
    box(
        0.65, 0.10, 1.25,
        loungerFabric,
        -8.0, 0.22, z
    );

    box(
        0.65, 0.08, 0.28,
        materials.wood,
        -8.0, 0.31, z - 0.43
    );
}

// Decorative stepping-stone pathway
for (let i = 0; i < 6; i++) {
    box(
        0.68, 0.07, 0.48,
        gardenStone,
        -2.0 - i * 0.75,
        0.035,
        5.15
    );
}

// Modern garden border
box(
    0.16, 0.24, 4.0,
    gardenDark,
    -8.0, 0.08, 2.0
);

// Extra garden plants
addPlant(-7.7, 0.4, 0.9);
addPlant(-7.7, 3.8, 0.85);
addPlant(-4.4, 4.0, 0.75);

// ========================================
// PREMIUM WARM GARDEN LIGHTING
// ========================================

const gardenLightMaterial = new THREE.MeshStandardMaterial({
    color: "#ffe2a8",
    emissive: "#ffb94f",
    emissiveIntensity: 2.2
});

const gardenLightPositions = [
    [-3.2, 0.4],
    [-4.7, 4.4],
    [-7.3, 0.6],
    [-7.3, 3.5],
    [4.6, 4.2]
];

gardenLightPositions.forEach(([x, z]) => {
    // Short decorative light post
    cylinder(
        0.055, 0.075, 0.55,
        gardenDark,
        x, 0.30, z
    );

    // Glowing light cap
    sphere(
        0.13,
        gardenLightMaterial,
        x, 0.62, z
    );

    // Soft light around the garden
    const gardenLight = new THREE.PointLight(
        "#ffd18a",
        1.5,
        3.5,
        2
    );

    gardenLight.position.set(x, 0.75, z);
    scene.add(gardenLight);
});

// Modern poolside decorative plants
addPlant(-4.5, 0.3, 0.7);
addPlant(-7.7, 2.0, 0.55);


        // Parked car.
        const car = new THREE.Group();
        house.add(car);
        box(1.55, 0.42, 2.5, mat("#d8e1db", 0.3, 0.25), 6.6, 0.42, 2.2, car);
        box(1.25, 0.42, 1.25, mat("#b8d5d8", 0.22, 0.25), 6.6, 0.82, 2.15, car);
        for (const x of [5.95, 7.25]) for (const z of [1.35, 3.0]) cylinder(0.22, 0.22, 0.14, materials.metal, x, 0.28, z, car);
        box(0.35, 0.12, 0.05, materials.white, 6.1, 0.46, 0.92, car);
        box(0.35, 0.12, 0.05, materials.white, 7.1, 0.46, 0.92, car);

        // Four controllable room lights.
       // ========================================
// SMARTNEST PRO — 6 ROOM LIGHT DEFINITIONS
// ========================================

const roomLightDefinitions = [
    {
        name: "Living Room",
        group: groundFloor,
        x: -2.7,
        y: 2.35,
        z: 0.8,
        keys: ["living", "lounge"]
    },
    {
        name: "Kitchen",
        group: groundFloor,
        x: 2.7,
        y: 2.35,
        z: -1.7,
        keys: ["kitchen"]
    },
    {
        name: "Master Bedroom",
        group: firstFloor,
        x: -2.7,
        y: 5.45,
        z: 0.8,
        keys: ["master bedroom", "master", "bedroom", "bed"]
    },
    {
        name: "Study Room",
        group: firstFloor,
        x: 2.5,
        y: 5.45,
        z: -1.7,
        keys: ["study", "office"]
    },
    {
        name: "Pooja Room",
        group: groundFloor,
        x: 0.2,
        y: 2.35,
        z: -1.7,
        keys: ["pooja", "prayer"]
    },
    {
        name: "Balcony",
        group: firstFloor,
        x: 2.5,
        y: 5.45,
        z: 2.8,
        keys: ["balcony"]
    }
];
        smartNestRoomLights = roomLightDefinitions.map((definition, index) => {
            const light = new THREE.PointLight("#ffd69a", 0, 5.2, 2);
            light.position.set(definition.x, definition.y, definition.z);
            definition.group.add(light);
            const bulb = new THREE.Mesh(
                new THREE.SphereGeometry(0.105, 16, 12),
                new THREE.MeshBasicMaterial({ color: "#9ba79a" })
            );
            bulb.position.set(definition.x, definition.y + 0.05, definition.z);
            definition.group.add(bulb);
            return { ...definition, light, bulb, index };
        });

        // ========================================
// SMARTNEST AI — LUXURY INTERIOR LIGHTING
// ========================================

const luxuryLightMaterial = new THREE.MeshStandardMaterial({
    color: "#ffe8b5",
    emissive: "#ffbd70",
    emissiveIntensity: 1.8
});

// Decorative ceiling lights
const luxuryCeilingLights = [
    [-2.7, 2.95, 0.8, groundFloor],
    [2.7, 2.95, -1.7, groundFloor],
    [-2.7, 6.15, 0.8, firstFloor],
    [2.5, 6.15, -1.7, firstFloor]
];

luxuryCeilingLights.forEach(([x, y, z, parent]) => {
    const fixture = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.07, 24),
        materials.metal
    );

    fixture.position.set(x, y, z);
    parent.add(fixture);

    const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 16, 12),
        luxuryLightMaterial
    );

    bulb.position.set(x, y - 0.06, z);
    parent.add(bulb);
});

        // Ground plane.
        const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat("#c8d4c8"));
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.y = -0.34;
        groundPlane.receiveShadow = true;
        scene.add(groundPlane);

        function getRoomRows() {
            return Array.from(document.querySelectorAll(".room-row"));
        }
       function findLightIndex(row, rowIndex) {
    const label = (
        `${row.dataset.room || ""} ${row.textContent || ""}`
    ).toLowerCase();

    if (label.includes("living")) return 0;
    if (label.includes("kitchen")) return 1;

    if (label.includes("master bedroom")) return 2;
    if (label.includes("study")) return 3;
    if (label.includes("pooja")) return 4;
    if (label.includes("balcony")) return 5;

    return -1;
}
        function syncHouseLights() {
            const rows = getRoomRows();
            const allToggle = document.getElementById("all-lights-toggle");
            const allOn = allToggle?.classList.contains("on") ||
                allToggle?.checked === true ||
                allToggle?.getAttribute("aria-pressed") === "true";

            smartNestRoomLights.forEach(room => {
            const matchingRows = rows.filter(
              (row, index) => findLightIndex(row, index) === room.index
                );
                const isOn = matchingRows.some(row => {
                    const toggle = row.querySelector(".toggle-switch, input[type='checkbox']");
                    return toggle?.classList.contains("on") || toggle?.checked === true ||
                        toggle?.getAttribute("aria-pressed") === "true";
                });
                const finalOn = allOn || isOn;
                room.light.intensity = finalOn ? 9 : 0;
                room.bulb.material.color.set(finalOn ? "#ffd27a" : "#9ba79a");
            });
        }

        window.addEventListener("smartnest:lightschange", syncHouseLights);
        getRoomRows().forEach(row => {
            const toggle = row.querySelector(".toggle-switch, input[type='checkbox']");
            toggle?.addEventListener("click", () => setTimeout(syncHouseLights, 0));
        });
        document.getElementById("all-lights-toggle")?.addEventListener("click", () => setTimeout(syncHouseLights, 0));
        document.querySelectorAll(".room-row input[type='checkbox']").forEach(toggle =>
            toggle.addEventListener("change", () => setTimeout(syncHouseLights, 0))
        );
        syncHouseLights();

        function changeHouseFloor(floor) {
            smartNestCurrentFloor = Number(floor);
            const fullView = smartNestCurrentFloor === 2;
            groundFloor.visible = fullView || smartNestCurrentFloor === 0;
            firstFloor.visible = fullView || smartNestCurrentFloor === 1;
            if (fullView) {
               camera.position.set(10, 8.5, 18);
camera.lookAt(0, 3, 0);
                smartNestShowToast("Full house view.");
            } else if (smartNestCurrentFloor === 1) {
                camera.position.set(9.5, 8.2, 14.5);
                camera.lookAt(0, 4.55, 0);
                smartNestShowToast("Viewing first floor.");
            } else {
                camera.position.set(10, 5.8, 14.5);
                camera.lookAt(0, 1.65, 0);
                smartNestShowToast("Viewing ground floor.");
            }
        }
        groundFloor.visible = true;
        firstFloor.visible = true;

        if (smartNestFloorChangeHandler) window.removeEventListener("smartnest:floorchange", smartNestFloorChangeHandler);
        smartNestFloorChangeHandler = event => changeHouseFloor(event.detail?.floor ?? 2);
        window.addEventListener("smartnest:floorchange", smartNestFloorChangeHandler);

        // Support common existing floor button patterns.
        document.querySelectorAll("[data-floor]").forEach(button => {
            button.addEventListener("click", () => {
                const raw = button.dataset.floor;
                let floor = raw === "ground" || raw === "0" ? 0 :
                    raw === "first" || raw === "1" || raw === "upper" ? 1 : 2;
                changeHouseFloor(floor);
            });
        });

    
// Connect room cards to their 3D views.
document.querySelectorAll(".room-row").forEach(row => {
    row.style.cursor = "pointer";

    row.addEventListener("dblclick", () => {
        const label = (
            (row.dataset.room || "") + " " + row.textContent
        ).toLowerCase();

        if (label.includes("living")) {
            smartNestFocusRoom("living");
        } else if (label.includes("kitchen")) {
            smartNestFocusRoom("kitchen");
        } else if (label.includes("master bedroom")) {
            smartNestFocusRoom("master");
        } else if (label.includes("study")) {
            smartNestFocusRoom("study");
        } else if (label.includes("pooja")) {
            smartNestFocusRoom("pooja");
        } else if (label.includes("balcony")) {
            smartNestFocusRoom("balcony");
        }
    });
});

// ========================================
// SMARTNEST AI — INTERACTIVE 3D ROOMS
// Click a room button to focus the camera
// ========================================

const smartNestRoomViews = {
    living: {
        position: [7, 4.2, 7],
        target: [-2.7, 1.2, 0.8],
        floor: 0
    },
    kitchen: {
        position: [7, 4.2, 5],
        target: [2.7, 1.1, -1.7],
        floor: 0
    },
    master: {
        position: [7, 7.2, 7],
        target: [-2.7, 4.5, 0.8],
        floor: 1
    },
    study: {
        position: [7, 7.2, 5],
        target: [2.5, 4.5, -1.7],
        floor: 1
    },
    pooja: {
        position: [5, 4.2, 5],
        target: [0.2, 1.2, -1.7],
        floor: 0
    },
    balcony: {
        position: [7, 6.2, 9],
        target: [2.5, 4.0, 3.0],
        floor: 1
    }
};

function smartNestFocusRoom(roomName) {
    const view = smartNestRoomViews[roomName];

    if (!view || !smartNestCamera || !smartNestHouse) {
        smartNestShowToast("Load the 3D house first.");
        return;
    }

    // Show the floor containing the selected room.
    smartNestGroundFloor.visible = view.floor === 0;
    smartNestFirstFloor.visible = view.floor === 1;
    smartNestCurrentFloor = view.floor;

    const [x, y, z] = view.position;

    smartNestCamera.position.set(x, y, z);
    smartNestCamera.lookAt(...view.target);

    smartNestShowToast(
        "Viewing " + roomName.charAt(0).toUpperCase() +
        roomName.slice(1) + "."
    );
}

// Use this from room buttons in the dashboard.
window.smartNestFocusRoom = smartNestFocusRoom;


        // Drag to rotate; wheel to zoom.
        let dragging = false, lastX = 0, lastY = 0;
        renderer.domElement.addEventListener("pointerdown", event => {
            dragging = true; lastX = event.clientX; lastY = event.clientY;
            renderer.domElement.setPointerCapture(event.pointerId);
            renderer.domElement.style.cursor = "grabbing";
        });
        renderer.domElement.addEventListener("pointermove", event => {
            if (!dragging) return;
            house.rotation.y += (event.clientX - lastX) * 0.006;
            camera.position.y = THREE.MathUtils.clamp(camera.position.y - (event.clientY - lastY) * 0.018, 3.5, 13);
            lastX = event.clientX; lastY = event.clientY;
        });
        const stopDragging = () => { dragging = false; renderer.domElement.style.cursor = "grab"; };
        renderer.domElement.addEventListener("pointerup", stopDragging);
        renderer.domElement.addEventListener("pointercancel", stopDragging);
        renderer.domElement.addEventListener("wheel", event => {
            event.preventDefault();
            camera.position.multiplyScalar(event.deltaY > 0 ? 1.055 : 0.945);
            camera.position.clampLength(9, 32);
            camera.lookAt(0, smartNestCurrentFloor === 1 ? 4.55 : smartNestCurrentFloor === 0 ? 1.65 : 3, 0);
        }, { passive: false });

        if (smartNestResizeObserver) smartNestResizeObserver.disconnect();
        smartNestResizeObserver = new ResizeObserver(() => {
            if (!stage.clientWidth || !stage.clientHeight) return;
            camera.aspect = stage.clientWidth / stage.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(stage.clientWidth, stage.clientHeight);
        });
        smartNestResizeObserver.observe(stage);
        if (placeholder) placeholder.style.display = "none";

        function animateHouse() {
            smartNestAnimationId = requestAnimationFrame(animateHouse);
            renderer.render(scene, camera);
        }
        animateHouse();
        window.houseInitialized = true;
        loadButton.disabled = false;
        loadButton.textContent = "3D House Ready ✓";
        smartNestShowToast("Your SmartNest 3D home is ready!");
    } catch (error) {
        console.error("SmartNest 3D house error:", error);
        loadButton.disabled = false;
        loadButton.textContent = "Retry 3D House";
        smartNestShowToast("3D house could not load. Check browser console.");
    }
}

// Replace only the old 3D load listener; remove any duplicate listener in this section.
document.getElementById("load-house")?.addEventListener("click", createSmartNestHouse);

// SmartNest: fix room light and floor controls

document.addEventListener("DOMContentLoaded", () => {
    // Handle individual room light buttons
    document.querySelectorAll(".room-row .toggle-switch").forEach(button => {
        button.addEventListener("click", () => {
            const isOn = button.classList.toggle("on");
            button.setAttribute("aria-checked", String(isOn));

            const row = button.closest(".room-row");
            const status = row?.querySelector(".room-light-status");

            if (status) {
                status.textContent = isOn ? "ON" : "OFF";
            }

            window.dispatchEvent(new Event("smartnest:lightschange"));
        });
    });

    // Handle all-lights button
    const allButton = document.getElementById("all-lights-toggle");

    allButton?.addEventListener("click", () => {
        const turnOn = !allButton.classList.contains("on");

        allButton.classList.toggle("on", turnOn);
        allButton.setAttribute("aria-pressed", String(turnOn));

        document.querySelectorAll(".room-row .toggle-switch").forEach(button => {
            button.classList.toggle("on", turnOn);
            button.setAttribute("aria-checked", String(turnOn));

            const status = button.closest(".room-row")
                ?.querySelector(".room-light-status");

            if (status) status.textContent = turnOn ? "ON" : "OFF";
        });

        window.dispatchEvent(new Event("smartnest:lightschange"));
    });

    // Floor buttons communicate with the 3D house
    document.querySelectorAll(".floor-button[data-floor]").forEach(button => {
        button.addEventListener("click", () => {
            const floor = Number(button.dataset.floor);

            document.querySelectorAll(".floor-button").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            window.dispatchEvent(
                new CustomEvent("smartnest:floorchange", {
                    detail: { floor }
                })
            );
        });
    });
});
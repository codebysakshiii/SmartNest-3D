const roomRows = [...document.querySelectorAll(".room-row")];
const navItems = [...document.querySelectorAll(".nav-item[data-page]")];
const floorButtons = [...document.querySelectorAll(".floor-button")];

const lightsActive = document.getElementById("lights-active");
const devicesOnline = document.getElementById("devices-online");
const lightPercentage = document.getElementById("light-percentage");
const toastContainer = document.getElementById("toast-container");

let currentFloor = 0;
let houseInitialized = false;

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3000);
}

function getActiveLights() {
    return roomRows.filter(row =>
        row.querySelector(".toggle-switch").classList.contains("on")
    ).length;
}

function updateLightStats() {
    const active = getActiveLights();
    const total = roomRows.length;

    lightsActive.textContent = active;
    devicesOnline.textContent = active;
    lightPercentage.textContent = `${Math.round(active / total * 100)}% active`;
}

function setLight(row, isOn, announce = true) {
    const toggle = row.querySelector(".toggle-switch");
    const status = row.querySelector(".room-light-status");

    toggle.classList.toggle("on", isOn);
    toggle.setAttribute("aria-checked", String(isOn));

    status.textContent = isOn ? "ON" : "OFF";
    status.classList.toggle("is-on", isOn);

    updateLightStats();

    if (announce) {
        const roomName = row.dataset.room;
        showToast(`${roomName} lights turned ${isOn ? "ON" : "OFF"}.`);
    }
}

roomRows.forEach(row => {
    const toggle = row.querySelector(".toggle-switch");

    setLight(row, toggle.classList.contains("on"), false);

    toggle.addEventListener("click", () => {
        setLight(row, !toggle.classList.contains("on"));
    });
});

document.getElementById("all-lights-toggle").addEventListener("click", () => {
    const turnOn = getActiveLights() !== roomRows.length;

    roomRows.forEach(row => setLight(row, turnOn, false));

    showToast(turnOn ? "All room lights are ON." : "All room lights are OFF.");
});

document.querySelectorAll(".automation-toggle").forEach(toggle => {
    toggle.addEventListener("click", () => {
        const isOn = !toggle.classList.contains("on");

        toggle.classList.toggle("on", isOn);
        toggle.setAttribute("aria-checked", String(isOn));

        const name = toggle.closest(".automation-card")
            .querySelector("strong").textContent;

        showToast(`${name} automation ${isOn ? "enabled" : "disabled"}.`);
    });
});

floorButtons.forEach(button => {
    button.addEventListener("click", () => {
        currentFloor = Number(button.dataset.floor);

        floorButtons.forEach(item => {
            const isActive = item === button;
            item.classList.toggle("active", isActive);
            item.setAttribute("aria-pressed", String(isActive));
        });

        showToast(
            currentFloor === 0
                ? "Ground floor selected."
                : "First floor selected."
        );

        // The 3D engine will use this selection in the next phase.
        window.dispatchEvent(new CustomEvent("smartnest:floorchange", {
            detail: { floor: currentFloor }
        }));
    });
});

function navigateTo(page, label) {
    navItems.forEach(item => {
        item.classList.toggle("active", item.dataset.page === page);
    });

    document.getElementById("page-title").textContent = label;

    const destinations = {
        overview: "welcome-heading",
        house: "house-panel",
        rooms: "room-list",
        automation: "automation-panel",
        energy: "energy-panel",
        settings: "theme-toggle"
    };

    const target = document.getElementById(destinations[page]);

    if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (page !== "overview") {
        showToast(`${label} selected. Additional functionality is being built.`);
    }
}

navItems.forEach(item => {
    item.addEventListener("click", () => {
        const labels = {
            overview: "Overview",
            house: "3D House",
            rooms: "Rooms & Devices",
            automation: "Automation",
            energy: "Energy Analytics",
            settings: "Settings"
        };

        navigateTo(item.dataset.page, labels[item.dataset.page]);
    });
});

document.querySelectorAll("[data-page]:not(.nav-item)").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;
        const navButton = navItems.find(item => item.dataset.page === page);

        if (navButton) {
            navButton.click();
        }
    });
});

document.getElementById("theme-toggle").addEventListener("click", () => {
    document.body.classList.toggle("light-theme");

    const lightMode = document.body.classList.contains("light-theme");

    showToast(lightMode ? "Light theme enabled." : "Dark theme enabled.");
});

document.getElementById("quick-action").addEventListener("click", () => {
    const options = [
        "Turn all lights on",
        "Turn all lights off",
        "Enable night mode"
    ];

    const choice = window.prompt(
        "Choose a quick action:\n1. Turn all lights on\n2. Turn all lights off\n3. Enable night mode\n\nEnter 1, 2, or 3:"
    );

    if (choice === "1" || choice === "2") {
        const turnOn = choice === "1";

        roomRows.forEach(row => setLight(row, turnOn, false));

        showToast(turnOn ? "All lights switched on." : "All lights switched off.");
    } else if (choice === "3") {
        document.body.classList.add("light-theme");
        showToast("Demo night-mode action selected.");
    } else if (choice !== null) {
        showToast("No valid action selected.");
    }
});



updateLightStats();

console.log("SmartNest AI dashboard initialized.");
console.log("Demo mode: sensor readings and energy data are simulated.");


// ========================================
// SMARTNEST AI - INTERACTIVE 3D HOUSE
// ========================================

let smartNestScene = null;
let smartNestRenderer = null;
let smartNestCamera = null;
let smartNestHouse = null;
let smartNestAnimationId = null;

async function createSmartNestHouse() {
    const stage = document.getElementById("house-stage");
    const placeholder = stage.querySelector(".house-placeholder");
    const loadButton = document.getElementById("load-house");

    if (smartNestRenderer) {
        showToast("3D house is already running.");
        return;
    }

    loadButton.disabled = true;
    loadButton.textContent = "Building your house...";

    try {
        const THREE = await import(
            "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"
        );

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#102019");

        const camera = new THREE.PerspectiveCamera(
            42,
            stage.clientWidth / stage.clientHeight,
            0.1,
            100
        );

        camera.position.set(10, 9, 12);
        camera.lookAt(0, 2, 0);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false
        });

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(stage.clientWidth, stage.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.display = "block";
        renderer.domElement.style.borderRadius = "12px";

        stage.insertBefore(renderer.domElement, stage.firstChild);

        smartNestScene = scene;
        smartNestRenderer = renderer;
        smartNestCamera = camera;

        // Lighting
        scene.add(new THREE.HemisphereLight("#d8f7df", "#18261e", 2));

        const sunlight = new THREE.DirectionalLight("#fff1d0", 3);
        sunlight.position.set(8, 12, 6);
        sunlight.castShadow = true;
        scene.add(sunlight);

        // Materials
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: "#e4e5d9",
            roughness: 0.85
        });

        const floorMaterial = new THREE.MeshStandardMaterial({
            color: "#b88d62",
            roughness: 0.8
        });

        const roofMaterial = new THREE.MeshStandardMaterial({
            color: "#344d3b",
            roughness: 0.9
        });

        const glassMaterial = new THREE.MeshStandardMaterial({
            color: "#75c9dc",
            metalness: 0.2,
            roughness: 0.2
        });

        const furnitureMaterial = new THREE.MeshStandardMaterial({
            color: "#795a42",
            roughness: 0.75
        });

        const house = new THREE.Group();
        scene.add(house);
        smartNestHouse = house;

        function box(width, height, depth, material, x, y, z, parent = house) {
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            parent.add(mesh);
            return mesh;
        }

        // Ground platform
        box(9, 0.25, 7, roofMaterial, 0, -0.1, 0);

        // Two floors
        box(8, 0.18, 6, floorMaterial, 0, 0.15, 0);
        box(8, 0.18, 6, floorMaterial, 0, 3.15, 0);

        // Exterior walls: ground floor
        box(8, 2.7, 0.18, wallMaterial, 0, 1.5, -3);
        box(0.18, 2.7, 6, wallMaterial, -4, 1.5, 0);
        box(0.18, 2.7, 6, wallMaterial, 4, 1.5, 0);
        box(8, 2.7, 0.18, wallMaterial, 0, 1.5, 3);

        // Exterior walls: first floor
        box(8, 2.7, 0.18, wallMaterial, 0, 4.5, -3);
        box(0.18, 2.7, 6, wallMaterial, -4, 4.5, 0);
        box(0.18, 2.7, 6, wallMaterial, 4, 4.5, 0);
        box(8, 2.7, 0.18, wallMaterial, 0, 4.5, 3);

        // Interior partitions
        box(0.12, 2.5, 5.8, wallMaterial, 0, 1.5, 0);
        box(3.8, 2.5, 0.12, wallMaterial, -2, 1.5, 0);
        box(3.8, 2.5, 0.12, wallMaterial, 2, 1.5, 0);

        box(0.12, 2.5, 5.8, wallMaterial, 0, 4.5, 0);
        box(3.8, 2.5, 0.12, wallMaterial, -2, 4.5, 0);
        box(3.8, 2.5, 0.12, wallMaterial, 2, 4.5, 0);

        // Flat modern roof
        
        // Windows
        const windowPositions = [
            [-2.4, 1.7, 3.11],
            [2.4, 1.7, 3.11],
            [-2.4, 4.7, 3.11],
            [2.4, 4.7, 3.11]
        ];

        windowPositions.forEach(([x, y, z]) => {
            box(1.05, 0.95, 0.07, glassMaterial, x, y, z);
        });

        // Furniture: sofas, tables, beds and wardrobes
        // Ground-floor living room
        box(1.7, 0.35, 0.8, furnitureMaterial, -2.7, 0.48, 1.2);
        box(1.7, 0.75, 0.18, furnitureMaterial, -2.7, 0.85, 1.55);
        box(0.9, 0.15, 0.6, roofMaterial, -2.7, 0.42, 0);

        // Kitchen counters
        box(1.5, 0.9, 0.7, furnitureMaterial, 2.6, 0.65, -1.9);
        box(1.5, 0.08, 0.72, wallMaterial, 2.6, 1.13, -1.9);

        // Ground-floor room furniture
        box(1.1, 0.5, 1.4, furnitureMaterial, -2.6, 0.5, -1.8);

        // First-floor beds
        box(1.6, 0.35, 2, wallMaterial, -2.5, 3.48, 1.2);
        box(1.65, 0.18, 0.5, roofMaterial, -2.5, 3.73, 1.85);

        box(1.5, 0.35, 1.8, wallMaterial, 2.5, 3.48, -1.7);
        box(1.55, 0.18, 0.5, roofMaterial, 2.5, 3.73, -1.2);

        // Wardrobes
        box(0.6, 1.8, 0.65, furnitureMaterial, -3.35, 4.1, -1.7);
        box(0.6, 1.8, 0.65, furnitureMaterial, 3.35, 4.1, 1.7);

        // Room lights
        const roomLights = [];

        [
            [-2, 2.35, 1],
            [2, 2.35, -1],
            [-2, 5.35, 1],
            [2, 5.35, -1]
        ].forEach(([x, y, z]) => {
            const light = new THREE.PointLight("#b9ff78", 12, 4);
            light.position.set(x, y, z);
            house.add(light);
            roomLights.push(light);

            const bulb = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 16, 12),
                new THREE.MeshBasicMaterial({ color: "#c9ff87" })
            );

            bulb.position.set(x, y, z);
            house.add(bulb);
        });

        // Ground plane
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshStandardMaterial({ color: "#18271f" })
        );

        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.25;
        ground.receiveShadow = true;
        scene.add(ground);

        // Remove placeholder only after the house is successfully created
        if (placeholder) {
            placeholder.style.display = "none";
        }

        // Connect existing room controls to house lighting
        function syncHouseLights() {
            const active = getActiveLights() > 0;

            roomLights.forEach(light => {
                light.intensity = active ? 12 : 0;
            });
        }

        roomRows.forEach(row => {
            row.querySelector(".toggle-switch").addEventListener(
                "click",
                () => window.setTimeout(syncHouseLights, 0)
            );
        });

        document.getElementById("all-lights-toggle")
            .addEventListener("click", () => {
                window.setTimeout(syncHouseLights, 0);
            });

        // Floor selector changes the camera view
        window.addEventListener("smartnest:floorchange", event => {
    const firstFloor = event.detail.floor === 1;

    // Move camera closer to the selected floor
    camera.position.set(
        firstFloor ? 9 : 10,
        firstFloor ? 8 : 6.5,
        firstFloor ? 10 : 11
    );

    // Focus on the selected floor
    camera.lookAt(
        0,
        firstFloor ? 4.3 : 1.5,
        0
    );

    showToast(
        firstFloor
            ? "Viewing first floor."
            : "Viewing ground floor."
    );
});

        // Mouse drag rotates the house
        let dragging = false;
        let lastX = 0;
        let lastY = 0;

        renderer.domElement.style.cursor = "grab";

        renderer.domElement.addEventListener("pointerdown", event => {
            dragging = true;
            lastX = event.clientX;
            lastY = event.clientY;
            renderer.domElement.setPointerCapture(event.pointerId);
            renderer.domElement.style.cursor = "grabbing";
        });

        renderer.domElement.addEventListener("pointermove", event => {
            if (!dragging) return;

            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;

            house.rotation.y += dx * 0.008;
            camera.position.y = Math.max(
                4,
                Math.min(16, camera.position.y - dy * 0.025)
            );

            lastX = event.clientX;
            lastY = event.clientY;
        });

        renderer.domElement.addEventListener("pointerup", () => {
            dragging = false;
            renderer.domElement.style.cursor = "grab";
        });

        renderer.domElement.addEventListener("pointercancel", () => {
            dragging = false;
            renderer.domElement.style.cursor = "grab";
        });

        // Responsive rendering
        const resizeObserver = new ResizeObserver(() => {
            if (!stage.clientWidth || !stage.clientHeight) return;

            camera.aspect = stage.clientWidth / stage.clientHeight;
            camera.updateProjectionMatrix();

            renderer.setSize(stage.clientWidth, stage.clientHeight);
        });

        resizeObserver.observe(stage);

        // Animation loop
        function animateHouse() {
            smartNestAnimationId = requestAnimationFrame(animateHouse);
            renderer.render(scene, camera);
        }

        animateHouse();

        houseInitialized = true;
        loadButton.textContent = "3D House Ready ✓";
        showToast("Your interactive 3D home is ready!");

    } catch (error) {
        console.error("SmartNest 3D house error:", error);

        loadButton.disabled = false;
        loadButton.textContent = "Retry 3D House";

        showToast("3D house could not load. Check the browser console.");
    }
}

// Connect the existing Initialize 3D House button
document.getElementById("load-house").addEventListener(
    "click",
    createSmartNestHouse
);
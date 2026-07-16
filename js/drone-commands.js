// Drone simulation: shared state, serialized flight commands, scene loading,
// collision handling, audio, smoke trails, and rendering.

// Shared application and simulation state
let scene;
let camera;
let renderer;
let drone;
const defaultFlightAltitude = 10.0;
const getNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};
const getDuration = value => {
    const duration = getNumber(value);
    return duration > 0 ? duration : 0;
};
const normalizeDegrees = angle => ((angle % 360) + 360) % 360;
const getShortestAngleDelta = (from, to) => ((to - from + 540) % 360) - 180;

// Convert local drone coordinates into Three.js world coordinates. X is lateral,
// Y is vertical, and Z is forward/backward relative to the current heading.
const resolveRelativeOffset = (x, y, z, direction) => {
    const forwardRad = THREE.MathUtils.degToRad(direction - 90);
    const rightRad = forwardRad - Math.PI / 2;
    return new THREE.Vector3(
        Math.sin(rightRad) * x + Math.sin(forwardRad) * z,
        y,
        Math.cos(rightRad) * x + Math.cos(forwardRad) * z
    );
};

// Build a cubic arc in the plane defined by the three path points. Computing
// the circle in 3D keeps vertical and tilted curves circular too, instead of
// reducing them to a parabolic fallback when their X/Z projection is a line.
const computeArcControls = (startPoint, viaPoint, targetPoint) => {
    const startToVia = viaPoint.clone().sub(startPoint);
    const startToTarget = targetPoint.clone().sub(startPoint);
    const normal = new THREE.Vector3().crossVectors(startToVia, startToTarget);
    const normalLengthSq = normal.lengthSq();
    const pointScale = startToVia.lengthSq() * startToTarget.lengthSq();
    if (pointScale === 0 || normalLengthSq <= pointScale * 1e-12) return null;

    const centerOffset = new THREE.Vector3()
        .crossVectors(startToTarget, normal)
        .multiplyScalar(startToVia.lengthSq())
        .add(
            new THREE.Vector3()
                .crossVectors(normal, startToVia)
                .multiplyScalar(startToTarget.lengthSq())
        )
        .multiplyScalar(1 / (2 * normalLengthSq));
    const center = startPoint.clone().add(centerOffset);
    const tangentAt = point => {
        const radius = point.clone().sub(center);
        if (radius.lengthSq() < 1e-12) return null;
        return new THREE.Vector3().crossVectors(normal, radius).normalize();
    };
    const startTangent = tangentAt(startPoint);
    const endTangent = tangentAt(targetPoint);
    if (!startTangent || !endTangent) return null;

    // A cubic Bezier is at 1/8 P0 + 3/8 P1 + 3/8 P2 + 1/8 P3
    // halfway through. Solve the two tangent lengths so it crosses viaPoint.
    const desired = viaPoint.clone()
        .sub(startPoint.clone().add(targetPoint).multiplyScalar(0.5))
        .multiplyScalar(1 / 0.375);
    const reverseEndTangent = endTangent.clone().multiplyScalar(-1);
    const tangentDot = startTangent.dot(reverseEndTangent);
    const determinant = 1 - tangentDot * tangentDot;
    let startLength;
    let endLength;

    if (Math.abs(determinant) > 1e-6) {
        const startProjection = startTangent.dot(desired);
        const endProjection = reverseEndTangent.dot(desired);
        startLength = (startProjection - tangentDot * endProjection) / determinant;
        endLength = (endProjection - tangentDot * startProjection) / determinant;
    } else {
        const combined = startTangent.clone().add(reverseEndTangent);
        const combinedLengthSq = combined.lengthSq();
        if (combinedLengthSq < 1e-6) return null;
        startLength = desired.dot(combined) / combinedLengthSq;
        endLength = startLength;
    }

    if (!Number.isFinite(startLength) || !Number.isFinite(endLength) || startLength <= 0 || endLength <= 0) {
        return null;
    }

    return {
        controlPoint1: startPoint.clone().add(startTangent.multiplyScalar(startLength)),
        controlPoint2: targetPoint.clone().sub(endTangent.multiplyScalar(endLength))
    };
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, getDuration(ms)));
const waitSeconds = seconds => sleep(Number(seconds) * 1000);
const graphicsProfiles = {
    performance: {
        pixelRatio: 0.75,
        shadows: false,
        shadowMapSize: 512,
        anisotropy: 1,
        smokeMax: 60,
        smokeInterval: 160,
        smokeRadius: 0.09
    },
    balanced: {
        pixelRatio: 1,
        shadows: true,
        shadowMapSize: 2048,
        anisotropy: 4,
        smokeMax: 140,
        smokeInterval: 90,
        smokeRadius: 0.12
    },
    quality: {
        pixelRatio: 1.5,
        shadows: true,
        shadowMapSize: 4096,
        anisotropy: 8,
        smokeMax: 240,
        smokeInterval: 45,
        smokeRadius: 0.16
    }
};
let graphicsProfileName = localStorage.getItem('graphicsProfile') || 'balanced';
let activeGraphicsProfile = graphicsProfiles[graphicsProfileName] || graphicsProfiles.balanced;
const collisionPadding = 1.4;
const collisionRayStartHeight = 10000;
const collisionRaycaster = new THREE.Raycaster();
let collisionMeshes = [];
let groundMeshes = [];
let directionalLight;
let droneGroundMarker;
let lastSmokeTime = 0;

// Camera state is updated by UI events and consumed by the render loop.
let isRightMouseDown = false;
const defaultCameraOffset = new THREE.Vector3(0, 5, 10).multiplyScalar(2.5);
const cameraOffset = defaultCameraOffset.clone();

let prevMousePos = {
    x: 0,
    y: 0
};
let cameraAngle = {
    x: 0,
    y: 0
};


// Serialized command execution
const commandQueue = [];
const addCommand = cmdFunction => {
    const commandPromise = new Promise((resolve, reject) => {
        commandQueue.push(next => {
            let completed = false;
            const completeCommand = () => {
                if (completed) return;
                completed = true;
                resolve();
                next();
            };
            try {
                cmdFunction(completeCommand);
            } catch (error) {
                if (!completed) {
                    completed = true;
                    reject(error);
                    next();
                }
            }
        });
    });
    if (commandQueue.length === 1) processQueue();
    return commandPromise;
};
const processQueue = () => {
    if (!commandQueue.length) return;
    const cmd = commandQueue.shift();
    cmd(processQueue);
};

// Drive numeric animations with requestAnimationFrame while handling zero-duration
// commands synchronously. Every flight command completes through the same callback.
const animateProperty = (setter, from, to, duration, onComplete) => {
    const safeDuration = getDuration(duration);
    if (safeDuration === 0) {
        setter(to);
        if (onComplete) onComplete();
        return;
    }
    const startTime = performance.now();
    const step = timestamp => {
        const progress = Math.min((timestamp - startTime) / safeDuration, 1);
        setter(from + (to - from) * progress);
        if (progress < 1) {
            requestAnimationFrame(step);
        } else if (onComplete) {
            onComplete();
        }
    };
    requestAnimationFrame(step);
};

// Terrain collision and graphics profiles
const registerCollisionMesh = mesh => {
    if (!mesh || !mesh.isMesh || mesh.userData.noCollision) return;
    collisionMeshes.push(mesh);
};

const registerGroundMesh = mesh => {
    if (!mesh || !mesh.isMesh || mesh.userData.noCollision) return;
    groundMeshes.push(mesh);
};

const collectCollisionMeshes = root => {
    root.traverse(obj => registerCollisionMesh(obj));
};

const getHeightAt = (meshes, x, z) => {
    if (!meshes.length) return 0;
    collisionRaycaster.set(
        new THREE.Vector3(x, collisionRayStartHeight, z),
        new THREE.Vector3(0, -1, 0)
    );
    const intersections = collisionRaycaster.intersectObjects(meshes, false);
    if (!intersections.length) return 0;
    return intersections[0].point.y;
};

const getSurfaceHeightAt = (x, z) => getHeightAt(collisionMeshes, x, z);
const getGroundHeightAt = (x, z) => getHeightAt(groundMeshes, x, z);

const getSafeAltitudeAt = (x, z) => getSurfaceHeightAt(x, z) + collisionPadding;

const getProfilePixelRatio = () => Math.min(window.devicePixelRatio || 1, activeGraphicsProfile.pixelRatio);

const getProfileAnisotropy = () => {
    if (!renderer || !renderer.capabilities || !renderer.capabilities.getMaxAnisotropy) {
        return activeGraphicsProfile.anisotropy;
    }
    return Math.min(activeGraphicsProfile.anisotropy, renderer.capabilities.getMaxAnisotropy());
};

const applyTextureQuality = texture => {
    if (!texture || !texture.image) return;
    texture.anisotropy = getProfileAnisotropy();
    texture.needsUpdate = true;
};

const applyObjectShadowProfile = object => {
    if (!object || !object.isMesh || object.userData.noShadow) return;
    object.castShadow = activeGraphicsProfile.shadows && !object.userData.ground;
    object.receiveShadow = activeGraphicsProfile.shadows;
};

const refreshSceneGraphicsProfile = () => {
    if (!scene) return;
    scene.traverse(object => {
        applyObjectShadowProfile(object);
        if (!object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => applyTextureQuality(material.map));
    });
};

const applyGraphicsProfile = profileName => {
    graphicsProfileName = graphicsProfiles[profileName] ? profileName : 'balanced';
    activeGraphicsProfile = graphicsProfiles[graphicsProfileName];
    localStorage.setItem('graphicsProfile', graphicsProfileName);

    if (renderer) {
        renderer.setPixelRatio(getProfilePixelRatio());
        renderer.shadowMap.enabled = activeGraphicsProfile.shadows;
    }

    if (directionalLight) {
        directionalLight.castShadow = activeGraphicsProfile.shadows;
        directionalLight.shadow.mapSize.set(activeGraphicsProfile.shadowMapSize, activeGraphicsProfile.shadowMapSize);
        if (directionalLight.shadow.map) {
            directionalLight.shadow.map.dispose();
            directionalLight.shadow.map = null;
        }
        directionalLight.shadow.needsUpdate = true;
    }

    if (droneGroundMarker) droneGroundMarker.visible = graphicsProfileName === 'performance';


    refreshSceneGraphicsProfile();
    updateSmokeLine();
    if (renderer) updateWebGLCanvas();
};

const enforceTerrainCollision = () => {
    if (!drone || !drone.mesh || !collisionMeshes.length) return;
    const minAltitude = drone.flying ?
        getSafeAltitudeAt(drone.mesh.position.x, drone.mesh.position.z) :
        getGroundHeightAt(drone.mesh.position.x, drone.mesh.position.z) + collisionPadding;
    if (drone.mesh.position.y < minAltitude) {
        drone.mesh.position.y = minAltitude;
        drone.altitude = minAltitude;
        updateStatus();
    }
};


// Drone engine audio
let audioCtx = null;
let droneBuffer = null;
let droneSource = null;
let gainNode = null;
const basePlaybackRate = 1.0;
const defaultVolume = 0.05;

let audioLoadPromise = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();

        gainNode = audioCtx.createGain();
        gainNode.gain.value = defaultVolume;
        gainNode.connect(audioCtx.destination);

        audioLoadPromise = fetch('sounds/drone.mp3')
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
            .then(buffer => {
                droneBuffer = buffer;
                console.log('Drone audio loaded');
            })
            .catch(err => console.error('Unable to load drone audio:', err));
    }
}

function playDroneSound() {
    if (!audioLoadPromise) {
        console.error('Drone audio was requested before initialization');
        return;
    }
    audioLoadPromise.then(() => {
        if (!audioCtx || !droneBuffer) {
            console.error('Drone audio is not initialized or its buffer is unavailable');
            return;
        }
        if (droneSource) {
            droneSource.stop();
            droneSource.disconnect();
        }
        droneSource = audioCtx.createBufferSource();
        droneSource.buffer = droneBuffer;
        droneSource.loop = true;

        droneSource.loopStart = 0;
        droneSource.loopEnd = droneBuffer.duration;

        droneSource.playbackRate.value = basePlaybackRate;

        droneSource.connect(gainNode);
        droneSource.start();
    });
}

function stopDroneSound() {
    if (droneSource) {
        droneSource.stop();
        droneSource.disconnect();
        droneSource = null;
    }
}

function updateDroneSound(newPlaybackRate) {
    if (droneSource) {
        droneSource.playbackRate.value = newPlaybackRate;
    }
}

// Scenario loading
function loadScenario(file) {
    if (!file) {
        return;
    }

    // Preserve infrastructure objects such as the drone, lights, and sky.
    scene.children = scene.children.filter(child => child.userData.type === 'keep');
    collisionMeshes = [];
    groundMeshes = [];
    collectCollisionMeshes(scene);

    fetch('backgrounds/' + file)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Terrain
            const textureName = data.groundTexture || 'grass.jpg';
            const hillHeight = data.hillHeight || 25;

            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                'textures/' + textureName,
                function(texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    applyTextureQuality(texture);

                    const planeSize = 4100;
                    const textureSize = 1024;
                    texture.repeat.set(planeSize / textureSize, planeSize / textureSize);

                    // Dispose the previous terrain before installing the new one.
                    const oldPlanes = scene.children.filter(obj => obj.userData.ground);
                    oldPlanes.forEach(p => {
                        scene.remove(p);
                        if (p.geometry) p.geometry.dispose();
                        if (p.material) p.material.dispose();
                    });
                    collisionMeshes = [];
                    groundMeshes = [];
                    collectCollisionMeshes(scene);

                    // Scenario-specific fog, with the flight-field defaults as fallback.
                    if (data.fog) {
                        const color = new THREE.Color(data.fog.color || 0x87ceeb);
                        const near = data.fog.near !== undefined ? data.fog.near : 200;
                        const far = data.fog.far !== undefined ? data.fog.far : 2500;
                        scene.fog = new THREE.Fog(color, near, far);
                        scene.background = color;
                    } else {
                        const defaultColor = new THREE.Color(0x87ceeb);
                        scene.fog = new THREE.Fog(defaultColor, 200, 2500);
                        scene.background = defaultColor;
                    }

                    // Segments provide vertices that can be displaced into rolling hills.
                    const geometry = new THREE.PlaneGeometry(planeSize, planeSize, 32, 32);

                    const vertices = geometry.vertices;
                    const radius = 200; // Keep a flat take-off area around the origin.

                    for (let i = 0; i < vertices.length; i++) {
                        const v = vertices[i];
                        const distance = Math.sqrt(v.x * v.x + v.y * v.y);

                        if (distance < radius) {
                            v.z = 0;
                        } else {
                            const rx = Math.random() * (1.0 - 0.001) + 0.001;
                            const ry = Math.random() * (1.0 - 0.001) + 0.001;
                            v.z = hillHeight * Math.sin(v.x * rx) * Math.cos(v.y * ry);
                        }
                    }
                    geometry.computeFaceNormals();
                    geometry.computeVertexNormals();

                    const planeMaterial = new THREE.MeshLambertMaterial({
                        map: texture
                    });

                    const plane = new THREE.Mesh(geometry, planeMaterial);
                    plane.rotation.x = -Math.PI / 2;
                    plane.receiveShadow = activeGraphicsProfile.shadows;
                    plane.userData.type = 'keep';
                    plane.userData.ground = true;
                    scene.add(plane);
                    registerCollisionMesh(plane);
                    registerGroundMesh(plane);
                    resetScene();
                    enforceTerrainCollision();
                },
                undefined,
                function(err) {
                    console.error('Unable to load the terrain texture:', err);
                }
            );

            // Scenario OBJ/MTL models
            if (!data.objects) return;

            data.objects.forEach(obj => {
                const mtlLoader = new THREE.MTLLoader();
                mtlLoader.setPath('models/');
                mtlLoader.load(obj.material, materials => {
                        materials.preload();

                        const objLoader = new THREE.OBJLoader();
                        objLoader.setMaterials(materials);
                        objLoader.setPath('models/');
                        objLoader.load(obj.model, object => {
                                object.traverse(child => {
                                    if (child.isMesh) {
                                        child.castShadow = activeGraphicsProfile.shadows;
                                        child.receiveShadow = activeGraphicsProfile.shadows;
                                        child.userData.type = 'scenario';
                                        registerCollisionMesh(child);
                                    }
                                });

                                const scale = obj.scale || 1;
                                object.scale.set(scale, scale, scale);

                                if (obj.position) {
                                    object.position.set(obj.position.x, obj.position.y, obj.position.z);
                                }

                                if (obj.rotation) {
                                    object.rotation.set(
                                        THREE.MathUtils.degToRad(obj.rotation.x || 0),
                                        THREE.MathUtils.degToRad(obj.rotation.y || 0),
                                        THREE.MathUtils.degToRad(obj.rotation.z || 0)
                                    );
                                }

                                scene.add(object);
                            },
                            undefined,
                            err => console.warn(`Unable to load OBJ "${obj.model}":`, err));
                    },
                    undefined,
                    err => console.warn(`Unable to load MTL "${obj.material}":`, err));
            });
        })
        .catch(err => console.error('Unable to load the scenario:', err));
}

// Three.js scene and drone controller initialization
const initThree = () => {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87ceeb, 200, 2500);
    scene.background = new THREE.Color(0x87ceeb);
    camera = new THREE.PerspectiveCamera(75, 4 / 3, 0.1, 1000000);
    camera.position.set(4, 0, 4);
    cameraAngle.x = Math.PI / 2;
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setPixelRatio(getProfilePixelRatio());
    renderer.shadowMap.enabled = activeGraphicsProfile.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    webglContainer.appendChild(renderer.domElement);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    ambientLight.userData.type = 'keep';
    scene.add(ambientLight);


    directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(0, 100, 0);
    directionalLight.castShadow = activeGraphicsProfile.shadows;
    directionalLight.userData.type = 'keep';
    scene.add(directionalLight);
    directionalLight.shadow.mapSize.set(activeGraphicsProfile.shadowMapSize, activeGraphicsProfile.shadowMapSize);
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -55;
    directionalLight.shadow.camera.right = 55;
    directionalLight.shadow.camera.top = 55;
    directionalLight.shadow.camera.bottom = -55;

    // Render the sky texture on the inside of a sphere around the flight area.
    const geometry = new THREE.SphereGeometry(2000, 32, 16);
    const sky_texture = new THREE.TextureLoader().load('textures/sky_campo_di_volo.png');
    const material = new THREE.MeshBasicMaterial({
        map: sky_texture,
        side: THREE.BackSide
    });
    const skySphere = new THREE.Mesh(geometry, material);
    skySphere.userData.noCollision = true;
    skySphere.userData.noShadow = true;
    skySphere.userData.type = 'keep';
    scene.add(skySphere);

    // Default ground shown before a scenario is selected.
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
        'textures/grass.jpg',
        function(texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            applyTextureQuality(texture);

            const planeSize = 4100;
            const textureSize = 256;

            texture.repeat.set(planeSize / textureSize, planeSize / textureSize);

            const planeMaterial = new THREE.MeshLambertMaterial({
                map: texture
            });

            const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeSize, planeSize), planeMaterial);
            plane.rotation.x = -Math.PI / 2;
            plane.receiveShadow = activeGraphicsProfile.shadows;
            plane.userData.ground = true;
            registerCollisionMesh(plane);
            registerGroundMesh(plane);
            scene.add(plane);
        },
        undefined,
        function(err) {
            console.error('Error in texture download', err);
        }
    );

    const piattaformaLoader = new THREE.TextureLoader();
    piattaformaLoader.load(
        'textures/piattaforma.png',
        function(texture) {
            const planeMaterial = new THREE.MeshLambertMaterial({
                map: texture,
                transparent: true
            });
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(16, 16, 1, 1), planeMaterial);
            plane.rotation.x = -Math.PI / 2;
            plane.position.y = 0.3;
            plane.receiveShadow = activeGraphicsProfile.shadows;
            registerCollisionMesh(plane);
            scene.add(plane);
            plane.userData.type = 'keep';
        },
        undefined,
        function(err) {
            console.error('Error in texture download', err);
        }
    );

    function createStlMaterial(geometry, fallbackColor) {
        if (geometry.hasColors) {
            return new THREE.MeshPhongMaterial({
                vertexColors: true,
                shininess: 30
            });
        }
        return new THREE.MeshPhongMaterial({
            color: fallbackColor,
            shininess: 30
        });
    }

    function addPropellers() {
        if (!drone.mesh) {
            console.error('Cannot attach propellers before the drone model is loaded');
            return;
        }

        const loader = new THREE.STLLoader();
        loader.load('models/elica.stl', (propellerGeometry) => {
            propellerGeometry.translate(0, -8, 0);
            const propellerMaterial = createStlMaterial(propellerGeometry, 0xFF0000);

            const positions = [{
                x: -580,
                z: -620
            }, {
                x: -580,
                z: 620
            }, {
                x: 600,
                z: -620
            }, {
                x: 600,
                z: 620
            }];

            drone.propellers = [];

            positions.forEach((pos, index) => {
                const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
                propeller.position.set(pos.x, 200.0, pos.z);
                propeller.userData.noCollision = true;
                propeller.castShadow = activeGraphicsProfile.shadows;

                drone.mesh.add(propeller);
                drone.propellers.push(propeller);
            });
        });
    }

    var object;
    const loader = new THREE.STLLoader();
    loader.load('models/drone.stl', (geometry) => {
        geometry.computeVertexNormals();
        const material = createStlMaterial(geometry, 0x404040);
        const object = new THREE.Mesh(geometry, material);
        object.scale.set(0.005, 0.005, 0.005);
        object.position.set(0, 1.4, 0);
        object.castShadow = activeGraphicsProfile.shadows;
        scene.add(object);

        drone.mesh = object;
        drone.mesh.userData.noCollision = true;
        drone.mesh.userData.type = 'keep';
        addPropellers();
        createDroneGuides();
    });

    // Generated Blockly programs call this controller. Each asynchronous method
    // enters the shared command queue so only one physical action runs at a time.
    drone = {
        mesh: object,
        propellers: [],
        flying: false,
        altitude: 1.5,
        direction: 0,
        smoke: 0,
        speed: 1.0,
        takeOff(callback) {
            if (!this.flying) {
                return addCommand(next => {
                    this.flying = true;
                    playDroneSound();
                    const startAltitude = this.altitude;
                    this.propellerInterval = setInterval(
                        () => {
                            if (this.propellers) {
                                this.propellers.forEach(
                                    prop => {
                                        prop.rotation.y += 2.00;
                                    }
                                );
                            }
                        }, 16
                    );
                    animateProperty(
                        val => {
                            this.mesh.position.y = val;
                            this.altitude = val;
                            updateStatus();
                        },
                        startAltitude, defaultFlightAltitude, 500,
                        () => {
                            updateStatus();
                            next();
                            if (callback) callback();
                        }
                    );
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        land(callback) {
            if (this.flying) {
                return addCommand(
                    next => {
                        const startAltitude = this.altitude;
                        const targetAltitude = getSafeAltitudeAt(this.mesh.position.x, this.mesh.position.z);
                        animateProperty(
                            val => {
                                const clampedAltitude = Math.max(val, targetAltitude);
                                this.mesh.position.y = clampedAltitude;
                                this.altitude = clampedAltitude;
                                updateStatus();
                            },
                            startAltitude, targetAltitude, 1000,
                            () => {
                                this.flying = false;
                                clearInterval(this.propellerInterval);
                                stopDroneSound();
                                updateStatus();
                                next();
                                if (callback) callback();
                            }
                        );
                    }
                );
            } else if (callback) callback();
            return Promise.resolve();
        },
        setAltitude(value, callback) {
            value = getNumber(value, this.altitude);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);
                    const startAltitude = this.altitude;
                    const minAltitude = getSafeAltitudeAt(this.mesh.position.x, this.mesh.position.z);
                    const targetAltitude = Math.max(value, minAltitude);
                    animateProperty(
                        val => {
                            const clampedAltitude = Math.max(val, minAltitude);
                            this.mesh.position.y = clampedAltitude;
                            this.altitude = clampedAltitude;
                            updateStatus();
                        },
                        startAltitude, targetAltitude, Math.abs(targetAltitude - startAltitude) * 50,
                        () => {
                            updateDroneSound(basePlaybackRate);
                            next();
                            if (callback) callback();
                        }
                    );
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        changeAltitude(value, callback) {
            value = getNumber(value);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);
                    const startAltitude = this.altitude;
                    const minAltitude = getSafeAltitudeAt(this.mesh.position.x, this.mesh.position.z);
                    const targetAltitude = Math.max(startAltitude + value, minAltitude);
                    animateProperty(
                        val => {
                            const clampedAltitude = Math.max(val, minAltitude);
                            this.mesh.position.y = clampedAltitude;
                            this.altitude = clampedAltitude;
                            updateStatus();
                        },
                        startAltitude, targetAltitude, Math.abs(targetAltitude - startAltitude) * 50,
                        () => {
                            updateDroneSound(basePlaybackRate);
                            next();
                            if (callback) callback();
                        }
                    );
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        setAngle(angle, callback) {
            angle = getNumber(angle);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);

                    const normalizedTarget = ((angle % 360) + 360) % 360;
                    const normalizedCurrent = ((-this.direction % 360) + 360) % 360;

                    let delta = normalizedTarget - normalizedCurrent;

                    if (delta > 180) delta -= 360;
                    if (delta < -180) delta += 360;

                    const startDirection = this.direction;
                    const targetDirection = normalizeDegrees(-normalizedTarget);

                    if (Math.abs(delta) < 0.05) {
                        this.direction = targetDirection;
                        this.mesh.rotation.y = THREE.MathUtils.degToRad(this.direction);
                        updateDroneSound(basePlaybackRate);
                        updateStatus();
                        next();
                        if (callback) callback();
                        return;
                    }

                    animateProperty(
                        val => {
                            this.direction = startDirection - delta * val;
                            this.mesh.rotation.y = THREE.MathUtils.degToRad(this.direction);
                            updateStatus();
                        },
                        0, 1, 500,
                        () => {
                            this.direction = targetDirection;
                            this.mesh.rotation.y = THREE.MathUtils.degToRad(this.direction);
                            updateDroneSound(basePlaybackRate);
                            updateStatus();
                            next();
                            if (callback) callback();
                        }
                    );
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        changeAngle(angle, callback) {
            angle = getNumber(angle);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);
                    const startDir = this.direction;
                    animateProperty(
                        val => {
                            let newDirection = startDir - angle * val;
                            this.direction = ((newDirection % 360) + 360) % 360;
                            this.mesh.rotation.y = THREE.MathUtils.degToRad(this.direction);
                            updateStatus();
                        },
                        0, 1, 500,
                        () => {
                            updateDroneSound(basePlaybackRate);
                            next();
                            if (callback) callback();
                        }
                    );
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        slide(distance, callback) {
            distance = getNumber(distance);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);
                    if (distance === 0) {
                        updateDroneSound(basePlaybackRate);
                        next();
                        if (callback) callback();
                        return;
                    }
                    const startX = this.mesh.position.x;
                    const startZ = this.mesh.position.z;
                    const rad = THREE.MathUtils.degToRad(this.direction);
                    this.mesh.rotation.y = THREE.MathUtils.degToRad(this.direction);
                    animateProperty(
                        val => {
                            this.mesh.rotation.x = THREE.MathUtils.degToRad(-10 * Math.sign(distance)) * val;
                        },
                        0, 1, 100,
                        () => {
                            animateProperty(
                                val => {
                                    this.mesh.position.x = startX - Math.sin(rad) * distance * val;
                                    this.mesh.position.z = startZ - Math.cos(rad) * distance * val;
                                    updateStatus();
                                },
                                0, 1, Math.abs(distance) * 50,
                                () => {
                                    animateProperty(
                                        val => {
                                            this.mesh.rotation.x = THREE.MathUtils.degToRad(20 * Math.sign(distance)) * val;
                                        },
                                        0, 1, 100,
                                        () => {
                                            updateDroneSound(basePlaybackRate);
                                            animateProperty(
                                                val => {
                                                    this.mesh.rotation.x = THREE.MathUtils.degToRad(-10 * Math.sign(distance)) * (1 - val);
                                                },
                                                0, 1, 100,
                                                () => {
                                                    next();
                                                    if (callback) callback();
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        walk(distance, callback) {
            distance = getNumber(distance);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);
                    const startX = this.mesh.position.x;
                    const startZ = this.mesh.position.z;
                    const rad = THREE.MathUtils.degToRad(this.direction - 90);
                    this.speed = Math.min(Math.max(getNumber(this.speed, 1.0), 0.0), 10.0);
                    if (distance === 0 || this.speed === 0) {
                        updateDroneSound(basePlaybackRate);
                        next();
                        if (callback) callback();
                        return;
                    }
                    animateProperty(
                        val => {
                            this.mesh.rotation.z = THREE.MathUtils.degToRad(10 * Math.sign(distance)) * val;
                        },
                        0, 1, 100,
                        () => {
                            animateProperty(
                                val => {
                                    this.mesh.position.x = startX + Math.sin(rad) * distance * val;
                                    this.mesh.position.z = startZ + Math.cos(rad) * distance * val;
                                    updateStatus();
                                },
                                0, 1, Math.abs(distance) * 50 / this.speed,
                                () => {
                                    animateProperty(
                                        val => {
                                            this.mesh.rotation.z = THREE.MathUtils.degToRad(-20 * Math.sign(distance)) * val;
                                        },
                                        0, 1, 100,
                                        () => {
                                            updateDroneSound(basePlaybackRate);
                                            animateProperty(
                                                val => {
                                                    this.mesh.rotation.z = THREE.MathUtils.degToRad(10 * Math.sign(distance)) * (1 - val);
                                                },
                                                0, 1, 100,
                                                () => {
                                                    next();
                                                    if (callback) callback();
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        walkClimbing(distance, climb, callback) {
            distance = getNumber(distance);
            climb = getNumber(climb);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);
                    const startX = this.mesh.position.x;
                    const startY = this.altitude;
                    const startZ = this.mesh.position.z;
                    const rad = THREE.MathUtils.degToRad(this.direction - 90);
                    const targetX = startX + Math.sin(rad) * distance;
                    const targetZ = startZ + Math.cos(rad) * distance;
                    const safeTargetY = Math.max(startY + climb, getSafeAltitudeAt(targetX, targetZ));
                    const deltaX = targetX - startX;
                    const deltaY = safeTargetY - startY;
                    const deltaZ = targetZ - startZ;
                    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
                    const leanAngle = distance === 0 ? 0 : 10 * Math.sign(distance);
                    this.speed = Math.min(Math.max(getNumber(this.speed, 1.0), 0.0), 10.0);
                    if (moveDistance === 0 || this.speed === 0) {
                        updateDroneSound(basePlaybackRate);
                        next();
                        if (callback) callback();
                        return;
                    }
                    this.mesh.rotation.y = THREE.MathUtils.degToRad(this.direction);
                    animateProperty(
                        val => {
                            this.mesh.rotation.z = THREE.MathUtils.degToRad(leanAngle) * val;
                        },
                        0, 1, 100,
                        () => {
                            animateProperty(
                                val => {
                                    const currentX = startX + deltaX * val;
                                    const currentZ = startZ + deltaZ * val;
                                    const minAltitude = getSafeAltitudeAt(currentX, currentZ);
                                    const currentY = Math.max(startY + deltaY * val, minAltitude);
                                    this.mesh.position.x = currentX;
                                    this.mesh.position.y = currentY;
                                    this.mesh.position.z = currentZ;
                                    this.altitude = currentY;
                                    updateStatus();
                                },
                                0, 1, moveDistance * 50 / this.speed,
                                () => {
                                    this.mesh.position.x = targetX;
                                    this.mesh.position.y = Math.max(safeTargetY, getSafeAltitudeAt(targetX, targetZ));
                                    this.mesh.position.z = targetZ;
                                    this.altitude = this.mesh.position.y;
                                    animateProperty(
                                        val => {
                                            this.mesh.rotation.z = THREE.MathUtils.degToRad(-2 * leanAngle) * val;
                                        },
                                        0, 1, 100,
                                        () => {
                                            updateDroneSound(basePlaybackRate);
                                            animateProperty(
                                                val => {
                                                    this.mesh.rotation.z = THREE.MathUtils.degToRad(leanAngle) * (1 - val);
                                                },
                                                0, 1, 100,
                                                () => {
                                                    this.mesh.rotation.z = 0;
                                                    updateStatus();
                                                    next();
                                                    if (callback) callback();
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        goTo(x, y, z, callback) {
            x = getNumber(x);
            y = getNumber(y, this.altitude);
            z = getNumber(z);
            return this.moveToInternal(-z, y, -x, callback, false);
        },
        moveBy(x, y, z, callback) {
            x = getNumber(x);
            y = getNumber(y);
            z = getNumber(z);
            const offset = resolveRelativeOffset(x, y, z, this.direction);
            return this.moveToInternal(
                this.mesh.position.x + offset.x,
                this.altitude + offset.y,
                this.mesh.position.z + offset.z,
                callback,
                false
            );
        },
        curveAbs(x, y, z, xd, yd, zd, callback) {
            x = getNumber(x);
            y = getNumber(y, this.altitude);
            z = getNumber(z);
            xd = getNumber(xd);
            yd = getNumber(yd, this.altitude);
            zd = getNumber(zd);
            return this.curveToInternal(-z, y, -x, -zd, yd, -xd, callback);
        },
        curve(x, y, z, xd, yd, zd, callback) {
            x = getNumber(x);
            y = getNumber(y);
            z = getNumber(z);
            xd = getNumber(xd);
            yd = getNumber(yd);
            zd = getNumber(zd);
            return this.curveToInternal(x, y, z, xd, yd, zd, callback, true);
        },
        returnToBase(callback) {
            return this.moveToInternal(0, defaultFlightAltitude, 0, callback);
        },
        curveToInternal(viaX, viaY, viaZ, targetX, targetY, targetZ, callback, useRelativeOffsets = false) {
            viaX = getNumber(viaX, this.mesh.position.x);
            viaY = getNumber(viaY, this.altitude);
            viaZ = getNumber(viaZ, this.mesh.position.z);
            targetX = getNumber(targetX, this.mesh.position.x);
            targetY = getNumber(targetY, this.altitude);
            targetZ = getNumber(targetZ, this.mesh.position.z);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);

                    const startPoint = new THREE.Vector3(this.mesh.position.x, this.altitude, this.mesh.position.z);
                    const viaOffset = useRelativeOffsets ?
                        resolveRelativeOffset(viaX, viaY, viaZ, this.direction) :
                        null;
                    const targetOffset = useRelativeOffsets ?
                        resolveRelativeOffset(targetX, targetY, targetZ, this.direction) :
                        null;
                    const resolvedViaX = useRelativeOffsets ? startPoint.x + viaOffset.x : viaX;
                    const resolvedViaY = useRelativeOffsets ? startPoint.y + viaOffset.y : viaY;
                    const resolvedViaZ = useRelativeOffsets ? startPoint.z + viaOffset.z : viaZ;
                    const resolvedTargetX = useRelativeOffsets ? resolvedViaX + targetOffset.x : targetX;
                    const resolvedTargetY = useRelativeOffsets ? resolvedViaY + targetOffset.y : targetY;
                    const resolvedTargetZ = useRelativeOffsets ? resolvedViaZ + targetOffset.z : targetZ;
                    const viaPoint = new THREE.Vector3(
                        resolvedViaX,
                        Math.max(resolvedViaY, getSafeAltitudeAt(resolvedViaX, resolvedViaZ)),
                        resolvedViaZ
                    );
                    const targetPoint = new THREE.Vector3(
                        resolvedTargetX,
                        Math.max(resolvedTargetY, getSafeAltitudeAt(resolvedTargetX, resolvedTargetZ)),
                        resolvedTargetZ
                    );
                    const computeInterpolatingControls = () => {
                        // Convert a quadratic Bezier passing through viaPoint into an
                        // equivalent cubic. The fallback depends only on coordinates,
                        // so changing the drone heading cannot reshape the path.
                        const quadraticControl = viaPoint.clone()
                            .multiplyScalar(2)
                            .sub(startPoint.clone().add(targetPoint).multiplyScalar(0.5));
                        const controlPoint1 = startPoint.clone().add(
                            quadraticControl.clone().sub(startPoint).multiplyScalar(2 / 3)
                        );
                        const controlPoint2 = targetPoint.clone().add(
                            quadraticControl.clone().sub(targetPoint).multiplyScalar(2 / 3)
                        );
                        return {
                            controlPoint1,
                            controlPoint2
                        };
                    };
                    const arcControls = computeArcControls(startPoint, viaPoint, targetPoint);
                    const controls = arcControls || computeInterpolatingControls();
                    const controlPoint1 = controls.controlPoint1;
                    const controlPoint2 = controls.controlPoint2;
                    const curvePath = new THREE.CubicBezierCurve3(startPoint, controlPoint1, controlPoint2, targetPoint);
                    const distance = curvePath.getLength();
                    const horizontalDistance = Math.max(
                        Math.hypot(viaPoint.x - startPoint.x, viaPoint.z - startPoint.z),
                        Math.hypot(targetPoint.x - viaPoint.x, targetPoint.z - viaPoint.z),
                        Math.hypot(targetPoint.x - startPoint.x, targetPoint.z - startPoint.z)
                    );

                    this.speed = Math.min(Math.max(getNumber(this.speed, 1.0), 0.0), 10.0);
                    if (distance === 0 || this.speed === 0) {
                        updateDroneSound(basePlaybackRate);
                        next();
                        if (callback) callback();
                        return;
                    }

                    const moveDuration = distance * 50 / this.speed;
                    const leanAngle = horizontalDistance > 0 ? 10 : 0;
                    const leanTransition = Math.min(100 / moveDuration, 0.5);

                    const move = () => {
                        animateProperty(
                            val => {
                                const leanProgress = Math.min(
                                    val / leanTransition,
                                    (1 - val) / leanTransition,
                                    1
                                );
                                this.mesh.rotation.z = THREE.MathUtils.degToRad(leanAngle * leanProgress);
                                const currentPoint = curvePath.getPoint(val);
                                const minAltitude = getSafeAltitudeAt(currentPoint.x, currentPoint.z);
                                const currentY = Math.max(currentPoint.y, minAltitude);
                                this.mesh.position.x = currentPoint.x;
                                this.mesh.position.y = currentY;
                                this.mesh.position.z = currentPoint.z;
                                this.altitude = currentY;
                                updateStatus();
                            },
                            0, 1, moveDuration,
                            () => {
                                this.mesh.position.x = targetPoint.x;
                                this.mesh.position.y = Math.max(targetPoint.y, getSafeAltitudeAt(targetPoint.x, targetPoint.z));
                                this.mesh.position.z = targetPoint.z;
                                this.altitude = this.mesh.position.y;
                                this.mesh.rotation.z = 0;
                                updateDroneSound(basePlaybackRate);
                                updateStatus();
                                next();
                                if (callback) callback();
                            }
                        );
                    };

                    move();
                });
            } else if (callback) callback();
            return Promise.resolve();
        },
        moveToInternal(targetX, targetY, targetZ, callback, updateDirection = true) {
            targetX = getNumber(targetX, this.mesh.position.x);
            targetY = getNumber(targetY, this.altitude);
            targetZ = getNumber(targetZ, this.mesh.position.z);
            if (this.flying) {
                return addCommand(next => {
                    updateDroneSound(basePlaybackRate + 1.0);

                    const startX = this.mesh.position.x;
                    const startY = this.altitude;
                    const startZ = this.mesh.position.z;
                    const safeTargetY = Math.max(targetY, getSafeAltitudeAt(targetX, targetZ));
                    const deltaX = targetX - startX;
                    const deltaY = safeTargetY - startY;
                    const deltaZ = targetZ - startZ;
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
                    const horizontalDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

                    this.speed = Math.min(Math.max(getNumber(this.speed, 1.0), 0.0), 10.0);
                    if (distance === 0 || this.speed === 0) {
                        updateDroneSound(basePlaybackRate);
                        next();
                        if (callback) callback();
                        return;
                    }

                    const startDirection = normalizeDegrees(this.direction);
                    const targetDirection = updateDirection && horizontalDistance > 0 ?
                        normalizeDegrees(THREE.MathUtils.radToDeg(Math.atan2(deltaX, deltaZ)) + 90) :
                        startDirection;
                    const yawDelta = getShortestAngleDelta(startDirection, targetDirection);
                    const moveDuration = distance * 50 / this.speed;
                    const leanAngle = horizontalDistance > 0 ? 10 : 0;

                    const move = () => {
                        animateProperty(
                            val => {
                                this.mesh.rotation.z = THREE.MathUtils.degToRad(leanAngle * val);
                            },
                            0, 1, 100,
                            () => {
                                animateProperty(
                                    val => {
                                        const currentX = startX + deltaX * val;
                                        const currentZ = startZ + deltaZ * val;
                                        const minAltitude = getSafeAltitudeAt(currentX, currentZ);
                                        const currentY = Math.max(startY + deltaY * val, minAltitude);
                                        this.mesh.position.x = currentX;
                                        this.mesh.position.y = currentY;
                                        this.mesh.position.z = currentZ;
                                        this.altitude = currentY;
                                        updateStatus();
                                    },
                                    0, 1, moveDuration,
                                    () => {
                                        this.mesh.position.x = targetX;
                                        this.mesh.position.y = Math.max(safeTargetY, getSafeAltitudeAt(targetX, targetZ));
                                        this.mesh.position.z = targetZ;
                                        this.altitude = this.mesh.position.y;
                                        animateProperty(
                                            val => {
                                                this.mesh.rotation.z = THREE.MathUtils.degToRad(leanAngle * (1 - val));
                                            },
                                            0, 1, 100,
                                            () => {
                                                if (updateDirection) {
                                                    this.direction = targetDirection;
                                                    this.mesh.rotation.y = THREE.MathUtils.degToRad(this.direction);
                                                }
                                                this.mesh.rotation.z = 0;
                                                updateDroneSound(basePlaybackRate);
                                                updateStatus();
                                                next();
                                                if (callback) callback();
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    };

                    if (updateDirection && horizontalDistance > 0) {
                        animateProperty(
                            val => {
                                this.direction = normalizeDegrees(startDirection + yawDelta * val);
                                this.mesh.rotation.y = THREE.MathUtils.degToRad(this.direction);
                                updateStatus();
                            },
                            0, 1, 250,
                            move
                        );
                    } else {
                        move();
                    }
                });
            } else if (callback) callback();
            return Promise.resolve();
        }
    };
    setupStatusInputs();
};

// Smoke trail and performance-mode ground guide
let smokeTrail = [];
let smokeLine = null;
const MAX_SMOKE_POINTS = 30000;
const smokePositions = new Float32Array(MAX_SMOKE_POINTS * 3);
const smokeBufferGeo = new THREE.BufferGeometry();
smokeBufferGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
smokeBufferGeo.setDrawRange(0, 0);
const smokeLineMat = new THREE.LineBasicMaterial({
    color: 0x2f3438,
    transparent: true,
    opacity: 0.9,
});

function clearSmokeTrail() {
    if (smokeLine) {
        scene.remove(smokeLine);
        smokeLine = null;
    }
    smokeTrail = [];
    lastSmokeTime = 0;
    smokeBufferGeo.setDrawRange(0, 0);
}

function updateSmokeLine() {
    // Update one shared geometry instead of allocating a new line for every point.
    if (smokeTrail.length < 2) {
        smokeBufferGeo.setDrawRange(0, 0);
        return;
    }

    const count = Math.min(smokeTrail.length, MAX_SMOKE_POINTS);
    const offset = smokeTrail.length > MAX_SMOKE_POINTS ?
        smokeTrail.length - MAX_SMOKE_POINTS :
        0;

    for (let i = 0; i < count; i++) {
        const p = smokeTrail[offset + i];
        smokePositions[i * 3] = p.x;
        smokePositions[i * 3 + 1] = p.y;
        smokePositions[i * 3 + 2] = p.z;
    }
    smokeBufferGeo.attributes.position.needsUpdate = true;
    smokeBufferGeo.setDrawRange(0, count);

    if (!smokeLine) {
        smokeLine = new THREE.Line(smokeBufferGeo, smokeLineMat);
        smokeLine.frustumCulled = false;
        smokeLine.userData.type = 'keep';
        smokeLine.userData.noCollision = true;
        smokeLine.userData.noShadow = true;
        scene.add(smokeLine);
    }
}

function addSmokePoint(position) {
    if (smokeTrail.length >= MAX_SMOKE_POINTS) return;
    const now = performance.now();
    if (now - lastSmokeTime < activeGraphicsProfile.smokeInterval) return;

    const point = position.clone();
    point.y = Math.max(point.y - 0.25, getGroundHeightAt(point.x, point.z) + 0.2);
    const previous = smokeTrail[smokeTrail.length - 1];
    if (previous && previous.distanceTo(point) < 0.2) return;

    lastSmokeTime = now;
    smokeTrail.push(point);
    updateSmokeLine();
}

function createDroneGuides() {
    if (droneGroundMarker) return;

    const markerGeometry = new THREE.RingGeometry(1.8, 2.05, 48);
    const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    droneGroundMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    droneGroundMarker.rotation.x = -Math.PI / 2;
    droneGroundMarker.userData.type = 'keep';
    droneGroundMarker.userData.noCollision = true;
    droneGroundMarker.userData.noShadow = true;
    scene.add(droneGroundMarker);


}

function updateDroneGuides() {
    if (!droneGroundMarker || !drone || !drone.mesh) return;
    const visible = graphicsProfileName === 'performance';
    droneGroundMarker.visible = visible;

    if (!visible) return;

    const x = drone.mesh.position.x;
    const z = drone.mesh.position.z;
    const groundY = getGroundHeightAt(x, z) + 0.05;

    droneGroundMarker.position.set(x, groundY, z);
}


// Render loop
const animate = () => {
    requestAnimationFrame(animate);
    if (drone && drone.mesh) {
        enforceTerrainCollision();
        const offset = cameraOffset.clone();
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta += cameraAngle.x;
        spherical.phi += cameraAngle.y;
        spherical.phi = Math.max(THREE.MathUtils.degToRad(10), Math.min(THREE.MathUtils.degToRad(85), spherical.phi));
        offset.setFromSpherical(spherical);
        camera.position.copy(drone.mesh.position).add(offset);
        camera.lookAt(drone.mesh.position);
        updateDroneGuides();

        // Keep the directional light and shadow camera centered on the drone.
        if (directionalLight) {
            directionalLight.position.set(drone.mesh.position.x, drone.mesh.position.y + 100, drone.mesh.position.z);
            directionalLight.target.position.copy(drone.mesh.position);
            directionalLight.target.updateMatrixWorld();
        }

        if (drone.smoke) {
            if (drone.flying && drone.mesh) {
                const pos = drone.mesh.position.clone();
                addSmokePoint(pos);
            }
        }
    }
    renderer.render(scene, camera);
};

// Scene and camera reset
const resetCameraView = () => {
    cameraAngle.x = Math.PI / 2;
    cameraAngle.y = 0;
    cameraOffset.copy(defaultCameraOffset);
    camera.position.set(4, 0, 4);
};

const resetScene = () => {
    const startAltitude = getSafeAltitudeAt(0, 0);
    drone.mesh.position.set(0, startAltitude, 0);
    drone.mesh.rotation.y = 0;
    drone.altitude = startAltitude;
    drone.direction = 0;
    drone.smoke = 0;
    resetCameraView();
    clearInterval(drone.propellerInterval);
    drone.flying = false;
    updateStatus();

    clearSmokeTrail();
    updateDroneGuides();
};

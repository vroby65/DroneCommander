const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console });
for (const file of ['three.min.js', 'OBJLoader.js', 'MTLLoader.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'libs', file), 'utf8'), context);
}
const THREE = context.THREE;

function loadScenery(detail) {
    const materials = new THREE.MTLLoader().parse(
        fs.readFileSync(path.join(root, 'models', detail.material), 'utf8'), '');
    const model = new THREE.OBJLoader().setMaterials(materials).parse(
        fs.readFileSync(path.join(root, 'models', detail.model), 'utf8'));
    model.updateMatrixWorld(true);
    return { model, materials };
}

for (const name of ['campo', 'citta', 'metropoli', 'isola']) {
    test(`${name}: scenery loads with local materials and a clear take-off area`, () => {
        const data = JSON.parse(fs.readFileSync(path.join(root, 'backgrounds', `${name}.json`)));
        assert.ok(fs.existsSync(path.join(root, 'textures', data.groundTexture)));
        const detail = data.objects.find(item => item.model === `details-${name}.obj`);
        assert.ok(detail, 'scenario must include its new scenery');
        for (const item of data.objects) {
            for (const key of ['model', 'material']) {
                assert.ok(fs.existsSync(path.join(root, 'models', item[key])), item[key]);
            }
        }
        const { model, materials } = loadScenery(detail);
        let vertices = 0;
        model.traverse(mesh => {
            if (!mesh.isMesh) return;
            vertices += mesh.geometry.attributes.position.count;
            assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            assert.ok(mats.every(mat => mat && mat.name && materials.materialsInfo[mat.name]));
        });
        assert.ok(vertices > 300 && vertices < 45000, `lightweight scenery: ${vertices} vertices`);
        const ray = new THREE.Raycaster();
        const landmarks = {
            campo: [-125, 15, 38],
            citta: [85, -75, 20],
            metropoli: [-185, -112, 20],
            isola: [112, -20, 25]
        };
        const [lx, lz, height] = landmarks[name];
        ray.set(new THREE.Vector3(lx, 1000, lz), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(model, true)[0];
        assert.ok(hit && hit.point.y >= height, `${name}: new landmark has a collision surface`);
        const outerLandmarks = {
            campo: [-65, -275, 30],
            citta: [190, 165, 0.5],
            metropoli: [-310, -150, 0.5],
            isola: [85, 125, 4]
        };
        const [ox, oz, outerHeight] = outerLandmarks[name];
        ray.set(new THREE.Vector3(ox, 1000, oz), new THREE.Vector3(0, -1, 0));
        const outerHit = ray.intersectObject(model, true)[0];
        assert.ok(outerHit && outerHit.point.y >= outerHeight,
            `${name}: scenery extends into the outer flight area`);
        for (const x of [-20, 0, 20]) {
            for (const z of [-20, 0, 20]) {
                ray.set(new THREE.Vector3(x, 1000, z), new THREE.Vector3(0, -1, 0));
                assert.equal(ray.intersectObject(model, true).length, 0, `take-off area ${x},${z}`);
            }
        }
    });
}

test('campo: fly through the training course and land under a gate or on the pad', () => {
    const { model } = loadScenery({ model: 'details-campo.obj', material: 'scenery.mtl' });
    const frames = [];
    Object.assign(context, {
        model,
        localStorage: { getItem: () => null },
        window: {},
        performance: { now: () => 0 },
        requestAnimationFrame: callback => frames.push(callback),
        clearInterval: () => {},
        updateStatus: () => {},
        console: { warn: () => {} }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'js', 'drone-commands.js'), 'utf8'), context);
    const run = code => vm.runInContext(code, context);
    run(`
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000));
        ground.rotation.x = -Math.PI / 2;
        ground.updateMatrixWorld(true);
        registerCollisionMesh(ground);
        registerGroundMesh(ground);
        collectCollisionMeshes(model);
        drone = { mesh: new THREE.Object3D(), flying: true, altitude: 10 };
        drone.mesh.position.set(0, 10, 0);
        rememberSafeDronePosition();
    `);

    for (const [x, y, z] of [
        [-65, 10, -24], [-65, 10, -35], [-65, 10, -300],
        [-65, 10, -333], [-65, 10, -370], [-135, 10, -370], [-135, 10, -305],
        [-175, 10, -252], [-135, 10, -199], [-175, 10, -146],
        [-135, 10, -93], [-155, 10, -47]
    ]) {
        assert.equal(run(`setDroneFlightPosition(${x}, ${y}, ${z})`), true,
            `clear waypoint ${x},${y},${z}`);
        run('enforceTerrainCollision()');
        assert.equal(run('drone.mesh.position.y'), y);
    }
    assert.ok(Math.abs(run('getSafeAltitudeAt(-155, -47, 10)') - 4.52) < 0.001);
    assert.ok(Math.abs(run('getSafeAltitudeAt(-65, -35, 10)') - 1.4) < 0.001);
    assert.equal(run('getSafeAltitudeAt(-65, -35, 40)'), 32.4);

    for (const [start, end] of [
        [[-81, 10, -20], [-81, 10, -50]], // a frame that crosses a post
        [[-65, 30, -20], [-65, 30, -50]], // a frame that crosses the crossbar
        [[-65, 10, -331], [-65, 23, -331]], // climb through the tunnel roof
        [[-189, 10, -252], [-125, 10, -252]] // cross a slalom pylon
    ]) {
        run(`
            drone.mesh.position.set(${start.join(',')});
            drone.altitude = ${start[1]};
            drone.flying = true;
            rememberSafeDronePosition();
        `);
        assert.equal(run(`setDroneFlightPosition(${end.join(',')})`), false);
        assert.deepEqual(Array.from(run('drone.mesh.position.toArray()')), start);
        assert.equal(run('collisionEmergencyActive'), true);
        assert.equal(frames.length, 1);
        frames.shift()(300);
        assert.equal(run('drone.flying'), false);
        assert.ok(Math.abs(run('drone.altitude') - 1.4) < 0.001);
    }
});

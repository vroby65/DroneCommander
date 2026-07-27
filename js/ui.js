// User interface: camera interaction, status controls, program actions, layout,
// localization, and scenario selection.

const container = document.getElementById('container');
const leftPanel = document.getElementById('leftPanel');
const divider = document.getElementById('divider');
const webglContainer = document.getElementById('webglContainer');
const rightPanel = document.getElementById('rightPanel');
const statusPanel = document.getElementById('statusPanel');
const droneCameraPanel = document.getElementById('droneCameraPanel');
const cameraPreviewToggle = document.getElementById('cameraPreviewToggle');
const cameraPreviewStorageKey = 'droneCameraPreviewEnabled';
const mediaSaveDirectoryRow = document.getElementById('mediaSaveDirectoryRow');
const mediaSaveDirectoryPath = document.getElementById('mediaSaveDirectoryPath');
const selectMediaSaveDirectoryBtn = document.getElementById('selectMediaSaveDirectoryBtn');
const resetMediaSaveDirectoryBtn = document.getElementById('resetMediaSaveDirectoryBtn');
const darkThemeToggle = document.getElementById('darkThemeToggle');
const darkThemeStorageKey = 'darkThemeEnabled';
let run = false;
let delay = 100;

const applyDarkTheme = (enabled, persist = true) => {
    document.documentElement.classList.toggle('dark-theme', enabled);
    darkThemeToggle.checked = enabled;
    if (persist) localStorage.setItem(darkThemeStorageKey, String(enabled));
    if (workspace) {
        workspace.setTheme(enabled ? makecodeDarkTheme : makecodeTheme);
        Blockly.svgResize(workspace);
    }
};

applyDarkTheme(localStorage.getItem(darkThemeStorageKey) === 'true', false);
darkThemeToggle.addEventListener('change', event => {
    applyDarkTheme(event.target.checked);
}, {
    passive: true
});

const applyCameraPreviewVisibility = (enabled, persist = true) => {
    droneCameraPanel.style.display = enabled ? '' : 'none';
    cameraPreviewToggle.checked = enabled;
    if (persist) localStorage.setItem(cameraPreviewStorageKey, String(enabled));
};

applyCameraPreviewVisibility(localStorage.getItem(cameraPreviewStorageKey) !== 'false', false);
cameraPreviewToggle.addEventListener('change', event => {
    applyCameraPreviewVisibility(event.target.checked);
    if (event.target.checked) updateViewerCanvases();
}, {
    passive: true
});

// Browsers do not expose writable absolute paths to web pages. On browsers
// supporting the File System Access API, keep a user-selected directory handle
// and write camera media there; otherwise camera media uses normal downloads.
const mediaDirectoryDatabaseName = 'droneCommanderSettings';
const mediaDirectoryStoreName = 'directoryHandles';
const mediaDirectoryHandleKey = 'cameraMedia';
let mediaSaveDirectoryHandle = null;
let mediaSaveDirectoryPermission = 'prompt';

const supportsMediaDirectorySelection = () =>
    typeof window.showDirectoryPicker === 'function';

const openMediaDirectoryDatabase = () => new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        reject(new Error('IndexedDB is unavailable'));
        return;
    }

    const request = indexedDB.open(mediaDirectoryDatabaseName, 1);
    request.addEventListener('upgradeneeded', () => {
        if (!request.result.objectStoreNames.contains(mediaDirectoryStoreName)) {
            request.result.createObjectStore(mediaDirectoryStoreName);
        }
    });
    request.addEventListener('success', () => resolve(request.result), {
        once: true
    });
    request.addEventListener('error', () => reject(request.error), {
        once: true
    });
});

const readStoredMediaDirectoryHandle = async () => {
    const database = await openMediaDirectoryDatabase();
    try {
        return await new Promise((resolve, reject) => {
            const request = database
                .transaction(mediaDirectoryStoreName, 'readonly')
                .objectStore(mediaDirectoryStoreName)
                .get(mediaDirectoryHandleKey);
            request.addEventListener('success', () => resolve(request.result || null), {
                once: true
            });
            request.addEventListener('error', () => reject(request.error), {
                once: true
            });
        });
    } finally {
        database.close();
    }
};

const storeMediaDirectoryHandle = async handle => {
    const database = await openMediaDirectoryDatabase();
    try {
        await new Promise((resolve, reject) => {
            const request = database
                .transaction(mediaDirectoryStoreName, 'readwrite')
                .objectStore(mediaDirectoryStoreName)
                .put(handle, mediaDirectoryHandleKey);
            request.addEventListener('success', resolve, {
                once: true
            });
            request.addEventListener('error', () => reject(request.error), {
                once: true
            });
        });
    } finally {
        database.close();
    }
};

const removeStoredMediaDirectoryHandle = async () => {
    const database = await openMediaDirectoryDatabase();
    try {
        await new Promise((resolve, reject) => {
            const request = database
                .transaction(mediaDirectoryStoreName, 'readwrite')
                .objectStore(mediaDirectoryStoreName)
                .delete(mediaDirectoryHandleKey);
            request.addEventListener('success', resolve, {
                once: true
            });
            request.addEventListener('error', () => reject(request.error), {
                once: true
            });
        });
    } finally {
        database.close();
    }
};

const queryMediaDirectoryPermission = async handle => {
    if (!handle || typeof handle.queryPermission !== 'function') return 'prompt';
    try {
        return await handle.queryPermission({
            mode: 'readwrite'
        });
    } catch (error) {
        console.warn('Unable to check the camera media directory permission:', error);
        return 'prompt';
    }
};

const updateMediaSaveDirectoryControl = () => {
    const supported = supportsMediaDirectorySelection();
    mediaSaveDirectoryRow.hidden = !supported;
    selectMediaSaveDirectoryBtn.disabled = !supported;
    resetMediaSaveDirectoryBtn.disabled = !supported || !mediaSaveDirectoryHandle;

    if (!supported) {
        mediaSaveDirectoryPath.value =
            Blockly.Msg.BKY_MEDIA_SAVE_DIRECTORY_UNSUPPORTED ||
            'Default browser downloads (folder selection unsupported)';
    } else if (!mediaSaveDirectoryHandle) {
        mediaSaveDirectoryPath.value =
            Blockly.Msg.BKY_MEDIA_SAVE_DIRECTORY_DEFAULT || 'Default browser downloads';
    } else {
        const permissionSuffix = mediaSaveDirectoryPermission === 'granted' ? '' :
            ` — ${Blockly.Msg.BKY_MEDIA_SAVE_DIRECTORY_PERMISSION_NEEDED || 'permission needed'}`;
        mediaSaveDirectoryPath.value = mediaSaveDirectoryHandle.name + permissionSuffix;
    }

    mediaSaveDirectoryPath.title =
        Blockly.Msg.BKY_MEDIA_SAVE_DIRECTORY_PRIVACY ||
        'For privacy, the browser displays only the selected folder name.';
};

selectMediaSaveDirectoryBtn.addEventListener('click', async () => {
    if (!supportsMediaDirectorySelection()) return;

    try {
        if (
            mediaSaveDirectoryHandle &&
            mediaSaveDirectoryPermission !== 'granted' &&
            typeof mediaSaveDirectoryHandle.requestPermission === 'function'
        ) {
            mediaSaveDirectoryPermission = await mediaSaveDirectoryHandle.requestPermission({
                mode: 'readwrite'
            });
            if (mediaSaveDirectoryPermission === 'granted') {
                updateMediaSaveDirectoryControl();
                return;
            }
        }

        const pickerOptions = {
            id: 'drone-commander-camera-media',
            mode: 'readwrite'
        };
        if (mediaSaveDirectoryHandle) pickerOptions.startIn = mediaSaveDirectoryHandle;
        mediaSaveDirectoryHandle = await window.showDirectoryPicker(pickerOptions);
        mediaSaveDirectoryPermission = await queryMediaDirectoryPermission(mediaSaveDirectoryHandle);
        updateMediaSaveDirectoryControl();

        try {
            await storeMediaDirectoryHandle(mediaSaveDirectoryHandle);
        } catch (error) {
            console.warn('Unable to remember the camera media directory:', error);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Unable to select the camera media directory:', error);
        }
    }
});

resetMediaSaveDirectoryBtn.addEventListener('click', async () => {
    mediaSaveDirectoryHandle = null;
    mediaSaveDirectoryPermission = 'prompt';
    updateMediaSaveDirectoryControl();
    try {
        await removeStoredMediaDirectoryHandle();
    } catch (error) {
        console.warn('Unable to forget the camera media directory:', error);
    }
});

const restoreMediaSaveDirectory = async () => {
    if (!supportsMediaDirectorySelection()) {
        updateMediaSaveDirectoryControl();
        return;
    }

    try {
        mediaSaveDirectoryHandle = await readStoredMediaDirectoryHandle();
        mediaSaveDirectoryPermission =
            await queryMediaDirectoryPermission(mediaSaveDirectoryHandle);
    } catch (error) {
        console.warn('Unable to restore the camera media directory:', error);
    }
    updateMediaSaveDirectoryControl();
};

window.saveMediaBlobToSelectedDirectory = async (blob, fileName) => {
    if (!mediaSaveDirectoryHandle) return false;

    mediaSaveDirectoryPermission =
        await queryMediaDirectoryPermission(mediaSaveDirectoryHandle);
    updateMediaSaveDirectoryControl();
    if (mediaSaveDirectoryPermission !== 'granted') return false;

    try {
        const fileHandle = await mediaSaveDirectoryHandle.getFileHandle(fileName, {
            create: true
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
    } catch (error) {
        console.error('Unable to write camera media to the selected directory:', error);
        return false;
    }
};

updateMediaSaveDirectoryControl();
restoreMediaSaveDirectory();

// Camera pointer and zoom controls
webglContainer.addEventListener('contextmenu', e => e.preventDefault());
webglContainer.addEventListener('mousedown', e => {
    if (e.button === 2) isRightMouseDown = true;
    if (e.button === 1) {
        cameraAngle.x += Math.PI / 2;
    }
    if (e.button === 0) {
        camera.position.set(4, 0, 4);
        cameraAngle.x = Math.PI / 2;
        cameraAngle.y = 0;
    }
    prevMousePos.x = e.clientX;
    prevMousePos.y = e.clientY;
}, {
    passive: true
});
document.addEventListener('mouseup', () => {
    isRightMouseDown = false;
}, {
    passive: true
});
document.addEventListener('mousemove', e => {
    const dx = e.clientX - prevMousePos.x;
    const dy = e.clientY - prevMousePos.y;

    if (isRightMouseDown) {
        cameraAngle.x += dx * 0.01;
        cameraAngle.y = Math.min(Math.max(cameraAngle.y + dy * 0.01, -Math.PI / 2), Math.PI / 2);
    }

    prevMousePos.x = e.clientX;
    prevMousePos.y = e.clientY;
}, {
    passive: true
});
webglContainer.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomFactor = 1 + e.deltaY * 0.001;
    cameraOffset.multiplyScalar(zoomFactor);

    const minZoom = 5;
    const maxZoom = 1000;
    cameraOffset.clampLength(minZoom, maxZoom);
}, {
    passive: false
});

// Keep the renderer at 4:3 while centering it inside the available panel.
const updateWebGLCanvas = () => {
    if (!renderer || !camera) return;
    const containerWidth = webglContainer.clientWidth;
    const containerHeight = webglContainer.clientHeight;
    const desiredAspect = 4 / 3;
    let newWidth, newHeight;
    if (containerWidth / containerHeight > desiredAspect) {
        newHeight = containerHeight;
        newWidth = containerHeight * desiredAspect;
    } else {
        newWidth = containerWidth;
        newHeight = containerWidth / desiredAspect;
    }
    const canvasLeft = (containerWidth - newWidth) / 2;
    renderer.setSize(newWidth, newHeight);
    renderer.domElement.style.cssText = `
    width: ${newWidth}px;
    height: ${newHeight}px;
    position: absolute;
    left: ${canvasLeft}px;
    top: 0px;
  `;

    // Both views are 4:3, so scaling each dimension by sqrt(1/8) makes
    // the preview occupy exactly one eighth of the main canvas area.
    const previewScale = Math.sqrt(1 / 8);
    droneCameraPanel.style.width = `${newWidth * previewScale}px`;
    droneCameraPanel.style.height = `${newHeight * previewScale}px`;
    droneCameraPanel.style.left = `${canvasLeft + 8}px`;
    droneCameraPanel.style.top = '8px';

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
};

// Keep the on-board camera at the same 4:3 aspect ratio as the main 3D view.
const updateDroneCameraCanvas = () => {
    if (!droneCamera) return;
    const previewWidth = droneCameraPanel.clientWidth;
    const previewHeight = droneCameraPanel.clientHeight;
    if (!previewWidth || !previewHeight) {
        droneCamera.aspect = 4 / 3;
        droneCamera.updateProjectionMatrix();
        if (droneCameraRenderTarget && !droneVideoRecording) {
            droneCameraRenderTarget.setSize(1, 1);
        }
        return;
    }

    droneCamera.aspect = previewWidth / previewHeight;
    droneCamera.updateProjectionMatrix();
    if (droneCameraRenderTarget && !droneVideoRecording) {
        const pixelRatio = getProfilePixelRatio();
        droneCameraRenderTarget.setSize(
            Math.max(1, Math.round(previewWidth * pixelRatio)),
            Math.max(1, Math.round(previewHeight * pixelRatio))
        );
    }
};

const updateViewerCanvases = () => {
    updateWebGLCanvas();
    updateDroneCameraCanvas();
};

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateViewerCanvases, 100);
}, {
    passive: true
});

// Keyboard state exposed to Blockly sensor blocks
const pressedKeys = {};
document.addEventListener('keydown', function(event) {
    pressedKeys[event.key] = true;
}, {
    passive: true
});
document.addEventListener('keyup', function(event) {
    pressedKeys[event.key] = false;
}, {
    passive: true
});

function isKeyPressed(key) {
    const normalizedKey = key.toLowerCase();

    const keyMap = {
        "space": " ",
        "return": "Return",
        "arrow_up": "ArrowUp",
        "arrow_down": "ArrowDown",
        "arrow_left": "ArrowLeft",
        "arrow_right": "ArrowRight"
    };
    const keyToCheck = keyMap[normalizedKey] || normalizedKey;
    return !!pressedKeys[keyToCheck];
}

// Status panel synchronization
const updateStatus = () => {
    document.getElementById('x').value = -drone.mesh.position.z.toFixed(2);
    document.getElementById('z').value = -drone.mesh.position.x.toFixed(2);
    document.getElementById('altitude').value = drone.altitude.toFixed(2);
    document.getElementById('direction').value = ((-drone.direction.toFixed(0) % 360) + 360) % 360;
    document.getElementById('flightStatus').innerText = drone.flying ?
        (Blockly.Msg["BKY_FLIGHT_IN_FLIGHT"] || "In Flight") :
        (Blockly.Msg["BKY_FLIGHT_ON_GROUND"] || "On Ground");
};

const setupStatusInputs = () => {
    document.getElementById('z').addEventListener('change', e => {
        drone.mesh.position.x = -parseFloat(e.target.value);
        enforceTerrainCollision();
    }, {
        passive: true
    });
    document.getElementById('x').addEventListener('change', e => {
        drone.mesh.position.z = -parseFloat(e.target.value);
        enforceTerrainCollision();
    }, {
        passive: true
    });
    document.getElementById('altitude').addEventListener('change', e => {
        drone.mesh.position.y = parseFloat(e.target.value);
        enforceTerrainCollision();
    }, {
        passive: true
    });
    document.getElementById('direction').addEventListener('change', e => {
        drone.direction = normalizeDegrees(-getNumber(e.target.value));
        drone.mesh.rotation.y = THREE.MathUtils.degToRad(drone.direction);
        updateStatus();
    }, {
        passive: true
    });
};

const formatProgramVariableValue = value => {
    if (value === undefined) return '—';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);

    try {
        const serializedValue = JSON.stringify(value);
        return serializedValue === undefined ? String(value) : serializedValue;
    } catch (error) {
        return String(value);
    }
};

function __droneCommanderUpdateVariables(variables) {
    const valuesContainer = document.getElementById('variableValues');
    valuesContainer.replaceChildren();

    if (!variables.length) {
        valuesContainer.textContent = '—';
        return;
    }

    variables.forEach(([name, value]) => {
        const variableValue = document.createElement('span');
        variableValue.className = 'variableValue';
        variableValue.textContent = `${name} = ${formatProgramVariableValue(value)}`;
        valuesContainer.appendChild(variableValue);
    });
}

const getGeneratedProgramVariables = () => {
    const variableModels = workspace.getAllVariables();
    if (!variableModels.length) return [];

    Blockly.JavaScript.init(workspace);
    const variableType = Blockly.Names.NameType.VARIABLE;
    const variables = variableModels.map(variable => ({
        displayName: variable.name,
        codeName: Blockly.JavaScript.nameDB_.getName(variable.getId(), variableType)
    }));
    Blockly.JavaScript.finish('');
    return variables;
};

// Program file actions and generated-code execution
document.getElementById('newBtn').addEventListener('click', () => {
    setProgramName(defaultProgramName);
    loadWorkspaceFromXmlText(defaultWorkspaceXmlText);
    __droneCommanderUpdateVariables([]);
});
document.getElementById('saveBtn').addEventListener('click', () => {
    const requestedName = prompt(Blockly.Msg.BKY_SAVE_PROMPT || 'File name:', programName);
    if (requestedName === null) return;
    setProgramName(requestedName);
    const xmlText = getWorkspaceXmlText();
    saveProgramToLocalStorage();
    const blob = new Blob([xmlText], {
        type: 'text/xml'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = programName + '.xml';
    a.click();
}, {
    passive: true
});
document.getElementById('loadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const xmlText = e.target.result;
        if (loadWorkspaceFromXmlText(xmlText, false)) {
            setProgramName(file.name);
            saveProgramToLocalStorage();
            __droneCommanderUpdateVariables([]);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}, {
    passive: true
});
document.getElementById('runBtn').addEventListener('click', () => {
    if (run) return;

    initAudio();
    document.getElementById("stopBtn").disabled = false;
    document.getElementById("runBtn").disabled = true;
    resetScene();

    Blockly.JavaScript.addReservedWords('__droneCommanderUpdateVariables');
    let code = Blockly.JavaScript.workspaceToCode(workspace);
    const programVariables = getGeneratedProgramVariables();
    __droneCommanderUpdateVariables(programVariables.map(variable => [variable.displayName, undefined]));
    const variableSnapshotCode = programVariables.length ?
        `__droneCommanderUpdateVariables([${programVariables.map(variable =>
            `[${JSON.stringify(variable.displayName)}, typeof ${variable.codeName} === 'undefined' ? undefined : ${variable.codeName}]`
        ).join(',')}]);` : '';
    delay = 10;
    run = true;

    // Flight commands return promises. Make user procedures asynchronous and add
    // a short cooperative pause/checkpoint after each generated statement.
    code = code.replace(/\bfunction\b/g, 'async function');
    code = code.replace(/\n/g, `;\n  ${variableSnapshotCode}await sleep(delay);delay=10;if(run!=true)return;`);
    const wrappedCode = `
      async function _run() {
        ${code}
        document.getElementById('stopBtn').click();
      }
      _run();
    `;
    eval(wrappedCode);
}, {
    passive: true
});

window.handleDroneCollisionEmergency = () => {
    cancelDroneVideoRecording();
    run = false;
    document.getElementById("runBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
};

window.finishDroneCollisionEmergency = () => {
    document.getElementById("runBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
};

document.getElementById('stopBtn').addEventListener('click', () => {
    cancelDroneVideoRecording();
    run = false;
    cancelDroneCommands();
    stopDroneSound();
    resetScene();
    document.getElementById("runBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
}, {
    passive: true
});

// Resizable editor/viewer layout
let isResizing = false;
let fullScreen = false;
document.getElementById('toggleWebglBtn').addEventListener('click', () => {
    if (!fullScreen) {
        leftPanel.style.display = 'none';
        divider.style.display = 'none';
        rightPanel.style.width = '100%';
        statusPanel.style.display = 'none';
        document.getElementById('toggleWebglBtn').innerText = "🗗";
    } else {
        leftPanel.style.display = '';
        divider.style.display = '';
        rightPanel.style.width = '';
        statusPanel.style.display = '';
        document.getElementById('toggleWebglBtn').innerText = "🗖";
    }
    fullScreen = !fullScreen;
    updateViewerCanvases();
}, {
    passive: true
});

divider.addEventListener('mousedown', () => {
    isResizing = true;
});
document.addEventListener('mousemove', e => {
    if (isResizing) {
        const containerOffsetLeft = container.offsetLeft;
        const pointerX = e.clientX - containerOffsetLeft;
        const minWidth = 200;
        const maxWidth = container.clientWidth - 200;
        let panelWidth = document.documentElement.dir === 'rtl' ?
            container.clientWidth - pointerX : pointerX;
        panelWidth = Math.max(minWidth, Math.min(panelWidth, maxWidth));
        leftPanel.style.width = panelWidth + "px";
        Blockly.svgResize(workspace);
        updateViewerCanvases();
    }
}, {
    passive: true
});
document.addEventListener('mouseup', () => {
    isResizing = false;
}, {
    passive: true
});

// Localization and application selectors
const loadedLanguageFiles = new Set(['en']);

function loadLanguageFile(lang, callback) {
    if (loadedLanguageFiles.has(lang)) {
        if (callback) callback();
        return;
    }
    var script = document.createElement('script');
    script.src = 'libs/Msg/' + lang + '.js';
    script.onload = function() {
        loadedLanguageFiles.add(lang);
        if (callback) callback();
    };
    document.head.appendChild(script);
}

function applyLocalizedStrings() {
    // Toolbar and menu
    document.getElementById('newBtn').innerText = Blockly.Msg.BKY_NEW || "New";
    document.getElementById('loadBtn').innerText = Blockly.Msg.BKY_LOAD || "Load";
    document.getElementById('saveBtn').innerText = Blockly.Msg.BKY_SAVE || "Save";
    document.getElementById('helpBtn').innerText = Blockly.Msg.BKY_HELP || "Help";

    // Scenario selector
    const scenarioOpt = document.querySelector('#scenarioSelect option:first-child');
    if (scenarioOpt) scenarioOpt.text = Blockly.Msg.BKY_SCENARIO || 'Scenario';

    // Graphics selector
    document.getElementById('graphicsSelect').title = Blockly.Msg.BKY_GRAPHICS || 'Graphics';
    const gfxOpts = document.querySelectorAll('#graphicsSelect option');
    if (gfxOpts[0]) gfxOpts[0].text = Blockly.Msg.BKY_GRAPHICS_PERFORMANCE || 'Performance';
    if (gfxOpts[1]) gfxOpts[1].text = Blockly.Msg.BKY_GRAPHICS_BALANCED || 'Balanced';
    if (gfxOpts[2]) gfxOpts[2].text = Blockly.Msg.BKY_GRAPHICS_QUALITY || 'Quality';

    // Status panel labels
    document.getElementById('labelX').innerText = Blockly.Msg["BKY_STATUS_X"] || 'X:';
    document.getElementById('labelZ').innerText = Blockly.Msg["BKY_STATUS_Z"] || 'Z:';
    document.getElementById('labelAlt').innerText = Blockly.Msg["BKY_STATUS_ALTITUDE"] || 'Altitude:';
    document.getElementById('labelDir').innerText = Blockly.Msg["BKY_STATUS_DIRECTION"] || 'Direction:';
    document.getElementById('labelStatus').innerText = Blockly.Msg["BKY_STATUS_FLIGHT"] || 'Status:';
    document.getElementById('labelVariables').innerText = Blockly.Msg["BKY_STATUS_VARIABLES"] ||
        (Blockly.Msg["BKY_CATEGORY_VARIABLES"] || 'Variables') + ':';
    document.getElementById('labelCameraPreview').innerText =
        Blockly.Msg["BKY_CAMERA_PREVIEW"] || 'Camera preview';
    document.getElementById('labelDarkTheme').innerText =
        Blockly.Msg["BKY_DARK_THEME"] || 'Dark theme';
    document.getElementById('labelMediaSaveDirectory').innerText =
        Blockly.Msg.BKY_MEDIA_SAVE_DIRECTORY || 'Photo/video folder:';
    selectMediaSaveDirectoryBtn.innerText =
        Blockly.Msg.BKY_MEDIA_SAVE_DIRECTORY_SELECT || 'Choose...';
    resetMediaSaveDirectoryBtn.innerText =
        Blockly.Msg.BKY_MEDIA_SAVE_DIRECTORY_RESET || 'Reset';
    updateMediaSaveDirectoryControl();

    // Current flight status
    if (typeof drone !== 'undefined' && drone) {
        document.getElementById('flightStatus').innerText = drone.flying ?
            (Blockly.Msg["BKY_FLIGHT_IN_FLIGHT"] || "In Flight") :
            (Blockly.Msg["BKY_FLIGHT_ON_GROUND"] || "On Ground");
    }
}

function updateLanguage(selectedLang) {
    const currentLang = localStorage.getItem('selectedLanguage') || 'en';
    localStorage.setItem('selectedLanguage', selectedLang);
    applyLocalizedStrings();
    if (selectedLang !== currentLang) {
        location.reload();
    }
}

document.getElementById('languageSelect').addEventListener('change', function() {
    var selectedLang = this.value;
    loadLanguageFile(selectedLang, function() {
        updateLanguage(selectedLang);
    });
}, {
    passive: true
});

document.getElementById('scenarioSelect').addEventListener('change', function() {
    const selectedScenario = this.value;
    loadScenario(selectedScenario);
    setTimeout(() => {
        resetCameraView();
        resetScene();
    }, 500);
});

document.getElementById('graphicsSelect').addEventListener('change', function() {
    applyGraphicsProfile(this.value);
}, {
    passive: true
});

document.getElementById('helpBtn').addEventListener('click', function() {
    const lang = document.getElementById('languageSelect').value;
    const helpFiles = {
        en: 'doc/help.html',
        it: 'doc/help-it.html',
        fr: 'doc/help-fr.html',
        de: 'doc/help-de.html',
        es: 'doc/help-es.html',
        pt: 'doc/help-pt.html',
        ar: 'doc/help-ar.html',
        zh: 'doc/help-zh.html',
        ko: 'doc/help-ko.html',
        ja: 'doc/help-ja.html'
    };
    const helpPage = helpFiles[lang] || 'doc/help.html';
    window.open(helpPage, '_blank');
});

function loadScenarioList() {
    fetch('backgrounds/list.json')
        .then(response => response.json())
        .then(data => {
            const scenarioSelect = document.getElementById('scenarioSelect');
            scenarioSelect.innerHTML = '<option value=""></option>';
            if (scenarioSelect.options[0]) scenarioSelect.options[0].text = Blockly.Msg.BKY_SCENARIO || 'Scenario';
            data.forEach(scenario => {
                const option = document.createElement('option');
                option.value = scenario.file;
                option.text = scenario.name;
                scenarioSelect.appendChild(option);
            });
        })
        .catch(err => console.error('Unable to load the scenario list:', err));
}

// Blockly integration: custom blocks, JavaScript generators, workspace persistence,
// and editor setup. This file is loaded before the simulation and UI layers.

let workspace;

// Custom block definitions
const customBlockTypes = [
    "take_off", "land", "return_to_base", "set_altitude", "change_altitude", "set_angle",
    "change_angle", "slide", "walk", "walk_climbing", "go_to", "move_by", "curve_abs", "curve",
    "wait", "smoke", "set_speed", "sensor_keypressed", "sensor_x",
    "sensor_z", "sensor_altitude", "sensor_direction", "sensor_speed",
    "start_block", "end_block"
];

function defineCustomBlocks() {
    customBlockTypes.forEach(type => {
        if (Blockly.Blocks[type]) delete Blockly.Blocks[type];
    });
    Blockly.defineBlocksWithJsonArray([{
        "type": "take_off",
        "message0": Blockly.Msg["BKY_DRONE_TAKEOFF"],
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_TAKEOFF_TOOLTIP"]
    }, {
        "type": "land",
        "message0": Blockly.Msg["BKY_DRONE_LAND"],
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_LAND_TOOLTIP"]
    }, {
        "type": "set_altitude",
        "message0": Blockly.Msg["BKY_DRONE_SET_ALTITUDE"],
        "args0": [{
            "type": "input_value",
            "name": "ALTITUDE",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_SET_ALTITUDE_TOOLTIP"]
    }, {
        "type": "change_altitude",
        "message0": Blockly.Msg["BKY_DRONE_CHANGE_ALTITUDE"],
        "args0": [{
            "type": "input_value",
            "name": "ALTITUDE",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_CHANGE_ALTITUDE_TOOLTIP"]
    }, {
        "type": "set_angle",
        "message0": Blockly.Msg["BKY_DRONE_SET_ANGLE"],
        "args0": [{
            "type": "input_value",
            "name": "ANGLE",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_SET_ANGLE_TOOLTIP"]
    }, {
        "type": "change_angle",
        "message0": Blockly.Msg["BKY_DRONE_CHANGE_ANGLE"],
        "args0": [{
            "type": "input_value",
            "name": "ANGLE",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_CHANGE_ANGLE_TOOLTIP"]
    }, {
        "type": "slide",
        "message0": Blockly.Msg["BKY_DRONE_SLIDE"],
        "args0": [{
            "type": "input_value",
            "name": "SLIDE",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_SLIDE_TOOLTIP"]
    }, {
        "type": "walk",
        "message0": Blockly.Msg["BKY_DRONE_WALK"],
        "args0": [{
            "type": "input_value",
            "name": "DIST",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_WALK_TOOLTIP"]
    }, {
        "type": "walk_climbing",
        "message0": Blockly.Msg["BKY_DRONE_WALK_CLIMBING"],
        "args0": [{
            "type": "input_value",
            "name": "DIST",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "CLIMB",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_WALK_CLIMBING_TOOLTIP"]
    }, {
        "type": "go_to",
        "message0": Blockly.Msg["BKY_DRONE_GO_TO"],
        "args0": [{
            "type": "input_value",
            "name": "X",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "Y",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "Z",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_GO_TO_TOOLTIP"]
    }, {
        "type": "move_by",
        "message0": Blockly.Msg["BKY_DRONE_MOVE_BY"],
        "args0": [{
            "type": "input_value",
            "name": "X",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "Y",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "Z",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_MOVE_BY_TOOLTIP"]
    }, {
        "type": "curve_abs",
        "message0": Blockly.Msg["BKY_DRONE_CURVE_ABS"],
        "args0": [{
            "type": "input_value",
            "name": "X",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "Y",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "Z",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "XD",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "YD",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "ZD",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_CURVE_ABS_TOOLTIP"]
    }, {
        "type": "curve",
        "message0": Blockly.Msg["BKY_DRONE_CURVE"],
        "args0": [{
            "type": "input_value",
            "name": "X",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "Y",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "Z",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "XD",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "YD",
            "check": "Number"
        }, {
            "type": "input_value",
            "name": "ZD",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_CURVE_TOOLTIP"]
    }, {
        "type": "return_to_base",
        "message0": Blockly.Msg["BKY_DRONE_RETURN_TO_BASE"],
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_RETURN_TO_BASE_TOOLTIP"]
    }, {
        "type": "wait",
        "message0": Blockly.Msg["BKY_DRONE_WAIT"],
        "args0": [{
            "type": "input_value",
            "name": "DIST",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_WAIT_TOOLTIP"]
    }, {
        "type": "smoke",
        "message0": Blockly.Msg["BKY_DRONE_SMOKE"],
        "args0": [{
            "type": "input_value",
            "name": "SMOKE",
            "check": "Boolean"
        }],
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_SMOKE_TOOLTIP"]
    }, {
        "type": "set_speed",
        "message0": Blockly.Msg["BKY_DRONE_SPEED"],
        "args0": [{
            "type": "input_value",
            "name": "SPEED",
            "check": "Number"
        }],
        "inputsInline": true,
        "previousStatement": null,
        "nextStatement": null,
        "colour": 20,
        "tooltip": Blockly.Msg["BKY_DRONE_SPEED_TOOLTIP"]
    }, {
        "type": "sensor_keypressed",
        "message0": Blockly.Msg["BKY_SENSOR_KEYPRESSED"],
        "args0": [{
            "type": "field_dropdown",
            "name": "KEY",
            "options": [
                [Blockly.Msg["ARROW_UP"], "ARROW_UP"],
                [Blockly.Msg["ARROW_DOWN"], "ARROW_DOWN"],
                [Blockly.Msg["ARROW_LEFT"], "ARROW_LEFT"],
                [Blockly.Msg["ARROW_RIGHT"], "ARROW_RIGHT"],
                [Blockly.Msg["SPACE"], "SPACE"],
                [Blockly.Msg["RETURN"], "RETURN"],
                ["A", "A"],
                ["B", "B"],
                ["C", "C"],
                ["D", "D"],
                ["E", "E"],
                ["F", "F"],
                ["G", "G"],
                ["H", "H"],
                ["I", "I"],
                ["J", "J"],
                ["K", "K"],
                ["L", "L"],
                ["M", "M"],
                ["N", "N"],
                ["O", "O"],
                ["P", "P"],
                ["Q", "Q"],
                ["R", "R"],
                ["S", "S"],
                ["T", "T"],
                ["U", "U"],
                ["V", "V"],
                ["W", "W"],
                ["X", "X"],
                ["Y", "Y"],
                ["Z", "Z"]
            ]
        }],
        "output": "Boolean",
        "colour": 90,
        "tooltip": Blockly.Msg["BKY_SENSOR_KEYPRESSED_TOOLTIP"],
        "helpUrl": ""
    }, {
        "type": "sensor_x",
        "message0": Blockly.Msg["BKY_SENSOR_X"],
        "output": "Numeric",
        "colour": 90,
        "tooltip": Blockly.Msg["BKY_SENSOR_X_TOOLTIP"],
        "helpUrl": ""
    }, {
        "type": "sensor_z",
        "message0": Blockly.Msg["BKY_SENSOR_Z"],
        "output": "Numeric",
        "colour": 90,
        "tooltip": Blockly.Msg["BKY_SENSOR_Z_TOOLTIP"],
        "helpUrl": ""
    }, {
        "type": "sensor_altitude",
        "message0": Blockly.Msg["BKY_SENSOR_ALTITUDE"],
        "output": "Numeric",
        "colour": 90,
        "tooltip": Blockly.Msg["BKY_SENSOR_ALTITUDE_TOOLTIP"],
        "helpUrl": ""
    }, {
        "type": "sensor_direction",
        "message0": Blockly.Msg["BKY_SENSOR_DIRECTION"],
        "output": "Numeric",
        "colour": 90,
        "tooltip": Blockly.Msg["BKY_SENSOR_DIRECTION_TOOLTIP"],
        "helpUrl": ""
    }, {
        "type": "sensor_speed",
        "message0": Blockly.Msg["BKY_SENSOR_SPEED"],
        "output": "Number",
        "colour": 90,
        "tooltip": Blockly.Msg["BKY_SENSOR_SPEED_TOOLTIP"],
        "helpUrl": ""
    }, {
        "type": "start_block",
        "message0": Blockly.Msg["BKY_FLOW_START"],
        "nextStatement": null,
        "colour": 60,
        "tooltip": Blockly.Msg["BKY_FLOW_START_TOOLTIP"],
        "hat": "cap"
    }, {
        "type": "end_block",
        "message0": Blockly.Msg["BKY_FLOW_END"],
        "previousStatement": null,
        "colour": 0,
        "tooltip": Blockly.Msg["BKY_FLOW_END_TOOLTIP"]
    }]);
}

const makecodeTheme = Blockly.Theme.defineTheme('makecode', {
    base: Blockly.Themes.Classic,
    blockStyles: {
        logic_blocks: {
            colourPrimary: "#4B9CD3"
        },
        loops_blocks: {
            colourPrimary: "#F7C948"
        },
        math_blocks: {
            colourPrimary: "#F86624"
        },
        text_blocks: {
            colourPrimary: "#8C6BB1"
        },
        list_blocks: {
            colourPrimary: "#3AAFB9"
        },
        variable_blocks: {
            colourPrimary: "#FF8C42"
        },
        procedure_blocks: {
            colourPrimary: "#DB5461"
        },
        drone_blocks: {
            colourPrimary: "#20A39E"
        },
        sensor_blocks: {
            colourPrimary: "#90BE6D"
        }
    },
    categoryStyles: {
        logic_category: {
            colour: "#4B9CD3"
        },
        loops_category: {
            colour: "#F7C948"
        },
        math_category: {
            colour: "#F86624"
        },
        text_category: {
            colour: "#8C6BB1"
        },
        lists_category: {
            colour: "#3AAFB9"
        },
        variables_category: {
            colour: "#FF8C42"
        },
        functions_category: {
            colour: "#DB5461"
        },
        drone_category: {
            colour: "#20A39E"
        },
        sensors_category: {
            colour: "#90BE6D"
        },
        flow_category: {
            colour: "#888"
        }
    },
    fontStyle: {
        family: 'Segoe UI, sans-serif',
        size: 14
    },
    componentStyles: {
        workspaceBackgroundColour: "#ffffff",
        toolboxBackgroundColour: "#eeeeee",
        toolboxForegroundColour: "#000000",
        flyoutBackgroundColour: "#f0f0f0",
        flyoutForegroundColour: "#000000",
        flyoutOpacity: 1,
        scrollbarColour: "#cccccc",
        insertionMarkerColour: "#000000",
        insertionMarkerOpacity: 0.3,
        cursorColour: "#d0d0d0"
    }
});

// JavaScript generators for drone commands
Blockly.JavaScript.forBlock['take_off'] = block => 'await drone.takeOff();\n';
Blockly.JavaScript.forBlock['land'] = block => 'await drone.land();\n';
Blockly.JavaScript.forBlock['set_altitude'] = block => {
    var altitude = Blockly.JavaScript.valueToCode(block, 'ALTITUDE', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.setAltitude(' + altitude + ');\n';
};
Blockly.JavaScript.forBlock['change_altitude'] = block => {
    var altitude = Blockly.JavaScript.valueToCode(block, 'ALTITUDE', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.changeAltitude(' + altitude + ');\n';
};
Blockly.JavaScript.forBlock['set_angle'] = block => {
    var angle = Blockly.JavaScript.valueToCode(block, 'ANGLE', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.setAngle(' + angle + ');\n';
};
Blockly.JavaScript.forBlock['change_angle'] = block => {
    var angle = Blockly.JavaScript.valueToCode(block, 'ANGLE', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.changeAngle(' + angle + ');\n';
};
Blockly.JavaScript.forBlock['slide'] = block => {
    var slide = Blockly.JavaScript.valueToCode(block, 'SLIDE', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.slide(' + slide + ');\n';
};
Blockly.JavaScript.forBlock['walk'] = block => {
    var dist = Blockly.JavaScript.valueToCode(block, 'DIST', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.walk(' + dist + ');\n';
};
Blockly.JavaScript.forBlock['walk_climbing'] = block => {
    var dist = Blockly.JavaScript.valueToCode(block, 'DIST', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var climb = Blockly.JavaScript.valueToCode(block, 'CLIMB', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.walkClimbing(' + dist + ', ' + climb + ');\n';
};
Blockly.JavaScript.forBlock['go_to'] = block => {
    var x = Blockly.JavaScript.valueToCode(block, 'X', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var y = Blockly.JavaScript.valueToCode(block, 'Y', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var z = Blockly.JavaScript.valueToCode(block, 'Z', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.goTo(' + x + ', ' + y + ', ' + z + ');\n';
};
Blockly.JavaScript.forBlock['move_by'] = block => {
    var x = Blockly.JavaScript.valueToCode(block, 'X', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var y = Blockly.JavaScript.valueToCode(block, 'Y', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var z = Blockly.JavaScript.valueToCode(block, 'Z', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.moveBy(' + x + ', ' + y + ', ' + z + ');\n';
};
Blockly.JavaScript.forBlock['curve_abs'] = block => {
    var x = Blockly.JavaScript.valueToCode(block, 'X', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var y = Blockly.JavaScript.valueToCode(block, 'Y', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var z = Blockly.JavaScript.valueToCode(block, 'Z', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var xd = Blockly.JavaScript.valueToCode(block, 'XD', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var yd = Blockly.JavaScript.valueToCode(block, 'YD', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var zd = Blockly.JavaScript.valueToCode(block, 'ZD', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.curveAbs(' + x + ', ' + y + ', ' + z + ', ' + xd + ', ' + yd + ', ' + zd + ');\n';
};
Blockly.JavaScript.forBlock['curve'] = block => {
    var x = Blockly.JavaScript.valueToCode(block, 'X', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var y = Blockly.JavaScript.valueToCode(block, 'Y', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var z = Blockly.JavaScript.valueToCode(block, 'Z', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var xd = Blockly.JavaScript.valueToCode(block, 'XD', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var yd = Blockly.JavaScript.valueToCode(block, 'YD', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    var zd = Blockly.JavaScript.valueToCode(block, 'ZD', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await drone.curve(' + x + ', ' + y + ', ' + z + ', ' + xd + ', ' + yd + ', ' + zd + ');\n';
};
Blockly.JavaScript.forBlock['return_to_base'] = block => 'await drone.returnToBase();\n';
Blockly.JavaScript.forBlock['wait'] = block => {
    var dist = Blockly.JavaScript.valueToCode(block, 'DIST', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return 'await waitSeconds(' + dist + ');\n';
};
Blockly.JavaScript.forBlock['smoke'] = block => {
    var smoke = Blockly.JavaScript.valueToCode(block, 'SMOKE', Blockly.JavaScript.ORDER_ATOMIC) || '0';
    return `drone.smoke = (${smoke});\n`;
};
Blockly.JavaScript.forBlock['set_speed'] = block => {
    var speed = Blockly.JavaScript.valueToCode(block, 'SPEED', Blockly.JavaScript.ORDER_ATOMIC) || '1';
    return `drone.speed = ${speed};\n`;
};

// JavaScript expressions for sensor blocks
Blockly.JavaScript.forBlock['sensor_keypressed'] = block => {
    var key = block.getFieldValue('KEY');
    var code = "isKeyPressed('" + key + "')";
    return [code, Blockly.JavaScript.ORDER_NONE];
};
Blockly.JavaScript.forBlock['sensor_x'] = block => {
    var code = "-drone.mesh.position.z.toFixed(2)";
    return [code, Blockly.JavaScript.ORDER_NONE];
};
Blockly.JavaScript.forBlock['sensor_z'] = block => {
    var code = "-drone.mesh.position.x.toFixed(2)";
    return [code, Blockly.JavaScript.ORDER_NONE];
};
Blockly.JavaScript.forBlock['sensor_altitude'] = block => {
    var code = "drone.altitude.toFixed(2)";
    return [code, Blockly.JavaScript.ORDER_NONE];
};
Blockly.JavaScript.forBlock['sensor_direction'] = block => {
    var code = "-drone.direction.toFixed(2)";
    return [code, Blockly.JavaScript.ORDER_NONE];
};
Blockly.JavaScript.forBlock['sensor_speed'] = block => {
    return ['drone.speed', Blockly.JavaScript.ORDER_NONE];
};
// Start and end are structural markers and do not emit executable code.
Blockly.JavaScript.forBlock['start_block'] = block => '';
Blockly.JavaScript.forBlock['end_block'] = block => '';

const originalProcedureCallReturn = Blockly.JavaScript.forBlock['procedures_callreturn'];
if (originalProcedureCallReturn) {
    // User-defined Blockly procedures participate in the asynchronous flight sequence.
    Blockly.JavaScript.forBlock['procedures_callnoreturn'] = (block, generator) => {
        const call = originalProcedureCallReturn(block, generator)[0];
        return 'await ' + call + ';\n';
    };
    Blockly.JavaScript.forBlock['procedures_callreturn'] = (block, generator) => {
        const call = originalProcedureCallReturn(block, generator)[0];
        return ['await ' + call, Blockly.JavaScript.ORDER_NONE];
    };
}

// Emit random integers inline. The program runner converts generated functions to
// async functions, which is incompatible with Blockly's synchronous helper here.
Blockly.JavaScript.forBlock['math_random_int'] = (block, generator) => {
    var from = generator.valueToCode(block, 'FROM', Blockly.JavaScript.ORDER_NONE) || '0';
    var to = generator.valueToCode(block, 'TO', Blockly.JavaScript.ORDER_NONE) || '0';
    var code = 'Math.floor(Math.random() * (' + to + ' - ' + from + ' + 1) + ' + from + ')';
    return [code, Blockly.JavaScript.ORDER_FUNCTION_CALL];
};
// Workspace persistence and editor lifecycle
const autosaveWorkspaceKey = 'droneCommander.autosaveXml';
const autosaveFileNameKey = 'droneCommander.fileName';
const defaultProgramName = (typeof Blockly !== 'undefined' && Blockly.Msg && Blockly.Msg.BKY_FILE_NAME) || 'noname';
const defaultWorkspaceXmlText = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="start_block" x="10" y="10"></block>
</xml>`;
let programName = localStorage.getItem(autosaveFileNameKey) || defaultProgramName;
let autosaveTimeout;
let isRestoringWorkspace = false;

const stripFileExtension = name => {
    const cleanName = String(name || '').split(/[\\/]/).pop().trim();
    return cleanName.replace(/\.[^/.]+$/, '').trim();
};

const normalizeProgramName = name => stripFileExtension(name) || defaultProgramName;

const updateFileNameLabel = () => {
    const label = document.getElementById('fileNameLabel');
    if (!label) return;
    label.innerText = programName;
    label.title = programName;
};

const setProgramName = name => {
    programName = normalizeProgramName(name);
    localStorage.setItem(autosaveFileNameKey, programName);
    updateFileNameLabel();
};

const getWorkspaceXmlText = () => {
    if (!workspace) return '';
    const xml = Blockly.Xml.workspaceToDom(workspace);
    return Blockly.Xml.domToPrettyText(xml);
};

const parseWorkspaceXml = xmlText => new DOMParser().parseFromString(xmlText, 'text/xml').documentElement;

const saveProgramToLocalStorage = () => {
    if (!workspace) return;
    localStorage.setItem(autosaveWorkspaceKey, getWorkspaceXmlText());
    localStorage.setItem(autosaveFileNameKey, programName);
};

const scheduleAutosave = event => {
    if (!workspace || isRestoringWorkspace || (event && event.isUiEvent)) return;
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(saveProgramToLocalStorage, 250);
};

const loadWorkspaceFromXmlText = (xmlText, shouldAutosave = true) => {
    if (!workspace || !xmlText) return false;
    isRestoringWorkspace = true;
    try {
        workspace.clear();
        Blockly.Xml.domToWorkspace(parseWorkspaceXml(xmlText), workspace);
    } catch (error) {
        console.error('Unable to load the Blockly program:', error);
        return false;
    } finally {
        isRestoringWorkspace = false;
    }
    if (shouldAutosave) saveProgramToLocalStorage();
    return true;
};

const restoreProgramFromLocalStorage = () => {
    setProgramName(localStorage.getItem(autosaveFileNameKey) || defaultProgramName);
    const savedXml = localStorage.getItem(autosaveWorkspaceKey);
    if (savedXml) loadWorkspaceFromXmlText(savedXml, false);
};

window.addEventListener('beforeunload', saveProgramToLocalStorage);

// Blockly editor and toolbox initialization
const initBlockly = () => {
    const toolbox = {
        "kind": "categoryToolbox",
        "contents": [{
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_LOGIC"],
            "colour": "210",
            "categorId": "logic",
            "contents": [{
                "kind": "block",
                "type": "controls_if"
            }, {
                "kind": "block",
                "type": "logic_compare"
            }, {
                "kind": "block",
                "type": "logic_operation"
            }, {
                "kind": "block",
                "type": "logic_negate"
            }, {
                "kind": "block",
                "type": "logic_boolean"
            }, {
                "kind": "block",
                "type": "logic_null"
            }, {
                "kind": "block",
                "type": "logic_ternary"
            }]
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_LOOPS"],
            "colour": "120",
            "categorId": "loops",
            "contents": [{
                "kind": "block",
                "type": "controls_repeat_ext"
            }, {
                "kind": "block",
                "type": "controls_whileUntil"
            }, {
                "kind": "block",
                "type": "controls_for"
            }, {
                "kind": "block",
                "type": "controls_forEach"
            }, {
                "kind": "block",
                "type": "controls_flow_statements"
            }]
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_MATH"],
            "colour": "230",
            "categorId": "math",
            "contents": [{
                "kind": "block",
                "type": "math_number"
            }, {
                "kind": "block",
                "type": "math_arithmetic"
            }, {
                "kind": "block",
                "type": "math_single"
            }, {
                "kind": "block",
                "type": "math_trig"
            }, {
                "kind": "block",
                "type": "math_constant"
            }, {
                "kind": "block",
                "type": "math_number_property"
            }, {
                "kind": "block",
                "type": "math_round"
            }, {
                "kind": "block",
                "type": "math_on_list"
            }, {
                "kind": "block",
                "type": "math_modulo"
            }, {
                "kind": "block",
                "type": "math_constrain"
            }, {
                "kind": "block",
                "type": "math_random_int"
            }, {
                "kind": "block",
                "type": "math_random_float"
            }]
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_TEXT"],
            "colour": "160",
            "categorId": "text",
            "contents": [{
                "kind": "block",
                "type": "text"
            }, {
                "kind": "block",
                "type": "text_join"
            }, {
                "kind": "block",
                "type": "text_append"
            }, {
                "kind": "block",
                "type": "text_length",
                "inputs": {
                    "VALUE": {
                        "shadow": {
                            "type": "text",
                            "fields": {
                                "TEXT": ""
                            }
                        }
                    }
                }
            }, {
                "kind": "block",
                "type": "text_isEmpty",
                "inputs": {
                    "VALUE": {
                        "shadow": {
                            "type": "text",
                            "fields": {
                                "TEXT": ""
                            }
                        }
                    }
                }
            }, {
                "kind": "block",
                "type": "text_indexOf"
            }, {
                "kind": "block",
                "type": "text_charAt"
            }, {
                "kind": "block",
                "type": "text_getSubstring"
            }, {
                "kind": "block",
                "type": "text_changeCase",
                "inputs": {
                    "TEXT": {
                        "shadow": {
                            "type": "text",
                            "fields": {
                                "TEXT": ""
                            }
                        }
                    }
                }
            }, {
                "kind": "block",
                "type": "text_trim",
                "inputs": {
                    "TEXT": {
                        "shadow": {
                            "type": "text",
                            "fields": {
                                "TEXT": ""
                            }
                        }
                    }
                }
            }, {
                "kind": "block",
                "type": "text_print",
                "inputs": {
                    "TEXT": {
                        "shadow": {
                            "type": "text",
                            "fields": {
                                "TEXT": ""
                            }
                        }
                    }
                }
            }]
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_LISTS"],
            "colour": "260",
            "categorId": "lists",
            "contents": [{
                "kind": "block",
                "type": "lists_create_with"
            }, {
                "kind": "block",
                "type": "lists_repeat"
            }, {
                "kind": "block",
                "type": "lists_length"
            }, {
                "kind": "block",
                "type": "lists_isEmpty"
            }, {
                "kind": "block",
                "type": "lists_indexOf"
            }, {
                "kind": "block",
                "type": "lists_getIndex"
            }, {
                "kind": "block",
                "type": "lists_setIndex"
            }, {
                "kind": "block",
                "type": "lists_getSublist"
            }, {
                "kind": "block",
                "type": "lists_split"
            }, {
                "kind": "block",
                "type": "lists_sort"
            }]
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_VARIABLES"],
            "colour": "330",
            "categorId": "variables",
            "custom": "VARIABLE"
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_FUNCTIONS"],
            "colour": "290",
            "categorId": "functions",
            "custom": "PROCEDURE"
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_SENSORS"],
            "colour": "90",
            "categorId": "sensors",
            "contents": [{
                "kind": "block",
                "type": "sensor_keypressed"
            }, {
                "kind": "block",
                "type": "sensor_x"
            }, {
                "kind": "block",
                "type": "sensor_z"
            }, {
                "kind": "block",
                "type": "sensor_altitude"
            }, {
                "kind": "block",
                "type": "sensor_direction"
            }, {
                "kind": "block",
                "type": "sensor_speed"
            }]
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_DRONE"],
            "colour": "20",
            "categorId": "drone",
            "contents": [{
                    "kind": "block",
                    "type": "take_off"
                }, {
                    "kind": "block",
                    "type": "land"
                }, {
                    "kind": "block",
                    "type": "return_to_base"
                }, {
                    "kind": "block",
                    "type": "set_altitude",
                    "inputs": {
                        "ALTITUDE": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "10"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "change_altitude",
                    "inputs": {
                        "ALTITUDE": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "10"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "set_angle",
                    "inputs": {
                        "ANGLE": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "90"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "change_angle",
                    "inputs": {
                        "ANGLE": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "90"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "slide",
                    "inputs": {
                        "SLIDE": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "1"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "walk",
                    "inputs": {
                        "DIST": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "1"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "walk_climbing",
                    "inputs": {
                        "DIST": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "1"
                                }
                            }
                        },
                        "CLIMB": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "1"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "go_to",
                    "inputs": {
                        "X": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "0"
                                }
                            }
                        },
                        "Y": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "10"
                                }
                            }
                        },
                        "Z": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "0"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "move_by",
                    "inputs": {
                        "X": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "1"
                                }
                            }
                        },
                        "Y": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "0"
                                }
                            }
                        },
                        "Z": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "0"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "curve_abs",
                    "inputs": {
                        "X": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "5"
                                }
                            }
                        },
                        "Y": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "12"
                                }
                            }
                        },
                        "Z": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "5"
                                }
                            }
                        },
                        "XD": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "10"
                                }
                            }
                        },
                        "YD": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "10"
                                }
                            }
                        },
                        "ZD": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "0"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "curve",
                    "inputs": {
                        "X": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "5"
                                }
                            }
                        },
                        "Y": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "2"
                                }
                            }
                        },
                        "Z": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "5"
                                }
                            }
                        },
                        "XD": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "10"
                                }
                            }
                        },
                        "YD": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "0"
                                }
                            }
                        },
                        "ZD": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "0"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "wait",
                    "inputs": {
                        "DIST": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "1"
                                }
                            }
                        }
                    }
                }, {
                    "kind": "block",
                    "type": "smoke"
                }, {
                    "kind": "block",
                    "type": "set_speed",
                    "inputs": {
                        "SPEED": {
                            "shadow": {
                                "type": "math_number",
                                "fields": {
                                    "NUM": "1"
                                }
                            }
                        }
                    }
                }

            ]
        }, {
            "kind": "category",
            "name": Blockly.Msg["BKY_CATEGORY_FLOW"],
            "colour": "60",
            "categorId": "flow",
            "contents": [{
                "kind": "block",
                "type": "start_block"
            }, {
                "kind": "block",
                "type": "end_block"
            }]
        }, ]
    };
    workspace = Blockly.inject('blocklyDiv', {
        toolbox,
        rtl: document.documentElement.dir === 'rtl',
        renderer: 'zelos',
        theme: Blockly.Themes.makecode
    });
    workspace.addChangeListener(scheduleAutosave);
};

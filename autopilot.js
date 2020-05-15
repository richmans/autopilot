// ==UserScript==
// @name         Victory Spacex autopilot
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Flight to victory
// @author       You
// @match        https://iss-sim.spacex.com/
// @grant        none
// ==/UserScript==

// determines how often the ap runs (in ms).
var apInterval = 1000;
// how long the cooldown program runs
var apCooldown = 10000;
// the overall state
var state = {}
// hold distance
var apHold = 20
// approach speed
var apApproachRate = 10

// get the current timestamp
function timestamp() {
    return (new Date()).getTime()
}

var action2button = {
    'begin': 'begin-button',
    'yaw-inc': 'yaw-right-button',
    'yaw-dec': 'yaw-left-button',
    'pitch-inc': 'pitch-down-button',
    'pitch-dec': 'pitch-up-button',
    'roll-inc': 'roll-right-button',
    'roll-dec': 'roll-left-button',
    'y-dec': 'translate-left-button',
    'y-inc': 'translate-right-button',
    'z-dec': 'translate-down-button',
    'z-inc': 'translate-up-button',
    'x-dec': 'translate-forward-button',
    'x-inc': 'translate-backward-button',
    'toggle-translation': 'toggle-translation',
    'toggle-rotation': 'toggle-rotation',
}

function ensurePrecision(state, instrument, isPrecise) {
    if (state.precision[instrument] != isPrecise) {
        return ['toggle-' + instrument]
    }
    return []
}
var programs = {
    init: function(state) {
        state.program = 'cooldown'
        return []
    },
    // waits for a couple of seconds for any residual motion to settle.
    cooldown: function(state) {
        if (state.cooldown.start === undefined) {
            state.cooldown = {start: timestamp()};
        }
        if (timestamp() - state.cooldown.start > apCooldown) {
            state.program = 'orient'
        }
        return []
    },
    // orients the spacecraft to docking orientation
    orient: function(state) {
        let actions = []
        let rotations = ['yaw', 'roll', 'pitch']
        let correctOrientations = []
        actions = actions.concat(ensurePrecision(state, 'rotation', true))
        for (i in rotations) {
            let rot = rotations[i]
            let o = state.orientation[rot]
            
            if (o.error > 0.1 && o.rate < 0.1) {
                // start positive correction
                actions.push(rot + '-inc')
            }else if (o.rate >= 0.1 && o.error <= 0.2) {
                // end positive correction
                actions.push(rot + '-dec')
            }else if (o.error < -0.1 && o.rate > -0.1) {
                // start negative correction
                actions.push(rot + '-dec')
            }else if (o.rate <= -0.1 && o.error >= -0.2) {
                // end negative correction
                actions.push(rot + '-inc')
            }
            if (o.error > -0.2 && o.error < 0.2 && o.rate == 0) {
                correctOrientations.push(rot)
            }
        }
        if (correctOrientations.length == rotations.length) {
            state.program = 'translate'
        }
        return actions
    },
    // moves the spacecraft to the correct y and z coordinates
    translate: function(state, doTransition=true) {
        let actions = []
        let translations = ['y', 'z']
        let correctTranslations = []
        let needPrecision = state.pos.total < 2*apHold
        actions = actions.concat(ensurePrecision(state, 'translation', needPrecision))
        for (i in translations) {
            let c = translations[i]
            let delta = state.pos[c]
            if (state.translate[c] == undefined) state.translate[c] = 0
            let rate = state.translate[c]
            if (delta < -0.1 && rate < 1) {
                // start positive correction
                actions.push(c + '-inc')
                state.translate[c] += 1
            }else if (delta >= -0.0 && rate >= 1) {
                // end positive correction
                actions.push(c+ '-dec')
                state.translate[c] -= 1
            }else if (delta > 0.1 && rate > -1) {
                // start negative correction
                actions.push(c + '-dec')
                state.translate[c] -= 1
            }else if (delta <= 0.0 && rate <= -1) {
                // end negative correction
                actions.push(c + '-inc')
                state.translate[c] += 1
            }
            if (delta > -0.2 && delta < 0.2 && rate == 0) {
                correctTranslations.push(c)
            }
        }
        if (correctTranslations.length == translations.length && doTransition) {
            if (state.pos.x > apHold) {
                state.program = 'approach'
            }else{
                state.program = 'dock'
            }
        }
        return actions
    },
    // close in on the docking port up to 20m
    approach: function(state) {
        let actions = ensurePrecision(state, 'translation', false)
        if (state.approach.rate == undefined) state.approach.rate = 0
        if (state.pos.x > apHold * 2 && state.approach.rate < apApproachRate) {
            actions.push('x-dec')
            state.approach.rate += 1
        } else if (state.pos.x < apHold * 2 && state.approach.rate > 1) {
            actions.push('x-inc')
            state.approach.rate -= 1
        } else if (state.approach.rate > 0 && state.pos.x <= apHold){
            actions.push('x-inc')
            state.approach.rate -= 1
        } else if (state.approach.rate == 0 && state.pos.x <= apHold) {
            state.program = 'translate'
        }

        return actions
    },
    // final docking procedure
    dock: function(state) {
        let actions = ensurePrecision(state, 'translation', true)
        actions = actions.concat(ensurePrecision(state, 'rotation', true))
        // while docking, make small adjustments to translation
        actions = actions.concat(programs.translate(state, false))
        if (state.approach.rate == undefined) state.approach.rate = 0
        if (state.approach.rate < 2) {
            actions.push('x-dec')
            state.approach.rate += 1
        }
        return actions
    },
    // stops all autopilot actions
    abort: function(state) {
        return []
    }

}

// checks if an element with a certain id is visible
function elementIsVisible(elid) {
    return document.getElementById(elid).style.visibility != 'hidden'
}

// detects what stage the simulator is in.
function detectStage() {
    if (elementIsVisible("hud")) return "flight";
    if (elementIsVisible("preloader")) return "preload";
    if (elementIsVisible("intro")){
        if (elementIsVisible("begin-button")){
            return "begin"
        } else {
            return "intro";
        }
    }
    if (elementIsVisible("success")) return "success";
    if (elementIsVisible("fail")) return "fail";
    
    
    return "unknown";
}

// gets float data from a dom node
function getFloat(qry) {
    return parseFloat(document.querySelector(qry).textContent)
}

// gathers all flight data visible on the screen and puts it into the state
function updateSensors(state) {
    state.pos = {
        x: getFloat("#x-range"),
        y: getFloat("#y-range"),
        z: getFloat("#z-range"),
        total: getFloat("#range .rate"),

    },
    state.speed = getFloat('#rate .rate')
    state.orientation = {
        pitch : {
            error: getFloat("#pitch .error"),
            rate: getFloat("#pitch .rate"),
        },
        roll : {
            error: getFloat("#roll .error"),
            rate: getFloat("#roll .rate"),
        },
        yaw : {
            error: getFloat("#yaw .error"),
            rate: getFloat("#yaw .rate"),
        }
    }
    state.precision = {
        translation: document.querySelector("#precision-translation-status.large") == undefined,
        rotation: document.querySelector("#precision-rotation-status.large") == undefined,
        
    }
}

// push a button based on a specific action that we want to achieve
function pushButton(ac) {
    console.log("Action:", ac)
    let buttonId = action2button[ac]
    if (buttonId == undefined) {
        console.error("No button found for action", ac)
    } else {
        document.getElementById(buttonId).click();
    }
}

// run the current program and update the state
function runProgram(state) {
    let curProg = state.program
    let p = programs[state.program]
    let actions = p(state);
    let newProgram = state.program
    // if we switched to a new program, initialize its state
    if (curProg != newProgram) {
        console.log("Switching from program", curProg, "to program", newProgram)
        state[newProgram] = {}
    }
    return actions
}

// Execute actions by clicking the correspondign buttons
function executeActions(actions) {
    for (a in actions) {
        pushButton(actions[a])
    }
}

// Do all the things needed to get us closer to docking
function fly(state) {
    updateSensors(state)
    actions = runProgram(state)
    executeActions(actions)
}

// detect the current simulator stage
// if the simulator is in 'flight' stage, call fly(state) to fly the spacecraft
// if the simulator is in 'begin' stage, push the button to start the flight
function autoPilot(state) {
    let stage = detectStage();
    if (state.stage != stage) {
        state.stage = stage
        console.log("Detected stage", stage)
        if (stage == 'flight') {
            state.program = 'init'
        }
    }
    if (stage == 'begin' && state.beginClicked == undefined) {
        pushButton('begin')
        state.beginClicked = true
    }
    if (stage == 'flight') fly(state);
    updateAutoPilotControls(state);
}

function updateAutoPilotControls(state) {
    document.querySelector('#autopilot .program').textContent = state.program
}

function apAbort() {
    state.program = 'abort'
    document.getElementById('apAbort').style.visibility = 'hidden'
}


function addAutopilotControls() {
    let hud = document.getElementById("hud");
    let div = document.createElement('div');
    div.style.position = 'absolute'
    div.style.bottom = '100px'
    div.style.transform = 'translateX(-50%)'
    div.style.left = '50%'
    div.style.color = '#24d2fd'
    div.style.textAlign = 'center'
    div.id = 'autopilot'
    div.innerHTML = "Autopilot <span class='program'>initializing</span><br/><a href='#' id='apAbort' style='color:red;text-decoration:underline'>ABORT</a>"
    hud.appendChild(div);
    document.getElementById('apAbort').onclick = apAbort
}
(function() {
    'use strict';
    addAutopilotControls()
    console.log("Victory autopilot loaded.");
    setInterval(autoPilot, apInterval, state)
    
})();
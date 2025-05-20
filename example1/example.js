"use strict";

var gl, program;
var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;
var canvas;
var NumVertices = 36;
var pointsArray = [];
var stack = [];

// Rotation angles for each limb
var theta = {
    Torso: 0,
    Head: 0,
    RULeg: 0, RLLeg: 0, RFoot: 0,
    LULeg: 0, LLLeg: 0, LFoot: 0,
    RUArm: 0, RLArm: 0,
    LUArm: 0, LLArm: 0
};

// Camera
var eye = vec3(10.0, 10.0, 15.0);
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);
const radius = 15.0;

const cameraViews = {
    front: {
        eye: vec3(10, 10, radius),
        at: vec3(0.0, 0.0, 0.0),
        up: vec3(0.0, 1.0, 0.0)
    },
    side: {
        eye: vec3(radius, 0.6, 0.6),
        at: vec3(0.0, 0.0, 0.0),
        up: vec3(0.0, 1.0, 0.0)
    },
    top: {
        eye: vec3(0.6, radius, 0.6),
        at: vec3(0.0, 0.0, 0.0),
        up: vec3(0.0, 0.0, 1.0)
    }
};

let thetaCam = 0;
let phi = 0;
let clickFlag = false;

function setEvent(canvas) {
    window.onkeydown = function(event) {
    switch(event.key) {
        case " ":  // 스페이스바
            isJumping = true;
            break;
        case "ArrowLeft":
            eye[0] -= 1;
            break;
        case "ArrowRight":
            eye[0] += 1;
            break;
        case "ArrowUp":
            eye[1] += 1;
            break;
        case "ArrowDown":
            eye[1] -= 1;
            break;
        case "r":
            resetPose();
            break;

        updateCamera();
    }
};

}


function setCameraView(view) {
    eye = view.eye;
    at = view.at;
    up = view.up;
}



// Size constants
const TORSO_HEIGHT = 4.0, TORSO_WIDTH = 3.0;
const LEG_UPPER_HEIGHT = 2.5, LEG_LOWER_HEIGHT = 2.0, FOOT_HEIGHT = 0.5, LIMB_WIDTH = 0.5;
const ARM_UPPER_HEIGHT = 1.8, ARM_LOWER_HEIGHT = 1.5;
const HEAD_HEIGHT = 1.2, HEAD_WIDTH = 1.5;

function quad(a, b, c, d, vertices) {
    let indices = [a, b, c, a, c, d];
    for (let i = 0; i < indices.length; ++i) pointsArray.push(vertices[indices[i]]);
}

function scale4(sx, sy, sz) {
    return mat4(
        vec4(sx, 0, 0, 0),
        vec4(0, sy, 0, 0),
        vec4(0, 0, sz, 0),
        vec4(0, 0, 0, 1)
    );
}

function colorCube(width, height, depth) {
    let w = width / 2, h = height / 2, d = depth / 2;
    let v = [
        vec4(-w,-h, d,1), vec4(-w, h, d,1), vec4( w, h, d,1), vec4( w,-h, d,1),
        vec4(-w,-h,-d,1), vec4(-w, h,-d,1), vec4( w, h,-d,1), vec4( w,-h,-d,1)
    ];
    quad(1,0,3,2,v); quad(2,3,7,6,v); quad(3,0,4,7,v);
    quad(6,5,1,2,v); quad(4,5,6,7,v); quad(5,4,0,1,v);
}

function drawBox(width, height, depth) {
    let instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * height, 0.0));
    instanceMatrix = mult(instanceMatrix, scale4(width, height, depth));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

function render() {
    stack = [];
    modelViewMatrix = lookAt(eye, at, up);
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Torso));
    stack.push(modelViewMatrix);

    // Torso
    drawBox(TORSO_WIDTH, TORSO_HEIGHT, TORSO_WIDTH);

    // Head
    modelViewMatrix = mult(modelViewMatrix, translate(0, TORSO_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Head));
    stack.push(modelViewMatrix);
    drawBox(HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH);
    modelViewMatrix = stack.pop();

    // Right leg (upper → lower → foot)
    modelViewMatrix = mult(stack[stack.length-1], translate(-1, 0, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.RULeg));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, LEG_UPPER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, LEG_UPPER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.RLLeg));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, LEG_LOWER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, LEG_LOWER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.RFoot));
    drawBox(LIMB_WIDTH, FOOT_HEIGHT, LIMB_WIDTH);
    modelViewMatrix = stack.pop();
    modelViewMatrix = stack.pop();

    // Left leg
    modelViewMatrix = mult(stack[stack.length-1], translate(1, 0, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.LULeg));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, LEG_UPPER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, LEG_UPPER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.LLLeg));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, LEG_LOWER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, LEG_LOWER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.LFoot));
    drawBox(LIMB_WIDTH, FOOT_HEIGHT, LIMB_WIDTH);
    modelViewMatrix = stack.pop();
    modelViewMatrix = stack.pop();

    // Arms (Left and Right: upper → lower)
    let armHeight = TORSO_HEIGHT * 0.8;

    // Left Arm
    modelViewMatrix = mult(stack[stack.length-1], translate(-TORSO_WIDTH/2 - LIMB_WIDTH/2, armHeight, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta.LUArm));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, ARM_UPPER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, ARM_UPPER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta.LLArm));
    drawBox(LIMB_WIDTH, ARM_LOWER_HEIGHT, LIMB_WIDTH);
    modelViewMatrix = stack.pop();

    // Right Arm
    modelViewMatrix = mult(stack[stack.length-1], translate(TORSO_WIDTH/2 + LIMB_WIDTH/2, armHeight, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta.RUArm));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, ARM_UPPER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, ARM_UPPER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta.RLArm));
    drawBox(LIMB_WIDTH, ARM_LOWER_HEIGHT, LIMB_WIDTH);
    stack.pop();

    modelViewMatrix = stack.pop(); // Restore to original

    
    // rotation move animation
    for (let key in theta){
         theta[key] += Math.random() * 0.5;
    }

    requestAnimFrame(render);

}

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) alert("WebGL isn't available");

    colorCube(1, 1, 1);

    let bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    projectionMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    setEvent(canvas);

    render();
};
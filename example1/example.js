"use strict";

// WebGL context and shader program
var gl, program;

// Matrices and their uniform locations
var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;
var normalMatrixLoc;

var modelMat, modelMatLoc;
var viewMat, viewMatLoc;

// Canvas element
var canvas;

// Number of vertices for a cube (6 faces * 2 triangles * 3 vertices)
var NumVertices = 36;

// Arrays to hold geometry and normal data
var pointsArray = [];
var normalsArray = [];

// Matrix stack used for hierarchical modeling (e.g., limbs)
var stack = [];

// Angles for each body part in degrees (used for animation and posing)
var theta = {
  Torso: 0,
  Head: 0,
  RULeg: 110, RLLeg: 150, RFoot: -150,  
  LULeg: 110, LLLeg: 150, LFoot: -150,
  RUArm: -150, RLArm: -20,
  LUArm: 150, LLArm: 20
};

// Camera parameters: position (eye), target (at), up direction
var eye = vec3(-100.0, 15.0, 15.0);
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

// Parameters for potential orbital camera control (currently unused)
const radius = 15.0;
let thetaCam = 0;
let phi = 0;
let clickFlag = false;

// Lighting and material properties for Phong shading
var lightPosition = vec4(1.0, 1.0, 1.0, 0.0);  // Directional light
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 0.8, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

var materialAmbient = vec4(0.3, 0.6, 0.0, 1.0); // Greenish tone
var materialDiffuse = vec4(0.4, 0.8, 0.4, 1.0);
var materialSpecular = vec4(0.2, 0.4, 0.2, 1.0);
var materialShininess = 30.0;

// Set up keyboard controls for camera movement and pose reset
function setEvent(canvas) {
    window.onkeydown = function(event) {
        switch(event.key) {
            case " ": break;
            case "ArrowLeft": at[0] -= 1; break;
            case "ArrowRight": at[0] += 1; break;
            case "ArrowUp": at[1] += 1; break;
            case "ArrowDown": at[1] -= 1; break;
            case "r": break;
        }
    };
}

// Set camera parameters from external input
function setCameraView(view) {
    eye = view.eye;
    at = view.at;
    up = view.up;
}

// Dimensions for body parts
const LEG_UPPER_HEIGHT = 3.5, LEG_LOWER_HEIGHT = 3.0;
const ARM_UPPER_HEIGHT = 2.0, ARM_LOWER_HEIGHT = 1.5;
const TORSO_HEIGHT = 1.8, TORSO_WIDTH = 3;
const FOOT_HEIGHT = 3.0, LIMB_WIDTH = 0.6;
const HEAD_HEIGHT = 1.2, HEAD_WIDTH = 2.0;
const EYE_RADIUS = 0.3;



// Draw a box centered vertically using modelViewMatrix
function drawBox(width, height, depth) {
    let instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * height, 0.0));
    instanceMatrix = mult(instanceMatrix, scale4(width, height, depth));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
    let normalMatrix = transpose(inverse4(modelViewMatrix));
    gl.uniformMatrix4fv(normalMatrixLoc, false, flatten(normalMatrix));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

// Draw a single spherical eye
function drawEye(offsetX) {
    let m = mult(modelViewMatrix, translate(offsetX, HEAD_HEIGHT * 0.8, HEAD_WIDTH / 2));
    m = mult(m, scale4(EYE_RADIUS, EYE_RADIUS, EYE_RADIUS));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(m));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

// Draw a leg (or similar 3-part limb)
function drawLimb(transform, upperAngle, lowerAngle, footAngle, upperLen, lowerLen) {
    modelViewMatrix = mult(transform, rotateX(upperAngle));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, upperLen, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, upperLen, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(lowerAngle));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, lowerLen, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, lowerLen, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(footAngle));
    drawBox(LIMB_WIDTH, FOOT_HEIGHT, LIMB_WIDTH);
    modelViewMatrix = stack.pop();
    modelViewMatrix = stack.pop();
}

// Draw an arm (2-part limb)
function drawArm(transform, upperAngle, lowerAngle) {
    modelViewMatrix = mult(transform, rotateZ(upperAngle));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, ARM_UPPER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, ARM_UPPER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(lowerAngle));
    drawBox(LIMB_WIDTH, ARM_LOWER_HEIGHT, LIMB_WIDTH);
    stack.pop();
}

// Angle for jumping animation
let jumpAngle = 0;
let jumpFlag = 1;
let jumpTime = 0;
const timeStep = 0.05;
const initialVelocity = { x: 5.0, y: 4.5 };  // x는 전진 속도
const gravity = 0.98;
let jumping = true;
let jumpOrigin = vec3(0, 0, 0);  // 누적 위치 저장

function computeTorsoPosition(t) {
    const x = initialVelocity.x * t;
    const y = initialVelocity.y * t - 0.5 * gravity * t * t;
    return vec3(x, Math.max(0, y), 0);
}

function computeTorsoOrientation(t) {
    const vx = initialVelocity.x;
    const vy = initialVelocity.y - gravity * t;
    if (vx === 0) return 0;
    return degrees(Math.atan2(vy, vx));  // Z축 기준 회전각 (pitch)
}

function degrees(radians) {
    return radians * (180 / Math.PI);
}


// Main rendering loop
function render() {
    stack = [];

    if (jumping) {
    jumpTime += timeStep;
}
    const offset = computeTorsoPosition(jumpTime);
    const pos = add(jumpOrigin, offset);
    const torsoAngle = computeTorsoOrientation(jumpTime);

    modelViewMatrix = lookAt(eye, at, up);
    modelViewMatrix = mult(modelViewMatrix, translate(pos[2], pos[1], pos[0]));
    modelViewMatrix = mult(modelViewMatrix, rotateX(-torsoAngle));  // ← 여기 핵심
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Torso)); // 기존 회전 유지
    //modelViewMatrix = mult(modelViewMatrix, rotateX(-30));

    stack.push(modelViewMatrix);

    // Draw torso
    drawBox(TORSO_WIDTH, TORSO_HEIGHT, TORSO_WIDTH);

    // Draw head
    modelViewMatrix = mult(modelViewMatrix, translate(0, TORSO_HEIGHT, 1));
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Head));
    stack.push(modelViewMatrix);
    drawBox(HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH);

    // Draw both eyes
    drawEye(-0.5);
    drawEye(0.5);

    modelViewMatrix = stack.pop();

    // Draw legs (left and right)
    drawLimb(mult(stack[stack.length-1], translate(-1.5, 0, -1.5)), theta.LULeg, theta.LLLeg, theta.LFoot, LEG_UPPER_HEIGHT, LEG_LOWER_HEIGHT);
    drawLimb(mult(stack[stack.length-1], translate(1.5, 0, -1.5)), theta.RULeg, theta.RLLeg, theta.RFoot, LEG_UPPER_HEIGHT, LEG_LOWER_HEIGHT);

    // Draw arms
    let armHeight = TORSO_HEIGHT * 0.6;
    drawArm(mult(stack[stack.length-1], translate(-TORSO_WIDTH/2 - LIMB_WIDTH/2, armHeight, 1.0)), theta.LUArm, theta.LLArm);
    drawArm(mult(stack[stack.length-1], translate(TORSO_WIDTH/2 + LIMB_WIDTH/2, armHeight, 1.0)), theta.RUArm, theta.RLArm);

    modelViewMatrix = stack.pop();

    if (jumpAngle > 120)
        jumpFlag = -1;
    else if (jumpAngle < 0)
        jumpFlag = 1;
    theta.LULeg += jumpFlag;
    theta.LLLeg -= jumpFlag;
    theta.LFoot += jumpFlag;
    theta.RULeg += jumpFlag;
    theta.RLLeg -= jumpFlag;
    theta.RFoot += jumpFlag;
    //console.log(jumpAngle);

    // 포물선 끝나면 다시 점프하도록 설정 (선택 사항)
    if (pos[1] <= 0.01 && jumpTime > 1) {
        jumpOrigin = add(jumpOrigin, offset);
        jumpTime = 0;
        jumping = true; // 반복 점프
    }
    
    at = vec3(pos[0], pos[1], pos[2]);
    console.log("x:", at[0], "y: ", at[1], "z: ", at[2]);
    
    jumpAngle += jumpFlag;
    
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

    let nBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    let vNormal = gl.getAttribLocation(program, "vNormal");
    gl.bindBuffer(gl.ARRAY_BUFFER, nBufferId);
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");

    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"), flatten(mult(lightAmbient, materialAmbient)));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"), flatten(mult(lightDiffuse, materialDiffuse)));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"), flatten(mult(lightSpecular, materialSpecular)));
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), flatten(lightPosition));
    gl.uniform1f(gl.getUniformLocation(program, "shininess"), materialShininess);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    projectionMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    setEvent(canvas);
    render();
};


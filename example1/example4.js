"use strict";

var gl, program;
var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

var NumVertices = 36;
var pointsArray = [];
var stack = [];

// Dimensions
const BASE_HEIGHT = 2.0, BASE_WIDTH = 5.0;
const LOWER_ARM_HEIGHT = 5.0, LOWER_ARM_WIDTH = 0.8;
const UPPER_ARM_HEIGHT = 3.0, UPPER_ARM_WIDTH = 0.5;

// Rotation angles
var theta = {
    Base: 0,
    LowerArm: 0,
    UpperArm: 0
};

function quad(a, b, c, d, vertices) {
    let indices = [a, b, c, a, c, d];
    for (let i = 0; i < indices.length; ++i) {
        pointsArray.push(vertices[indices[i]]);
    }
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

function drawBox(scaleX, scaleY, scaleZ) {
    let instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * scaleY, 0.0));
    instanceMatrix = mult(instanceMatrix, scale4(scaleX, scaleY, scaleZ));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

// function base() {
//     drawBox(BASE_WIDTH, BASE_HEIGHT, BASE_WIDTH);
// }

// function lowerArm() {
//     drawBox(LOWER_ARM_WIDTH, LOWER_ARM_HEIGHT, LOWER_ARM_WIDTH);
// }

// function upperArm() {
//     drawBox(UPPER_ARM_WIDTH, UPPER_ARM_HEIGHT, UPPER_ARM_WIDTH);
// }


// 추가 회전 각도
var theta = {
    Base: 0,
    Torso: 0,
    LeftArm: 0,
    LeftHand: 0,
    RightArm: 0,
    RightHand: 0,
    LeftLeg: 0,
    LeftFoot: 0,
    RightLeg: 0,
    RightFoot: 0
};

// 크기 정의 (예시 단위)
const TORSO_HEIGHT = 6.0, TORSO_WIDTH = 2.0;
const ARM_HEIGHT = 4.0, ARM_WIDTH = 0.5;
const HAND_HEIGHT = 1.0, HAND_WIDTH = 0.4;
const LEG_HEIGHT = 5.0, LEG_WIDTH = 0.6;
const FOOT_HEIGHT = 1.0, FOOT_WIDTH = 0.5;

// 개별 부위 함수
function torso() {
    drawBox(TORSO_WIDTH, TORSO_HEIGHT, TORSO_WIDTH);
}
function leftArm() {
    drawBox(ARM_WIDTH, ARM_HEIGHT, ARM_WIDTH);
}
function leftHand() {
    drawBox(HAND_WIDTH, HAND_HEIGHT, HAND_WIDTH);
}
function rightArm() {
    drawBox(ARM_WIDTH, ARM_HEIGHT, ARM_WIDTH);
}
function rightHand() {
    drawBox(HAND_WIDTH, HAND_HEIGHT, HAND_WIDTH);
}
function leftLeg() {
    drawBox(LEG_WIDTH, LEG_HEIGHT, LEG_WIDTH);
}
function leftFoot() {
    drawBox(FOOT_WIDTH, FOOT_HEIGHT, FOOT_WIDTH);
}
function rightLeg() {
    drawBox(LEG_WIDTH, LEG_HEIGHT, LEG_WIDTH);
}
function rightFoot() {
    drawBox(FOOT_WIDTH, FOOT_HEIGHT, FOOT_WIDTH);
}

window.onload = function init() {
    let canvas = document.getElementById("gl-canvas");
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

    render();
};
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    modelViewMatrix = lookAt(vec3(7.0, 5.0, 25.0), vec3(0, 0, 0), vec3(0, 1, 0));
    stack = [];

    // Base (회전)
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Base));
    stack.push(modelViewMatrix);

    // Torso
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Torso));
    stack.push(modelViewMatrix);
    torso();

    // Left Arm
    modelViewMatrix = mult(modelViewMatrix, translate(-(TORSO_WIDTH + ARM_WIDTH) / 2, TORSO_HEIGHT * 0.9, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta.LeftArm));
    stack.push(modelViewMatrix);
    leftArm();

    // Left Hand
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, ARM_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta.LeftHand));
    leftHand();
    modelViewMatrix = stack.pop(); // ← Left Arm 복귀

    modelViewMatrix = stack.pop(); // ← Torso 복귀

    // Right Arm
    modelViewMatrix = mult(modelViewMatrix, translate((TORSO_WIDTH + ARM_WIDTH) / 2, TORSO_HEIGHT * 0.9, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta.RightArm));
    stack.push(modelViewMatrix);
    rightArm();

    // Right Hand
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, ARM_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(theta.RightHand));
    rightHand();
    modelViewMatrix = stack.pop(); // ← Right Arm 복귀

    // Legs (좌우 동일하게 구조 반복)
    modelViewMatrix = mult(stack[stack.length - 1], translate(-(TORSO_WIDTH / 2), 0.0, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.LeftLeg));
    stack.push(modelViewMatrix);
    leftLeg();
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, LEG_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.LeftFoot));
    leftFoot();
    modelViewMatrix = stack.pop();

    modelViewMatrix = mult(stack[stack.length - 1], translate(TORSO_WIDTH / 2, 0.0, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.RightLeg));
    stack.push(modelViewMatrix);
    rightLeg();
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, LEG_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotateX(theta.RightFoot));
    rightFoot();
    modelViewMatrix = stack.pop();

    modelViewMatrix = stack.pop(); // ← Base 복귀

    // 회전 각도 애니메이션
    for (let key in theta){
         theta[key] += Math.random() * 0.5;
         console.log(key, theta[key]);

    requestAnimFrame(render);
}

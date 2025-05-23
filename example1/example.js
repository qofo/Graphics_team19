"use strict";

var gl, program;
var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;
var normalMatrixLoc;
var canvas;
var NumVertices = 36;
var pointsArray = [];
var normalsArray = [];
var stack = [];

var theta = {
  Torso: 0,
  Head: 15,
  RULeg: -110, RLLeg: 100, RFoot: -30,
  LULeg: -110, LLLeg: 100, LFoot: -30,
  RUArm: 70, RLArm: -20,
  LUArm: -70, LLArm: 20
};

var eye = vec3(6.0, 4.0, 12.0);
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

const radius = 15.0;
let thetaCam = 0;
let phi = 0;
let clickFlag = false;

var lightPosition = vec4(1.0, 1.0, 1.0, 0.0);
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 0.8, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

var materialAmbient = vec4(0.3, 0.6, 0.0, 1.0); // 초록색 느낌
var materialDiffuse = vec4(0.4, 0.8, 0.4, 1.0);
var materialSpecular = vec4(0.2, 0.4, 0.2, 1.0);
var materialShininess = 30.0;

function setEvent(canvas) {
    window.onkeydown = function(event) {
        switch(event.key) {
            case " ": break;
            case "ArrowLeft": eye[0] -= 1; break;
            case "ArrowRight": eye[0] += 1; break;
            case "ArrowUp": eye[1] += 1; break;
            case "ArrowDown": eye[1] -= 1; break;
            case "r": resetPose(); break;
        }
    };
}

function setCameraView(view) {
    eye = view.eye;
    at = view.at;
    up = view.up;
}

const LEG_UPPER_HEIGHT = 3.5, LEG_LOWER_HEIGHT = 3.0;
const ARM_UPPER_HEIGHT = 1.0, ARM_LOWER_HEIGHT = 0.8;
const TORSO_HEIGHT = 1.8, TORSO_WIDTH = 4.5;
const FOOT_HEIGHT = 0.5, LIMB_WIDTH = 0.6;
const HEAD_HEIGHT = 1.2, HEAD_WIDTH = 2.0;
const EYE_RADIUS = 0.3;

function quad(a, b, c, d, vertices) {
    let indices = [a, b, c, a, c, d];
    let normal = normalize(cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[b])));
    for (let i = 0; i < indices.length; ++i) {
        pointsArray.push(vertices[indices[i]]);
        normalsArray.push(normal);
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

function drawBox(width, height, depth) {
    let instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * height, 0.0));
    instanceMatrix = mult(instanceMatrix, scale4(width, height, depth));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
    let normalMatrix = transpose(inverse4(modelViewMatrix));
    gl.uniformMatrix4fv(normalMatrixLoc, false, flatten(normalMatrix));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

function drawEye(offsetX) {
    let m = mult(modelViewMatrix, translate(offsetX, HEAD_HEIGHT * 0.8, HEAD_WIDTH / 2));
    m = mult(m, scale4(EYE_RADIUS, EYE_RADIUS, EYE_RADIUS));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(m));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

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

function drawArm(transform, upperAngle, lowerAngle) {
    modelViewMatrix = mult(transform, rotateZ(upperAngle));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, ARM_UPPER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, ARM_UPPER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(lowerAngle));
    drawBox(LIMB_WIDTH, ARM_LOWER_HEIGHT, LIMB_WIDTH);
    stack.pop();
}

let jumpAngle = 0;

function render() {
    stack = [];
    let jumpHeight = Math.abs(Math.sin(radians(jumpAngle))) * 1.5;
    jumpAngle = (jumpAngle + 2.0) % 360;

    modelViewMatrix = lookAt(vec3(eye[0], eye[1] + jumpHeight, eye[2]), at, up);
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Torso));
    stack.push(modelViewMatrix);

    drawBox(TORSO_WIDTH, TORSO_HEIGHT, TORSO_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, TORSO_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Head));
    stack.push(modelViewMatrix);
    drawBox(HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH);

    drawEye(-0.5);
    drawEye(0.5);

    modelViewMatrix = stack.pop();

    drawLimb(mult(stack[stack.length-1], translate(-1.5, 0, -1.5)), theta.LULeg, theta.LLLeg, theta.LFoot, LEG_UPPER_HEIGHT, LEG_LOWER_HEIGHT);
    drawLimb(mult(stack[stack.length-1], translate(1.5, 0, -1.5)), theta.RULeg, theta.RLLeg, theta.RFoot, LEG_UPPER_HEIGHT, LEG_LOWER_HEIGHT);

    let armHeight = TORSO_HEIGHT * 0.6;
    drawArm(mult(stack[stack.length-1], translate(-TORSO_WIDTH/2 - LIMB_WIDTH/2, armHeight, 1.0)), theta.LUArm, theta.LLArm);
    drawArm(mult(stack[stack.length-1], translate(TORSO_WIDTH/2 + LIMB_WIDTH/2, armHeight, 1.0)), theta.RUArm, theta.RLArm);

    modelViewMatrix = stack.pop();

    for (let key in theta){
        theta[key] += Math.random() * 2;
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

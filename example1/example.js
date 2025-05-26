"use strict";

// WebGL context and shader program
var gl, program;

// Matrices and their uniform locations
var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;
var normalMatrixLoc;

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
  Head: 15,
  RULeg: -110, RLLeg: 100, RFoot: -30,
  LULeg: -110, LLLeg: 100, LFoot: -30,
  RUArm: 70, RLArm: -20,
  LUArm: -70, LLArm: 20
};

// Camera parameters: position (eye), target (at), up direction
var eye = vec3(6.0, 4.0, 12.0);
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
            case "ArrowLeft": eye[0] -= 1; break;
            case "ArrowRight": eye[0] += 1; break;
            case "ArrowUp": eye[1] += 1; break;
            case "ArrowDown": eye[1] -= 1; break;
            case "r": resetPose(); break;
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
const ARM_UPPER_HEIGHT = 1.0, ARM_LOWER_HEIGHT = 0.8;
const TORSO_HEIGHT = 1.8, TORSO_WIDTH = 4.5;
const FOOT_HEIGHT = 0.5, LIMB_WIDTH = 0.6;
const HEAD_HEIGHT = 1.2, HEAD_WIDTH = 2.0;
const EYE_RADIUS = 0.3;

// Construct one face of the cube and store vertex and normal data
function quad(a, b, c, d, vertices) {
    let indices = [a, b, c, a, c, d];
    let normal = normalize(cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[b])));
    for (let i = 0; i < indices.length; ++i) {
        pointsArray.push(vertices[indices[i]]);
        normalsArray.push(normal);
    }
}

// Create scaling matrix manually
function scale4(sx, sy, sz) {
    return mat4(
        vec4(sx, 0, 0, 0),
        vec4(0, sy, 0, 0),
        vec4(0, 0, sz, 0),
        vec4(0, 0, 0, 1)
    );
}

// Build geometry for a cube with given dimensions
function colorCube(width, height, depth) {
    let w = width / 2, h = height / 2, d = depth / 2;
    let v = [
        vec4(-w,-h, d,1), vec4(-w, h, d,1), vec4( w, h, d,1), vec4( w,-h, d,1),
        vec4(-w,-h,-d,1), vec4(-w, h,-d,1), vec4( w, h,-d,1), vec4( w,-h,-d,1)
    ];
    quad(1,0,3,2,v); quad(2,3,7,6,v); quad(3,0,4,7,v);
    quad(6,5,1,2,v); quad(4,5,6,7,v); quad(5,4,0,1,v);
}

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

// Main rendering loop
function render() {
    stack = [];

    // // Simple jumping effect using sine wave
    // let jumpHeight = Math.abs(Math.sin(radians(jumpAngle))) * 1.5;
    // jumpAngle = (jumpAngle + 2.0) % 360;

    // View transformation with jumping
    modelViewMatrix = lookAt(vec3(eye[0], eye[1], eye[2]), at, up);
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Torso));
    stack.push(modelViewMatrix);

    // Draw torso
    drawBox(TORSO_WIDTH, TORSO_HEIGHT, TORSO_WIDTH);

    // Draw head
    modelViewMatrix = mult(modelViewMatrix, translate(0, TORSO_HEIGHT, 0));
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

    // Slight random pose change per frame (for subtle motion)
    // for (let key in theta){
    //     theta[key] += Math.random() * 2;
    // }

    requestAnimFrame(render);
}

// Entry point: setup WebGL and start rendering
window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) alert("WebGL isn't available");

    // Generate cube geometry
    colorCube(1, 1, 1);

    // Create buffer for vertex positions
    let bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    // Create buffer for normals
    let nBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);

    // Initialize shaders
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Bind position data to shader
    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Bind normal data to shader
    let vNormal = gl.getAttribLocation(program, "vNormal");
    gl.bindBuffer(gl.ARRAY_BUFFER, nBufferId);
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);

    // Get uniform locations for matrices
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");

    // Set lighting uniforms
    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"), flatten(mult(lightAmbient, materialAmbient)));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"), flatten(mult(lightDiffuse, materialDiffuse)));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"), flatten(mult(lightSpecular, materialSpecular)));
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), flatten(lightPosition));
    gl.uniform1f(gl.getUniformLocation(program, "shininess"), materialShininess);

    // Enable depth testing and set background color
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Set perspective projection matrix
    projectionMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    setEvent(canvas);
    render();
};

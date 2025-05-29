"use strict";

// WebGL context and shader program handle
var gl, program;

// Matrices and their corresponding uniform locations in shaders
var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;
var normalMatrixLoc;

// Additional matrix variables (not used in main render path)
var modelMat, modelMatLoc;
var viewMat, viewMatLoc;

// HTML canvas element where WebGL renders
var canvas;

// Number of vertices required to render a cube (6 faces × 2 triangles per face × 3 vertices per triangle)
var NumVertices = 36;

// Arrays for storing vertex positions and normal vectors for lighting calculations
var pointsArray = [];
var normalsArray = [];

// Stack for hierarchical modeling (used to store matrix states for articulated body parts)
var stack = [];

// Rotation angles (in degrees) for each articulated body part
var theta = {
  Torso: 0,
  Head: 0,
  RULeg: 110, RLLeg: 150, RFoot: -150,  
  LULeg: 110, LLLeg: 150, LFoot: -150,
  RUArm: -150, RLArm: -20,
  LUArm: 150, LLArm: 20
};

// Camera parameters: position (eye), focal point (at), and up direction
var eye = vec3(-80.0, 15.0, 35.0);
var at = vec3(10.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

// (Optional) Camera orbit control parameters (currently unused)
const radius = 15.0;
let thetaCam = 0;
let phi = 0;
let clickFlag = false;

// Light source properties for Phong illumination
var lightPosition = vec4(1.0, 1.0, 1.0, 0.0);  // Directional light (w = 0)
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 0.8, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

// Material properties for the object's surface
var materialAmbient = vec4(0.3, 0.6, 0.0, 1.0); // Greenish base color
var materialDiffuse = vec4(0.4, 0.8, 0.4, 1.0);
var materialSpecular = vec4(0.2, 0.4, 0.2, 1.0);
var materialShininess = 30.0;

// Setup keyboard event listeners for basic camera movement
function setEvent(canvas) {
    window.onkeydown = function(event) {
        switch(event.key) {
            case " ": break;  // (Reserved for future action)
            case "ArrowLeft": eye[0] -= 1; break;   // Move camera left
            case "ArrowRight": eye[0] += 1; break;  // Move camera right
            case "ArrowUp": eye[1] += 1; break;     // Move camera upward
            case "ArrowDown": eye[1] -= 1; break;   // Move camera downward
            case "r": break;  // (Reserved for pose reset)
            case "x": jumping = true; break;
        }
    };
}

// Allow camera view to be updated from an external control source
function setCameraView(view) {
    eye = view.eye;
    at = view.at;
    up = view.up;
}

// Dimensions for different body parts (used in drawing functions)
const LEG_UPPER_HEIGHT = 3.5, LEG_LOWER_HEIGHT = 3.0;
const ARM_UPPER_HEIGHT = 2.0, ARM_LOWER_HEIGHT = 1.5;
const TORSO_HEIGHT = 1.8, TORSO_WIDTH = 3;
const FOOT_HEIGHT = 3.0, LIMB_WIDTH = 0.6;
const HEAD_HEIGHT = 1.2, HEAD_WIDTH = 2.0;
const EYE_RADIUS = 0.3;

// Draw a box (cube) centered vertically based on the current modelViewMatrix.
// The box is transformed by scaling and translating to match the specified dimensions.
function drawBox(width, height, depth) {
    let instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.5 * height, 0.0));
    instanceMatrix = mult(instanceMatrix, scale4(width, height, depth));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));

    let normalMatrix = transpose(inverse4(modelViewMatrix));
    gl.uniformMatrix4fv(normalMatrixLoc, false, flatten(normalMatrix));

    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}
// Draw a spherical eye at a horizontal offset relative to the head's position.
// The eye is represented by a scaled cube (as placeholder geometry).
function drawEye(offsetX) {
    let m = mult(modelViewMatrix, translate(offsetX, HEAD_HEIGHT * 0.8, HEAD_WIDTH / 2));
    m = mult(m, scale4(EYE_RADIUS, EYE_RADIUS, EYE_RADIUS));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(m));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

// Draw a 3-part articulated limb (e.g., a leg), composed of upper segment, lower segment, and foot.
// Each segment is drawn in order, applying rotation and translation based on joint angles.
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

    // Restore the previous matrix states after drawing each segment
    modelViewMatrix = stack.pop();
    modelViewMatrix = stack.pop();
}

// Draw a 2-part articulated limb (e.g., an arm), with upper and lower segments.
// Rotations are applied in Z-axis, and each segment is drawn hierarchically.
function drawArm(transform, upperAngle, lowerAngle) {
    modelViewMatrix = mult(transform, rotateZ(upperAngle));
    stack.push(modelViewMatrix);
    drawBox(LIMB_WIDTH, ARM_UPPER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = mult(modelViewMatrix, translate(0, ARM_UPPER_HEIGHT, 0));
    modelViewMatrix = mult(modelViewMatrix, rotateZ(lowerAngle));
    drawBox(LIMB_WIDTH, ARM_LOWER_HEIGHT, LIMB_WIDTH);

    modelViewMatrix = stack.pop();
}

// Variables controlling jump animation logic
let jumpFlag = 1;          // Direction flag for alternating leg motion
let jumpTime = 0;          // Time elapsed since start of current jump

const timeStep = 0.05;     // Time increment per frame
const initialVelocity = { x: 3.0, y: 4.5 };  // Initial velocities (x: horizontal, y: vertical)
const gravity = 0.5;       // Gravity constant for parabolic motion
let jumping = true;        // Boolean flag to toggle jumping state
let jumpOrigin = vec3(0, 0, 0);  // Stores accumulated position over multiple jumps

// Compute the current position of the torso along a 2D parabolic arc
// Returns a 3D vector (x, y, z) with motion only in x and y
function computeTorsoPosition(t) {
    const x = initialVelocity.x * t;
    const y = initialVelocity.y * t - 0.5 * gravity * t * t;
    return vec3(x, Math.max(0, y), 0);  // Ensure torso stays above ground
}

// Compute the current position of the torso along a 2D parabolic arc
// Returns a 3D vector (x, y, z) with motion only in x and y
function computeTorsoPosition(t) {
    const x = initialVelocity.x * t;
    const y = initialVelocity.y * t - 0.5 * gravity * t * t;
    return vec3(x, Math.max(0, y), 0);  // Ensure torso stays above ground
}

// Compute pitch rotation angle (in degrees) of the torso during jump
// Based on the direction of velocity vector (dy/dx)
function computeTorsoOrientation(t) {
    const vx = initialVelocity.x;
    const vy = initialVelocity.y - gravity * t;
    if (vx === 0) return 0;
    return degrees(Math.atan2(vy, vx));  // Converts slope to pitch angle
}

// Convert angle from radians to degrees
function degrees(radians) {
    return radians * (180 / Math.PI);
}

// Draw the ground plane with a distinct material appearance
// Temporarily changes lighting material to gray, then restores original
function drawGround() {
    stack.push(modelViewMatrix);

    // Slight downward offset so ground does not intersect body
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, -0.05, 0.0));

    // Use a neutral gray material for the ground
    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"),
                  flatten(mult(lightAmbient, vec4(0.2, 0.2, 0.2, 1.0))));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"),
                  flatten(mult(lightDiffuse, vec4(0.6, 0.6, 0.6, 1.0))));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"),
                  flatten(mult(lightSpecular, vec4(0.0, 0.0, 0.0, 1.0))));

    drawBox(100.0, 0.1, 100.0);  // Very large flat box representing the ground

    // Restore the original material for the character model
    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"),
                  flatten(mult(lightAmbient, materialAmbient)));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"),
                  flatten(mult(lightDiffuse, materialDiffuse)));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"),
                  flatten(mult(lightSpecular, materialSpecular)));

    modelViewMatrix = stack.pop();
}

// Main render loop: updates animation, applies transformations, and draws each part
function render() {
    stack = [];  // Reset matrix stack for each frame

    // Update jump time if currently jumping
    if (jumping) {
        jumpTime += timeStep;
    }

    // Compute torso position and orientation based on time
    const offset = computeTorsoPosition(jumpTime);
    const pos = add(jumpOrigin, offset);
    const torsoAngle = computeTorsoOrientation(jumpTime);

    // Set up view transformation (camera)
    modelViewMatrix = lookAt(eye, at, up);

    // Draw the ground plane
    drawGround();

    // Move to torso position (Z-X-Y order), apply rotation for jump orientation
    modelViewMatrix = mult(modelViewMatrix, translate(pos[2], pos[1], pos[0] - 50));
    modelViewMatrix = mult(modelViewMatrix, rotateX(-torsoAngle));  // Tilt torso based on jump
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Torso));  // Apply user-controlled rotation

    stack.push(modelViewMatrix);

    // Draw torso
    drawBox(TORSO_WIDTH, TORSO_HEIGHT, TORSO_WIDTH);

    // Draw head
    modelViewMatrix = mult(modelViewMatrix, translate(0, TORSO_HEIGHT, 1));
    modelViewMatrix = mult(modelViewMatrix, rotateY(theta.Head));
    stack.push(modelViewMatrix);
    drawBox(HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH);

    // Draw eyes (left and right)
    drawEye(-0.5);
    drawEye(0.5);

    modelViewMatrix = stack.pop();

    // Draw legs
    drawLimb(mult(stack[stack.length - 1], translate(-1.5, 0, -1.5)),
             theta.LULeg, theta.LLLeg, theta.LFoot, LEG_UPPER_HEIGHT, LEG_LOWER_HEIGHT);
    drawLimb(mult(stack[stack.length - 1], translate(1.5, 0, -1.5)),
             theta.RULeg, theta.RLLeg, theta.RFoot, LEG_UPPER_HEIGHT, LEG_LOWER_HEIGHT);

    // Draw arms
    let armHeight = TORSO_HEIGHT * 0.6;
    drawArm(mult(stack[stack.length - 1], translate(-TORSO_WIDTH / 2 - LIMB_WIDTH / 2, armHeight, 1.0)),
            theta.LUArm, theta.LLArm);
    drawArm(mult(stack[stack.length - 1], translate(TORSO_WIDTH / 2 + LIMB_WIDTH / 2, armHeight, 1.0)),
            theta.RUArm, theta.RLArm);

    modelViewMatrix = stack.pop();

    // Update joint angles for leg animation during jump
    const highTime = initialVelocity.y / gravity;
    if (jumping) {
        
        if (jumpTime < highTime)
            jumpFlag = 1;
        else
            jumpFlag = -1;

        theta.LULeg += jumpFlag;
        theta.LLLeg -= jumpFlag;
        theta.LFoot += jumpFlag;
        theta.RULeg += jumpFlag;
        theta.RLLeg -= jumpFlag;
        theta.RFoot += jumpFlag;
    }

    // When landing, reset for next jump cycle
    if (pos[1] <= 0.01 && jumpTime > highTime) {
        jumpOrigin = add(jumpOrigin, offset);
        jumpTime = 0;
         jumping = false; // Uncomment to stop jumping after one cycle
    }

    //console.log("x:", at[0], "y: ", at[1], "z: ", at[2]);

    requestAnimFrame(render);  // Schedule the next frame
}

// Initialization function: sets up WebGL context, shaders, buffers, and begins render loop
window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) alert("WebGL isn't available");

    colorCube(1, 1, 1);  // Initialize cube geometry

    // Create and fill vertex buffer
    let bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    // Create and fill normal buffer
    let nBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);

    // Load and activate shader program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Link vertex position attribute
    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Link normal vector attribute
    let vNormal = gl.getAttribLocation(program, "vNormal");
    gl.bindBuffer(gl.ARRAY_BUFFER, nBufferId);
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);

    // Get uniform locations for transformation and lighting
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");

    // Set lighting parameters
    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"), flatten(mult(lightAmbient, materialAmbient)));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"), flatten(mult(lightDiffuse, materialDiffuse)));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"), flatten(mult(lightSpecular, materialSpecular)));
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), flatten(lightPosition));
    gl.uniform1f(gl.getUniformLocation(program, "shininess"), materialShininess);

    // Enable depth testing and set clear color
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Set projection matrix
    projectionMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    // Set up keyboard controls
    setEvent(canvas);

    // Start render loop
    render();
};

"use strict";

// Legacy frog application demonstrating hierarchical modeling

// Namespace object to avoid global variable pollution
const FrogApp = {
    gl: null,
    program: null,
    canvas: null,
    modelViewMatrix: null,
    projectionMatrix: null,
    normalMatrixLoc: null,
    modelViewMatrixLoc: null,
    projectionMatrixLoc: null,

    pointsArray: [],
    normalsArray: [],
    stack: [],

    // Camera settings
    camera: {
        eye: vec3(-80.0, 15.0, 35.0),
        at: vec3(10.0, 0.0, 0.0),
        up: vec3(0.0, 1.0, 0.0)
    },

    // Joint angles
    theta: {
        Torso: 0,
        Head: 0,
        RULeg: 110, RLLeg: 150, RFoot: -150,  
        LULeg: 110, LLLeg: 150, LFoot: -150,
        RUArm: -150, RLArm: -20,
        LUArm: 150, LLArm: 20
    },

    // Lighting and material properties
    light: {
        position: vec4(1.0, 1.0, 1.0, 0.0), // directional
        ambient: vec4(0.2, 0.2, 0.2, 1.0),
        diffuse: vec4(1.0, 1.0, 0.8, 1.0),
        specular: vec4(1.0, 1.0, 1.0, 1.0)
    },
    material: {
        ambient: vec4(0.3, 0.6, 0.0, 1.0),
        diffuse: vec4(0.4, 0.8, 0.4, 1.0),
        specular: vec4(0.2, 0.4, 0.2, 1.0),
        shininess: 30.0
    },

    // Body part dimensions
    dims: {
        TORSO_HEIGHT: 1.8, TORSO_WIDTH: 3,
        HEAD_HEIGHT: 1.2, HEAD_WIDTH: 2.0,
        LEG_UPPER: 3.5, LEG_LOWER: 3.0,
        ARM_UPPER: 2.0, ARM_LOWER: 1.5,
        FOOT_HEIGHT: 3.0, LIMB_WIDTH: 0.6,
        EYE_RADIUS: 0.3
    },

    // Jump animation state
    jumpFlag: 1,
    jumpTime: 0,
    timeStep: 0.05,
    initialVelocity: { x: 3.0, y: 4.5 },
    gravity: 0.5,
    jumping: true,
    jumpOrigin: vec3(0, 0, 0)
};

/* --- Utility Functions --- */

// Converts radians to degrees
function degrees(rad) {
    return rad * (180 / Math.PI);
}

// Custom scaling matrix (4x4)
function scale4(sx, sy, sz) {
    return mat4(
        vec4(sx, 0, 0, 0),
        vec4(0, sy, 0, 0),
        vec4(0, 0, sz, 0),
        vec4(0, 0, 0, 1)
    );
}

// Compute the current torso position for the jump animation
function computeTorsoPosition(t) {
    const v = FrogApp.initialVelocity;
    const g = FrogApp.gravity;
    const x = v.x * t;
    const y = v.y * t - 0.5 * g * t * t;
    return vec3(x, Math.max(0, y), 0);
}

// Compute the torso's orientation (pitch) during the jump
function computeTorsoOrientation(t) {
    const v = FrogApp.initialVelocity;
    const g = FrogApp.gravity;
    const vx = v.x;
    const vy = v.y - g * t;
    if (vx === 0) return 0;
    return degrees(Math.atan2(vy, vx));
}

/* --- Geometry Construction --- */

// Build cube geometry for vertex/normal buffer
function colorCube(width, height, depth) {
    const w = width / 2, h = height / 2, d = depth / 2;
    const v = [
        vec4(-w,-h, d,1), vec4(-w, h, d,1), vec4( w, h, d,1), vec4( w,-h, d,1),
        vec4(-w,-h,-d,1), vec4(-w, h,-d,1), vec4( w, h,-d,1), vec4( w,-h,-d,1)
    ];
    quad(1,0,3,2,v); quad(2,3,7,6,v); quad(3,0,4,7,v);
    quad(6,5,1,2,v); quad(4,5,6,7,v); quad(5,4,0,1,v);
}

// Store one face of the cube
function quad(a, b, c, d, vertices) {
    const idx = [a, b, c, a, c, d];
    const normal = normalize(cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[b])));
    for (let i = 0; i < idx.length; ++i) {
        FrogApp.pointsArray.push(vertices[idx[i]]);
        FrogApp.normalsArray.push(normal);
    }
}

/* --- Drawing Helpers --- */

// Draw a box at the current modelViewMatrix with given dimensions
function drawBox(width, height, depth) {
    const app = FrogApp;
    let m = mult(app.modelViewMatrix, translate(0.0, 0.5 * height, 0.0));
    m = mult(m, scale4(width, height, depth));
    app.gl.uniformMatrix4fv(app.modelViewMatrixLoc, false, flatten(m));
    // Normal matrix for lighting
    let normalMatrix = transpose(inverse4(app.modelViewMatrix));
    app.gl.uniformMatrix4fv(app.normalMatrixLoc, false, flatten(normalMatrix));
    app.gl.drawArrays(app.gl.TRIANGLES, 0, 36);
}

// Draw an "eye" (just a scaled box here)
function drawEye(offsetX) {
    const app = FrogApp;
    let m = mult(app.modelViewMatrix, translate(offsetX, app.dims.HEAD_HEIGHT * 0.8, app.dims.HEAD_WIDTH / 2));
    m = mult(m, scale4(app.dims.EYE_RADIUS, app.dims.EYE_RADIUS, app.dims.EYE_RADIUS));
    app.gl.uniformMatrix4fv(app.modelViewMatrixLoc, false, flatten(m));
    app.gl.drawArrays(app.gl.TRIANGLES, 0, 36);
}

// Draw a 3-joint limb (e.g., leg)
function drawLimb(transform, upperAngle, lowerAngle, footAngle, upperLen, lowerLen) {
    const app = FrogApp;
    app.modelViewMatrix = mult(transform, rotateX(upperAngle));
    app.stack.push(app.modelViewMatrix);
    drawBox(app.dims.LIMB_WIDTH, upperLen, app.dims.LIMB_WIDTH);

    app.modelViewMatrix = mult(app.modelViewMatrix, translate(0, upperLen, 0));
    app.modelViewMatrix = mult(app.modelViewMatrix, rotateX(lowerAngle));
    app.stack.push(app.modelViewMatrix);
    drawBox(app.dims.LIMB_WIDTH, lowerLen, app.dims.LIMB_WIDTH);

    app.modelViewMatrix = mult(app.modelViewMatrix, translate(0, lowerLen, 0));
    app.modelViewMatrix = mult(app.modelViewMatrix, rotateX(footAngle));
    drawBox(app.dims.LIMB_WIDTH, app.dims.FOOT_HEIGHT, app.dims.LIMB_WIDTH);

    app.modelViewMatrix = app.stack.pop();
    app.modelViewMatrix = app.stack.pop();
}

// Draw a 2-joint arm
function drawArm(transform, upperAngle, lowerAngle) {
    const app = FrogApp;
    app.modelViewMatrix = mult(transform, rotateZ(upperAngle));
    app.stack.push(app.modelViewMatrix);
    drawBox(app.dims.LIMB_WIDTH, app.dims.ARM_UPPER, app.dims.LIMB_WIDTH);

    app.modelViewMatrix = mult(app.modelViewMatrix, translate(0, app.dims.ARM_UPPER, 0));
    app.modelViewMatrix = mult(app.modelViewMatrix, rotateZ(lowerAngle));
    drawBox(app.dims.LIMB_WIDTH, app.dims.ARM_LOWER, app.dims.LIMB_WIDTH);

    app.modelViewMatrix = app.stack.pop();
}

// Draw the ground as a flat box
function drawGround() {
    const app = FrogApp;
    app.stack.push(app.modelViewMatrix);

    app.modelViewMatrix = mult(app.modelViewMatrix, translate(0.0, -0.05, 0.0));
    // Set temporary gray material
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "ambientProduct"),
        flatten(mult(app.light.ambient, vec4(0.2, 0.2, 0.2, 1.0))));
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "diffuseProduct"),
        flatten(mult(app.light.diffuse, vec4(0.6, 0.6, 0.6, 1.0))));
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "specularProduct"),
        flatten(mult(app.light.specular, vec4(0.0, 0.0, 0.0, 1.0))));
    drawBox(100.0, 0.1, 100.0);

    // Restore original material
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "ambientProduct"),
        flatten(mult(app.light.ambient, app.material.ambient)));
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "diffuseProduct"),
        flatten(mult(app.light.diffuse, app.material.diffuse)));
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "specularProduct"),
        flatten(mult(app.light.specular, app.material.specular)));

    app.modelViewMatrix = app.stack.pop();
}

/* --- Animation and Rendering Loop --- */

function render() {
    const app = FrogApp;
    app.stack = [];

    // Update jump time if in jump state
    if (app.jumping) app.jumpTime += app.timeStep;

    // Calculate torso position and pitch
    const offset = computeTorsoPosition(app.jumpTime);
    const pos = add(app.jumpOrigin, offset);
    const torsoAngle = computeTorsoOrientation(app.jumpTime);

    // Camera/view setup
    app.modelViewMatrix = lookAt(app.camera.eye, app.camera.at, app.camera.up);

    // Draw ground
    drawGround();

    // Move to torso position, apply pitch for jumping orientation
    app.modelViewMatrix = mult(app.modelViewMatrix, translate(pos[2], pos[1], pos[0] - 50));
    app.modelViewMatrix = mult(app.modelViewMatrix, rotateX(-torsoAngle));
    app.modelViewMatrix = mult(app.modelViewMatrix, rotateY(app.theta.Torso));
    app.stack.push(app.modelViewMatrix);

    // Draw torso
    drawBox(app.dims.TORSO_WIDTH, app.dims.TORSO_HEIGHT, app.dims.TORSO_WIDTH);

    // Draw head
    app.modelViewMatrix = mult(app.modelViewMatrix, translate(0, app.dims.TORSO_HEIGHT, 1));
    app.modelViewMatrix = mult(app.modelViewMatrix, rotateY(app.theta.Head));
    app.stack.push(app.modelViewMatrix);
    drawBox(app.dims.HEAD_WIDTH, app.dims.HEAD_HEIGHT, app.dims.HEAD_WIDTH);
    drawEye(-0.5);
    drawEye(0.5);
    app.modelViewMatrix = app.stack.pop();

    // Draw legs
    drawLimb(mult(app.stack[app.stack.length - 1], translate(-1.5, 0, -1.5)),
        app.theta.LULeg, app.theta.LLLeg, app.theta.LFoot, app.dims.LEG_UPPER, app.dims.LEG_LOWER);
    drawLimb(mult(app.stack[app.stack.length - 1], translate(1.5, 0, -1.5)),
        app.theta.RULeg, app.theta.RLLeg, app.theta.RFoot, app.dims.LEG_UPPER, app.dims.LEG_LOWER);

    // Draw arms
    const armHeight = app.dims.TORSO_HEIGHT * 0.6;
    drawArm(mult(app.stack[app.stack.length - 1], translate(-app.dims.TORSO_WIDTH / 2 - app.dims.LIMB_WIDTH / 2, armHeight, 1.0)),
        app.theta.LUArm, app.theta.LLArm);
    drawArm(mult(app.stack[app.stack.length - 1], translate(app.dims.TORSO_WIDTH / 2 + app.dims.LIMB_WIDTH / 2, armHeight, 1.0)),
        app.theta.RUArm, app.theta.RLArm);

    app.modelViewMatrix = app.stack.pop();

    // Simple joint angle animation for jumping
    const highTime = app.initialVelocity.y / app.gravity;
    if (app.jumping) {
        app.jumpFlag = (app.jumpTime < highTime) ? 1 : -1;
        app.theta.LULeg += app.jumpFlag;
        app.theta.LLLeg -= app.jumpFlag;
        app.theta.LFoot += app.jumpFlag;
        app.theta.RULeg += app.jumpFlag;
        app.theta.RLLeg -= app.jumpFlag;
        app.theta.RFoot += app.jumpFlag;
    }

    // Reset jump when landing
    if (pos[1] <= 0.01 && app.jumpTime > highTime) {
        app.jumpOrigin = add(app.jumpOrigin, offset);
        app.jumpTime = 0;
        app.jumping = false;
    }

    requestAnimFrame(render);
}

// Resets the jumping position and state
function resetPos() {
    const app = FrogApp;
    app.jumpTime = 0;
    app.jumpOrigin = vec3(0, 0, 0);
    app.jumping = false;
}

/* --- Keyboard Event Handling --- */

function setEvent() {
    window.onkeydown = function(event) {
        const app = FrogApp;
        switch(event.key) {
            case "ArrowLeft": app.camera.eye[0] -= 1; break;
            case "ArrowRight": app.camera.eye[0] += 1; break;
            case "ArrowUp": app.camera.eye[1] += 1; break;
            case "ArrowDown": app.camera.eye[1] -= 1; break;
            case "r": resetPos(); break;
            case "x": app.jumping = !app.jumping; break;
            // Spacebar reserved
        }
    };
}

/* --- WebGL Initialization --- */

window.onload = function init() {
    const app = FrogApp;
    app.canvas = document.getElementById("gl-canvas");
    app.gl = WebGLUtils.setupWebGL(app.canvas);
    if (!app.gl) {
        alert("WebGL isn't available");
        return;
    }

    // Build geometry buffers
    colorCube(1, 1, 1);

    // Vertex buffer
    const bufferId = app.gl.createBuffer();
    app.gl.bindBuffer(app.gl.ARRAY_BUFFER, bufferId);
    app.gl.bufferData(app.gl.ARRAY_BUFFER, flatten(app.pointsArray), app.gl.STATIC_DRAW);

    // Normal buffer
    const nBufferId = app.gl.createBuffer();
    app.gl.bindBuffer(app.gl.ARRAY_BUFFER, nBufferId);
    app.gl.bufferData(app.gl.ARRAY_BUFFER, flatten(app.normalsArray), app.gl.STATIC_DRAW);

    // Shader setup
    app.program = initShaders(app.gl, "vertex-shader", "fragment-shader");
    app.gl.useProgram(app.program);

    // Attribute: position
    const vPosition = app.gl.getAttribLocation(app.program, "vPosition");
    app.gl.bindBuffer(app.gl.ARRAY_BUFFER, bufferId);
    app.gl.vertexAttribPointer(vPosition, 4, app.gl.FLOAT, false, 0, 0);
    app.gl.enableVertexAttribArray(vPosition);

    // Attribute: normal
    const vNormal = app.gl.getAttribLocation(app.program, "vNormal");
    app.gl.bindBuffer(app.gl.ARRAY_BUFFER, nBufferId);
    app.gl.vertexAttribPointer(vNormal, 3, app.gl.FLOAT, false, 0, 0);
    app.gl.enableVertexAttribArray(vNormal);

    // Uniforms
    app.modelViewMatrixLoc = app.gl.getUniformLocation(app.program, "modelViewMatrix");
    app.projectionMatrixLoc = app.gl.getUniformLocation(app.program, "projectionMatrix");
    app.normalMatrixLoc = app.gl.getUniformLocation(app.program, "normalMatrix");

    // Lighting/material uniforms
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "ambientProduct"),
        flatten(mult(app.light.ambient, app.material.ambient)));
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "diffuseProduct"),
        flatten(mult(app.light.diffuse, app.material.diffuse)));
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "specularProduct"),
        flatten(mult(app.light.specular, app.material.specular)));
    app.gl.uniform4fv(app.gl.getUniformLocation(app.program, "lightPosition"),
        flatten(app.light.position));
    app.gl.uniform1f(app.gl.getUniformLocation(app.program, "shininess"),
        app.material.shininess);

    app.gl.enable(app.gl.DEPTH_TEST);
    app.gl.clearColor(1.0, 1.0, 1.0, 1.0);
    app.gl.viewport(0, 0, app.canvas.width, app.canvas.height);

    // Projection matrix
    app.projectionMatrix = perspective(45, app.canvas.width / app.canvas.height, 0.1, 100.0);
    app.gl.uniformMatrix4fv(app.projectionMatrixLoc, false, flatten(app.projectionMatrix));

    setEvent();

    render();
};

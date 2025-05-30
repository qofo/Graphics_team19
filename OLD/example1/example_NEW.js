"use strict";

// Configuration object for centralized settings management
const CONFIG = {
    bodyParts: {
        torso: { width: 3, height: 1.8, depth: 3 },
        head: { width: 2.0, height: 1.2, depth: 2.0 },
        leg: { upperHeight: 3.5, lowerHeight: 3.0, width: 0.6 },
        arm: { upperHeight: 2.0, lowerHeight: 1.5, width: 0.6 },
        foot: { height: 3.0 },
        eye: { radius: 0.3 }
    },
    physics: {
        gravity: 0.5,
        initialVelocity: { x: 3.0, y: 4.5 },
        timeStep: 0.05
    },
    lighting: {
        position: [1.0, 1.0, 1.0, 0.0],
        ambient: [0.2, 0.2, 0.2, 1.0],
        diffuse: [1.0, 1.0, 0.8, 1.0],
        specular: [1.0, 1.0, 1.0, 1.0]
    },
    material: {
        ambient: [0.3, 0.6, 0.0, 1.0],
        diffuse: [0.4, 0.8, 0.4, 1.0],
        specular: [0.2, 0.4, 0.2, 1.0],
        shininess: 30.0
    },
    camera: {
        eye: [-80.0, 15.0, 35.0],
        at: [10.0, 0.0, 0.0],
        up: [0.0, 1.0, 0.0]
    }
};

// WebGL Renderer class for managing rendering operations
class WebGLRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.initWebGL();
        this.program = null;
        this.matrixStack = [];
        this.numVertices = 36;
        
        // Matrix uniform locations
        this.uniformLocations = {};
        
        // Geometry data
        this.pointsArray = [];
        this.normalsArray = [];
    }
    
    initWebGL() {
        const gl = WebGLUtils.setupWebGL(this.canvas);
        if (!gl) {
            throw new Error("WebGL is not supported in this browser");
        }
        return gl;
    }
    
    initShaders() {
        this.program = initShaders(this.gl, "vertex-shader", "fragment-shader");
        if (!this.program) {
            throw new Error("Failed to initialize shaders");
        }
        this.gl.useProgram(this.program);
        
        // Cache uniform locations
        this.uniformLocations = {
            modelViewMatrix: this.gl.getUniformLocation(this.program, "modelViewMatrix"),
            projectionMatrix: this.gl.getUniformLocation(this.program, "projectionMatrix"),
            normalMatrix: this.gl.getUniformLocation(this.program, "normalMatrix"),
            ambientProduct: this.gl.getUniformLocation(this.program, "ambientProduct"),
            diffuseProduct: this.gl.getUniformLocation(this.program, "diffuseProduct"),
            specularProduct: this.gl.getUniformLocation(this.program, "specularProduct"),
            lightPosition: this.gl.getUniformLocation(this.program, "lightPosition"),
            shininess: this.gl.getUniformLocation(this.program, "shininess")
        };
    }
    
    setupBuffers() {
        // Create and fill vertex buffer
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, flatten(this.pointsArray), this.gl.STATIC_DRAW);
        
        // Create and fill normal buffer
        const normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, flatten(this.normalsArray), this.gl.STATIC_DRAW);
        
        // Link vertex attributes
        const vPosition = this.gl.getAttribLocation(this.program, "vPosition");
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.vertexAttribPointer(vPosition, 4, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(vPosition);
        
        const vNormal = this.gl.getAttribLocation(this.program, "vNormal");
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.vertexAttribPointer(vNormal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(vNormal);
    }
    
    setupLighting() {
        const { lighting, material } = CONFIG;
        
        this.gl.uniform4fv(this.uniformLocations.ambientProduct, 
            flatten(mult(vec4(...lighting.ambient), vec4(...material.ambient))));
        this.gl.uniform4fv(this.uniformLocations.diffuseProduct, 
            flatten(mult(vec4(...lighting.diffuse), vec4(...material.diffuse))));
        this.gl.uniform4fv(this.uniformLocations.specularProduct, 
            flatten(mult(vec4(...lighting.specular), vec4(...material.specular))));
        this.gl.uniform4fv(this.uniformLocations.lightPosition, 
            flatten(vec4(...lighting.position)));
        this.gl.uniform1f(this.uniformLocations.shininess, material.shininess);
    }
    
    setProjectionMatrix(matrix) {
        this.gl.uniformMatrix4fv(this.uniformLocations.projectionMatrix, false, flatten(matrix));
    }
    
    setModelViewMatrix(matrix) {
        this.gl.uniformMatrix4fv(this.uniformLocations.modelViewMatrix, false, flatten(matrix));
        
        const normalMatrix = transpose(inverse4(matrix));
        this.gl.uniformMatrix4fv(this.uniformLocations.normalMatrix, false, flatten(normalMatrix));
    }
    
    drawBox(width, height, depth, transform) {
        const instanceMatrix = mult(transform, translate(0.0, 0.5 * height, 0.0));
        const scaledMatrix = mult(instanceMatrix, scale4(width, height, depth));
        
        this.setModelViewMatrix(scaledMatrix);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numVertices);
    }
    
    pushMatrix(matrix) {
        this.matrixStack.push(mat4(matrix));
    }
    
    popMatrix() {
        return this.matrixStack.pop();
    }
    
    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
}

// Joint Controller for managing character joint angles
class JointController {
    constructor() {
        this.angles = {
            torso: 0,
            head: 0,
            rightUpperLeg: 110, rightLowerLeg: 150, rightFoot: -150,
            leftUpperLeg: 110, leftLowerLeg: 150, leftFoot: -150,
            rightUpperArm: -150, rightLowerArm: -20,
            leftUpperArm: 150, leftLowerArm: 20
        };
    }
    
    getAngle(jointName) {
        return this.angles[jointName] || 0;
    }
    
    setAngle(jointName, angle) {
        if (this.angles.hasOwnProperty(jointName)) {
            this.angles[jointName] = angle;
        }
    }
    
    updateJumpAngles(direction) {
        const legJoints = ['leftUpperLeg', 'rightUpperLeg'];
        const kneeJoints = ['leftLowerLeg', 'rightLowerLeg'];
        const footJoints = ['leftFoot', 'rightFoot'];
        
        legJoints.forEach(joint => this.angles[joint] += direction);
        kneeJoints.forEach(joint => this.angles[joint] -= direction);
        footJoints.forEach(joint => this.angles[joint] += direction);
    }
}

// Physics System for handling projectile motion
class PhysicsSystem {
    constructor(config = CONFIG.physics) {
        this.gravity = config.gravity;
        this.initialVelocity = config.initialVelocity;
        this.timeStep = config.timeStep;
    }
    
    computePosition(time) {
        const x = this.initialVelocity.x * time;
        const y = this.initialVelocity.y * time - 0.5 * this.gravity * time * time;
        return vec3(x, Math.max(0, y), 0);
    }
    
    computeOrientation(time) {
        const vx = this.initialVelocity.x;
        const vy = this.initialVelocity.y - this.gravity * time;
        if (vx === 0) return 0;
        return this.radiansToDegrees(Math.atan2(vy, vx));
    }
    
    getApexTime() {
        return this.initialVelocity.y / this.gravity;
    }
    
    radiansToDegrees(radians) {
        return radians * (180 / Math.PI);
    }
}

// Animation Controller for managing jump animation
class AnimationController {
    constructor(jointController, physicsSystem) {
        this.jointController = jointController;
        this.physicsSystem = physicsSystem;
        this.isJumping = true;
        this.jumpTime = 0;
        this.jumpOrigin = vec3(0, 0, 0);
        this.jumpDirection = 1;
    }
    
    update() {
        if (!this.isJumping) return;
        
        this.jumpTime += this.physicsSystem.timeStep;
        
        const apexTime = this.physicsSystem.getApexTime();
        this.jumpDirection = this.jumpTime < apexTime ? 1 : -1;
        
        this.jointController.updateJumpAngles(this.jumpDirection);
        
        // Check for landing
        const currentPos = this.physicsSystem.computePosition(this.jumpTime);
        if (currentPos[1] <= 0.01 && this.jumpTime > apexTime) {
            this.jumpOrigin = add(this.jumpOrigin, currentPos);
            this.jumpTime = 0;
            // this.isJumping = false; // Uncomment to stop after one jump
        }
    }
    
    getCurrentPosition() {
        const offset = this.physicsSystem.computePosition(this.jumpTime);
        return add(this.jumpOrigin, offset);
    }
    
    getCurrentOrientation() {
        return this.physicsSystem.computeOrientation(this.jumpTime);
    }
    
    toggleJump() {
        this.isJumping = !this.isJumping;
    }
}

// Camera Controller for managing camera movement
class CameraController {
    constructor(config = CONFIG.camera) {
        this.eye = vec3(...config.eye);
        this.at = vec3(...config.at);
        this.up = vec3(...config.up);
    }
    
    moveLeft(distance = 1) {
        this.eye[0] -= distance;
    }
    
    moveRight(distance = 1) {
        this.eye[0] += distance;
    }
    
    moveUp(distance = 1) {
        this.eye[1] += distance;
    }
    
    moveDown(distance = 1) {
        this.eye[1] -= distance;
    }
    
    getViewMatrix() {
        return lookAt(this.eye, this.at, this.up);
    }
}

// Character class for rendering the 3D character
class Character3D {
    constructor(renderer, jointController) {
        this.renderer = renderer;
        this.jointController = jointController;
        this.position = vec3(0, 0, -50);
        this.orientation = 0;
    }
    
    setPosition(position) {
        this.position = position;
    }
    
    setOrientation(angle) {
        this.orientation = angle;
    }
    
    drawEye(offsetX, transform) {
        const { head, eye } = CONFIG.bodyParts;
        const eyeTransform = mult(transform, translate(offsetX, head.height * 0.8, head.width / 2));
        const scaledTransform = mult(eyeTransform, scale4(eye.radius, eye.radius, eye.radius));
        
        this.renderer.setModelViewMatrix(scaledTransform);
        this.renderer.gl.drawArrays(this.renderer.gl.TRIANGLES, 0, this.renderer.numVertices);
    }
    
    drawLimb(transform, upperAngle, lowerAngle, footAngle, upperLen, lowerLen) {
        const { width } = CONFIG.bodyParts.leg;
        const { height: footHeight } = CONFIG.bodyParts.foot;
        
        // Upper limb
        let limbTransform = mult(transform, rotateX(upperAngle));
        this.renderer.pushMatrix(limbTransform);
        this.renderer.drawBox(width, upperLen, width, limbTransform);
        
        // Lower limb
        limbTransform = mult(limbTransform, translate(0, upperLen, 0));
        limbTransform = mult(limbTransform, rotateX(lowerAngle));
        this.renderer.pushMatrix(limbTransform);
        this.renderer.drawBox(width, lowerLen, width, limbTransform);
        
        // Foot
        limbTransform = mult(limbTransform, translate(0, lowerLen, 0));
        limbTransform = mult(limbTransform, rotateX(footAngle));
        this.renderer.drawBox(width, footHeight, width, limbTransform);
        
        // Restore matrices
        this.renderer.popMatrix();
        this.renderer.popMatrix();
    }
    
    drawArm(transform, upperAngle, lowerAngle) {
        const { upperHeight, lowerHeight, width } = CONFIG.bodyParts.arm;
        
        // Upper arm
        let armTransform = mult(transform, rotateZ(upperAngle));
        this.renderer.pushMatrix(armTransform);
        this.renderer.drawBox(width, upperHeight, width, armTransform);
        
        // Lower arm
        armTransform = mult(armTransform, translate(0, upperHeight, 0));
        armTransform = mult(armTransform, rotateZ(lowerAngle));
        this.renderer.drawBox(width, lowerHeight, width, armTransform);
        
        this.renderer.popMatrix();
    }
    
    render(viewMatrix) {
        const { torso, head, leg, arm } = CONFIG.bodyParts;
        
        // Apply camera view and character transform
        let modelViewMatrix = mult(viewMatrix, translate(this.position[2], this.position[1], this.position[0]));
        modelViewMatrix = mult(modelViewMatrix, rotateX(-this.orientation));
        modelViewMatrix = mult(modelViewMatrix, rotateY(this.jointController.getAngle('torso')));
        
        this.renderer.pushMatrix(modelViewMatrix);
        
        // Draw torso
        this.renderer.drawBox(torso.width, torso.height, torso.depth, modelViewMatrix);
        
        // Draw head
        let headTransform = mult(modelViewMatrix, translate(0, torso.height, 1));
        headTransform = mult(headTransform, rotateY(this.jointController.getAngle('head')));
        this.renderer.pushMatrix(headTransform);
        this.renderer.drawBox(head.width, head.height, head.depth, headTransform);
        
        // Draw eyes
        this.drawEye(-0.5, headTransform);
        this.drawEye(0.5, headTransform);
        
        this.renderer.popMatrix();
        
        // Draw legs
        const legConfigs = [
            {
                offset: [-1.5, 0, -1.5],
                angles: ['leftUpperLeg', 'leftLowerLeg', 'leftFoot']
            },
            {
                offset: [1.5, 0, -1.5],
                angles: ['rightUpperLeg', 'rightLowerLeg', 'rightFoot']
            }
        ];
        
        legConfigs.forEach(config => {
            const legTransform = mult(modelViewMatrix, translate(...config.offset));
            const angles = config.angles.map(name => this.jointController.getAngle(name));
            this.drawLimb(legTransform, ...angles, leg.upperHeight, leg.lowerHeight);
        });
        
        // Draw arms
        const armHeight = torso.height * 0.6;
        const armConfigs = [
            {
                offset: [-torso.width / 2 - arm.width / 2, armHeight, 1.0],
                angles: ['leftUpperArm', 'leftLowerArm']
            },
            {
                offset: [torso.width / 2 + arm.width / 2, armHeight, 1.0],
                angles: ['rightUpperArm', 'rightLowerArm']
            }
        ];
        
        armConfigs.forEach(config => {
            const armTransform = mult(modelViewMatrix, translate(...config.offset));
            const angles = config.angles.map(name => this.jointController.getAngle(name));
            this.drawArm(armTransform, ...angles);
        });
        
        this.renderer.popMatrix();
    }
}

// Ground class for rendering the ground plane
class Ground {
    constructor(renderer) {
        this.renderer = renderer;
    }
    
    render(viewMatrix) {
        this.renderer.pushMatrix(viewMatrix);
        
        const groundTransform = mult(viewMatrix, translate(0.0, -0.05, 0.0));
        
        // Temporarily change material for ground
        this.setGroundMaterial();
        this.renderer.drawBox(100.0, 0.1, 100.0, groundTransform);
        this.restoreCharacterMaterial();
        
        this.renderer.popMatrix();
    }
    
    setGroundMaterial() {
        const { lighting } = CONFIG;
        const groundMaterial = {
            ambient: [0.2, 0.2, 0.2, 1.0],
            diffuse: [0.6, 0.6, 0.6, 1.0],
            specular: [0.0, 0.0, 0.0, 1.0]
        };
        
        this.renderer.gl.uniform4fv(this.renderer.uniformLocations.ambientProduct,
            flatten(mult(vec4(...lighting.ambient), vec4(...groundMaterial.ambient))));
        this.renderer.gl.uniform4fv(this.renderer.uniformLocations.diffuseProduct,
            flatten(mult(vec4(...lighting.diffuse), vec4(...groundMaterial.diffuse))));
        this.renderer.gl.uniform4fv(this.renderer.uniformLocations.specularProduct,
            flatten(mult(vec4(...lighting.specular), vec4(...groundMaterial.specular))));
    }
    
    restoreCharacterMaterial() {
        const { lighting, material } = CONFIG;
        
        this.renderer.gl.uniform4fv(this.renderer.uniformLocations.ambientProduct,
            flatten(mult(vec4(...lighting.ambient), vec4(...material.ambient))));
        this.renderer.gl.uniform4fv(this.renderer.uniformLocations.diffuseProduct,
            flatten(mult(vec4(...lighting.diffuse), vec4(...material.diffuse))));
        this.renderer.gl.uniform4fv(this.renderer.uniformLocations.specularProduct,
            flatten(mult(vec4(...lighting.specular), vec4(...material.specular))));
    }
}

// Input Manager for handling keyboard input
class InputManager {
    constructor() {
        this.keyStates = new Map();
        this.eventListeners = new Map();
        this.setupEventListeners();
    }
    
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (event) => {
            if (!this.keyStates.get(event.code)) {
                this.keyStates.set(event.code, true);
                this.emit('keydown', event.code);
            }
        });
        
        window.addEventListener('keyup', (event) => {
            this.keyStates.set(event.code, false);
            this.emit('keyup', event.code);
        });
    }
    
    isKeyPressed(keyCode) {
        return this.keyStates.get(keyCode) || false;
    }
}

// Main Application class
class Character3DApp {
    constructor(canvasId) {
        try {
            // Initialize core systems
            this.renderer = new WebGLRenderer(canvasId);
            this.jointController = new JointController();
            this.physicsSystem = new PhysicsSystem();
            this.animationController = new AnimationController(this.jointController, this.physicsSystem);
            this.cameraController = new CameraController();
            this.inputManager = new InputManager();
            
            // Create scene objects
            this.character = new Character3D(this.renderer, this.jointController);
            this.ground = new Ground(this.renderer);
            
            // Initialize WebGL
            this.initWebGL();
            this.setupInput();
            this.start();
            
        } catch (error) {
            console.error("Failed to initialize application:", error);
            alert("Failed to initialize 3D application: " + error.message);
        }
    }
    
    initWebGL() {
        // Initialize geometry
        colorCube(1, 1, 1);
        this.renderer.pointsArray = pointsArray;
        this.renderer.normalsArray = normalsArray;
        
        // Setup WebGL
        this.renderer.initShaders();
        this.renderer.setupBuffers();
        this.renderer.setupLighting();
        
        // Configure WebGL state
        this.renderer.gl.enable(this.renderer.gl.DEPTH_TEST);
        this.renderer.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.renderer.gl.viewport(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        
        // Set projection matrix
        const projectionMatrix = perspective(45, 
            this.renderer.canvas.width / this.renderer.canvas.height, 0.1, 100.0);
        this.renderer.setProjectionMatrix(projectionMatrix);
    }
    
    setupInput() {
        this.inputManager.on('keydown', (keyCode) => {
            switch(keyCode) {
                case 'ArrowLeft':
                    this.cameraController.moveLeft();
                    break;
                case 'ArrowRight':
                    this.cameraController.moveRight();
                    break;
                case 'ArrowUp':
                    this.cameraController.moveUp();
                    break;
                case 'ArrowDown':
                    this.cameraController.moveDown();
                    break;
                case 'KeyX':
                    this.animationController.toggleJump();
                    break;
                case 'KeyR':
                    this.reset();
                    break;
            }
        });
    }
    
    reset() {
        this.animationController.jumpTime = 0;
        this.animationController.jumpOrigin = vec3(0, 0, 0);
        this.animationController.isJumping = false;
    }
    
    update() {
        this.animationController.update();
        
        // Update character position and orientation
        this.character.setPosition(this.animationController.getCurrentPosition());
        this.character.setOrientation(this.animationController.getCurrentOrientation());
    }
    
    render() {
        this.renderer.clear();
        
        const viewMatrix = this.cameraController.getViewMatrix();
        
        // Render scene objects
        this.ground.render(viewMatrix);
        this.character.render(viewMatrix);
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    start() {

        this.gameLoop();
    }
}

// Global variables for compatibility with modeling.js
var pointsArray = [];
var normalsArray = [];

// Initialize application when page loads
window.onload = function() {
    try {
        new Character3DApp('gl-canvas');
    } catch (error) {
        console.error("Application failed to start:", error);
    }
};
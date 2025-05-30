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
            this.cameraController.bindToCanvas(this.renderer.canvas, () => this.character.position);

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
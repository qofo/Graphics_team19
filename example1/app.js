"use strict";

// Configuration object for centralized settings management
const CONFIG = {
    bodyParts: {
        torso: { width: 3, height: 1.8, depth: 3 },
        head: { width: 2.0, height: 1.2, depth: 2.0 },
        leg: { upperHeight: 3.5, lowerHeight: 3.0, width: 0.6 },
        arm: { upperHeight: 2.0, lowerHeight: 1.5, width: 0.6 },
        foot: { height: 3.0 },
        eye: { radius: 0.3 },
        },
    physics: {
        gravity: 0.5,
        initialVelocity: { x: 3.0, y: 4.5 },
        timeStep: 0.05
    },
    lighting: {
        position: [1.0, 1.0, 1.0, 1.0],
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
    groundMaterial: {
        ambient: [0.4, 0.25, 0.1, 1.0], // 🟤 연한 갈색 ambient
        diffuse: [0.5, 0.3, 0.15, 1.0], // 🟤 연한 갈색 diffuse
        specular: [0.1, 0.1, 0.1, 1.0], // 🟤 살짝 어두운 specular
        shininess: 10.0
    },
    camera: {
        eye: [-80.0, 15.0, 35.0],
        at: [10.0, 0.0, 0.0],
        up: [0.0, 1.0, 0.0]
    },
    initialJointAngles: {
            torsoY: 0,
            torsoX: 0,
            head: 0,
            rightUpperLeg: 110, rightLowerLeg: 150, rightFoot: -150,
            leftUpperLeg: 110, leftLowerLeg: 150, leftFoot: -150,
            rightUpperArm: -150, rightLowerArm: -20,
            leftUpperArm: 150, leftLowerArm: 20
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

            this.lightOffsets = { x: 0, y: 5, z: 0 };
            this.totalDistance = 0;
            this.lastZ = 0;
            
            // Create scene objects
            this.character = new Character3D(this.renderer, this.jointController);
            //this.ground = new Ground(this.renderer);
            this.groundManager = new GroundManager(this.renderer);
            
            // Initialize WebGL
            this.initWebGL();
            this.setupInput();
            this.setupUI();
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
        this.renderer.texCoordsArray = texCoordsArray;
        
        // Setup WebGL
        this.renderer.initShaders();
        this.renderer.setupBuffers();
        this.renderer.setupLighting();

        // Texture Load
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = "groundTexture.jpg";
        image.onload = () => {
            this.renderer.initGroundTexture(image);
        };

        const frogImage = new Image();
        frogImage.src = "frogTexture.jpg";
        frogImage.onload = () => {
            this.renderer.initFrogTexture(frogImage);
        };
        
        // Configure WebGL state
        this.renderer.gl.enable(this.renderer.gl.DEPTH_TEST);
        this.renderer.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.renderer.gl.viewport(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        
        // Set projection matrix
        const projectionMatrix = perspective(45, 
            this.renderer.canvas.width / this.renderer.canvas.height, 0.1, 500.0);
        this.renderer.setProjectionMatrix(projectionMatrix);
        this.reset();
    }
    
    setupInput() {
        this.inputManager.on('keydown', (keyCode) => {
            switch(keyCode) {
                case 'Space':
                case ' ':
                    this.animationController.triggerJump();
                    break;
                case 'KeyR':
                    this.reset();
                    break;
            }
        });
    }

    setupUI() {
        const bind = (id, axis) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    this.lightOffsets[axis] = parseFloat(el.value);
                });
            }
        };
        bind('light-x', 'x');
        bind('light-y', 'y');
        bind('light-z', 'z');
    }
    
    reset() {
        this.animationController.jumpTime = 0;
        this.animationController.jumpOrigin = vec3(0, 0, 0);
        this.animationController.isJumping = false;

        this.jointController.angles = { ...CONFIG.initialJointAngles };
        this.character.position = vec3(0, 0, -50);

        this.totalDistance = 0;
        this.lastZ = this.character.position[2];
        const distElem = document.getElementById('distance');
        if (distElem) distElem.textContent = this.totalDistance.toFixed(2);

        // GroundManager 초기화
        this.groundManager = new GroundManager(this.renderer);
    }
    
    update() {
        this.animationController.update();

        const ROTATE_SPEED = 0.5;
        if (!this.animationController.isJumping) {
            if (this.inputManager.isKeyPressed('KeyW')) {
                this.jointController.angles.torsoX -= ROTATE_SPEED;
            }
            if (this.inputManager.isKeyPressed('KeyS')) {
                this.jointController.angles.torsoX += ROTATE_SPEED;
            }
            if (this.inputManager.isKeyPressed('KeyA')) {
                this.jointController.angles.torsoY += ROTATE_SPEED;
            }
            if (this.inputManager.isKeyPressed('KeyD')) {
                this.jointController.angles.torsoY -= ROTATE_SPEED;
            }
        }
        this.jointController.angles.torsoX = Math.max(-30, Math.min(30, this.jointController.angles.torsoX));
        //console.log("app torsoX:", this.jointController.angles.torsoX);
        
        // 개구리 위치 갱신
        this.character.setPosition(this.animationController.getCurrentPosition());
        this.character.setOrientation(this.animationController.getCurrentOrientation());

        const charPos = this.character.position;
        this.totalDistance += charPos[2] - this.lastZ;
        this.lastZ = charPos[2];
        const distElem = document.getElementById('distance');
        if (distElem) distElem.textContent = this.totalDistance.toFixed(2);

        const lightPos = vec4(
            charPos[0] + this.lightOffsets.x,
            charPos[1] + this.lightOffsets.y,
            charPos[2] + this.lightOffsets.z,
            1.0
        );
        this.renderer.updateLightPosition(lightPos);

        // GroundManager 업데이트: 개구리의 z위치를 넘겨줌
        this.groundManager.update(this.character.position[2]);

        const groundHeight = this.groundManager.getGroundHeightAt(charPos[0], charPos[2]);

        if (groundHeight !== null && charPos[1] <= groundHeight) {
            // 착지 - use landing state
            if (this.animationController.isJumping && !this.animationController.isLanding) {
                this.animationController.startLanding([
                    charPos[0], groundHeight, charPos[2]
                ]);
            }
        } else if (charPos[1] < -10.0) {
            // 낙사
            alert("Game Over");
            this.reset();
        }
    }
    
    render() {
        this.renderer.clear();
        
        const viewMatrix = this.cameraController.getViewMatrix();
        
        // Render scene objects
        //this.ground.render(viewMatrix);
        this.groundManager.render(viewMatrix);
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
var texCoordsArray = [];

// Initialize application when page loads
window.onload = function() {
    try {
        new Character3DApp('gl-canvas');
    } catch (error) {
        console.error("Application failed to start:", error);
    }
};
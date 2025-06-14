"use strict";

// Controllers for joint angles, physics, camera and input
// Joint Controller for managing character joint angles
class JointController {
    constructor() {
        this.angles = {
            ...CONFIG.initialJointAngles
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
    
    computePositionOrigin(time) {
        const x = this.initialVelocity.x * time;
        const y = this.initialVelocity.y * time - 0.5 * this.gravity * time * time;
        return vec3(0, Math.max(0, y), x);
    }

    computePosition(time, torsoX, torsoY) {
        const v = this.initialVelocity;
        const v0 = Math.sqrt(v.x * v.x + v.y * v.y);

        const radX = (-torsoX+60) * Math.PI / 180;
        const radY = (torsoY) * Math.PI / 180;

        const vy = v0 * Math.sin(radX);
        const v_horizontal = v0 * Math.cos(radX);

        const x = v_horizontal * Math.cos(radY) * time;
        const z = v_horizontal * Math.sin(radY) * time;
        const y = vy * time - 0.5 * this.gravity * time * time;

        return vec3(z, y, x);
    }

    
    computeOrientation(time) {
        const vx = this.initialVelocity.x;
        const vy = this.initialVelocity.y - this.gravity * time;
        if (vx === 0) return 0;
        return this.radiansToDegrees(Math.atan2(vy, vx));
    }
    
    getApexTime(torsoX) {
        const v = this.initialVelocity;
        const v0 = Math.sqrt(v.x * v.x + v.y * v.y);

        const radX = (-torsoX+60) * Math.PI / 180;

        const vy = v0 * Math.sin(radX);
        return Math.abs(vy / this.gravity);
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
        this.isJumping = false;
        this.jumpTime = 0;
        this.jumpOrigin = vec3(0, 0, 0);
        this.jumpDirection = 1;
        this.isLanding = false;
        this.landingTime = 0;
        this.landingDuration = 0.2;
        this.landingStartAngles = null;
    }

    update() {
        if (this.isLanding) {
            this.landingTime += this.physicsSystem.timeStep;
            const t = Math.min(1, this.landingTime / this.landingDuration);
            const target = CONFIG.initialJointAngles;

            for (const joint in target) {
                const start = this.landingStartAngles[joint];
                this.jointController.angles[joint] =
                    start + (target[joint] - start) * t;
            }

            if (t >= 1) {
                this.isLanding = false;
                this.landingTime = 0;
                this.landingStartAngles = null;
                this.jointController.angles = { ...CONFIG.initialJointAngles };
                this.jumpTime = 0;
            }
            return;
        }

        if (!this.isJumping) return;
        
        this.jumpTime += this.physicsSystem.timeStep;
        
        const torsoX = this.jointController.getAngle('torsoX');
        const torsoY = this.jointController.getAngle('torsoY');
        const apexTime = this.physicsSystem.getApexTime(torsoX);

        this.jumpDirection = this.jumpTime < apexTime ? 1 : -1;
        
        this.jointController.updateJumpAngles(this.jumpDirection);
        
        // Check for landing

        const currentPos = this.physicsSystem.computePosition(this.jumpTime, torsoX, torsoY);
        
        const time = Math.floor(this.jumpTime * 20);
        // if (Math.floor(time) % 25 === 0)
        //     //console.log("time:", time, "angle:", torsoX, "pos:", currentPos);

        // if (this.jumpTime > 2 * apexTime) {
        //     this.jumpOrigin = add(this.jumpOrigin, currentPos);
        //     this.jumpTime = 0;
        //     this.isJumping = false; // Uncomment to stop after one jump

        //     this.jointController.angles = { ...CONFIG.initialJointAngles};
        //     this.jointController.angles.torsoX = torsoX;
        //     this.jointController.angles.torsoY = torsoY;

        //     //console.log(currentPos);
        // }
    }
    
    getCurrentPosition() {
        const torsoX = this.jointController.getAngle('torsoX');
        const torsoY = this.jointController.getAngle('torsoY');
        const offset = this.physicsSystem.computePosition(this.jumpTime, torsoX, torsoY);
        return add(this.jumpOrigin, offset);
    }
    
    getCurrentOrientation() {
        return this.physicsSystem.computeOrientation(this.jumpTime);
    }
    
    triggerJump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.jumpTime = 0;
        }
    }

    startLanding(position) {
        this.isJumping = false;
        this.isLanding = true;
        this.landingTime = 0;
        this.landingStartAngles = { ...this.jointController.angles };
        this.jumpOrigin = vec3(...position);
        this.jumpTime = 0;
    }
}

class CameraController {

    constructor(config = CONFIG.camera) {
        this.distance = 50;  // 모델과의 거리
        this.theta = 180;    // 모델의 뒤쪽에서 시작
        this.phi = 30;       // 위에서 내려다보는 각도
        this.zoomSpeed = 2;

        this.target = vec3(...config.at);
        this.up = vec3(...config.up);

        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
    }
    


    bindToCanvas(canvas, getTargetPosition) {
        this.getTargetPosition = getTargetPosition;
        canvas.addEventListener("mousedown", (e) => {
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener("mousemove", (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;

                this.theta += dx * 0.5;
                this.phi = Math.min(89, Math.max(1, this.phi - dy * 0.5));

                this.lastMouse = { x: e.clientX, y: e.clientY };
            }
        });

        canvas.addEventListener("mouseup", () => {
            this.isDragging = false;
        });

        canvas.addEventListener("wheel", (e) => {
            this.distance += e.deltaY * 0.05;
            this.distance = Math.max(5, Math.min(200, this.distance));
        });
    }

    getViewMatrix() {
        const radTheta = this.theta * Math.PI / 180;
        const radPhi = this.phi * Math.PI / 180;

        if (this.getTargetPosition) {
            this.target = this.getTargetPosition();
        }

        const x = this.target[0] + this.distance * Math.sin(radTheta) * Math.cos(radPhi);
        const y = this.target[1] + this.distance * Math.sin(radPhi);
        const z = this.target[2] + this.distance * Math.cos(radTheta) * Math.cos(radPhi);

        this.eye = vec3(x, y, z);
        return lookAt(this.eye, this.target, this.up);
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
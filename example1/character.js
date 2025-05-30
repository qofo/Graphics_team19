
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

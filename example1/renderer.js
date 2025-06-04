"use strict";
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

// Construct one face of the cube and store vertex and normal data
function quad(a, b, c, d, vertices) {
    let texCoords = [
        vec2(0, 0),
        vec2(0, 1),
        vec2(1, 1),
        vec2(1, 0)
    ];
    let quadTexCoords = [texCoords[0], texCoords[1], texCoords[2], texCoords[0], texCoords[2], texCoords[3]];

    let indices = [a, b, c, a, c, d];
    let normal = normalize(cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[b])));
    for (let i = 0; i < indices.length; ++i) {
        pointsArray.push(vertices[indices[i]]);
        normalsArray.push(normal);
        texCoordsArray.push(quadTexCoords[i]);
    }
}
// WebGL Renderer class for managing rendering operations
class WebGLRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.initWebGL();
        this.program = null;
        this.matrixStack = [];
        this.numVertices = 36;
        this.frogTexture = null;
        
        // Matrix uniform locations
        this.uniformLocations = {};
        
        // Geometry data
        this.pointsArray = [];
        this.normalsArray = [];

        this.currentViewMatrix = mat4();
        this.lightViewMatrix = mat4();
        this.lightProjectionMatrix = mat4();
        this.biasMatrix = mat4(
            vec4(0.5, 0.0, 0.0, 0.0),
            vec4(0.0, 0.5, 0.0, 0.0),
            vec4(0.0, 0.0, 0.5, 0.0),
            vec4(0.5, 0.5, 0.5, 1.0)
        );
        this.shadowMapSize = 1024;
        this.shadowFramebuffer = null;
        this.shadowDepthTexture = null;
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
            shininess: this.gl.getUniformLocation(this.program, "shininess"),
            shadowMatrix: this.gl.getUniformLocation(this.program, "shadowMatrix"),
            shadowMap: this.gl.getUniformLocation(this.program, "shadowMap")
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
        
        const texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, flatten(this.texCoordsArray), this.gl.STATIC_DRAW);

        // Link vertex attributes
        const vPosition = this.gl.getAttribLocation(this.program, "vPosition");
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.vertexAttribPointer(vPosition, 4, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(vPosition);
        
        const vNormal = this.gl.getAttribLocation(this.program, "vNormal");
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.vertexAttribPointer(vNormal, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(vNormal);

        const vTexCoord = this.gl.getAttribLocation(this.program, "vTexCoord");
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
        this.gl.vertexAttribPointer(vTexCoord, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(vTexCoord);
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
        this.lightViewMatrix = lookAt(vec3(...lighting.position.slice(0,3)), vec3(0,0,0), vec3(0,1,0));
        this.lightProjectionMatrix = perspective(45, 1, 0.1, 200.0);
        this.gl.uniform1f(this.uniformLocations.shininess, material.shininess);
    }

    setFrogMaterial() {
        const { ambient, diffuse, specular, shininess } = CONFIG.material;
        this.gl.uniform4fv(this.uniformLocations.ambientProduct, ambient);
        this.gl.uniform4fv(this.uniformLocations.diffuseProduct, diffuse);
        this.gl.uniform4fv(this.uniformLocations.specularProduct, specular);
        this.gl.uniform1f(this.uniformLocations.shininess, shininess);
    }

    setGroundMaterial() {
        const { ambient, diffuse, specular, shininess } = CONFIG.groundMaterial;
        this.gl.uniform4fv(this.uniformLocations.ambientProduct, ambient);
        this.gl.uniform4fv(this.uniformLocations.diffuseProduct, diffuse);
        this.gl.uniform4fv(this.uniformLocations.specularProduct, specular);
        this.gl.uniform1f(this.uniformLocations.shininess, shininess);
    }


    initFrogTexture(image) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA,
                        this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);

        this.frogTexture = texture;
    }

    initGroundTexture(image) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA,
                            this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);

        this.groundTexture = texture;
    }

    initShadowMap() {
        const gl = this.gl;
        this.shadowFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);

        const colorTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colorTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.shadowMapSize, this.shadowMapSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0);

        this.shadowDepthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadowDepthTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, this.shadowMapSize, this.shadowMapSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowDepthTexture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    setupGroundTexture() {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.groundTexture);

        const textureLoc = this.gl.getUniformLocation(this.program, "texture");
        this.gl.uniform1i(textureLoc, 0);
    }

    setupShadowMap() {
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.shadowDepthTexture);
        this.gl.uniform1i(this.uniformLocations.shadowMap, 1);
    }

    setupFrogTexture() {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.frogTexture);

        const textureLoc = this.gl.getUniformLocation(this.program, "texture");
        this.gl.uniform1i(textureLoc, 0);
    }

    bindShadowFramebuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.shadowFramebuffer);
        this.gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
    }

    unbindShadowFramebuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    setProjectionMatrix(matrix) {
        this.gl.uniformMatrix4fv(this.uniformLocations.projectionMatrix, false, flatten(matrix));
    }

    setViewMatrix(matrix) {
        this.currentViewMatrix = mat4(matrix);
    }

    setLightViewMatrix(matrix) {
        this.lightViewMatrix = mat4(matrix);
    }

    setLightProjectionMatrix(matrix) {
        this.lightProjectionMatrix = mat4(matrix);
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

        const invView = inverse4(this.currentViewMatrix);
        const worldMatrix = mult(invView, scaledMatrix);
        const shadow = mult(this.biasMatrix,
            mult(this.lightProjectionMatrix, mult(this.lightViewMatrix, worldMatrix)));
        this.gl.uniformMatrix4fv(this.uniformLocations.shadowMatrix, false, flatten(shadow));

        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numVertices);
    }
    
    pushMatrix(matrix) {
        this.matrixStack.push(mat4(matrix));
    }
    
    popMatrix() {
        return this.matrixStack.pop();
    }

    updateLightPosition(position) {
        this.gl.uniform4fv(this.uniformLocations.lightPosition, flatten(position));
        this.lightViewMatrix = lookAt(vec3(position[0], position[1], position[2]), vec3(0,0,0), vec3(0,1,0));
    }

    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
}


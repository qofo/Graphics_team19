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
    let indices = [a, b, c, a, c, d];
    let normal = normalize(cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[b])));
    for (let i = 0; i < indices.length; ++i) {
        pointsArray.push(vertices[indices[i]]);
        normalsArray.push(normal);
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


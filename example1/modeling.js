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
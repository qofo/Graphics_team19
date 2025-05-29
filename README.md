---
### Team 19
| Name  | Role                |
| ----- | ------------------- |
| 이준서   | Animation, Lighting |
| Ensio | Modeling,           |

---
### TODO
### 1. Modeling
#### Frog Modeling
- [x] Build frog using box hierarchy
- [ ] Adjust size/proportion to resemble frog
- [ ] Add ~~eyes~~, mouth, foot detail
#### ETC.
- [x] Add floor object
### 2. User Interaction
- [ ] A. Implement camera orbit with mouse
- [ ] B. Implement jump direction/distance input with keyboard

### 3. Animation
- [x] Design keyframes: which joints, what angle range
- [x] Implement jump motion over time (timing function)

### 4. Lighting
- [x] Set up ambient + diffuse + specular lighting
- [x] Match the lighting model from the assignment

### 5. Texture
- [ ] Apply frog skin texture
- [ ] Apply floor texture

### 6. (Optional) Shadow
- [ ] Global directional shadow (advanced)

### 7. Presentation Material
- [ ] Make ppt slides(can be revised after submission)

### 8. Demo Video
- [ ] Make demo video

---
### Hierarchy
- Torso 	
	- right upper leg – right lower leg – right foot
	- left upper leg – left lower leg – left foot
	- head
	- left upper arm – left lower arm – (hand?)
	- right upper arm – right lower arm – (hand?)
 
 Each of them has just 1 Degree of Freedom.

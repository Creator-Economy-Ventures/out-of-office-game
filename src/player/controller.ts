import * as THREE from 'three';
import { keys, mouse } from '../core/input';
import { gameState, modStat } from '../core/store';
import { playFootstep } from '../core/audio';
import { TUNING } from '../config/tuning';
import { getTerrainY } from '../world/builders';

export class PlayerController {
  camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0;
  velocity = new THREE.Vector3();
  position = new THREE.Vector3(0, 2, 10);
  grounded = true;
  crouching = false;
  sensitivity = 0.002;
  footstepTimer = 0;
  bobTimer = 0;
  bobAmount = 0;
  enabled = true;
  surface: 'grass' | 'wood' | 'gravel' | 'felt' = 'grass';
  arms: THREE.Group;
  leftArm!: THREE.Mesh;
  rightArm!: THREE.Mesh;
  sleeveColor = 0x4a6080; // NYC blue-grey vest

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.camera.position.copy(this.position);
    this.arms = new THREE.Group();
    this.camera.add(this.arms);
    this.buildArms(scene);
  }

  buildArms(scene: THREE.Scene) {
    // Left arm
    const armGeo = new THREE.CapsuleGeometry(0.05, 0.28, 3, 6);
    const armMat = new THREE.MeshLambertMaterial({ color: this.sleeveColor });
    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.22, -0.22, -0.35);
    this.leftArm.rotation.x = 0.4;
    this.leftArm.rotation.z = 0.15;

    // Right arm
    this.rightArm = new THREE.Mesh(armGeo.clone(), armMat.clone());
    this.rightArm.position.set(0.22, -0.22, -0.35);
    this.rightArm.rotation.x = 0.4;
    this.rightArm.rotation.z = -0.15;

    // Hands
    const handGeo = new THREE.SphereGeometry(0.06, 6, 4);
    const handMat = new THREE.MeshLambertMaterial({ color: 0xd4956a });
    const leftHand = new THREE.Mesh(handGeo, handMat);
    leftHand.position.set(0, -0.17, 0);
    this.leftArm.add(leftHand);
    const rightHand = leftHand.clone();
    this.rightArm.add(rightHand);

    this.arms.add(this.leftArm);
    this.arms.add(this.rightArm);
    scene.add(this.camera);
  }

  setSleeveColor(color: number) {
    this.sleeveColor = color;
    (this.leftArm.material as THREE.MeshLambertMaterial).color.set(color);
    (this.rightArm.material as THREE.MeshLambertMaterial).color.set(color);
  }

  update(dt: number) {
    if (!this.enabled) return;

    // Look
    this.yaw -= mouse.dx * this.sensitivity;
    this.pitch -= mouse.dy * this.sensitivity;
    this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));

    // Move
    const sprinting = keys['ShiftLeft'] && !this.crouching;
    const speed = this.crouching ? TUNING.player.walkSpeed * 0.5
      : sprinting ? TUNING.player.sprintSpeed : TUNING.player.walkSpeed;

    if (sprinting) {
      modStat('stamina', -TUNING.player.staminaDrainSprint * dt);
      if (gameState.stats.stamina <= 0) keys['ShiftLeft'] = false;
    } else if (gameState.stats.stamina < gameState.stats.staminaMax) {
      modStat('stamina', 10 * dt);
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const moveDir = new THREE.Vector3();

    if (keys['KeyW'] || keys['ArrowUp']) moveDir.add(forward);
    if (keys['KeyS'] || keys['ArrowDown']) moveDir.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft']) moveDir.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right);

    const moving = moveDir.length() > 0;
    if (moving) moveDir.normalize().multiplyScalar(speed * dt);
    this.velocity.x = moveDir.x;
    this.velocity.z = moveDir.z;

    // Jump
    if (keys['Space'] && this.grounded) {
      this.velocity.y = TUNING.player.jumpForce;
      this.grounded = false;
    }

    // Gravity
    if (!this.grounded) {
      this.velocity.y -= 20 * dt;
    }

    // Move
    this.position.x += this.velocity.x;
    this.position.z += this.velocity.z;
    this.position.y += this.velocity.y * dt;

    // Clamp to world bounds
    this.position.x = Math.max(-290, Math.min(290, this.position.x));
    this.position.z = Math.max(-290, Math.min(290, this.position.z));

    // Ground
    const groundY = getTerrainY(this.position.x, this.position.z);
    const eyeHeight = this.crouching ? 1.2 : 1.7;
    if (this.position.y <= groundY + eyeHeight) {
      this.position.y = groundY + eyeHeight;
      this.velocity.y = 0;
      this.grounded = true;
    }

    // Crouch
    this.crouching = !!keys['KeyC'];

    // Footsteps
    if (moving && this.grounded) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        playFootstep(this.surface);
        this.footstepTimer = sprinting ? 0.3 : 0.5;
      }
      this.bobTimer += dt * (sprinting ? 12 : 8);
      this.bobAmount = Math.sin(this.bobTimer) * 0.04;
    } else {
      this.bobAmount *= 0.9;
    }

    // Apply to camera
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.position.copy(this.position);
    this.camera.position.y += this.bobAmount;
    this.camera.quaternion.setFromEuler(euler);

    // Arm bob
    this.arms.position.y = -0.02 + Math.sin(this.bobTimer) * 0.015;
  }
}

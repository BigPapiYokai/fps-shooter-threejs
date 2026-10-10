import * as THREE from 'three';
import { HitboxSystem } from './Hitbox.js';

export class TargetManager {
    constructor(scene, hitboxSystem, player, particleSystem) {
        this.scene = scene;
        this.hitboxSystem = hitboxSystem;
        this.player = player;
        this.particleSystem = particleSystem;
        this.targets = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2;
        this.maxTargets = 15;
        
        this.targetTypes = [
            { name: 'standard', health: 50, score: 100, color: 0x44ff44, size: 1, speed: 3 },
            { name: 'armored', health: 150, score: 250, color: 0x8888ff, size: 1.2, speed: 2 },
            { name: 'fast', health: 30, score: 150, color: 0xffaa00, size: 0.8, speed: 6 },
            { name: 'boss', health: 500, score: 1000, color: 0xff0000, size: 2, speed: 1.5 }
        ];
    }

    spawnTarget(position = null) {
        if (this.targets.length >= this.maxTargets) return;
        
        const type = this.targetTypes[Math.floor(Math.random() * this.targetTypes.length)];
        const target = this.createTarget(type, position);
        this.targets.push(target);
        return target;
    }

    createTarget(type, position) {
        const group = new THREE.Group();
        
        const bodyGeo = new THREE.CapsuleGeometry(type.size * 0.3, type.size * 1.2, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: type.color, 
            roughness: 0.5, 
            metalness: 0.2,
            emissive: type.color,
            emissiveIntensity: 0.1
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        const headGeo = new THREE.SphereGeometry(type.size * 0.25, 16, 16);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.y = type.size * 0.9;
        head.castShadow = true;
        group.add(head);
        
        const eyeGeo = new THREE.SphereGeometry(type.size * 0.08, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1 * type.size, type.size * 0.95, 0.2 * type.size);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1 * type.size, type.size * 0.95, 0.2 * type.size);
        group.add(leftEye, rightEye);
        group.userData.eyes = [leftEye, rightEye];
        
        if (!position) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 15 + Math.random() * 20;
            position = new THREE.Vector3(
                Math.cos(angle) * radius,
                type.size * 0.6,
                Math.sin(angle) * radius
            );
        }
        group.position.copy(position);
        group.userData = {
            ...group.userData,
            type: type.name,
            health: type.health,
            maxHealth: type.health,
            score: type.score,
            speed: type.speed,
            color: type.color,
            size: type.size,
            lastHit: 0
        };
        
        const bodyHitbox = this.hitboxSystem.createBodyHitbox(
            type.size * 0.6, type.size * 1.2, type.size * 0.6
        );
        bodyHitbox.name = 'body';
        bodyHitbox.position.set(0, type.size * 0.6, 0);
        group.add(bodyHitbox);
        
        const headHitbox = this.hitboxSystem.createHeadHitbox(type.size * 0.25);
        headHitbox.name = 'head';
        headHitbox.position.set(0, type.size * 1.2, 0);
        group.add(headHitbox);
        
        this.hitboxSystem.register(group, {
            meshes: [bodyHitbox, headHitbox],
            multipliers: { head: 3.0, body: 1.0 },
            defaultMultiplier: 1.0,
            onHit: (damage, multiplier, part) => this.onTargetHit(group, damage, multiplier, part)
        });
        
        this.scene.add(group);
        return group;
    }

    onTargetHit(target, damage, multiplier, hitPart) {
        target.userData.health -= Math.floor(damage * multiplier);
        target.userData.lastHit = Date.now();
        
        this.particleSystem.createHitEffect(
            target.getWorldPosition(new THREE.Vector3()),
            hitPart === 'head' ? 0xffff00 : 0xff4444
        );
        
        this.player.playHitSound();
        
        if (target.userData.health <= 0) {
            this.destroyTarget(target);
        } else {
            this.flashTarget(target);
        }
    }

    flashTarget(target) {
        const originalColor = target.userData.color;
        target.traverse(child => {
            if (child.isMesh && child.material && child.material.color) {
                child.material.emissiveIntensity = 1;
                child.material.color.setHex(0xffffff);
            }
        });
        setTimeout(() => {
            target.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    child.material.emissiveIntensity = 0.1;
                    child.material.color.setHex(originalColor);
                }
            });
        }, 100);
    }

    destroyTarget(target) {
        this.hitboxSystem.unregister(target);
        
        this.particleSystem.createExplosion(
            target.getWorldPosition(new THREE.Vector3()),
            target.userData.color,
            target.userData.size
        );
        
        this.player.addScore(target.userData.score);
        this.player.playKillSound();
        
        const index = this.targets.indexOf(target);
        if (index > -1) this.targets.splice(index, 1);
        
        target.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        this.scene.remove(target);
    }

    update(delta) {
        this.spawnTimer += delta;
        if (this.spawnTimer >= this.spawnInterval && this.targets.length < this.maxTargets) {
            this.spawnTarget();
            this.spawnTimer = 0;
            this.spawnInterval = 1.5 + Math.random() * 2;
        }

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const target = this.targets[i];
            this.updateTarget(target, delta);
            
            if (target.userData.health <= 0) {
                this.destroyTarget(target);
            }
        }
    }

    updateTarget(target, delta) {
        const playerPos = this.player.camera.position.clone();
        playerPos.y = target.position.y;
        
        const direction = new THREE.Vector3().subVectors(playerPos, target.position).normalize();
        const distance = target.position.distanceTo(playerPos);
        
        if (distance > 2) {
            target.position.addScaledVector(direction, target.userData.speed * delta);
        }
        
        target.lookAt(playerPos);
        
        target.userData.eyes.forEach(eye => {
            eye.lookAt(this.player.camera.position);
        });
        
        const body = target.children[0];
        if (body) {
            body.rotation.y += delta * 2;
        }
    }

    clearAll() {
        for (const target of this.targets) {
            this.destroyTarget(target);
        }
        this.targets = [];
    }

    getTargets() {
        return this.targets;
    }
}
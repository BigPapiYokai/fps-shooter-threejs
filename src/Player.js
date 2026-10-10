import * as THREE from 'three';

export class Player {
    constructor(camera, scene, hitboxSystem) {
        this.camera = camera;
        this.scene = scene;
        this.hitboxSystem = hitboxSystem;
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 8;
        this.sprintMultiplier = 1.8;
        this.jumpForce = 12;
        this.gravity = 28;
        this.terminalVelocity = 40;
        
        this.health = 100;
        this.maxHealth = 100;
        this.ammo = 30;
        this.maxAmmo = 30;
        this.score = 0;
        this.isAlive = true;
        
        this.yaw = 0;
        this.pitch = 0;
        this.mouseSensitivity = 0.002;
        
        this.keys = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false };
        this.canJump = false;
        
        this.gun = this.createGun();
        this.camera.add(this.gun);
        this.gun.position.set(0.3, -0.3, -0.5);
        
        this.setupControls();
        this.createHitboxes();
    }

    createGun() {
        const group = new THREE.Group();
        
        const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 12);
        const barrel = new THREE.Mesh(barrelGeo, bodyMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.5;
        group.add(barrel);
        
        const handleGeo = new THREE.BoxGeometry(0.08, 0.25, 0.08);
        const handle = new THREE.Mesh(handleGeo, bodyMat);
        handle.position.set(0, -0.25, 0.1);
        group.add(handle);
        
        this.muzzleFlash = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0 })
        );
        this.muzzleFlash.position.z = -0.7;
        group.add(this.muzzleFlash);
        
        return group;
    }

    createHitboxes() {
        const bodyHitbox = this.hitboxSystem.createBodyHitbox(0.6, 1.7, 0.4);
        bodyHitbox.name = 'body';
        bodyHitbox.position.set(0, 0.85, 0);
        this.camera.add(bodyHitbox);
        
        const headHitbox = this.hitboxSystem.createHeadHitbox(0.25);
        headHitbox.name = 'head';
        headHitbox.position.set(0, 1.6, 0);
        this.camera.add(headHitbox);
        
        this.hitboxSystem.register(this.camera, {
            meshes: [bodyHitbox, headHitbox],
            multipliers: { head: 2.5, body: 1.0 },
            defaultMultiplier: 1.0,
            onHit: (damage, multiplier, part) => this.takeDamage(damage, multiplier, part)
        });
    }

    setupControls() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onKeyDown(e) {
        if (!this.isAlive) return;
        switch(e.code) {
            case 'KeyW': this.keys.forward = true; break;
            case 'KeyS': this.keys.backward = true; break;
            case 'KeyA': this.keys.left = true; break;
            case 'KeyD': this.keys.right = true; break;
            case 'Space': this.keys.jump = true; break;
            case 'ShiftLeft': this.keys.sprint = true; break;
            case 'KeyR': this.reload(); break;
        }
    }

    onKeyUp(e) {
        switch(e.code) {
            case 'KeyW': this.keys.forward = false; break;
            case 'KeyS': this.keys.backward = false; break;
            case 'KeyA': this.keys.left = false; break;
            case 'KeyD': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'ShiftLeft': this.keys.sprint = false; break;
        }
    }

    onMouseMove(e) {
        if (document.pointerLockElement !== document.body) return;
        this.yaw -= e.movementX * this.mouseSensitivity;
        this.pitch -= e.movementY * this.mouseSensitivity;
        this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch));
    }

    onMouseDown(e) {
        if (e.button === 0 && this.isAlive) {
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            } else {
                this.shoot();
            }
        }
    }

    shoot() {
        if (this.ammo <= 0) {
            this.playEmptySound();
            return;
        }
        
        this.ammo--;
        this.updateAmmoUI();
        this.animateMuzzleFlash();
        this.playShootSound();
        
        const origin = this.camera.getWorldPosition(new THREE.Vector3());
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        
        return { origin, direction };
    }

    animateMuzzleFlash() {
        this.muzzleFlash.material.opacity = 1;
        this.muzzleFlash.scale.setScalar(1);
        this.gun.rotation.x = -0.1;
        
        setTimeout(() => {
            this.muzzleFlash.material.opacity = 0;
            this.gun.rotation.x = 0;
        }, 50);
    }

    reload() {
        if (this.ammo < this.maxAmmo) {
            this.ammo = this.maxAmmo;
            this.updateAmmoUI();
            this.playReloadSound();
        }
    }

    takeDamage(damage, multiplier, hitPart) {
        if (!this.isAlive) return;
        const actualDamage = Math.floor(damage * multiplier);
        this.health = Math.max(0, this.health - actualDamage);
        this.updateHealthUI();
        this.showDamageIndicator();
        
        if (this.health <= 0) {
            this.die();
        }
    }

    showDamageIndicator() {
        const indicator = document.getElementById('damage-indicator');
        indicator.classList.add('active');
        setTimeout(() => indicator.classList.remove('active'), 150);
    }

    die() {
        this.isAlive = false;
        document.exitPointerLock();
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('final-score').textContent = `Final Score: ${this.score}`;
    }

    respawn() {
        this.health = this.maxHealth;
        this.ammo = this.maxAmmo;
        this.score = 0;
        this.isAlive = true;
        this.camera.position.set(0, 1.7, 10);
        this.velocity.set(0, 0, 0);
        this.updateHealthUI();
        this.updateAmmoUI();
        this.updateScoreUI();
    }

    update(delta, walls) {
        if (!this.isAlive) return;

        const speed = this.moveSpeed * (this.keys.sprint ? this.sprintMultiplier : 1);
        
        this.direction.z = Number(this.keys.forward) - Number(this.keys.backward);
        this.direction.x = Number(this.keys.right) - Number(this.keys.left);
        this.direction.normalize();
        
        if (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) {
            const moveDir = new THREE.Vector3();
            this.camera.getWorldDirection(moveDir);
            moveDir.y = 0;
            moveDir.normalize();
            
            const right = new THREE.Vector3().crossVectors(moveDir, new THREE.Vector3(0, 1, 0));
            
            const forwardMove = moveDir.clone().multiplyScalar(-this.direction.z * speed * delta);
            const rightMove = right.clone().multiplyScalar(this.direction.x * speed * delta);
            
            this.velocity.x += forwardMove.x + rightMove.x;
            this.velocity.z += forwardMove.z + rightMove.z;
        } else {
            this.velocity.x *= 0.9;
            this.velocity.z *= 0.9;
        }

        this.velocity.y -= this.gravity * delta;
        this.velocity.y = Math.max(this.velocity.y, -this.terminalVelocity);

        this.checkCollisions(walls, delta);

        this.camera.position.addScaledVector(this.velocity, delta);
        this.camera.position.y = Math.max(this.camera.position.y, 1.7);

        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

        this.animateGun(delta);
    }

    checkCollisions(walls, delta) {
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            this.camera.position.clone().add(new THREE.Vector3(0, 0.85, 0)),
            new THREE.Vector3(0.6, 1.7, 0.6)
        );

        const futurePos = this.camera.position.clone().addScaledVector(this.velocity, delta);
        const futureBox = new THREE.Box3().setFromCenterAndSize(
            futurePos.clone().add(new THREE.Vector3(0, 0.85, 0)),
            new THREE.Vector3(0.6, 1.7, 0.6)
        );

        for (const wall of walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            
            if (futureBox.intersectsBox(wallBox)) {
                const playerBoxTemp = playerBox.clone();
                playerBoxTemp.translate(new THREE.Vector3(this.velocity.x * delta, 0, 0));
                if (playerBoxTemp.intersectsBox(wallBox)) {
                    this.velocity.x = 0;
                }
                
                playerBoxTemp.copy(playerBox);
                playerBoxTemp.translate(new THREE.Vector3(0, 0, this.velocity.z * delta));
                if (playerBoxTemp.intersectsBox(wallBox)) {
                    this.velocity.z = 0;
                }

                playerBoxTemp.copy(playerBox);
                playerBoxTemp.translate(new THREE.Vector3(0, this.velocity.y * delta, 0));
                if (playerBoxTemp.intersectsBox(wallBox)) {
                    if (this.velocity.y < 0) {
                        this.canJump = true;
                        this.camera.position.y = wallBox.max.y + 0.85;
                    }
                    this.velocity.y = 0;
                }
            }
        }

        if (this.keys.jump && this.canJump) {
            this.velocity.y = this.jumpForce;
            this.canJump = false;
            this.playJumpSound();
        }
    }

    animateGun(delta) {
        const bobSpeed = 10;
        const bobAmount = 0.02;
        const time = Date.now() * 0.005;
        
        if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
            this.gun.position.y = -0.3 + Math.sin(time * bobSpeed) * bobAmount;
            this.gun.position.x = 0.3 + Math.sin(time * bobSpeed * 0.5) * bobAmount * 0.5;
        } else {
            this.gun.position.y = -0.3;
            this.gun.position.x = 0.3;
        }
    }

    updateHealthUI() {
        document.getElementById('health').textContent = `Health: ${this.health}`;
    }

    updateAmmoUI() {
        document.getElementById('ammo').textContent = `Ammo: ${this.ammo}/${this.maxAmmo}`;
    }

    updateScoreUI() {
        document.getElementById('score').textContent = `Score: ${this.score}`;
    }

    addScore(points) {
        this.score += points;
        this.updateScoreUI();
    }

    playShootSound() { this.playTone(200, 0.1, 'square', 0.3); }
    playEmptySound() { this.playTone(100, 0.2, 'sawtooth', 0.2); }
    playReloadSound() { this.playTone(300, 0.15, 'sine', 0.2); }
    playJumpSound() { this.playTone(400, 0.1, 'sine', 0.15); }
    playHitSound() { this.playTone(800, 0.05, 'square', 0.2); }
    playKillSound() { this.playTone(600, 0.2, 'triangle', 0.3); }

    playTone(freq, duration, type, volume) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.value = volume;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch(e) {}
    }
}
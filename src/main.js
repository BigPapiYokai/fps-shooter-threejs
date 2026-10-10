import * as THREE from 'three';
import { Player } from './Player.js';
import { TargetManager } from './Target.js';
import { HitboxSystem, HitboxVisualizer } from './Hitbox.js';
import { ParticleSystem } from './Particles.js';

class Game {
    constructor() {
        this.initThreeJS();
        this.initSystems();
        this.initEnvironment();
        this.initEventListeners();
        this.animate();
    }

    initThreeJS() {
        this.container = document.getElementById('game-container');
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.container.appendChild(this.renderer.domElement);
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a12);
        this.scene.fog = new THREE.Fog(0x0a0a12, 10, 80);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.set(0, 1.7, 10);
    }

    initSystems() {
        this.hitboxSystem = new HitboxSystem();
        this.particleSystem = new ParticleSystem(this.scene);
        this.hitboxVisualizer = new HitboxVisualizer(this.scene);
        
        this.player = new Player(this.camera, this.scene, this.hitboxSystem);
        this.targetManager = new TargetManager(this.scene, this.hitboxSystem, this.player, this.particleSystem);
        
        this.clock = new THREE.Clock();
        this.bullets = [];
        this.walls = [];
    }

    initEnvironment() {
        this.createLighting();
        this.createFloor();
        this.createWalls();
        this.createProps();
        this.spawnInitialTargets();
    }

    createLighting() {
        const ambient = new THREE.AmbientLight(0x444466, 0.5);
        this.scene.add(ambient);
        
        const sun = new THREE.DirectionalLight(0xffffee, 1.5);
        sun.position.set(20, 40, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 30;
        sun.shadow.camera.bottom = -30;
        sun.shadow.bias = -0.001;
        this.scene.add(sun);
        
        const fillLight = new THREE.DirectionalLight(0x4466ff, 0.3);
        fillLight.position.set(-20, 10, -20);
        this.scene.add(fillLight);
        
        const rimLight = new THREE.DirectionalLight(0xff4444, 0.2);
        rimLight.position.set(0, -10, 0);
        this.scene.add(rimLight);
    }

    createFloor() {
        const floorGeo = new THREE.PlaneGeometry(100, 100, 50, 50);
        const positions = floorGeo.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] = Math.sin(positions[i] * 0.2) * Math.cos(positions[i + 2] * 0.2) * 0.1;
        }
        floorGeo.computeVertexNormals();
        
        const floorMat = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a2e, 
            roughness: 0.9, 
            metalness: 0.1 
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        const gridHelper = new THREE.GridHelper(100, 50, 0x00ff88, 0x003311);
        gridHelper.material.opacity = 0.15;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    createWalls() {
        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a4a, 
            roughness: 0.7, 
            metalness: 0.2 
        });
        
        const wallPositions = [
            { pos: [0, 2.5, -25], scale: [50, 5, 1] },
            { pos: [0, 2.5, 25], scale: [50, 5, 1] },
            { pos: [-25, 2.5, 0], scale: [1, 5, 50] },
            { pos: [25, 2.5, 0], scale: [1, 5, 50] },
            { pos: [-15, 2.5, -15], scale: [5, 5, 10] },
            { pos: [15, 2.5, 15], scale: [5, 5, 10] },
            { pos: [-15, 2.5, 15], scale: [10, 5, 5] },
            { pos: [15, 2.5, -15], scale: [10, 5, 5] },
        ];
        
        for (const w of wallPositions) {
            const geo = new THREE.BoxGeometry(...w.scale);
            const wall = new THREE.Mesh(geo, wallMat);
            wall.position.set(...w.pos);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            this.walls.push(wall);
        }
    }

    createProps() {
        const propMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a3a5a, 
            roughness: 0.6, 
            metalness: 0.3 
        });
        
        for (let i = 0; i < 20; i++) {
            const type = Math.random();
            let geo, prop;
            
            if (type < 0.4) {
                geo = new THREE.BoxGeometry(
                    1 + Math.random() * 2,
                    2 + Math.random() * 3,
                    1 + Math.random() * 2
                );
            } else if (type < 0.7) {
                geo = new THREE.CylinderGeometry(
                    0.5 + Math.random() * 0.5,
                    0.5 + Math.random() * 0.5,
                    2 + Math.random() * 4,
                    8
                );
            } else {
                geo = new THREE.CapsuleGeometry(
                    0.4 + Math.random() * 0.3,
                    1 + Math.random() * 2,
                    8, 16
                );
            }
            
            prop = new THREE.Mesh(geo, propMat);
            prop.position.set(
                (Math.random() - 0.5) * 40,
                geo.parameters.height ? geo.parameters.height / 2 : 1,
                (Math.random() - 0.5) * 40
            );
            prop.castShadow = true;
            prop.receiveShadow = true;
            this.scene.add(prop);
            this.walls.push(prop);
        }
    }

    spawnInitialTargets() {
        for (let i = 0; i < 8; i++) {
            setTimeout(() => this.targetManager.spawnTarget(), i * 300);
        }
    }

    initEventListeners() {
        window.addEventListener('resize', () => this.onResize());
        
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        
        document.body.addEventListener('click', () => {
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            }
        });
    }

    startGame() {
        document.getElementById('menu').classList.add('hidden');
        document.body.requestPointerLock();
    }

    restartGame() {
        document.getElementById('game-over').classList.add('hidden');
        this.targetManager.clearAll();
        this.particleSystem.clear();
        this.player.respawn();
        this.spawnInitialTargets();
        document.body.requestPointerLock();
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    handleShooting() {
        const shot = this.player.shoot();
        if (!shot) return;
        
        const hit = this.hitboxSystem.raycast(shot.origin, shot.direction);
        
        if (hit) {
            const endPos = new THREE.Vector3().addVectors(shot.origin, shot.direction.clone().multiplyScalar(hit.distance));
            this.particleSystem.createBulletTrail(shot.origin, endPos);
            this.hitboxVisualizer.showHit(hit.point, hit.face.normal, hit.multiplier > 1 ? 0xffff00 : 0xff4444);
            
            if (hit.hitboxData.onHit) {
                hit.hitboxData.onHit(25, hit.multiplier, hit.meshName);
            }
        } else {
            const endPos = new THREE.Vector3().addVectors(shot.origin, shot.direction.clone().multiplyScalar(100));
            this.particleSystem.createBulletTrail(shot.origin, endPos);
        }
        
        this.particleSystem.createMuzzleFlash(shot.origin, shot.direction);
    }

    animate() {
        const delta = Math.min(this.clock.getDelta(), 0.1);
        
        this.player.update(delta, this.walls);
        this.targetManager.update(delta);
        this.particleSystem.update(delta);
        this.hitboxVisualizer.update(delta);
        
        this.renderer.render(this.scene, this.camera);
        
        requestAnimationFrame(() => this.animate());
    }
}

new Game();
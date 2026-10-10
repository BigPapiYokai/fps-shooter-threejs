import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.hitMarkers = [];
    }

    createHitEffect(position, color) {
        const count = 8;
        for (let i = 0; i < count; i++) {
            const geometry = new THREE.SphereGeometry(0.05, 6, 6);
            const material = new THREE.MeshBasicMaterial({ 
                color, 
                transparent: true, 
                opacity: 1 
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 5 + 2,
                (Math.random() - 0.5) * 10
            );
            
            this.particles.push({
                mesh: particle,
                velocity,
                life: 1.0,
                decay: 0.5 + Math.random() * 0.5
            });
            this.scene.add(particle);
        }
        
        this.createHitRing(position, color);
    }

    createHitRing(position, color) {
        const geometry = new THREE.RingGeometry(0.1, 0.3, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.position.copy(position);
        ring.lookAt(new THREE.Vector3().addVectors(position, new THREE.Vector3(0, 1, 0)));
        
        this.particles.push({
            mesh: ring,
            velocity: new THREE.Vector3(),
            life: 0.5,
            decay: 2,
            isRing: true
        });
        this.scene.add(ring);
    }

    createExplosion(position, color, size = 1) {
        const count = 30 * size;
        for (let i = 0; i < count; i++) {
            const geometry = new THREE.SphereGeometry(0.08 * size, 8, 8);
            const material = new THREE.MeshBasicMaterial({ 
                color, 
                transparent: true, 
                opacity: 1 
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            const speed = 5 + Math.random() * 15 * size;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                Math.random() * speed,
                (Math.random() - 0.5) * speed
            );
            
            this.particles.push({
                mesh: particle,
                velocity,
                life: 1.5,
                decay: 0.3 + Math.random() * 0.4,
                gravity: true
            });
            this.scene.add(particle);
        }
        
        for (let i = 0; i < 3; i++) {
            const geometry = new THREE.RingGeometry(0.2 * size, 1 * size, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color, 
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.6
            });
            const ring = new THREE.Mesh(geometry, material);
            ring.position.copy(position);
            ring.rotation.x = Math.random() * Math.PI;
            ring.rotation.y = Math.random() * Math.PI;
            ring.rotation.z = Math.random() * Math.PI;
            
            this.particles.push({
                mesh: ring,
                velocity: new THREE.Vector3(),
                life: 1,
                decay: 1,
                isRing: true,
                expandRate: 2 * size
            });
            this.scene.add(ring);
        }
    }

    createBulletTrail(start, end) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array([start.x, start.y, start.z, end.x, end.y, end.z]);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({ 
            color: 0xffff00, 
            transparent: true, 
            opacity: 0.8 
        });
        const line = new THREE.Line(geometry, material);
        
        this.particles.push({
            mesh: line,
            velocity: new THREE.Vector3(),
            life: 0.1,
            decay: 10,
            isTrail: true
        });
        this.scene.add(line);
    }

    createMuzzleFlash(position, direction) {
        const geometry = new THREE.ConeGeometry(0.1, 0.3, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffff88, 
            transparent: true, 
            opacity: 1,
            side: THREE.DoubleSide
        });
        const flash = new THREE.Mesh(geometry, material);
        flash.position.copy(position);
        flash.lookAt(new THREE.Vector3().addVectors(position, direction));
        flash.rotateX(Math.PI / 2);
        
        this.particles.push({
            mesh: flash,
            velocity: direction.clone().multiplyScalar(5),
            life: 0.05,
            decay: 20
        });
        this.scene.add(flash);
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta * p.decay;
            
            if (p.mesh && p.velocity) {
                if (p.gravity) {
                    p.velocity.y -= 20 * delta;
                }
                p.mesh.position.addScaledVector(p.velocity, delta);
            }
            
            if (p.isRing && p.expandRate) {
                p.mesh.scale.multiplyScalar(1 + delta * p.expandRate);
            }
            
            if (p.mesh.material) {
                p.mesh.material.opacity = Math.max(0, p.life);
            }
            
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) {
                    if (Array.isArray(p.mesh.material)) {
                        p.mesh.material.forEach(m => m.dispose());
                    } else {
                        p.mesh.material.dispose();
                    }
                }
                this.particles.splice(i, 1);
            }
        }
    }

    clear() {
        for (const p of this.particles) {
            this.scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) {
                if (Array.isArray(p.mesh.material)) {
                    p.mesh.material.forEach(m => m.dispose());
                } else {
                    p.mesh.material.dispose();
                }
            }
        }
        this.particles = [];
    }
}
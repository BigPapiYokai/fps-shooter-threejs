import * as THREE from 'three';

export class HitboxSystem {
    constructor() {
        this.hitboxes = new Map();
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 200;
    }

    register(object, hitboxData) {
        this.hitboxes.set(object.uuid, {
            object,
            meshes: hitboxData.meshes || [object],
            multipliers: hitboxData.multipliers || {},
            defaultMultiplier: hitboxData.defaultMultiplier || 1.0,
            onHit: hitboxData.onHit || null
        });
    }

    unregister(object) {
        this.hitboxes.delete(object.uuid);
    }

    raycast(origin, direction) {
        this.raycaster.set(origin, direction);
        
        let closestHit = null;
        let closestDistance = Infinity;

        for (const [uuid, data] of this.hitboxes) {
            if (!data.object.visible) continue;

            for (let i = 0; i < data.meshes.length; i++) {
                const mesh = data.meshes[i];
                if (!mesh.visible) continue;

                const intersects = this.raycaster.intersectObject(mesh, true);
                
                if (intersects.length > 0) {
                    const hit = intersects[0];
                    if (hit.distance < closestDistance) {
                        closestDistance = hit.distance;
                        const multiplier = data.multipliers[mesh.name] || data.defaultMultiplier;
                        closestHit = {
                            ...hit,
                            hitboxData: data,
                            multiplier,
                            meshName: mesh.name,
                            hitboxUuid: uuid
                        };
                    }
                }
            }
        }

        return closestHit;
    }

    createHeadHitbox(size = 0.3) {
        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
            visible: false,
            side: THREE.DoubleSide 
        });
        return new THREE.Mesh(geometry, material);
    }

    createBodyHitbox(width = 0.5, height = 1.0, depth = 0.3) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshBasicMaterial({ 
            visible: false,
            side: THREE.DoubleSide 
        });
        return new THREE.Mesh(geometry, material);
    }

    createLimbHitbox(radius = 0.12, height = 0.6) {
        const geometry = new THREE.CapsuleGeometry(radius, height, 8, 16);
        const material = new THREE.MeshBasicMaterial({ 
            visible: false,
            side: THREE.DoubleSide 
        });
        return new THREE.Mesh(geometry, material);
    }

    debugDraw(scene) {
        this.debugMeshes = [];
        for (const [uuid, data] of this.hitboxes) {
            for (const mesh of data.meshes) {
                const box = new THREE.Box3().setFromObject(mesh);
                const helper = new THREE.Box3Helper(box, 0xff0000);
                scene.add(helper);
                this.debugMeshes.push(helper);
            }
        }
    }

    clearDebug(scene) {
        if (this.debugMeshes) {
            for (const mesh of this.debugMeshes) {
                scene.remove(mesh);
            }
            this.debugMeshes = [];
        }
    }
}

export class HitboxVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.markers = [];
    }

    showHit(position, normal, color = 0xff4444) {
        const geometry = new THREE.RingGeometry(0.05, 0.15, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        marker.lookAt(new THREE.Vector3().addVectors(position, normal));
        this.scene.add(marker);
        this.markers.push({ mesh: marker, life: 1.0 });
    }

    update(delta) {
        for (let i = this.markers.length - 1; i >= 0; i--) {
            const m = this.markers[i];
            m.life -= delta * 2;
            m.mesh.material.opacity = m.life * 0.8;
            m.mesh.scale.multiplyScalar(1 + delta * 2);
            
            if (m.life <= 0) {
                this.scene.remove(m.mesh);
                m.mesh.geometry.dispose();
                m.mesh.material.dispose();
                this.markers.splice(i, 1);
            }
        }
    }

    clear() {
        for (const m of this.markers) {
            this.scene.remove(m.mesh);
            m.mesh.geometry.dispose();
            m.mesh.material.dispose();
        }
        this.markers = [];
    }
}
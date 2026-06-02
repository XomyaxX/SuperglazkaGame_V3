// scrollshoter_game.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { floorVertexShader, floorFragmentShader } from './scrollshoter_shaders.js';

export class GameRunner {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        
        this.scene.background = new THREE.Color(0x110522); 
        this.scene.fog = new THREE.Fog(0x110522, 35, 150);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 12);
        this.camera.lookAt(0, 1, -5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace; 
        this.container.appendChild(this.renderer.domElement);

        this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xff00ff, 0.8);
        dirLight.position.set(5, 20, 10);
        this.scene.add(dirLight);

        // --- КЭШИРОВАНИЕ И ЗАГРУЗКА ИЗ LOCALSTORAGE ---
        const savedWave = localStorage.getItem('scrollshoter_wave');
        const savedUnlocked = localStorage.getItem('scrollshoter_unlocked_wave');
        const savedShooters = localStorage.getItem('scrollshoter_shooters');
        const savedFireRate = localStorage.getItem('scrollshoter_firerate');

        this.state = {
            hp: 100, 
            shooters: savedShooters ? parseInt(savedShooters, 10) : 1, 
            fireRate: savedFireRate ? parseFloat(savedFireRate) : 1.0, 
            isGameOver: false,
            isLevelWon: false, // Флаг для полной остановки игры при победе
            wave: savedWave ? parseInt(savedWave, 10) : 1, 
            unlockedWave: savedUnlocked ? parseInt(savedUnlocked, 10) : 1,
            waveTime: 0, 
            bossSpawnTime: 25, 
            bossSpawned: false
        };

        this.bullets = [];
        this.enemies = [];
        this.panels = [];

        this.lastShotTime = 0;
        this.lastEnemySpawn = 0;
        this.lastPanelSpawn = 0;

        // --- ОПТИМИЗАЦИЯ: ПУЛ ГЕОМЕТРИИ И МАТЕРИАЛОВ (Создаются 1 раз) ---
        this.bulletGeo = new THREE.BoxGeometry(0.1, 0.1, 0.6);
        this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.enemyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        this.bossGeo = new THREE.BoxGeometry(3.0, 3.0, 3.0);
        this.panelGeo = new THREE.BoxGeometry(2.2, 1.5, 0.1);
        this.playerUnitGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        this.playerMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x005555, roughness: 0.2 });

        this.setupNeonEnvironment();
        this.setupPlayer();
        this.setupControls();

        this.clock = new THREE.Clock();
        this._boundResize = () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', this._boundResize);
        
        this.animate();
    }

    get difficultyMultiplier() {
        return 1 + (this.state.wave - 1) * 0.4; 
    }

    setupNeonEnvironment() {
        const floorGeo = new THREE.PlaneGeometry(500, 500);
        this.floorUniforms = {
            time: { value: 0.0 },
            color: { value: new THREE.Color(0xff00ff) }
        };
        const floorMat = new THREE.ShaderMaterial({
            uniforms: this.floorUniforms,
            vertexShader: floorVertexShader,
            fragmentShader: floorFragmentShader
        });
        const backgroundFloor = new THREE.Mesh(floorGeo, floorMat);
        backgroundFloor.rotation.x = -Math.PI / 2;
        backgroundFloor.position.y = -0.1;
        this.scene.add(backgroundFloor);

        const laneWidth = 2.4;
        const laneGeo = new THREE.PlaneGeometry(laneWidth - 0.1, 100);
        const laneMat = new THREE.MeshBasicMaterial({ color: 0x050011, transparent: true, opacity: 0.85, depthWrite: false });
        
        const centers = [-2.4, 0, 2.4]; 
        centers.forEach(x => {
            const mesh = new THREE.Mesh(laneGeo, laneMat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, 0, -30);
            this.scene.add(mesh);
        });

        const wallGeo = new THREE.BoxGeometry(0.15, 0.8, 70);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x220044, transparent: true, opacity: 0.5, emissive: 0x110022 });
        
        const wall1 = new THREE.Mesh(wallGeo, wallMat);
        wall1.position.set(-1.2, 0.4, -20);
        
        const wall2 = new THREE.Mesh(wallGeo, wallMat);
        wall2.position.set(1.2, 0.4, -20);
        
        this.scene.add(wall1, wall2);

        const borderGeo = new THREE.PlaneGeometry(0.08, 100);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const borders = [-3.6, 3.6]; 
        borders.forEach(x => {
            const mesh = new THREE.Mesh(borderGeo, borderMat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, 0.01, -30);
            this.scene.add(mesh);
        });
    }

    setupPlayer() {
        this.playerGroup = new THREE.Group();
        this.playerGroup.position.set(0, 0, 4); 
        this.scene.add(this.playerGroup);
        this.updatePlayerVisuals();
    }

    updatePlayerVisuals() {
        while(this.playerGroup.children.length > 0) {
            this.playerGroup.remove(this.playerGroup.children[0]);
        }
        const count = Math.min(this.state.shooters, 15);
        for(let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.playerUnitGeo, this.playerMat);
            if (i === 0) {
                mesh.position.set(0, 0.25, 0); 
            } else {
                const row = Math.floor((i - 1) / 3); 
                const col = (i - 1) % 3;             
                mesh.position.x = (col - 1) * 0.7;   
                mesh.position.z = (row + 1) * 0.6;   
                mesh.position.y = 0.25;
            }
            this.playerGroup.add(mesh);
        }
    }

    setupControls() {
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        const onPointerMove = (event) => {
            if(this.state.isGameOver || this.state.isLevelWon) return;
            let clientX = event.clientX || (event.touches && event.touches[0].clientX);
            let clientY = event.clientY || (event.touches && event.touches[0].clientY);
            if (clientX === undefined) return;

            this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = - (clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const target = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.plane, target);
            
            if (target) {
                this.playerGroup.position.x = THREE.MathUtils.clamp(target.x, -3.2, 3.2);
            }
        };

        this._boundPointerMove = onPointerMove;
        window.addEventListener('mousemove', this._boundPointerMove);
        window.addEventListener('touchmove', this._boundPointerMove, {passive: false});
    }

    destroy() {
        this.state.isGameOver = true;
        this.state.isLevelWon = true;
        if (this._boundResize) window.removeEventListener('resize', this._boundResize);
        if (this._boundPointerMove) {
            window.removeEventListener('mousemove', this._boundPointerMove);
            window.removeEventListener('touchmove', this._boundPointerMove);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    // --- ОПТИМИЗАЦИЯ: Динамическое обновление текстуры холста БЕЗ ПЕРЕСОЗДАНИЯ ---
    setupPanelLabel(panel, text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 256; 
        const ctx = canvas.getContext('2d');
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace; 
        texture.anisotropy = this.maxAnisotropy;    
        
        panel.material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.9 });
        panel.userData.canvas = canvas;
        panel.userData.ctx = ctx;
        panel.userData.texture = texture;

        this.updatePanelLabelText(panel, text, color);
    }

    updatePanelLabelText(panel, text, color) {
        const { canvas, ctx, texture } = panel.userData;
        ctx.fillStyle = 'rgba(10, 0, 20, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 12; 
        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

        ctx.fillStyle = color;
        ctx.font = 'bold 75px sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        texture.needsUpdate = true; // Триггерим апдейт на GPU вместо пересоздания текстуры
    }

    setupHPLabel(enemy, hp) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 128; 
        const ctx = canvas.getContext('2d');
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.maxAnisotropy;

        const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
        const geo = new THREE.PlaneGeometry(1.0, 0.5);
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.userData = { canvas, ctx, texture };
        this.updateHPLabelText(mesh, hp);
        return mesh;
    }

    updateHPLabelText(mesh, hp) {
        const { canvas, ctx, texture } = mesh.userData;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hp.toString(), canvas.width / 2, canvas.height / 2);
        texture.needsUpdate = true;
    }

    spawnPanel() {
        const isLeft = Math.random() > 0.5;
        const laneX = isLeft ? -2.4 : 2.4; 
        const type = isLeft ? 'shooters' : 'firerate';
        
        let waveBonus = Math.floor(this.state.wave / 2);
        let value = isLeft ? (Math.random() > 0.7 ? 2 : 1) + waveBonus : 0.2 + (waveBonus * 0.1);
        
        const text = type === 'shooters' ? `+${Math.floor(value)}` : `×${(1 + value).toFixed(1)}`;
        const color = type === 'shooters' ? '#00ff88' : '#ffaa00';

        const panel = new THREE.Mesh(this.panelGeo, null);
        panel.position.set(laneX, 0.75, -50);
        panel.userData = { type, value, textTemplate: type === 'shooters' ? '+' : '×' };
        
        this.setupPanelLabel(panel, text, color);
        
        this.scene.add(panel);
        this.panels.push(panel);
    }

    spawnEnemy(isBoss = false) {
        const size = isBoss ? 3.0 : 0.8;
        
        // --- БАЛАНС: Скейл ХП босса ТОЛЬКО от текущей волны (без учета юнитов) ---
        let baseHp = isBoss ? 50 + (this.state.wave * 12) : Math.floor(Math.random() * 2) + 1;
        const hp = Math.max(1, Math.floor(baseHp * this.difficultyMultiplier));
        
        const color = isBoss ? 0xff0055 : 0xff00ff;
        const geo = isBoss ? this.bossGeo : this.enemyGeo;
        const mat = new THREE.MeshStandardMaterial({ color, emissive: isBoss ? 0x550000 : 0x330033, roughness: 0.1 });
        const enemy = new THREE.Mesh(geo, mat);

        const offsetX = isBoss ? 0 : (Math.random() - 0.5) * 1.6;
        enemy.position.set(offsetX, size / 2, -50);
        enemy.userData = { hp, maxHp: hp, isBoss };

        if (!isBoss) {
            const hpMesh = this.setupHPLabel(enemy, hp);
            hpMesh.position.set(0, size / 2 + 0.5, 0);
            enemy.add(hpMesh);
            enemy.userData.hpMesh = hpMesh;
        } else {
            document.getElementById('boss-hud').style.display = 'block';
            document.getElementById('boss-hp-bar').style.width = '100%';
            document.getElementById('boss-title').innerText = `КРИТИЧЕСКАЯ УГРОЗА: УРОВЕНЬ ${this.state.wave}`;
        }

        this.scene.add(enemy);
        this.enemies.push(enemy);
    }

    // --- МЕХАНИКА: Остановка игры и вывод меню выбора уровней ---
    levelWin() {
        this.state.isLevelWon = true; 
        document.getElementById('boss-hud').style.display = 'none';

        const nextWave = this.state.wave + 1;
        if (nextWave > this.state.unlockedWave) {
            this.state.unlockedWave = nextWave;
            localStorage.setItem('scrollshoter_unlocked_wave', this.state.unlockedWave);
        }

        // КЭШИРОВАНИЕ: Сохранение происходит строго в момент победы
        localStorage.setItem('scrollshoter_wave', nextWave);
        localStorage.setItem('scrollshoter_shooters', this.state.shooters);
        localStorage.setItem('scrollshoter_firerate', this.state.fireRate);

        const flash = document.getElementById('wave-clear-flash');
        
        let buttonsHTML = '';
        for (let i = 1; i <= this.state.unlockedWave; i++) {
            const isCurrent = i === nextWave;
            const btnColor = isCurrent ? '#00ff88' : '#00ffff';
            buttonsHTML += `<button class="menu-level-btn" data-level="${i}" style="
                background: rgba(20, 0, 40, 0.8); border: 2px solid ${btnColor}; color: ${btnColor}; 
                padding: 10px 20px; font-size: 18px; font-weight: bold; cursor: pointer;
                margin: 5px; border-radius: 5px; text-transform: uppercase; transition: 0.2s; pointer-events: auto;
            ">Уровень ${i}</button>`;
        }

        flash.innerHTML = `
            <div style="background: rgba(10, 0, 20, 0.95); padding: 30px; border-radius: 15px; border: 2px solid #00ff88; box-shadow: 0 0 30px #00ff88; text-align: center;">
                <div style="font-size: 36px; color: #00ff88; text-shadow: 0 0 15px #00ff88; margin-bottom: 15px;">УРОВЕНЬ ${this.state.wave} ПРОЙДЕН!</div>
                <div style="font-size: 18px; color: #ffffff; margin-bottom: 25px;">Прогресс сохранен в кэш.<br>Выберите уровень для игры:</div>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; max-width: 500px; margin: 0 auto;">
                    ${buttonsHTML}
                </div>
            </div>
        `;
        
        flash.style.pointerEvents = 'auto';
        flash.style.display = 'block';

        document.querySelectorAll('.menu-level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetLevel = e.target.getAttribute('data-level');
                localStorage.setItem('scrollshoter_wave', targetLevel);
                if (typeof window.scrollShooterRestart === 'function') {
                    window.scrollShooterRestart(targetLevel);
                } else {
                    location.reload();
                }
            });
        });
    }

    shoot() {
        const count = Math.min(this.state.shooters, 6);
        for(let i=0; i < count; i++) {
            const bullet = new THREE.Mesh(this.bulletGeo, this.bulletMat);
            const offsetX = (i - count / 2 + 0.5) * 0.35;
            
            bullet.position.copy(this.playerGroup.position);
            bullet.position.x += offsetX;
            bullet.position.y = 0.3;
            bullet.position.z -= 0.5;
            
            this.scene.add(bullet);
            this.bullets.push(bullet);
        }
    }

    updateUI() {
        document.getElementById('wave-display').innerText = `УРОВЕНЬ: ${this.state.wave}`;
        document.getElementById('hp-display').innerText = `Здоровье базы: ${Math.max(0, this.state.hp)}`;
        document.getElementById('shooters-display').innerText = `Стрелки: ${Math.floor(this.state.shooters)}`;
        document.getElementById('firerate-display').innerText = `Скорость стрельбы: ${this.state.fireRate.toFixed(1)}x`;
        
        const timeLeft = Math.max(0, this.state.bossSpawnTime - this.state.waveTime);
        document.getElementById('time-display').innerText = this.state.bossSpawned ? "БОСС НА ПОЛЕ!" : `До Босса: ${Math.ceil(timeLeft)} сек`;
    }

    gameOver() {
        this.state.isGameOver = true;
        document.getElementById('boss-hud').style.display = 'none';
        document.getElementById('game-over').style.display = 'block';
        document.getElementById('final-wave').innerText = `База пала на ${this.state.wave} уровне`;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.state.isGameOver || this.state.isLevelWon) return;

        const dt = this.clock.getDelta();
        this.state.waveTime += dt;
        
        if (this.floorUniforms) {
            this.floorUniforms.time.value += dt;
        }

        if (!this.state.bossSpawned && this.state.waveTime > this.state.bossSpawnTime) {
            this.state.bossSpawned = true;
            this.spawnEnemy(true);
        }
        
        if (!this.state.bossSpawned && this.state.waveTime - this.lastEnemySpawn > Math.max(0.4, 1.2 - (this.state.wave * 0.05))) {
            this.spawnEnemy();
            this.lastEnemySpawn = this.state.waveTime;
        }
        
        if (this.state.waveTime - this.lastPanelSpawn > 3.0) {
            this.spawnPanel();
            this.lastPanelSpawn = this.state.waveTime;
        }

        const fireDelay = 0.4 / this.state.fireRate;
        if (this.state.waveTime - this.lastShotTime > fireDelay) {
            this.shoot();
            this.lastShotTime = this.state.waveTime;
        }

        const gameSpeed = 14 + (this.state.wave * 1.5);

        // 1. ДВИЖЕНИЕ ВРАГОВ С ОЧИСТКОЙ ПАМЯТИ
        for (let j = this.enemies.length - 1; j >= 0; j--) {
            let e = this.enemies[j];
            let currentSpeed = e.userData.isBoss ? gameSpeed * 0.15 : gameSpeed;
            e.position.z += currentSpeed * dt;

            if (e.position.z > 6) {
                if (e.userData.isBoss) {
                    this.state.hp = 0;
                    this.updateUI();
                    this.gameOver();
                    this.scene.remove(e);
                    this.enemies.splice(j, 1);
                    return;
                } else {
                    this.state.hp -= 10;
                    this.scene.remove(e);
                    if (e.userData.hpMesh) {
                        e.userData.hpMesh.material.map.dispose();
                        e.userData.hpMesh.material.dispose();
                        this.scene.remove(e.userData.hpMesh);
                    }
                    e.material.dispose();
                    this.enemies.splice(j, 1);

                    if (this.state.hp <= 0) {
                        this.gameOver();
                        return;
                    }
                }
                continue;
            }
        }

        // 2. ДВИЖЕНИЕ ВОРОТ С ОЧИСТКОЙ ПАМЯТИ
        for (let pIdx = this.panels.length - 1; pIdx >= 0; pIdx--) {
            let p = this.panels[pIdx];
            p.position.z += gameSpeed * dt;

            if (Math.abs(p.position.z - this.playerGroup.position.z) < 0.8 && Math.abs(p.position.x - this.playerGroup.position.x) < 1.5) {
                if (p.userData.type === 'shooters') {
                    this.state.shooters += Math.floor(p.userData.value);
                    this.updatePlayerVisuals();
                } else if (p.userData.type === 'firerate') {
                    this.state.fireRate += p.userData.value * 0.5;
                }
                
                this.scene.remove(p);
                p.material.map.dispose();
                p.material.dispose();
                this.panels.splice(pIdx, 1);
                continue;
            }

            if (p.position.z > 8) {
                this.scene.remove(p);
                p.material.map.dispose();
                p.material.dispose();
                this.panels.splice(pIdx, 1);
            }
        }

        // 3. ПОЛЕТ ПУЛЬ И УДАЛЕНИЕ ЗА ГРАНИЦАМИ ЭКРАНА
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let b = this.bullets[i];
            b.position.z -= 35 * dt;

            // --- ИСПРАВЛЕНИЕ УТЕЧКИ: удаляем улетевшие пули из сцены ---
            if (b.position.z < -60) {
                this.scene.remove(b);
                this.bullets.splice(i, 1);
                continue;
            }

            let hit = false;

            for (let j = this.enemies.length - 1; j >= 0; j--) {
                let e = this.enemies[j];
                let hitDist = e.userData.isBoss ? 2.0 : 0.7;
                
                if (b.position.distanceTo(e.position) < hitDist) {
                    e.userData.hp -= 2; 
                    hit = true;

                    this.scene.remove(b);
                    this.bullets.splice(i, 1);

                    if (e.userData.hp <= 0) {
                        this.scene.remove(e);
                        if (e.userData.hpMesh) {
                            e.userData.hpMesh.material.map.dispose();
                            e.userData.hpMesh.material.dispose();
                        }
                        e.material.dispose();
                        this.enemies.splice(j, 1);
                        
                        if (e.userData.isBoss) {
                            this.levelWin();
                        }
                    } else {
                        if (!e.userData.isBoss) {
                            this.updateHPLabelText(e.userData.hpMesh, e.userData.hp);
                        } else {
                            const pct = (e.userData.hp / e.userData.maxHp) * 100;
                            document.getElementById('boss-hp-bar').style.width = pct + '%';
                        }
                    }
                    break;
                }
            }

            if (!hit) {
                for (let pIdx = this.panels.length - 1; pIdx >= 0; pIdx--) {
                    let p = this.panels[pIdx];
                    if (b.position.distanceTo(p.position) < 1.4) {
                        hit = true;
                        const isMult = p.userData.type === 'firerate';
                        p.userData.value += (isMult ? 0.05 : 0.5) * this.difficultyMultiplier;
                        
                        const newColor = isMult ? '#ffaa00' : '#00ff88';
                        const formattedVal = isMult ? (1 + p.userData.value).toFixed(1) : Math.floor(p.userData.value);
                        const newText = `${p.userData.textTemplate}${formattedVal}`;
                        
                        this.updatePanelLabelText(p, newText, newColor);

                        this.scene.remove(b);
                        this.bullets.splice(i, 1);
                        break;
                    }
                }
            }
        }

        this.updateUI();
        this.renderer.render(this.scene, this.camera);
    }
}
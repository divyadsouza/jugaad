/* ==========================================================================
   Jugaad Runner — Complete Game Engine
   Pure HTML5 Canvas, no libraries
   ========================================================================== */

(function () {
    "use strict";

    // ── Constants ──────────────────────────────────────────────────────
    const CANVAS_W = 900;
    const CANVAS_H = 500;
    const GROUND_Y = 400;
    const GRAVITY = 0.6;
    const JUMP_FORCE = -13;
    const MAX_SPEED = 12;
    const BASE_SPEED = 4;
    const SPEED_RAMP = 0.0003; // speed increase per distance unit

    // ── Environmental Facts ───────────────────────────────────────────
    const ECO_FACTS = [
        "8 million tons of plastic enter the ocean every year.",
        "The Great Pacific Garbage Patch is twice the size of Texas.",
        "Air pollution causes 7 million premature deaths annually.",
        "We lose 10 million hectares of forest every year.",
        "Over 1 million marine animals die from plastic pollution each year.",
        "The fashion industry produces 10% of global carbon emissions.",
        "Only 9% of all plastic ever produced has been recycled.",
        "By 2050, there could be more plastic than fish in the ocean by weight.",
        "An area of rainforest the size of a football field is cut down every second.",
        "Landfills are the third-largest source of methane emissions in the US.",
        "E-waste is the fastest growing waste stream in the world.",
        "It takes 500 years for a single plastic bottle to decompose.",
        "80% of ocean pollution comes from land-based sources.",
        "One garbage truck of textiles is landfilled or burned every second.",
        "Indoor air pollution kills 3.8 million people every year."
    ];

    // ── Color Palettes ────────────────────────────────────────────────
    // Polluted (start) -> Healed (end)
    const COLORS = {
        skyPolluted:     ["#1a1210", "#2a1f18", "#3d2e22"],
        skyHealed:       ["#0b1a2e", "#0f2847", "#1a4070"],
        groundPolluted:  "#3a3530",
        groundHealed:    "#1a5c2a",
        groundTopPolluted: "#504840",
        groundTopHealed:   "#2d8a3e",
        smogPolluted:    "rgba(80, 70, 55, 0.4)",
        smogHealed:      "rgba(50, 120, 180, 0.08)",
        cityPolluted:    "#252018",
        cityHealed:      "#1a3050",
    };

    // ── Canvas Setup ──────────────────────────────────────────────────
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    // Scale canvas for display
    function resizeCanvas() {
        const wrapper = document.getElementById("game-wrapper");
        const maxW = Math.min(wrapper.clientWidth - 16, 900);
        const ratio = CANVAS_H / CANVAS_W;
        canvas.style.width = maxW + "px";
        canvas.style.height = (maxW * ratio) + "px";
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // ── DOM References ────────────────────────────────────────────────
    const hudScore = document.getElementById("hud-score");
    const hudDist = document.getElementById("hud-distance");
    const hudLives = document.getElementById("hud-lives");
    const startOverlay = document.getElementById("start-overlay");
    const gameoverOverlay = document.getElementById("gameover-overlay");
    const finalScore = document.getElementById("final-score");
    const finalDist = document.getElementById("final-distance");
    const ecoFact = document.getElementById("eco-fact");
    const btnStart = document.getElementById("btn-start");
    const btnRestart = document.getElementById("btn-restart");

    // ── Game State ────────────────────────────────────────────────────
    const FIRE_TYPES = {
        PURIFICATION: {
            color: '#00FF00',
            damage: 1,
            speed: 8,
            size: 8,
            description: 'Standard purification beam'
        },
        SOLAR_FLARE: {
            color: '#FFD700',
            damage: 2,
            speed: 10,
            size: 10,
            description: 'Solar-powered flare attack'
        },
        WASTE_RECYCLER: {
            color: '#00CED1',
            damage: 3,
            speed: 6,
            size: 12,
            piercing: true,
            description: 'Recycles waste on impact'
        },
        NATURE_WRATH: {
            color: '#32CD32',
            damage: 5,
            speed: 12,
            size: 15,
            explosive: true,
            description: 'Nature\'s ultimate wrath'
        }
    };

    let state = {
        running: false,
        score: 0,
        distance: 0,
        speed: BASE_SPEED,
        lives: 3,
        gameOver: false,
        invincibleTimer: 0,
        healProgress: 0, // 0 = polluted, 1 = healed
        shakeTimer: 0,
        shakeIntensity: 0,
        currentFireType: 'PURIFICATION',
        bossTimer: 0,
        nextBossAt: 500, // Spawn boss every 500 distance
        enemiesKilled: 0,
        fireTypesUnlocked: ['PURIFICATION'], // Unlock new fire types as you progress
    };

    const ENEMY_TYPES = {
        WASTE_DEMON: {
            width: 50,
            height: 50,
            color: '#8B4513',
            speed: 2,
            health: 2,
            appearance: 'demon',
            points: 10,
            damage: 1,
            description: 'Toxic waste demon formed from industrial sludge'
        },
        SMOG_WRAITH: {
            width: 60,
            height: 40,
            color: '#696969',
            speed: 3,
            health: 1,
            appearance: 'wraith',
            points: 15,
            damage: 1,
            description: 'Air pollution wraith that suffocates all life'
        },
        SLUDGE_CRAWLER: {
            width: 70,
            height: 30,
            color: '#2F4F2F',
            speed: 1.5,
            health: 3,
            appearance: 'crawler',
            points: 20,
            damage: 2,
            description: 'Radioactive sludge crawler from nuclear waste'
        },
        BOSS_POLLUTION_BEHEMOTH: {
            width: 120,
            height: 120,
            color: '#8B0000',
            speed: 0.8,
            health: 20,
            appearance: 'behemoth',
            points: 100,
            damage: 3,
            isBoss: true,
            description: 'The ultimate pollution behemoth - all waste combined'
        }
    };

    // ── Player ────────────────────────────────────────────────────────
    let player = {
        x: 120,
        y: GROUND_Y,
        w: 28,
        h: 40,
        vy: 0,
        onGround: true,
        jumps: 0,
        maxJumps: 2,
        animFrame: 0,
        animTimer: 0,
        trail: [],
    };

    // ── World ─────────────────────────────────────────────────────────
    let world = {
        bgOffset: 0,
        midOffset: 0,
        fgOffset: 0,
        groundTiles: [],
        buildings: [],
        clouds: [],
    };

    // ── Entity arrays ─────────────────────────────────────────────────
    let obstacles = [];
    let enemies = [];
    let projectiles = [];
    let particles = [];
    let orbs = [];
    let scorePopups = [];

    // ── Timers / Spawners ─────────────────────────────────────────────
    let obstacleTimer = 0;
    let enemyTimer = 0;
    let orbTimer = 0;
    let shootTimer = 0;

    // ── Input ─────────────────────────────────────────────────────────
    let jumpPressed = false;
    let lastJumpTime = 0;

    function handleJump() {
        if (!state.running || state.gameOver) return;
        const now = performance.now();
        if (player.jumps < player.maxJumps) {
            player.vy = JUMP_FORCE * (player.jumps === 1 ? 0.85 : 1);
            player.onGround = false;
            player.jumps++;
            // Jump particles
            for (let i = 0; i < 6; i++) {
                particles.push(createParticle(
                    player.x + player.w / 2,
                    player.y + player.h,
                    (Math.random() - 0.5) * 3,
                    -Math.random() * 2 - 1,
                    lerpColor("#60a5fa", "#34d399", state.healProgress),
                    20 + Math.random() * 15
                ));
            }
        }
        lastJumpTime = now;
    }

    // Keyboard
    document.addEventListener("keydown", function (e) {
        if (e.code === "Space" || e.code === "ArrowUp") {
            e.preventDefault();
            if (!jumpPressed) {
                jumpPressed = true;
                handleJump();
            }
        }
        
        // Fire type switching (1-4 keys)
        if (e.code === "Digit1" && state.fireTypesUnlocked.includes('PURIFICATION')) {
            state.currentFireType = 'PURIFICATION';
            showFireTypePopup('PURIFICATION BEAM');
        }
        if (e.code === "Digit2" && state.fireTypesUnlocked.includes('SOLAR_FLARE')) {
            state.currentFireType = 'SOLAR_FLARE';
            showFireTypePopup('SOLAR FLARE');
        }
        if (e.code === "Digit3" && state.fireTypesUnlocked.includes('WASTE_RECYCLER')) {
            state.currentFireType = 'WASTE_RECYCLER';
            showFireTypePopup('WASTE RECYCLER');
        }
        if (e.code === "Digit4" && state.fireTypesUnlocked.includes('NATURE_WRATH')) {
            state.currentFireType = 'NATURE_WRATH';
            showFireTypePopup('NATURE WRATH');
        }
    });
    document.addEventListener("keyup", function (e) {
        if (e.code === "Space" || e.code === "ArrowUp") {
            jumpPressed = false;
        }
    });

    // Touch / Click
    canvas.addEventListener("mousedown", function (e) {
        e.preventDefault();
        handleJump();
    });
    canvas.addEventListener("touchstart", function (e) {
        e.preventDefault();
        handleJump();
    }, { passive: false });

    // Start / Restart buttons
    btnStart.addEventListener("click", startGame);
    btnRestart.addEventListener("click", startGame);

    // ── Initialization ────────────────────────────────────────────────
    function startGame() {
        state = {
            running: true,
            score: 0,
            distance: 0,
            speed: BASE_SPEED,
            lives: 3,
            gameOver: false,
            invincibleTimer: 0,
            healProgress: 0,
            shakeTimer: 0,
            shakeIntensity: 0,
            currentFireType: 'PURIFICATION',
            bossTimer: 0,
            nextBossAt: 500,
            enemiesKilled: 0,
            fireTypesUnlocked: ['PURIFICATION'],
        };
        player = {
            x: 120,
            y: GROUND_Y - 40,
            w: 28,
            h: 40,
            vy: 0,
            onGround: true,
            jumps: 0,
            maxJumps: 2,
            animFrame: 0,
            animTimer: 0,
            trail: [],
        };
        obstacles = [];
        enemies = [];
        projectiles = [];
        particles = [];
        orbs = [];
        scorePopups = [];
        obstacleTimer = 0;
        enemyTimer = 0;
        orbTimer = 0;
        shootTimer = 0;

        initWorld();

        startOverlay.classList.add("hidden");
        gameoverOverlay.classList.add("hidden");
        updateHUD();
    }

    function initWorld() {
        world.buildings = [];
        for (let i = 0; i < 12; i++) {
            world.buildings.push({
                x: i * 120 + Math.random() * 40,
                w: 30 + Math.random() * 50,
                h: 60 + Math.random() * 120,
            });
        }
        world.clouds = [];
        for (let i = 0; i < 8; i++) {
            world.clouds.push({
                x: Math.random() * CANVAS_W * 2,
                y: 40 + Math.random() * 120,
                w: 80 + Math.random() * 120,
                h: 20 + Math.random() * 30,
                speed: 0.2 + Math.random() * 0.4,
            });
        }
    }

    // ── Game Over ─────────────────────────────────────────────────────
    function triggerGameOver() {
        state.gameOver = true;
        state.running = false;

        // Explosion particles
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 / 30) * i;
            const spd = 2 + Math.random() * 4;
            particles.push(createParticle(
                player.x + player.w / 2,
                player.y + player.h / 2,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd,
                "#ef4444",
                40 + Math.random() * 20
            ));
        }

        setTimeout(showGameOver, 800);
    }

    function showGameOver() {
        finalScore.textContent = state.score;
        finalDist.textContent = Math.floor(state.distance) + "m";
        ecoFact.textContent = '"' + ECO_FACTS[Math.floor(Math.random() * ECO_FACTS.length)] + '"';
        gameoverOverlay.classList.remove("hidden");
    }

    // ── Hit / Damage ──────────────────────────────────────────────────
    function hitPlayer() {
        if (state.invincibleTimer > 0) return;
        state.lives--;
        state.shakeTimer = 15;
        state.shakeIntensity = 6;

        // Damage particles
        for (let i = 0; i < 12; i++) {
            particles.push(createParticle(
                player.x + player.w / 2,
                player.y + player.h / 2,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                "#ef4444",
                25 + Math.random() * 15
            ));
        }

        if (state.lives <= 0) {
            triggerGameOver();
        } else {
            state.invincibleTimer = 90; // 1.5 seconds at 60fps
        }
        updateHUD();
    }

    // ── Update HUD ────────────────────────────────────────────────────
    function updateHUD() {
        hudScore.textContent = state.score;
        hudDist.textContent = Math.floor(state.distance) + "m";
        let hearts = "";
        for (let i = 0; i < 3; i++) {
            hearts += i < state.lives ? "\u2665 " : "\u2661 ";
        }
        hudLives.textContent = hearts.trim();
        
        // Update fire type UI
        const fireTypeElements = document.querySelectorAll('.fire-type');
        fireTypeElements.forEach(el => {
            const type = el.dataset.type;
            if (type === state.currentFireType) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
            
            if (state.fireTypesUnlocked.includes(type)) {
                el.classList.remove('locked');
            } else {
                el.classList.add('locked');
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────
    function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

    function lerpColor(c1, c2, t) {
        // Hex to RGB
        const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
        const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
        const r = Math.round(lerp(r1, r2, t)), g = Math.round(lerp(g1, g2, t)), b = Math.round(lerp(b1, b2, t));
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function rectOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function dist(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    // ── Particle Factory ──────────────────────────────────────────────
    function createParticle(x, y, vx, vy, color, life) {
        return { x, y, vx, vy, color, life, maxLife: life, size: 2 + Math.random() * 3 };
    }
    
    function showFireTypePopup(text) {
        scorePopups.push({
            x: CANVAS_W / 2,
            y: CANVAS_H / 3,
            text: text,
            life: 60,
            color: '#FFD700',
            size: 24
        });
    }
    
    function checkFireTypeUnlocks() {
        // Unlock new fire types based on progress
        if (state.distance >= 200 && !state.fireTypesUnlocked.includes('SOLAR_FLARE')) {
            state.fireTypesUnlocked.push('SOLAR_FLARE');
            showFireTypePopup('SOLAR FLARE UNLOCKED! (Press 2)');
        }
        if (state.distance >= 500 && !state.fireTypesUnlocked.includes('WASTE_RECYCLER')) {
            state.fireTypesUnlocked.push('WASTE_RECYCLER');
            showFireTypePopup('WASTE RECYCLER UNLOCKED! (Press 3)');
        }
        if (state.distance >= 1000 && !state.fireTypesUnlocked.includes('NATURE_WRATH')) {
            state.fireTypesUnlocked.push('NATURE_WRATH');
            showFireTypePopup('NATURE WRATH UNLOCKED! (Press 4)');
        }
    }

    // ── Spawners ──────────────────────────────────────────────────────
    function spawnObstacle() {
        const types = [
            { name: "waste_pile", w: 40, h: 35, color: "#6b5b3a" },
            { name: "toxic_barrel", w: 28, h: 38, color: "#7d3c98" },
            { name: "plastic_mountain", w: 60, h: 45, color: "#4a6741" },
        ];
        const t = types[Math.floor(Math.random() * types.length)];
        obstacles.push({
            x: CANVAS_W + 20,
            y: GROUND_Y - t.h,
            w: t.w,
            h: t.h,
            type: t.name,
            color: t.color,
        });
    }

    function spawnEnemy() {
        // Check for boss spawn
        if (state.distance >= state.nextBossAt && state.bossTimer === 0) {
            state.bossTimer = 1;
            const boss = ENEMY_TYPES.BOSS_POLLUTION_BEHEMOTH;
            enemies.push({
                x: CANVAS_W + 50,
                y: GROUND_Y - boss.height,
                w: boss.width,
                h: boss.height,
                type: 'BOSS_POLLUTION_BEHEMOTH',
                color: boss.color,
                hp: boss.health,
                maxHp: boss.health,
                speed: boss.speed,
                pattern: 'behemoth',
                time: 0,
                isBoss: true,
                appearance: boss.appearance,
                points: boss.points,
                damage: boss.damage,
            });
            
            // Screen shake on boss spawn
            state.shakeTimer = 20;
            state.shakeIntensity = 10;
            return;
        }
        
        // Regular enemy spawning
        const enemyKeys = ['WASTE_DEMON', 'SMOG_WRAITH', 'SLUDGE_CRAWLER'];
        const key = enemyKeys[Math.floor(Math.random() * enemyKeys.length)];
        const template = ENEMY_TYPES[key];
        
        enemies.push({
            x: CANVAS_W + 20,
            y: GROUND_Y - template.height - Math.random() * 100,
            w: template.width,
            h: template.height,
            type: key,
            color: template.color,
            hp: template.health,
            maxHp: template.health,
            speed: template.speed,
            pattern: key === 'WASTE_DEMON' ? 'sine' : key === 'SMOG_WRAITH' ? 'drift' : 'ground',
            time: Math.random() * 100,
            appearance: template.appearance,
            points: template.points,
            damage: template.damage,
        });
    }

    function spawnOrb() {
        const yPos = GROUND_Y - 60 - Math.random() * 150;
        orbs.push({
            x: CANVAS_W + 10,
            y: yPos,
            r: 10,
            glow: 0,
            collected: false,
        });
    }

    // ── Auto-Shoot ────────────────────────────────────────────────────
    function autoShoot() {
        if (enemies.length === 0) return;

        // Find nearest enemy
        let nearest = null;
        let nearDist = Infinity;
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;

        for (const e of enemies) {
            const d = dist(px, py, e.x + e.w / 2, e.y + e.h / 2);
            if (d < nearDist && d < 500) {
                nearDist = d;
                nearest = e;
            }
        }

        if (nearest) {
            const tx = nearest.x + nearest.w / 2;
            const ty = nearest.y + nearest.h / 2;
            const angle = Math.atan2(ty - py, tx - px);
            
            const fireType = FIRE_TYPES[state.currentFireType];
            projectiles.push({
                x: px,
                y: py,
                vx: Math.cos(angle) * fireType.speed,
                vy: Math.sin(angle) * fireType.speed,
                life: 60,
                color: fireType.color,
                damage: fireType.damage,
                size: fireType.size,
                piercing: fireType.piercing || false,
                explosive: fireType.explosive || false,
            });
        }
    }

    // ── UPDATE ─────────────────────────────────────────────────────────
    function update(dt) {
        if (!state.running) return;

        const speedMul = dt / 16.667; // Normalize to 60fps

        // Increase speed over time
        state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.distance * SPEED_RAMP);

        // Distance & heal progress
        state.distance += state.speed * speedMul * 0.3;
        state.healProgress = Math.min(1, state.distance / 3000); // Full heal at 3000m
        
        // Check for fire type unlocks
        checkFireTypeUnlocks();

        // Invincibility
        if (state.invincibleTimer > 0) state.invincibleTimer -= speedMul;

        // Screen shake
        if (state.shakeTimer > 0) state.shakeTimer -= speedMul;

        // ─ Player Physics ─
        player.vy += GRAVITY * speedMul;
        player.y += player.vy * speedMul;

        if (player.y >= GROUND_Y - player.h) {
            player.y = GROUND_Y - player.h;
            player.vy = 0;
            player.onGround = true;
            player.jumps = 0;
        } else {
            player.onGround = false;
        }

        // Player animation
        player.animTimer += speedMul;
        if (player.animTimer > 6) {
            player.animTimer = 0;
            player.animFrame = (player.animFrame + 1) % 4;
        }

        // Player trail
        if (player.trail.length > 12) player.trail.shift();
        player.trail.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, a: 1 });
        for (const t of player.trail) t.a -= 0.08 * speedMul;

        // ─ World scrolling ─
        world.bgOffset += state.speed * 0.15 * speedMul;
        world.midOffset += state.speed * 0.4 * speedMul;
        world.fgOffset += state.speed * speedMul;

        // Move clouds
        for (const c of world.clouds) {
            c.x -= c.speed * speedMul;
            if (c.x + c.w < 0) {
                c.x = CANVAS_W + Math.random() * 200;
                c.y = 40 + Math.random() * 120;
            }
        }

        // ─ Spawn timers ─
        const spawnRate = Math.max(40, 120 - state.distance * 0.02);
        obstacleTimer += speedMul;
        if (obstacleTimer > spawnRate) {
            obstacleTimer = 0;
            spawnObstacle();
        }

        enemyTimer += speedMul;
        const enemyRate = Math.max(60, 180 - state.distance * 0.03);
        if (enemyTimer > enemyRate) {
            enemyTimer = 0;
            spawnEnemy();
        }

        orbTimer += speedMul;
        if (orbTimer > 80) {
            orbTimer = 0;
            spawnOrb();
        }

        shootTimer += speedMul;
        if (shootTimer > 18) {
            shootTimer = 0;
            autoShoot();
        }

        // ─ Update obstacles ─
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i];
            o.x -= state.speed * speedMul;
            if (o.x + o.w < -20) {
                obstacles.splice(i, 1);
                continue;
            }
            // Collision
            if (rectOverlap(
                { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 4 },
                o
            )) {
                hitPlayer();
                obstacles.splice(i, 1);
            }
        }

        // ─ Update enemies ─
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.x -= (state.speed * 0.6 + e.speed) * speedMul;
            e.time += 0.05 * speedMul;

            if (e.pattern === "sine") {
                e.y = e.y + Math.sin(e.time) * 0.8 * speedMul;
            } else if (e.pattern === "drift") {
                e.y += Math.sin(e.time * 0.7) * 0.5 * speedMul;
            } else if (e.pattern === "behemoth") {
                // Boss floats slowly up and down
                e.y += Math.sin(e.time * 0.3) * 0.3 * speedMul;
            }
            // ground pattern stays on ground

            if (e.x + e.w < -20) {
                enemies.splice(i, 1);
                continue;
            }

            // Collision with player
            if (rectOverlap(
                { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 4 },
                e
            )) {
                hitPlayer();
                enemies.splice(i, 1);
            }
        }

        // ─ Update projectiles ─
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.x += p.vx * speedMul;
            p.y += p.vy * speedMul;
            p.life -= speedMul;

            if (p.life <= 0 || p.x > CANVAS_W + 20 || p.x < -20 || p.y < -20 || p.y > CANVAS_H + 20) {
                projectiles.splice(i, 1);
                continue;
            }

            // Hit enemy?
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                const projectileSize = p.size || 8;
                if (rectOverlap({ x: p.x - projectileSize/2, y: p.y - projectileSize/2, w: projectileSize, h: projectileSize }, e)) {
                    e.hp -= p.damage || 1;
                    
                    // Explosive damage?
                    if (p.explosive) {
                        // Damage all enemies in radius
                        for (const other of enemies) {
                            const dist = Math.sqrt((other.x + other.w/2 - p.x)**2 + (other.y + other.h/2 - p.y)**2);
                            if (dist < 80) {
                                other.hp -= 2;
                            }
                        }
                        // Explosion effect
                        for (let k = 0; k < 20; k++) {
                            const angle = (Math.PI * 2 / 20) * k;
                            particles.push(createParticle(
                                p.x, p.y,
                                Math.cos(angle) * (3 + Math.random() * 4),
                                Math.sin(angle) * (3 + Math.random() * 4),
                                p.color,
                                30 + Math.random() * 20
                            ));
                        }
                    } else {
                        // Normal spark particles
                        for (let k = 0; k < 6; k++) {
                            particles.push(createParticle(
                                p.x, p.y,
                                (Math.random() - 0.5) * 4,
                                (Math.random() - 0.5) * 4,
                                e.color,
                                15 + Math.random() * 10
                            ));
                        }
                    }
                    
                    if (!p.piercing) {
                        projectiles.splice(i, 1);
                    }

                    if (e.hp <= 0) {
                        // Kill enemy — big sparks
                        state.score += e.points || (e.maxHp * 50);
                        state.enemiesKilled++;
                        
                        // Boss defeated?
                        if (e.isBoss) {
                            state.score += 500; // Bonus for boss
                            state.nextBossAt = state.distance + 500; // Next boss in 500m
                            state.bossTimer = 0;
                            showFireTypePopup('BOSS DEFEATED! +500');
                            // Big screen shake
                            state.shakeTimer = 30;
                            state.shakeIntensity = 15;
                        }
                        
                        for (let k = 0; k < 15; k++) {
                            const angle = (Math.PI * 2 / 15) * k;
                            particles.push(createParticle(
                                e.x + e.w / 2, e.y + e.h / 2,
                                Math.cos(angle) * (2 + Math.random() * 3),
                                Math.sin(angle) * (2 + Math.random() * 3),
                                e.color,
                                25 + Math.random() * 15
                            ));
                        }
                        scorePopups.push({
                            x: e.x + e.w / 2,
                            y: e.y,
                            text: "+" + (e.points || (e.maxHp * 50)),
                            life: 40,
                        });
                        enemies.splice(j, 1);

                        // Healing leaf particles if past 30% heal
                        if (state.healProgress > 0.3) {
                            for (let k = 0; k < 4; k++) {
                                particles.push(createParticle(
                                    e.x + e.w / 2 + (Math.random() - 0.5) * 30,
                                    e.y + e.h / 2,
                                    (Math.random() - 0.5) * 2,
                                    -Math.random() * 2 - 0.5,
                                    "#34d399",
                                    35 + Math.random() * 20
                                ));
                            }
                        }
                    }
                    break;
                }
            }
        }

        // ─ Update orbs ─
        for (let i = orbs.length - 1; i >= 0; i--) {
            const o = orbs[i];
            o.x -= state.speed * speedMul;
            o.glow += 0.1 * speedMul;

            if (o.x + o.r < -20) {
                orbs.splice(i, 1);
                continue;
            }

            // Collect
            const orbDist = dist(player.x + player.w / 2, player.y + player.h / 2, o.x, o.y);
            if (orbDist < o.r + 20) {
                state.score += 25;
                // Collect particles
                for (let k = 0; k < 8; k++) {
                    particles.push(createParticle(
                        o.x, o.y,
                        (Math.random() - 0.5) * 4,
                        (Math.random() - 0.5) * 4,
                        "#4ade80",
                        20 + Math.random() * 10
                    ));
                }
                scorePopups.push({ x: o.x, y: o.y - 15, text: "+25", life: 30 });
                orbs.splice(i, 1);
            }
        }

        // ─ Update particles ─
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * speedMul;
            p.y += p.vy * speedMul;
            p.vy += 0.05 * speedMul; // slight gravity
            p.life -= speedMul;
            if (p.life <= 0) particles.splice(i, 1);
        }

        // ─ Score popups ─
        for (let i = scorePopups.length - 1; i >= 0; i--) {
            const s = scorePopups[i];
            s.y -= 1 * speedMul;
            s.life -= speedMul;
            if (s.life <= 0) scorePopups.splice(i, 1);
        }

        updateHUD();
    }

    // ── RENDER ─────────────────────────────────────────────────────────
    function render() {
        const hp = state.healProgress;

        ctx.save();

        // Screen shake
        if (state.shakeTimer > 0) {
            const sx = (Math.random() - 0.5) * state.shakeIntensity;
            const sy = (Math.random() - 0.5) * state.shakeIntensity;
            ctx.translate(sx, sy);
        }

        // ─ Sky gradient ─
        const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        for (let i = 0; i < 3; i++) {
            const c = lerpColor(COLORS.skyPolluted[i], COLORS.skyHealed[i], hp);
            grad.addColorStop(i * 0.5, c);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // ─ Stars (appear as world heals) ─
        if (hp > 0.4) {
            ctx.fillStyle = `rgba(255, 255, 255, ${(hp - 0.4) * 0.5})`;
            const seed = 42;
            for (let i = 0; i < 30; i++) {
                const sx = ((seed * (i + 1) * 7) % CANVAS_W);
                const sy = ((seed * (i + 1) * 13) % (GROUND_Y - 50));
                const ss = 1 + ((i * 3) % 3);
                ctx.fillRect(sx, sy, ss, ss);
            }
        }

        // ─ Background city silhouette ─
        const cityColor = lerpColor(COLORS.cityPolluted, COLORS.cityHealed, hp);
        ctx.fillStyle = cityColor;
        for (const b of world.buildings) {
            const bx = ((b.x - world.bgOffset * 0.3) % (CANVAS_W + 200)) - 100;
            ctx.fillRect(bx, GROUND_Y - b.h * 0.6, b.w, b.h * 0.6);
            // Windows
            if (hp < 0.7) {
                ctx.fillStyle = `rgba(255, 200, 100, ${0.15 * (1 - hp)})`;
                for (let wy = GROUND_Y - b.h * 0.55; wy < GROUND_Y - 10; wy += 15) {
                    for (let wx = bx + 5; wx < bx + b.w - 5; wx += 12) {
                        ctx.fillRect(wx, wy, 4, 6);
                    }
                }
                ctx.fillStyle = cityColor;
            }
        }

        // ─ Mid-ground smog/clouds ─
        for (const c of world.clouds) {
            const alpha = lerp(0.35, 0.08, hp);
            const cloudColor = hp < 0.5
                ? `rgba(80, 70, 55, ${alpha})`
                : `rgba(200, 230, 255, ${alpha * 0.5})`;
            ctx.fillStyle = cloudColor;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // ─ Ground ─
        const groundColor = lerpColor(COLORS.groundPolluted, COLORS.groundHealed, hp);
        const groundTopColor = lerpColor(COLORS.groundTopPolluted, COLORS.groundTopHealed, hp);

        // Ground top edge (grass/dirt line)
        ctx.fillStyle = groundTopColor;
        ctx.fillRect(0, GROUND_Y - 3, CANVAS_W, 6);

        // Ground body
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, GROUND_Y + 3, CANVAS_W, CANVAS_H - GROUND_Y);

        // Ground texture - cracks (polluted) or grass tufts (healed)
        const texOffset = world.fgOffset % 40;
        if (hp < 0.6) {
            ctx.strokeStyle = `rgba(60, 50, 40, ${0.3 * (1 - hp)})`;
            ctx.lineWidth = 1;
            for (let gx = -texOffset; gx < CANVAS_W + 40; gx += 40) {
                ctx.beginPath();
                ctx.moveTo(gx, GROUND_Y + 10);
                ctx.lineTo(gx + 10, GROUND_Y + 25);
                ctx.stroke();
            }
        }
        if (hp > 0.3) {
            ctx.strokeStyle = `rgba(74, 222, 128, ${(hp - 0.3) * 0.6})`;
            ctx.lineWidth = 1.5;
            for (let gx = -texOffset; gx < CANVAS_W + 40; gx += 25) {
                ctx.beginPath();
                ctx.moveTo(gx, GROUND_Y);
                ctx.lineTo(gx - 3, GROUND_Y - 6 - Math.sin(gx * 0.1) * 3);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(gx + 8, GROUND_Y);
                ctx.lineTo(gx + 10, GROUND_Y - 4 - Math.cos(gx * 0.15) * 2);
                ctx.stroke();
            }
        }

        // ─ Obstacles ─
        for (const o of obstacles) {
            ctx.save();
            if (o.type === "waste_pile") {
                drawWastePile(o);
            } else if (o.type === "toxic_barrel") {
                drawToxicBarrel(o);
            } else if (o.type === "plastic_mountain") {
                drawPlasticMountain(o);
            }
            ctx.restore();
        }

        // ─ Orbs ─
        for (const o of orbs) {
            const glowSize = 12 + Math.sin(o.glow) * 3;
            const orbGrad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, glowSize);
            orbGrad.addColorStop(0, "rgba(74, 222, 128, 0.9)");
            orbGrad.addColorStop(0.5, "rgba(74, 222, 128, 0.3)");
            orbGrad.addColorStop(1, "rgba(74, 222, 128, 0)");
            ctx.fillStyle = orbGrad;
            ctx.beginPath();
            ctx.arc(o.x, o.y, glowSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#4ade80";
            ctx.beginPath();
            ctx.arc(o.x, o.y, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#a7f3d0";
            ctx.beginPath();
            ctx.arc(o.x - 1.5, o.y - 1.5, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // ─ Enemies ─
        for (const e of enemies) {
            ctx.save();
            if (e.type === "WASTE_DEMON") {
                drawWasteDemon(e);
            } else if (e.type === "SMOG_WRAITH") {
                drawSmogWraith(e);
            } else if (e.type === "SLUDGE_CRAWLER") {
                drawSludgeCrawler(e);
            } else if (e.type === "BOSS_POLLUTION_BEHEMOTH") {
                drawPollutionBehemoth(e);
            }
            // HP bar
            if (e.hp < e.maxHp) {
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.fillRect(e.x, e.y - 8, e.w, 4);
                ctx.fillStyle = "#ef4444";
                ctx.fillRect(e.x, e.y - 8, e.w * (e.hp / e.maxHp), 4);
            }
            ctx.restore();
        }

        // ─ Projectiles ─
        for (const p of projectiles) {
            ctx.save();
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = p.color;
            
            const size = p.size || 3;
            
            // Different shapes for different fire types
            if (state.currentFireType === 'NATURE_WRATH') {
                // Star shape for Nature's Wrath
                ctx.translate(p.x, p.y);
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                    const x = Math.cos(angle) * size;
                    const y = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    
                    const innerAngle = angle + Math.PI / 5;
                    const innerX = Math.cos(innerAngle) * (size * 0.5);
                    const innerY = Math.sin(innerAngle) * (size * 0.5);
                    ctx.lineTo(innerX, innerY);
                }
                ctx.closePath();
                ctx.fill();
            } else if (state.currentFireType === 'WASTE_RECYCLER') {
                // Triangle for Waste Recycler
                ctx.translate(p.x, p.y);
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(-size, size);
                ctx.lineTo(size, size);
                ctx.closePath();
                ctx.fill();
            } else {
                // Circle for others
                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Trail
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(p.x - p.vx * 0.5, p.y - p.vy * 0.5, size * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // ─ Player ─
        if (!state.gameOver) {
            ctx.save();

            // Blink when invincible
            if (state.invincibleTimer > 0 && Math.floor(state.invincibleTimer / 4) % 2 === 0) {
                ctx.globalAlpha = 0.3;
            }

            // Trail
            for (const t of player.trail) {
                if (t.a > 0) {
                    ctx.globalAlpha = Math.max(0, t.a) * 0.2;
                    ctx.fillStyle = lerpColor("#60a5fa", "#34d399", hp);
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.globalAlpha = state.invincibleTimer > 0 && Math.floor(state.invincibleTimer / 4) % 2 === 0 ? 0.3 : 1;

            drawPlayer();

            ctx.restore();
        }

        // ─ Particles ─
        for (const p of particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            ctx.restore();
        }

        // ─ Score Popups ─
        for (const s of scorePopups) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, s.life / (s.maxLife || 40));
            ctx.fillStyle = s.color || "#4ade80";
            ctx.font = `bold ${s.size || 14}px 'Inter', sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(s.text, s.x, s.y);
            ctx.restore();
        }

        // ─ Pollution haze overlay (fades with healing) ─
        if (hp < 0.8) {
            ctx.fillStyle = `rgba(40, 30, 20, ${0.15 * (1 - hp)})`;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        }

        ctx.restore();
    }

    // ── Draw Helpers ──────────────────────────────────────────────────
    function drawPlayer() {
        const px = player.x;
        const py = player.y;
        const hp = state.healProgress;
        const bodyColor = lerpColor("#60a5fa", "#34d399", hp);
        const glowColor = lerpColor("#93c5fd", "#6ee7b7", hp);

        // Outer glow
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;

        // Body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.roundRect(px + 4, py + 6, 20, 28, 4);
        ctx.fill();

        // Head
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(px + 14, py + 6, 9, 0, Math.PI * 2);
        ctx.fill();

        // Visor / eyes
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(px + 17, py + 5, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(px + 18, py + 5, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Legs (animated)
        ctx.shadowBlur = 0;
        ctx.fillStyle = bodyColor;
        const legOffset = player.onGround ? Math.sin(player.animFrame * 1.5) * 4 : 3;
        ctx.fillRect(px + 6, py + 34, 6, 6 + legOffset);
        ctx.fillRect(px + 16, py + 34, 6, 6 - legOffset);

        // Energy core
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
        ctx.beginPath();
        ctx.arc(px + 14, py + 20, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawWastePile(o) {
        // Irregular mound shape
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + o.h);
        ctx.lineTo(o.x + 5, o.y + 10);
        ctx.lineTo(o.x + 15, o.y);
        ctx.lineTo(o.x + 25, o.y + 5);
        ctx.lineTo(o.x + 35, o.y + 3);
        ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.closePath();
        ctx.fill();

        // Trash details
        ctx.fillStyle = "#8b7355";
        ctx.fillRect(o.x + 10, o.y + 12, 8, 5);
        ctx.fillStyle = "#5a4a32";
        ctx.fillRect(o.x + 22, o.y + 8, 6, 10);

        // Stink lines
        ctx.strokeStyle = "rgba(180, 160, 100, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(o.x + 18, o.y - 5);
        ctx.quadraticCurveTo(o.x + 20, o.y - 12, o.x + 16, o.y - 18);
        ctx.stroke();
    }

    function drawToxicBarrel(o) {
        // Barrel body
        ctx.fillStyle = "#5b2d7e";
        ctx.beginPath();
        ctx.roundRect(o.x + 2, o.y + 4, o.w - 4, o.h - 4, 3);
        ctx.fill();

        // Barrel bands
        ctx.fillStyle = "#7d3c98";
        ctx.fillRect(o.x + 2, o.y + 8, o.w - 4, 4);
        ctx.fillRect(o.x + 2, o.y + o.h - 12, o.w - 4, 4);

        // Hazard symbol
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, o.y + 14);
        ctx.lineTo(o.x + o.w / 2 + 6, o.y + 24);
        ctx.lineTo(o.x + o.w / 2 - 6, o.y + 24);
        ctx.closePath();
        ctx.fill();

        // Drip
        ctx.fillStyle = "rgba(180, 255, 50, 0.6)";
        const dripY = o.y + o.h + Math.sin(Date.now() * 0.003) * 3;
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, dripY, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPlasticMountain(o) {
        // Large mound
        ctx.fillStyle = "#3d5a35";
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + o.h);
        ctx.quadraticCurveTo(o.x + o.w * 0.2, o.y - 5, o.x + o.w * 0.4, o.y + 5);
        ctx.quadraticCurveTo(o.x + o.w * 0.6, o.y - 3, o.x + o.w * 0.8, o.y + 8);
        ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.closePath();
        ctx.fill();

        // Plastic items
        ctx.fillStyle = "rgba(100, 200, 255, 0.4)";
        ctx.fillRect(o.x + 10, o.y + 15, 10, 6);
        ctx.fillStyle = "rgba(255, 100, 100, 0.3)";
        ctx.fillRect(o.x + 30, o.y + 10, 8, 12);
        ctx.fillStyle = "rgba(255, 255, 100, 0.3)";
        ctx.beginPath();
        ctx.arc(o.x + 48, o.y + 20, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawWasteDemon(e) {
        // Floating toxic blob
        const wobble = Math.sin(e.time * 2) * 2;
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + e.h / 2 + wobble, e.w / 2 - 2, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(e.x + e.w * 0.35, e.y + e.h * 0.4 + wobble, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + e.w * 0.65, e.y + e.h * 0.4 + wobble, 3, 0, Math.PI * 2);
        ctx.fill();

        // Angry mouth
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + e.h * 0.65 + wobble, 5, 0, Math.PI);
        ctx.fill();

        // Dripping appendages
        ctx.fillStyle = "rgba(163, 230, 53, 0.5)";
        ctx.beginPath();
        ctx.ellipse(e.x + 5, e.y + e.h + wobble, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(e.x + e.w - 5, e.y + e.h + wobble + 2, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawSmogWraith(e) {
        const wobble = Math.sin(e.time) * 3;
        // Wispy cloud shape
        ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
        ctx.shadowColor = "#94a3b8";
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2 + wobble, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(e.x + e.w * 0.3, e.y + e.h * 0.4 + wobble, e.w * 0.3, e.h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(e.x + e.w * 0.7, e.y + e.h * 0.5 + wobble, e.w * 0.25, e.h * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ghost eyes
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 50, 50, 0.7)";
        ctx.beginPath();
        ctx.arc(e.x + e.w * 0.4, e.y + e.h * 0.4 + wobble, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + e.w * 0.6, e.y + e.h * 0.4 + wobble, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawSludgeCrawler(e) {
        const squish = Math.sin(e.time * 3) * 2;
        // Sludge body on ground
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2 + squish, e.w / 2 + squish, e.h / 2 - squish / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Spikes
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#dc2626";
        for (let i = 0; i < 3; i++) {
            const sx = e.x + 8 + i * 10;
            ctx.beginPath();
            ctx.moveTo(sx, e.y + 4 + squish);
            ctx.lineTo(sx + 3, e.y - 6 + squish);
            ctx.lineTo(sx + 6, e.y + 4 + squish);
            ctx.closePath();
            ctx.fill();
        }

        // Eyes
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(e.x + e.w * 0.35, e.y + e.h * 0.5 + squish, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + e.w * 0.65, e.y + e.h * 0.5 + squish, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    function drawPollutionBehemoth(e) {
        const pulse = Math.sin(e.time * 1.5) * 5;
        
        // Main body - giant toxic mass
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 20;
        
        ctx.beginPath();
        ctx.ellipse(e.x + e.w/2, e.y + e.h/2, e.w/2 + pulse, e.h/2 + pulse, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Toxic cores floating inside
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#FF00FF";
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 / 3) * i + e.time;
            const cx = e.x + e.w/2 + Math.cos(angle) * 20;
            const cy = e.y + e.h/2 + Math.sin(angle) * 20;
            ctx.beginPath();
            ctx.arc(cx, cy, 8 + pulse/2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Spikes all around
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#000";
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const sx = e.x + e.w/2 + Math.cos(angle) * (e.w/2 + 10);
            const sy = e.y + e.h/2 + Math.sin(angle) * (e.h/2 + 10);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(e.x + e.w/2 + Math.cos(angle) * (e.w/2 + 20), e.y + e.h/2 + Math.sin(angle) * (e.h/2 + 20));
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // Giant evil eye
        ctx.fillStyle = "#FF0000";
        ctx.shadowColor = "#FF0000";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(e.x + e.w/2, e.y + e.h/2, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#000";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(e.x + e.w/2, e.y + e.h/2, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── Game Loop ─────────────────────────────────────────────────────
    let lastTime = 0;

    function gameLoop(timestamp) {
        const dt = lastTime ? Math.min(timestamp - lastTime, 50) : 16.667; // cap at 50ms
        lastTime = timestamp;

        update(dt);
        render();

        requestAnimationFrame(gameLoop);
    }

    // ── Boot ──────────────────────────────────────────────────────────
    initWorld();

    // Draw initial polluted background on canvas before game starts
    render();

    requestAnimationFrame(gameLoop);

})();

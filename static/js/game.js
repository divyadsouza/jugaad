/* ==========================================================================
   Jugaad Runner — The Scrappy Eco Warrior
   Complete Game Engine — Pure HTML5 Canvas
   ========================================================================== */

(function () {
    "use strict";

    // ── Constants ──────────────────────────────────────────────────────
    const W = 900, H = 500;
    const GROUND_Y = 410;
    const GRAVITY = 0.55;
    const JUMP_FORCE = -12.5;
    const BASE_SPEED = 4;
    const MAX_SPEED = 11;
    const SPEED_RAMP = 0.0002;
    const PLAYER_W = 36, PLAYER_H = 44;

    // ── Death Quips ────────────────────────────────────────────────────
    const DEATH_QUIPS = [
        "Even the trash is disappointed in you.",
        "The ocean called. It wants its plastic back.",
        "You got recycled. Literally.",
        "Mother Nature just unfriended you.",
        "That was less 'eco-warrior' and more 'eco-worrier'.",
        "The polar bears are shaking their heads.",
        "Your carbon footprint just got bigger. By dying.",
        "Plot twist: YOU were the pollution all along.",
        "The trees are writing angry letters about your performance.",
        "Somewhere, a dolphin just sighed.",
        "Achievement unlocked: Maximum Disappointment",
        "The recycling bin rejected your application.",
        "Even the cockroaches could've survived longer.",
        "Your jetpack called. It wants a better pilot.",
        "Greta Thunberg would NOT be impressed."
    ];

    const ECO_FACTS = [
        "8 million tons of plastic enter the ocean every year.",
        "The Great Pacific Garbage Patch is twice the size of Texas.",
        "Air pollution causes 7 million premature deaths annually.",
        "We lose 10 million hectares of forest every year.",
        "Over 1 million marine animals die from plastic pollution each year.",
        "Only 9% of all plastic ever produced has been recycled.",
        "By 2050, there could be more plastic than fish in the ocean by weight.",
        "It takes 500 years for a single plastic bottle to decompose.",
        "E-waste is the fastest growing waste stream in the world.",
        "Landfills are the third-largest source of methane emissions in the US.",
        "80% of ocean pollution comes from land-based sources.",
        "One garbage truck of textiles is landfilled or burned every second.",
        "An area of rainforest the size of a football field is cut down every second.",
        "Indoor air pollution kills 3.8 million people every year.",
        "The fashion industry produces 10% of global carbon emissions."
    ];

    // ── Weapons ────────────────────────────────────────────────────────
    const WEAPONS = [
        { name: "Water Cannon", color: "#4fc3f7", trail: "#81d4fa", damage: 1, speed: 9, rate: 180, size: 6, unlock: 0, piercing: false, aoe: false },
        { name: "Solar Beam", color: "#ffd54f", trail: "#ffecb3", damage: 2, speed: 14, rate: 350, size: 5, unlock: 500, piercing: false, aoe: false },
        { name: "Recycling Ray", color: "#66bb6a", trail: "#a5d6a7", damage: 1, speed: 8, rate: 220, size: 7, unlock: 1500, piercing: true, aoe: false },
        { name: "Nature's Wrath", color: "#8bc34a", trail: "#c5e1a5", damage: 3, speed: 6, rate: 500, size: 10, unlock: 3000, piercing: false, aoe: true }
    ];

    // ── Canvas Setup ───────────────────────────────────────────────────
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;

    function resizeCanvas() {
        const wr = document.getElementById("game-wrapper");
        const maxW = Math.min(wr.clientWidth - 16, 900);
        canvas.style.width = maxW + "px";
        canvas.style.height = (maxW * H / W) + "px";
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // ── DOM ─────────────────────────────────────────────────────────────
    const startOverlay = document.getElementById("start-overlay");
    const gameoverOverlay = document.getElementById("gameover-overlay");
    const btnStart = document.getElementById("btn-start");
    const btnRestart = document.getElementById("btn-restart");
    const weaponUnlockEl = document.getElementById("weapon-unlock");
    const weaponUnlockName = document.getElementById("weapon-unlock-name");

    // ── State Machine ──────────────────────────────────────────────────
    const STATE = { MENU: 0, PLAYING: 1, BOSS: 2, GAMEOVER: 3 };
    let state = STATE.MENU;

    // ── Game State ─────────────────────────────────────────────────────
    let score, distance, lives, combo, comboTimer, maxCombo, killCount;
    let currentWeapon, unlockedWeapons;
    let scrollSpeed, lastShot;
    let screenShakeX, screenShakeY, screenShakeTime;
    let bossActive, currentBoss;
    let healProgress; // 0-1 how healed the world is

    // ── Object Pools ───────────────────────────────────────────────────
    let player, enemies, projectiles, particles, textPopups, crystals, platforms;
    let bgElements; // parallax bg objects

    // ── Input ──────────────────────────────────────────────────────────
    const keys = {};
    let mouseDown = false;

    function resetGame() {
        score = 0; distance = 0; lives = 3;
        combo = 0; comboTimer = 0; maxCombo = 0; killCount = 0;
        currentWeapon = 0; unlockedWeapons = [true, false, false, false];
        scrollSpeed = BASE_SPEED; lastShot = 0;
        screenShakeX = 0; screenShakeY = 0; screenShakeTime = 0;
        bossActive = false; currentBoss = null;
        healProgress = 0;

        player = {
            x: 120, y: GROUND_Y - PLAYER_H,
            vy: 0, jumping: false, doubleJumped: false, sliding: false,
            slideTimer: 0,
            animFrame: 0, animTimer: 0,
            state: "run", // run, jump, doublejump, shoot, hit, dead
            hitTimer: 0, invulnTimer: 0,
            shootAnim: 0
        };

        enemies = [];
        projectiles = [];
        particles = [];
        textPopups = [];
        crystals = [];
        platforms = [];
        bgElements = { farClouds: [], mountains: [], midTrees: [], groundDetails: [] };

        initBackground();
        updateWeaponUI();
    }

    function initBackground() {
        // Generate some initial background elements
        for (let i = 0; i < 6; i++) {
            bgElements.farClouds.push({ x: i * 180, y: 30 + Math.random() * 60, w: 60 + Math.random() * 80 });
        }
        for (let i = 0; i < 5; i++) {
            bgElements.mountains.push({ x: i * 220, h: 80 + Math.random() * 60, w: 150 + Math.random() * 80 });
        }
        for (let i = 0; i < 8; i++) {
            bgElements.midTrees.push({ x: i * 130, h: 40 + Math.random() * 50, type: Math.floor(Math.random() * 3) });
        }
        for (let i = 0; i < 20; i++) {
            bgElements.groundDetails.push({ x: i * 50 + Math.random() * 30, type: Math.floor(Math.random() * 4) });
        }
    }

    // ── Weapon UI ──────────────────────────────────────────────────────
    function updateWeaponUI() {
        for (let i = 0; i < 4; i++) {
            const el = document.getElementById("weapon-" + i);
            if (!el) continue;
            el.classList.toggle("active", i === currentWeapon);
            el.classList.toggle("locked", !unlockedWeapons[i]);
            el.classList.toggle("unlocked", unlockedWeapons[i] && i !== currentWeapon);
            const statusEl = el.querySelector(".weapon-status");
            if (statusEl) {
                if (i === currentWeapon) statusEl.textContent = "EQUIPPED";
                else if (unlockedWeapons[i]) statusEl.textContent = "READY";
                else statusEl.textContent = WEAPONS[i].unlock + " PTS";
            }
        }
    }

    function showWeaponUnlock(idx) {
        weaponUnlockName.textContent = WEAPONS[idx].name;
        weaponUnlockEl.classList.remove("hidden");
        setTimeout(() => weaponUnlockEl.classList.add("hidden"), 2500);
    }

    // ── Input Handling ─────────────────────────────────────────────────
    document.addEventListener("keydown", (e) => {
        keys[e.key.toLowerCase()] = true;
        if (state === STATE.PLAYING || state === STATE.BOSS) {
            if (e.key === " " || e.key === "w" || e.key === "ArrowUp") { e.preventDefault(); tryJump(); }
            if (e.key === "s" || e.key === "ArrowDown") { e.preventDefault(); trySlide(); }
            if (e.key === "z") tryShoot();
            if (e.key >= "1" && e.key <= "4") switchWeapon(parseInt(e.key) - 1);
        }
    });
    document.addEventListener("keyup", (e) => {
        keys[e.key.toLowerCase()] = false;
        if (e.key === "s" || e.key === "ArrowDown") player.sliding = false;
    });

    canvas.addEventListener("mousedown", (e) => { e.preventDefault(); mouseDown = true; if (state === STATE.PLAYING || state === STATE.BOSS) tryShoot(); });
    canvas.addEventListener("mouseup", () => mouseDown = false);
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (state === STATE.PLAYING || state === STATE.BOSS) {
            let dir = e.deltaY > 0 ? 1 : -1;
            let next = currentWeapon;
            for (let i = 0; i < 4; i++) {
                next = (next + dir + 4) % 4;
                if (unlockedWeapons[next]) { switchWeapon(next); break; }
            }
        }
    }, { passive: false });

    // Touch support
    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (state === STATE.PLAYING || state === STATE.BOSS) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const relX = (touch.clientX - rect.left) / rect.width;
            if (relX < 0.4) tryJump();
            else tryShoot();
        }
    }, { passive: false });

    function tryJump() {
        if (player.sliding) return;
        if (player.state === "dead") return;
        if (!player.jumping) {
            player.vy = JUMP_FORCE;
            player.jumping = true;
            player.doubleJumped = false;
            player.state = "jump";
            spawnParticles(player.x + PLAYER_W / 2, player.y + PLAYER_H, "#ff9800", 5, { dy: 2 });
        } else if (!player.doubleJumped) {
            player.vy = JUMP_FORCE * 0.85;
            player.doubleJumped = true;
            player.state = "doublejump";
            spawnParticles(player.x + PLAYER_W / 2, player.y + PLAYER_H, "#ffd54f", 8, { dy: 3, spread: 3 });
        }
    }

    function trySlide() {
        if (player.jumping || player.state === "dead") return;
        player.sliding = true;
        player.slideTimer = 30;
    }

    function tryShoot() {
        const now = performance.now();
        const weap = WEAPONS[currentWeapon];
        if (now - lastShot < weap.rate) return;
        lastShot = now;
        player.shootAnim = 8;

        const px = player.x + PLAYER_W;
        const py = player.y + PLAYER_H / 2 - 4;
        projectiles.push({
            x: px, y: py, vx: weap.speed, vy: 0,
            damage: weap.damage, color: weap.color, trail: weap.trail,
            size: weap.size, piercing: weap.piercing, aoe: weap.aoe,
            life: 120, weapIdx: currentWeapon
        });
        // Recoil
        screenShakeX = -2;
        screenShakeTime = 3;
        spawnParticles(px, py, weap.color, 3, { dx: 2, spread: 1 });
    }

    function switchWeapon(idx) {
        if (idx >= 0 && idx < 4 && unlockedWeapons[idx]) {
            currentWeapon = idx;
            updateWeaponUI();
        }
    }

    // ── Particle System ────────────────────────────────────────────────
    function spawnParticles(x, y, color, count, opts = {}) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * (opts.spread || 6),
                y: y + (Math.random() - 0.5) * (opts.spread || 6),
                vx: (Math.random() - 0.5) * (opts.dx || 4),
                vy: -(Math.random()) * (opts.dy || 4) - 1,
                color: color,
                life: opts.life || (20 + Math.random() * 20),
                maxLife: opts.life || 30,
                size: opts.size || (2 + Math.random() * 3),
                gravity: opts.gravity !== undefined ? opts.gravity : 0.1
            });
        }
    }

    function spawnConfetti(x, y, count) {
        const colors = ["#ff4444", "#44ff44", "#4444ff", "#ffff44", "#ff44ff", "#44ffff", "#ffd54f", "#ff9800"];
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: -Math.random() * 8 - 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 40 + Math.random() * 30,
                maxLife: 60,
                size: 2 + Math.random() * 4,
                gravity: 0.15,
                confetti: true,
                rot: Math.random() * Math.PI * 2
            });
        }
    }

    function spawnTextPopup(x, y, text, color, size) {
        textPopups.push({ x, y, text, color, size: size || 16, life: 60, maxLife: 60, vy: -1.5 });
    }

    // ── Enemy Spawning ─────────────────────────────────────────────────
    let enemySpawnTimer = 0;
    let crystalSpawnTimer = 0;

    function spawnEnemy() {
        const types = [];
        // Available types based on distance
        types.push("bottle"); // always
        if (distance > 100) types.push("oilblob");
        if (distance > 300) types.push("smokestack");
        if (distance > 200) types.push("tirespider");
        if (distance > 400) types.push("ewaste");
        if (distance > 500) types.push("styrofoam");

        const type = types[Math.floor(Math.random() * types.length)];
        const enemy = createEnemy(type);
        enemies.push(enemy);
    }

    function createEnemy(type) {
        const base = { x: W + 20, animFrame: 0, animTimer: 0, flashTimer: 0, blinkTimer: Math.random() * 60 };
        switch (type) {
            case "bottle":
                return { ...base, type, y: GROUND_Y - 28, w: 20, h: 28, hp: 1, maxHp: 1, speed: 1.5, bouncePhase: Math.random() * Math.PI * 2 };
            case "oilblob":
                return { ...base, type, y: GROUND_Y - 24, w: 30, h: 24, hp: 2, maxHp: 2, speed: 1.2, wobblePhase: 0 };
            case "smokestack":
                return { ...base, type, y: GROUND_Y - 55, w: 28, h: 55, hp: 3, maxHp: 3, speed: 0.7, smokeTimer: 0 };
            case "tirespider":
                return { ...base, type, y: GROUND_Y - 30, w: 32, h: 30, hp: 2, maxHp: 2, speed: 2.5 + Math.random(), jitterX: 0, jitterY: 0 };
            case "ewaste":
                return { ...base, type, y: GROUND_Y - 18, w: 16, h: 18, hp: 1, maxHp: 1, speed: 2, sparkTimer: 0 };
            case "styrofoam":
                return { ...base, type, y: GROUND_Y - 120 - Math.random() * 80, w: 22, h: 22, hp: 1, maxHp: 1, speed: 1, phaseAlpha: 1, phaseTimer: 0, floatPhase: Math.random() * Math.PI * 2 };
            default:
                return { ...base, type: "bottle", y: GROUND_Y - 28, w: 20, h: 28, hp: 1, maxHp: 1, speed: 1.5, bouncePhase: 0 };
        }
    }

    // ── Boss Creation ──────────────────────────────────────────────────
    const BOSS_DEFS = [
        { name: "Mega Landfill Monster", hp: 10, dist: 500, color: "#8d6e63" },
        { name: "Corporate Polluter Robot", hp: 15, dist: 1000, color: "#607d8b" },
        { name: "The Great Pacific Garbage Patch", hp: 20, dist: 1500, color: "#0097a7" }
    ];
    let nextBossIdx = 0;
    let bossDefeatedDist = [];

    function spawnBoss(idx) {
        const def = BOSS_DEFS[idx];
        bossActive = true;
        currentBoss = {
            name: def.name, type: idx,
            x: W - 120, y: GROUND_Y - 140, w: 100, h: 140,
            hp: def.hp, maxHp: def.hp,
            color: def.color,
            attackTimer: 0, attackCooldown: 90,
            animTimer: 0, flashTimer: 0,
            phase: 0, tauntTimer: 0, isTaunting: false,
            projectiles: []
        };
    }

    // ── Collision Detection (AABB) ─────────────────────────────────────
    function aabb(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function playerRect() {
        if (player.sliding) {
            return { x: player.x, y: player.y + PLAYER_H - 18, w: PLAYER_W + 8, h: 18 };
        }
        return { x: player.x, y: player.y, w: PLAYER_W, h: PLAYER_H };
    }

    // ── Update ─────────────────────────────────────────────────────────
    let lastTime = 0;
    let animClock = 0;

    function update(dt) {
        if (state !== STATE.PLAYING && state !== STATE.BOSS) return;

        animClock += dt;
        const spd = Math.min(scrollSpeed, MAX_SPEED);

        // Player physics
        if (player.state !== "dead") {
            player.vy += GRAVITY;
            player.y += player.vy;

            if (player.y >= GROUND_Y - PLAYER_H) {
                player.y = GROUND_Y - PLAYER_H;
                player.vy = 0;
                player.jumping = false;
                player.doubleJumped = false;
                if (player.state === "jump" || player.state === "doublejump") player.state = "run";
            }

            // Slide
            if (player.sliding) {
                player.slideTimer--;
                if (player.slideTimer <= 0) player.sliding = false;
            }

            // Animation
            player.animTimer++;
            if (player.animTimer > 6) { player.animTimer = 0; player.animFrame = (player.animFrame + 1) % 4; }

            if (player.shootAnim > 0) player.shootAnim--;
            if (player.hitTimer > 0) player.hitTimer--;
            if (player.invulnTimer > 0) player.invulnTimer--;

            // Auto-shoot if mouse held
            if (mouseDown && player.shootAnim === 0) tryShoot();
        }

        // Scroll / distance (not during boss)
        if (!bossActive) {
            distance += spd * 0.05;
            scrollSpeed = BASE_SPEED + distance * SPEED_RAMP;
        }

        // Heal progress
        healProgress = Math.min(distance / 2000, 1);

        // Check weapon unlocks
        for (let i = 1; i < WEAPONS.length; i++) {
            if (!unlockedWeapons[i] && score >= WEAPONS[i].unlock) {
                unlockedWeapons[i] = true;
                showWeaponUnlock(i);
                updateWeaponUI();
            }
        }

        // Check boss spawn
        if (!bossActive && nextBossIdx < BOSS_DEFS.length && distance >= BOSS_DEFS[nextBossIdx].dist && !bossDefeatedDist.includes(nextBossIdx)) {
            spawnBoss(nextBossIdx);
            state = STATE.BOSS;
        }

        // Combo timer
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) { combo = 0; }
        }

        // Distance score
        if (!bossActive) {
            score += spd * 0.005;
        }

        // ── Enemies ──
        if (!bossActive) {
            enemySpawnTimer -= dt;
            if (enemySpawnTimer <= 0) {
                spawnEnemy();
                enemySpawnTimer = Math.max(30, 100 - distance * 0.03) + Math.random() * 40;
            }
        }

        // Crystal spawns
        crystalSpawnTimer -= dt;
        if (crystalSpawnTimer <= 0 && !bossActive) {
            crystals.push({ x: W + 10, y: GROUND_Y - 60 - Math.random() * 100, size: 12, rot: 0 });
            crystalSpawnTimer = 300 + Math.random() * 200;
        }

        // Update enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.x -= (bossActive ? 0 : spd) + e.speed;
            e.animTimer++;
            e.blinkTimer++;
            if (e.flashTimer > 0) e.flashTimer--;

            // Type-specific behavior
            if (e.type === "bottle") e.y = GROUND_Y - 28 + Math.sin(animClock * 0.08 + e.bouncePhase) * 8;
            if (e.type === "oilblob") { e.wobblePhase += 0.05; }
            if (e.type === "tirespider") { e.jitterX = Math.sin(animClock * 0.15 + e.x) * 2; e.jitterY = Math.cos(animClock * 0.12 + e.x) * 1.5; }
            if (e.type === "styrofoam") {
                e.phaseTimer++;
                e.phaseAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(e.phaseTimer * 0.04));
                e.y += Math.sin(animClock * 0.03 + e.floatPhase) * 0.5;
            }
            if (e.type === "smokestack") {
                e.smokeTimer++;
                if (e.smokeTimer > 60) {
                    e.smokeTimer = 0;
                    // Smoke cloud as a "projectile" from enemy
                    if (Math.abs(e.x - player.x) < 300) {
                        spawnParticles(e.x + e.w / 2, e.y, "rgba(100,100,100,0.5)", 4, { dx: -3, dy: -2, spread: 10, life: 40 });
                    }
                }
            }
            if (e.type === "ewaste") {
                e.sparkTimer++;
                if (e.sparkTimer > 20) { e.sparkTimer = 0; spawnParticles(e.x + e.w / 2, e.y, "#ffeb3b", 2, { spread: 4, life: 10 }); }
            }

            // Remove if off screen
            if (e.x < -60) { enemies.splice(i, 1); continue; }

            // Collision with player
            if (player.invulnTimer <= 0 && player.state !== "dead" && aabb(playerRect(), e)) {
                hitPlayer();
            }
        }

        // Update crystals
        for (let i = crystals.length - 1; i >= 0; i--) {
            const c = crystals[i];
            c.x -= spd;
            c.rot += 0.03;
            if (c.x < -20) { crystals.splice(i, 1); continue; }
            // Collect
            if (aabb(playerRect(), { x: c.x - c.size / 2, y: c.y - c.size / 2, w: c.size, h: c.size })) {
                score += 50;
                spawnParticles(c.x, c.y, "#e1bee7", 8, { dy: 3, spread: 8 });
                spawnTextPopup(c.x, c.y - 10, "+50", "#e1bee7", 14);
                crystals.splice(i, 1);
            }
        }

        // Update projectiles
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            // Trail particles
            if (p.life % 2 === 0) {
                particles.push({
                    x: p.x, y: p.y,
                    vx: -1, vy: (Math.random() - 0.5),
                    color: p.trail, life: 10, maxLife: 10,
                    size: p.size * 0.5, gravity: 0
                });
            }

            if (p.life <= 0 || p.x > W + 20 || p.x < -20) { projectiles.splice(i, 1); continue; }

            // Hit enemies
            let hitAny = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (e.type === "styrofoam" && e.phaseAlpha < 0.5) continue; // phased out
                if (aabb({ x: p.x - p.size / 2, y: p.y - p.size / 2, w: p.size, h: p.size }, e)) {
                    e.hp -= p.damage;
                    e.flashTimer = 6;
                    hitAny = true;
                    spawnParticles(p.x, p.y, p.color, 5, { spread: 8 });

                    if (e.hp <= 0) {
                        killEnemy(e, j);
                    }

                    if (p.aoe) {
                        // Damage nearby enemies too
                        for (let k = enemies.length - 1; k >= 0; k--) {
                            if (k === j) continue;
                            const e2 = enemies[k];
                            if (Math.abs(e2.x - p.x) < 50 && Math.abs(e2.y - p.y) < 50) {
                                e2.hp -= p.damage;
                                e2.flashTimer = 6;
                                if (e2.hp <= 0) killEnemy(e2, k);
                            }
                        }
                    }

                    if (!p.piercing) break;
                }
            }

            // Hit boss
            if (bossActive && currentBoss) {
                const bHit = { x: currentBoss.x + 10, y: currentBoss.y + 10, w: currentBoss.w - 20, h: currentBoss.h - 20 };
                if (aabb({ x: p.x - p.size / 2, y: p.y - p.size / 2, w: p.size, h: p.size }, bHit)) {
                    currentBoss.hp -= p.damage;
                    currentBoss.flashTimer = 6;
                    hitAny = true;
                    spawnParticles(p.x, p.y, p.color, 6, { spread: 10 });
                    screenShakeX = (Math.random() - 0.5) * 3;
                    screenShakeY = (Math.random() - 0.5) * 3;
                    screenShakeTime = 4;

                    if (currentBoss.hp <= 0) {
                        defeatBoss();
                    }
                    if (!p.piercing) hitAny = true;
                }
            }

            if (hitAny && !projectiles[i]?.piercing) { projectiles.splice(i, 1); }
        }

        // Update boss
        if (bossActive && currentBoss) {
            currentBoss.animTimer++;
            if (currentBoss.flashTimer > 0) currentBoss.flashTimer--;

            currentBoss.attackTimer++;
            if (currentBoss.attackTimer >= currentBoss.attackCooldown) {
                currentBoss.attackTimer = 0;
                bossAttack();
            }

            // Boss projectiles
            for (let i = currentBoss.projectiles.length - 1; i >= 0; i--) {
                const bp = currentBoss.projectiles[i];
                bp.x += bp.vx;
                bp.y += bp.vy;
                bp.life--;
                if (bp.life <= 0 || bp.x < -20) { currentBoss.projectiles.splice(i, 1); continue; }
                if (player.invulnTimer <= 0 && player.state !== "dead" && aabb(playerRect(), { x: bp.x - 8, y: bp.y - 8, w: 16, h: 16 })) {
                    hitPlayer();
                    currentBoss.projectiles.splice(i, 1);
                }
            }
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.life--;
            if (p.confetti) p.rot += 0.1;
            if (p.life <= 0) particles.splice(i, 1);
        }

        // Update text popups
        for (let i = textPopups.length - 1; i >= 0; i--) {
            const t = textPopups[i];
            t.y += t.vy;
            t.life--;
            if (t.life <= 0) textPopups.splice(i, 1);
        }

        // Screen shake decay
        if (screenShakeTime > 0) {
            screenShakeTime--;
        } else {
            screenShakeX *= 0.8;
            screenShakeY *= 0.8;
        }

        // Scroll background
        if (!bossActive) {
            bgElements.farClouds.forEach(c => { c.x -= spd * 0.15; if (c.x < -c.w) c.x = W + 20; });
            bgElements.mountains.forEach(m => { m.x -= spd * 0.3; if (m.x < -m.w) m.x = W + 20; });
            bgElements.midTrees.forEach(t => { t.x -= spd * 0.6; if (t.x < -60) t.x = W + 20 + Math.random() * 40; });
            bgElements.groundDetails.forEach(g => { g.x -= spd; if (g.x < -30) g.x = W + 10 + Math.random() * 30; });
        }
    }

    function killEnemy(e, idx) {
        // Score
        const basePoints = 10 * e.maxHp;
        combo++;
        comboTimer = 120; // 2 seconds at 60fps
        if (combo > maxCombo) maxCombo = combo;
        const mult = combo >= 10 ? 10 : combo >= 5 ? 5 : combo >= 3 ? 3 : combo >= 2 ? 2 : 1;
        score += basePoints * mult;
        killCount++;

        // Combo text
        if (combo === 2) spawnTextPopup(e.x, e.y - 20, "REDUCE!", "#4caf50", 18);
        else if (combo === 3) spawnTextPopup(e.x, e.y - 20, "REUSE!", "#42a5f5", 20);
        else if (combo === 5) spawnTextPopup(e.x, e.y - 20, "RECYCLE!", "#ffd54f", 24);
        else if (combo >= 10) spawnTextPopup(e.x, e.y - 30, "JUGAAD MASTER!", "#ff9800", 28);

        // Comic book text
        const smacks = ["POW!", "SPLAT!", "WHOOSH!", "CRUNCH!", "ZAP!", "BONK!"];
        spawnTextPopup(e.x + 10, e.y - 10, smacks[Math.floor(Math.random() * smacks.length)], "#fff", 14);

        // Confetti explosion
        spawnConfetti(e.x + e.w / 2, e.y + e.h / 2, 15);

        // Screen shake
        screenShakeX = (Math.random() - 0.5) * 4;
        screenShakeY = (Math.random() - 0.5) * 4;
        screenShakeTime = 5;

        enemies.splice(idx, 1);
    }

    function hitPlayer() {
        if (player.invulnTimer > 0 || player.state === "dead") return;
        lives--;
        player.hitTimer = 20;
        player.invulnTimer = 90; // 1.5 sec invulnerability
        player.state = "hit";
        screenShakeX = (Math.random() - 0.5) * 8;
        screenShakeY = (Math.random() - 0.5) * 8;
        screenShakeTime = 10;
        spawnParticles(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, "#ef4444", 10, { spread: 15 });

        if (lives <= 0) {
            player.state = "dead";
            player.vy = -8;
            setTimeout(() => gameOver(), 1500);
        }
    }

    function bossAttack() {
        if (!currentBoss) return;
        const b = currentBoss;
        // Different attacks per boss type
        if (b.type === 0) {
            // Landfill: throws garbage
            for (let i = 0; i < 3; i++) {
                b.projectiles.push({
                    x: b.x, y: b.y + 40 + i * 30,
                    vx: -4 - Math.random() * 3, vy: -2 + Math.random() * 4,
                    life: 120, color: "#8d6e63", type: "trash"
                });
            }
        } else if (b.type === 1) {
            // Corporate: smokestack missiles and dollar bills
            b.projectiles.push({
                x: b.x, y: b.y + 30,
                vx: -6, vy: 0, life: 100, color: "#78909c", type: "missile"
            });
            b.projectiles.push({
                x: b.x, y: b.y + 80,
                vx: -3, vy: -1 + Math.random() * 2, life: 120, color: "#4caf50", type: "dollar"
            });
        } else if (b.type === 2) {
            // Garbage Patch: plastic tentacles sweep
            for (let i = 0; i < 5; i++) {
                b.projectiles.push({
                    x: b.x - 10, y: b.y + i * 28,
                    vx: -5, vy: (i - 2) * 0.8, life: 80, color: "#00838f", type: "tentacle"
                });
            }
        }
    }

    function defeatBoss() {
        score += 200;
        bossDefeatedDist.push(nextBossIdx);
        nextBossIdx++;
        spawnConfetti(currentBoss.x + currentBoss.w / 2, currentBoss.y + currentBoss.h / 2, 40);
        spawnTextPopup(currentBoss.x, currentBoss.y - 20, "BOSS DEFEATED!", "#ffd54f", 28);
        screenShakeX = (Math.random() - 0.5) * 12;
        screenShakeY = (Math.random() - 0.5) * 12;
        screenShakeTime = 20;
        bossActive = false;
        currentBoss = null;
        state = STATE.PLAYING;
    }

    function gameOver() {
        state = STATE.GAMEOVER;
        document.getElementById("final-score").textContent = Math.floor(score);
        document.getElementById("final-distance").textContent = Math.floor(distance) + "m";
        document.getElementById("final-kills").textContent = killCount;
        document.getElementById("final-combo").textContent = maxCombo + "x";
        document.getElementById("death-quip").textContent = '"' + DEATH_QUIPS[Math.floor(Math.random() * DEATH_QUIPS.length)] + '"';
        document.getElementById("eco-fact").textContent = ECO_FACTS[Math.floor(Math.random() * ECO_FACTS.length)];
        gameoverOverlay.classList.remove("hidden");
    }

    // ── Drawing ────────────────────────────────────────────────────────
    function draw() {
        ctx.save();
        ctx.translate(Math.round(screenShakeX), Math.round(screenShakeY));

        drawBackground();
        drawPlatforms();
        drawCrystals();
        drawEnemies();
        if (bossActive && currentBoss) drawBoss();
        drawProjectiles();
        drawPlayer();
        drawParticles();
        drawTextPopups();
        drawHUD();

        ctx.restore();
    }

    // ── Background Drawing ─────────────────────────────────────────────
    function drawBackground() {
        const h = healProgress;

        // Sky gradient
        const skyTop = lerpColor("#1a1210", "#1a3a5c", h);
        const skyMid = lerpColor("#2a1f18", "#2a5580", h);
        const skyBot = lerpColor("#3d2e22", "#4a80aa", h);
        const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        grad.addColorStop(0, skyTop);
        grad.addColorStop(0.5, skyMid);
        grad.addColorStop(1, skyBot);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, GROUND_Y);

        // Smog layer
        const smogAlpha = 0.35 * (1 - h);
        if (smogAlpha > 0.01) {
            ctx.fillStyle = `rgba(80, 70, 55, ${smogAlpha})`;
            ctx.fillRect(0, 0, W, GROUND_Y);
        }

        // Far clouds / sun
        if (h > 0.3) {
            // Sun
            const sunAlpha = (h - 0.3) / 0.7;
            ctx.fillStyle = `rgba(255, 220, 100, ${sunAlpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(W - 100, 60, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 240, 180, ${sunAlpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(W - 100, 60, 25, 0, Math.PI * 2);
            ctx.fill();
        }

        // Clouds
        bgElements.farClouds.forEach(c => {
            const cAlpha = 0.15 + h * 0.3;
            ctx.fillStyle = `rgba(200, 210, 220, ${cAlpha})`;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w / 2, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x - c.w * 0.2, c.y + 4, c.w * 0.3, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        // Mountains / buildings
        bgElements.mountains.forEach(m => {
            const mCol = lerpColor("#252018", "#2a5040", h);
            ctx.fillStyle = mCol;
            ctx.beginPath();
            ctx.moveTo(m.x, GROUND_Y);
            ctx.lineTo(m.x + m.w / 2, GROUND_Y - m.h);
            ctx.lineTo(m.x + m.w, GROUND_Y);
            ctx.fill();
            // Snow caps when healed
            if (h > 0.5) {
                ctx.fillStyle = `rgba(255,255,255,${(h - 0.5) * 0.6})`;
                ctx.beginPath();
                ctx.moveTo(m.x + m.w / 2, GROUND_Y - m.h);
                ctx.lineTo(m.x + m.w / 2 - 15, GROUND_Y - m.h + 20);
                ctx.lineTo(m.x + m.w / 2 + 15, GROUND_Y - m.h + 20);
                ctx.fill();
            }
        });

        // Mid-ground trees
        bgElements.midTrees.forEach(t => {
            const alive = h > 0.2;
            if (alive) {
                // Green tree
                const gAlpha = Math.min(1, (h - 0.2) / 0.3);
                ctx.fillStyle = `rgba(40, 90, 40, ${0.5 + gAlpha * 0.5})`;
                ctx.beginPath();
                ctx.moveTo(t.x, GROUND_Y);
                ctx.lineTo(t.x + 10, GROUND_Y - t.h);
                ctx.lineTo(t.x + 20, GROUND_Y);
                ctx.fill();
                // Trunk
                ctx.fillStyle = "#5d4037";
                ctx.fillRect(t.x + 8, GROUND_Y - t.h * 0.4, 4, t.h * 0.4);
            } else {
                // Dead tree stump
                ctx.fillStyle = "#3a3530";
                ctx.fillRect(t.x + 8, GROUND_Y - 15, 4, 15);
                ctx.beginPath();
                ctx.moveTo(t.x + 10, GROUND_Y - 15);
                ctx.lineTo(t.x + 5, GROUND_Y - 22);
                ctx.moveTo(t.x + 10, GROUND_Y - 12);
                ctx.lineTo(t.x + 16, GROUND_Y - 20);
                ctx.strokeStyle = "#3a3530";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        // Birds when healed
        if (h > 0.6) {
            const birdAlpha = (h - 0.6) / 0.4;
            ctx.strokeStyle = `rgba(50, 50, 50, ${birdAlpha * 0.5})`;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
                const bx = ((animClock * 0.3 + i * 200) % (W + 100)) - 50;
                const by = 40 + i * 25 + Math.sin(animClock * 0.02 + i) * 8;
                ctx.beginPath();
                ctx.moveTo(bx - 6, by + 3);
                ctx.quadraticCurveTo(bx - 3, by - 3, bx, by);
                ctx.quadraticCurveTo(bx + 3, by - 3, bx + 6, by + 3);
                ctx.stroke();
            }
        }

        // Flowers when healed
        if (h > 0.7) {
            const flAlpha = (h - 0.7) / 0.3;
            const flowerColors = ["#e91e63", "#ff9800", "#9c27b0", "#ffeb3b"];
            bgElements.groundDetails.forEach((g, idx) => {
                if (idx % 3 !== 0) return;
                const fc = flowerColors[idx % flowerColors.length];
                ctx.globalAlpha = flAlpha;
                ctx.fillStyle = fc;
                ctx.beginPath();
                ctx.arc(g.x, GROUND_Y - 4, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#4caf50";
                ctx.fillRect(g.x - 0.5, GROUND_Y - 4, 1, 4);
                ctx.globalAlpha = 1;
            });
        }

        // Ground
        const groundCol = lerpColor("#3a3530", "#2d6a3e", h);
        const groundTopCol = lerpColor("#504840", "#3d9a4e", h);
        ctx.fillStyle = groundCol;
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
        ctx.fillStyle = groundTopCol;
        ctx.fillRect(0, GROUND_Y, W, 4);

        // Ground details (trash when polluted, grass when healed)
        bgElements.groundDetails.forEach(g => {
            if (h < 0.5) {
                // Trash details
                ctx.fillStyle = `rgba(100, 90, 70, ${0.5 - h})`;
                if (g.type === 0) { ctx.fillRect(g.x, GROUND_Y + 6, 5, 3); }
                else if (g.type === 1) { ctx.beginPath(); ctx.arc(g.x, GROUND_Y + 8, 2, 0, Math.PI * 2); ctx.fill(); }
            }
            if (h > 0.3) {
                // Grass tufts
                ctx.strokeStyle = `rgba(60, 140, 60, ${Math.min(1, (h - 0.3) * 2)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(g.x, GROUND_Y);
                ctx.lineTo(g.x - 2, GROUND_Y - 5);
                ctx.moveTo(g.x, GROUND_Y);
                ctx.lineTo(g.x + 2, GROUND_Y - 4);
                ctx.stroke();
            }
        });
    }

    function drawPlatforms() { /* future extension */ }

    // ── Draw Player ────────────────────────────────────────────────────
    function drawPlayer() {
        ctx.save();
        const px = player.x, py = player.y;

        // Invuln flashing
        if (player.invulnTimer > 0 && Math.floor(player.invulnTimer / 4) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        if (player.sliding) {
            drawPlayerSliding(px, py);
        } else if (player.state === "dead") {
            drawPlayerDead(px, py);
        } else {
            drawPlayerNormal(px, py);
        }

        ctx.restore();
    }

    function drawPlayerNormal(px, py) {
        const frame = player.animFrame;

        // Jetpack (tin cans on back)
        ctx.fillStyle = "#9e9e9e";
        ctx.fillRect(px - 4, py + 8, 6, 22);
        ctx.fillStyle = "#757575";
        ctx.fillRect(px - 5, py + 8, 8, 4);
        ctx.fillRect(px - 5, py + 18, 8, 4);
        ctx.fillRect(px - 5, py + 26, 8, 4);
        // Bamboo struts
        ctx.strokeStyle = "#a1887f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - 2, py + 8);
        ctx.lineTo(px + 4, py + 4);
        ctx.moveTo(px - 2, py + 30);
        ctx.lineTo(px + 4, py + 34);
        ctx.stroke();

        // Jetpack flames (when jumping)
        if (player.jumping) {
            const fl = 8 + Math.random() * 8;
            ctx.fillStyle = "#ff9800";
            ctx.beginPath();
            ctx.moveTo(px - 3, py + 30);
            ctx.lineTo(px + 1, py + 30 + fl);
            ctx.lineTo(px + 5, py + 30);
            ctx.fill();
            ctx.fillStyle = "#ffeb3b";
            ctx.beginPath();
            ctx.moveTo(px - 1, py + 30);
            ctx.lineTo(px + 1, py + 30 + fl * 0.6);
            ctx.lineTo(px + 3, py + 30);
            ctx.fill();
        } else {
            // Sputtering sparks
            if (frame % 2 === 0) {
                ctx.fillStyle = "#ff9800";
                ctx.beginPath();
                ctx.arc(px, py + 32, 2 + Math.random() * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Body (patchwork vest)
        ctx.fillStyle = "#5d4037"; // vest
        ctx.fillRect(px + 4, py + 10, 20, 18);
        // Patches
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(px + 6, py + 12, 6, 6);
        ctx.fillStyle = "#4e342e";
        ctx.fillRect(px + 16, py + 14, 5, 7);
        ctx.fillStyle = "#ff9800";
        ctx.fillRect(px + 10, py + 20, 4, 4);

        // Arms
        ctx.fillStyle = "#8d6e63";
        const armAngle = player.shootAnim > 0 ? -0.3 : Math.sin(animClock * 0.1 + frame * 0.5) * 0.3;
        ctx.save();
        ctx.translate(px + 24, py + 14);
        ctx.rotate(armAngle);
        ctx.fillRect(0, 0, 10, 4);
        ctx.restore();

        // Head
        ctx.fillStyle = "#d7a86e"; // skin
        ctx.fillRect(px + 8, py, 16, 12);

        // Hair
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(px + 7, py - 2, 18, 5);
        ctx.fillRect(px + 6, py, 3, 4);

        // Goggles
        if (player.hitTimer > 10) {
            // Askew goggles
            ctx.save();
            ctx.translate(px + 16, py + 4);
            ctx.rotate(0.3);
            ctx.fillStyle = "#37474f";
            ctx.fillRect(-8, -3, 16, 6);
            ctx.fillStyle = "#4fc3f7";
            ctx.fillRect(-6, -2, 5, 4);
            ctx.fillStyle = "#4fc3f7";
            ctx.fillRect(1, -2, 5, 4);
            ctx.restore();
        } else {
            ctx.fillStyle = "#37474f";
            ctx.fillRect(px + 8, py + 2, 16, 6);
            ctx.fillStyle = "#4fc3f7";
            ctx.fillRect(px + 9, py + 3, 6, 4);
            ctx.fillStyle = "#81d4fa";
            ctx.fillRect(px + 17, py + 3, 6, 4);
            // Goggle shine
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fillRect(px + 10, py + 3, 2, 2);
            ctx.fillRect(px + 18, py + 3, 2, 2);
        }

        // Smile
        ctx.fillStyle = "#4e342e";
        ctx.fillRect(px + 14, py + 9, 4, 1);

        // Legs (animated)
        ctx.fillStyle = "#3e2723";
        const legKick = Math.sin(animClock * 0.15 + frame * 1.5) * 5;
        // Left leg
        ctx.fillRect(px + 8, py + 28, 5, 12 + (player.jumping ? 0 : legKick));
        // Right leg
        ctx.fillRect(px + 16, py + 28, 5, 12 + (player.jumping ? 0 : -legKick));
        // Shoes
        ctx.fillStyle = "#f44336";
        ctx.fillRect(px + 7, py + 38 + (player.jumping ? 2 : Math.max(0, legKick)), 7, 4);
        ctx.fillRect(px + 15, py + 38 + (player.jumping ? 2 : Math.max(0, -legKick)), 7, 4);

        // Weapon in hand (when shooting)
        if (player.shootAnim > 0) {
            const wc = WEAPONS[currentWeapon].color;
            ctx.fillStyle = "#616161";
            ctx.fillRect(px + 28, py + 12, 8, 4);
            ctx.fillStyle = wc;
            ctx.beginPath();
            ctx.arc(px + 38, py + 14, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Double jump spin effect
        if (player.state === "doublejump" && player.jumping) {
            ctx.strokeStyle = "rgba(255, 213, 79, 0.4)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px + PLAYER_W / 2, py + PLAYER_H / 2, 24, animClock * 0.3, animClock * 0.3 + Math.PI);
            ctx.stroke();
        }
    }

    function drawPlayerSliding(px, py) {
        const sy = py + PLAYER_H - 16;
        // Sliding body (horizontal)
        ctx.fillStyle = "#5d4037";
        ctx.fillRect(px, sy, PLAYER_W + 8, 10);
        // Head
        ctx.fillStyle = "#d7a86e";
        ctx.fillRect(px + PLAYER_W - 2, sy - 4, 12, 10);
        // Goggles
        ctx.fillStyle = "#37474f";
        ctx.fillRect(px + PLAYER_W + 2, sy - 2, 8, 4);
        ctx.fillStyle = "#4fc3f7";
        ctx.fillRect(px + PLAYER_W + 3, sy - 1, 3, 2);
        ctx.fillStyle = "#81d4fa";
        ctx.fillRect(px + PLAYER_W + 7, sy - 1, 3, 2);
        // Speed lines
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const lx = px - 10 - Math.random() * 15;
            const ly = sy + 2 + i * 4;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - 15, ly);
            ctx.stroke();
        }
        // Jetpack sparks while sliding
        ctx.fillStyle = "#ff9800";
        ctx.beginPath();
        ctx.arc(px - 2, sy + 5, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPlayerDead(px, py) {
        ctx.save();
        ctx.translate(px + PLAYER_W / 2, py + PLAYER_H / 2);
        ctx.rotate(Math.sin(animClock * 0.05) * 0.5 + 0.3);

        // Falling body
        ctx.fillStyle = "#5d4037";
        ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = "#d7a86e";
        ctx.fillRect(-6, -18, 12, 10);
        // X eyes
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -14); ctx.lineTo(0, -10);
        ctx.moveTo(0, -14); ctx.lineTo(-4, -10);
        ctx.moveTo(2, -14); ctx.lineTo(6, -10);
        ctx.moveTo(6, -14); ctx.lineTo(2, -10);
        ctx.stroke();

        // Goggles flying off
        const gOff = animClock * 0.1;
        ctx.fillStyle = "#37474f";
        ctx.save();
        ctx.translate(10 + gOff * 2, -20 - gOff * 3);
        ctx.rotate(gOff * 0.5);
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillStyle = "#4fc3f7";
        ctx.fillRect(-5, -1, 4, 2);
        ctx.fillRect(1, -1, 4, 2);
        ctx.restore();

        ctx.restore();
    }

    // ── Draw Enemies ───────────────────────────────────────────────────
    function drawEnemies() {
        enemies.forEach(e => {
            ctx.save();
            if (e.flashTimer > 0) {
                ctx.globalAlpha = 0.6;
                ctx.filter = "brightness(2)";
            }
            if (e.type === "styrofoam") ctx.globalAlpha = e.phaseAlpha;

            switch (e.type) {
                case "bottle": drawBottleMonster(e); break;
                case "oilblob": drawOilBlob(e); break;
                case "smokestack": drawSmokeStack(e); break;
                case "tirespider": drawTireSpider(e); break;
                case "ewaste": drawEWasteGremlin(e); break;
                case "styrofoam": drawStyrofoamPhantom(e); break;
            }
            ctx.restore();
        });
    }

    function drawGooglyEyes(x, y, size, lookDir) {
        // Left eye
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x - size * 0.6, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        const pupilOff = size * 0.3 * lookDir;
        ctx.beginPath();
        ctx.arc(x - size * 0.6 + pupilOff, y + size * 0.1, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Right eye
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x + size * 0.6, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(x + size * 0.6 + pupilOff, y + size * 0.1, size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Blink sometimes
        if (Math.floor(animClock * 0.016) % 4 === 0 && Math.sin(animClock * 0.1 + x) > 0.95) {
            ctx.fillStyle = "#fff";
            ctx.fillRect(x - size * 1.6, y - size * 0.3, size * 3.2, size * 0.6);
        }
    }

    function drawBottleMonster(e) {
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        // Bottle body - transparent blue
        ctx.fillStyle = "rgba(100, 180, 255, 0.4)";
        ctx.strokeStyle = "rgba(100, 180, 255, 0.7)";
        ctx.lineWidth = 1.5;
        // Bottle shape
        ctx.beginPath();
        ctx.moveTo(e.x + 5, e.y + e.h);
        ctx.lineTo(e.x + 3, e.y + 10);
        ctx.lineTo(e.x + 6, e.y + 6);
        ctx.lineTo(e.x + 8, e.y + 2);
        ctx.lineTo(e.x + 12, e.y + 2);
        ctx.lineTo(e.x + 14, e.y + 6);
        ctx.lineTo(e.x + 17, e.y + 10);
        ctx.lineTo(e.x + 15, e.y + e.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Cap (hat)
        ctx.fillStyle = "#e53935";
        ctx.fillRect(e.x + 7, e.y - 2, 6, 5);
        ctx.fillRect(e.x + 5, e.y + 1, 10, 2);
        // Label
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(e.x + 5, e.y + 14, 10, 8);
        // Googly eyes
        drawGooglyEyes(cx, e.y + 10, 3, -1);
        // Tiny feet
        ctx.fillStyle = "rgba(100, 180, 255, 0.6)";
        const footBounce = Math.sin(animClock * 0.1) * 2;
        ctx.fillRect(e.x + 4, e.y + e.h - 2, 4, 3 + footBounce);
        ctx.fillRect(e.x + 12, e.y + e.h - 2, 4, 3 - footBounce);
    }

    function drawOilBlob(e) {
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        // Black blob body with rainbow sheen
        const wobble = Math.sin(e.wobblePhase) * 3;
        ctx.fillStyle = "#1a1a1a";
        ctx.beginPath();
        ctx.ellipse(cx + wobble, cy + 2, e.w / 2 + 2, e.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rainbow iridescence
        const iriGrad = ctx.createLinearGradient(e.x, e.y, e.x + e.w, e.y + e.h);
        iriGrad.addColorStop(0, "rgba(255,0,100,0.15)");
        iriGrad.addColorStop(0.3, "rgba(0,255,100,0.15)");
        iriGrad.addColorStop(0.6, "rgba(0,100,255,0.15)");
        iriGrad.addColorStop(1, "rgba(255,200,0,0.15)");
        ctx.fillStyle = iriGrad;
        ctx.beginPath();
        ctx.ellipse(cx + wobble, cy + 2, e.w / 2, e.h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Slippery trail
        ctx.fillStyle = "rgba(20, 20, 20, 0.3)";
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(e.x + e.w + i * 8, GROUND_Y - 2, 4, 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // Googly eyes
        drawGooglyEyes(cx + wobble, cy - 4, 4, -1);
        // Evil grin
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + wobble, cy + 4, 6, 0.1, Math.PI - 0.1);
        ctx.stroke();
    }

    function drawSmokeStack(e) {
        const cx = e.x + e.w / 2;
        // Main body - grey rectangle
        ctx.fillStyle = "#616161";
        ctx.fillRect(e.x + 2, e.y + 10, e.w - 4, e.h - 10);
        // Darker bands
        ctx.fillStyle = "#424242";
        ctx.fillRect(e.x + 2, e.y + 15, e.w - 4, 4);
        ctx.fillRect(e.x + 2, e.y + 30, e.w - 4, 4);
        ctx.fillRect(e.x + 2, e.y + 45, e.w - 4, 4);
        // Chimney top
        ctx.fillStyle = "#757575";
        ctx.fillRect(e.x, e.y + 6, e.w, 8);
        ctx.fillStyle = "#424242";
        ctx.fillRect(e.x - 2, e.y + 4, e.w + 4, 4);
        // Pipe arms
        ctx.fillStyle = "#9e9e9e";
        ctx.save();
        ctx.translate(e.x, e.y + 25);
        ctx.rotate(Math.sin(animClock * 0.03) * 0.2);
        ctx.fillRect(-12, -3, 14, 6);
        ctx.fillRect(-14, -4, 4, 8); // hand
        ctx.restore();
        ctx.save();
        ctx.translate(e.x + e.w, e.y + 25);
        ctx.rotate(-Math.sin(animClock * 0.03) * 0.2);
        ctx.fillRect(-2, -3, 14, 6);
        ctx.fillRect(10, -4, 4, 8);
        ctx.restore();
        // Smoke puffs from top
        const smokeAlpha = 0.3 + Math.sin(animClock * 0.05) * 0.15;
        ctx.fillStyle = `rgba(100,100,100,${smokeAlpha})`;
        for (let i = 0; i < 3; i++) {
            const sy = e.y - 5 - i * 12 - Math.sin(animClock * 0.04 + i) * 4;
            const sr = 6 + i * 3 + Math.sin(animClock * 0.06 + i) * 2;
            ctx.beginPath();
            ctx.arc(cx + Math.sin(animClock * 0.03 + i * 2) * 4, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
        // Googly eyes
        drawGooglyEyes(cx, e.y + 18, 4, -1);
        // Angry brow
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 8, e.y + 13);
        ctx.lineTo(cx - 3, e.y + 15);
        ctx.moveTo(cx + 8, e.y + 13);
        ctx.lineTo(cx + 3, e.y + 15);
        ctx.stroke();
    }

    function drawTireSpider(e) {
        const cx = e.x + e.w / 2 + (e.jitterX || 0);
        const cy = e.y + e.h / 2 + (e.jitterY || 0);
        // Tire legs (6 legs)
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + animClock * 0.05;
            const legLen = 14 + Math.sin(animClock * 0.1 + i * 2) * 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * legLen, cy + Math.sin(angle) * legLen);
            ctx.stroke();
            // Tire foot
            ctx.fillStyle = "#1a1a1a";
            ctx.beginPath();
            ctx.arc(cx + Math.cos(angle) * legLen, cy + Math.sin(angle) * legLen, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        // Main tire body (stack)
        ctx.fillStyle = "#1a1a1a";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tread marks
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const ta = (i / 4) * Math.PI * 2 + animClock * 0.08;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ta) * 7, cy + Math.sin(ta) * 5);
            ctx.lineTo(cx + Math.cos(ta) * 11, cy + Math.sin(ta) * 9);
            ctx.stroke();
        }
        // Googly eyes
        drawGooglyEyes(cx, cy - 3, 3, -1);
    }

    function drawEWasteGremlin(e) {
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        // Circuit board body
        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(e.x, e.y + 2, e.w, e.h - 4);
        // Circuit traces
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x + 2, e.y + 5);
        ctx.lineTo(e.x + 8, e.y + 5);
        ctx.lineTo(e.x + 8, e.y + 10);
        ctx.moveTo(e.x + 10, e.y + 4);
        ctx.lineTo(e.x + 14, e.y + 8);
        ctx.lineTo(e.x + 14, e.y + 14);
        ctx.stroke();
        // Chip
        ctx.fillStyle = "#111";
        ctx.fillRect(e.x + 4, e.y + 8, 6, 4);
        // Wire arms
        ctx.strokeStyle = "#f44336";
        ctx.lineWidth = 1.5;
        const wireWave = Math.sin(animClock * 0.12 + e.x) * 5;
        ctx.beginPath();
        ctx.moveTo(e.x, cy);
        ctx.quadraticCurveTo(e.x - 5, cy + wireWave, e.x - 8, cy - 2);
        ctx.moveTo(e.x + e.w, cy);
        ctx.quadraticCurveTo(e.x + e.w + 5, cy - wireWave, e.x + e.w + 8, cy + 2);
        ctx.stroke();
        // Wire legs
        ctx.beginPath();
        ctx.moveTo(e.x + 3, e.y + e.h);
        ctx.lineTo(e.x + 1, e.y + e.h + 4);
        ctx.moveTo(e.x + e.w - 3, e.y + e.h);
        ctx.lineTo(e.x + e.w - 1, e.y + e.h + 4);
        ctx.stroke();
        // Googly eyes
        drawGooglyEyes(cx, e.y + 5, 2.5, -1);
        // Sparks
        if (e.sparkTimer > 15) {
            ctx.fillStyle = "#ffeb3b";
            ctx.beginPath();
            const sx = e.x + Math.random() * e.w;
            const sy = e.y + Math.random() * e.h;
            ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawStyrofoamPhantom(e) {
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        const float = Math.sin(animClock * 0.04 + e.floatPhase) * 4;
        // Ghost body
        ctx.fillStyle = `rgba(240, 240, 240, ${e.phaseAlpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(cx, cy + float - 2, 10, Math.PI, 0);
        ctx.lineTo(cx + 10, cy + float + 10);
        // Wavy bottom
        for (let i = 0; i < 5; i++) {
            const wx = cx + 10 - i * 5;
            const wy = cy + float + 10 + (i % 2 === 0 ? 4 : 0);
            ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.fill();
        // Inner texture (styrofoam dots)
        ctx.fillStyle = `rgba(200,200,200,${e.phaseAlpha * 0.3})`;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(cx - 5 + (i % 3) * 5, cy + float - 4 + Math.floor(i / 3) * 5, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        // Googly eyes
        ctx.globalAlpha = e.phaseAlpha;
        drawGooglyEyes(cx, cy + float - 4, 3, -1);
        ctx.globalAlpha = e.phaseAlpha;
        // Spooky mouth
        ctx.fillStyle = `rgba(100,100,100,${e.phaseAlpha * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy + float + 3, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // ── Draw Boss ──────────────────────────────────────────────────────
    function drawBoss() {
        const b = currentBoss;
        ctx.save();
        if (b.flashTimer > 0) {
            ctx.filter = "brightness(2)";
        }

        if (b.type === 0) drawLandfillBoss(b);
        else if (b.type === 1) drawCorporateBoss(b);
        else if (b.type === 2) drawGarbagePatchBoss(b);

        ctx.restore();

        // Boss projectiles
        b.projectiles.forEach(bp => {
            ctx.fillStyle = bp.color;
            if (bp.type === "trash") {
                ctx.save();
                ctx.translate(bp.x, bp.y);
                ctx.rotate(animClock * 0.1);
                ctx.fillRect(-6, -6, 12, 12);
                ctx.restore();
            } else if (bp.type === "missile") {
                ctx.fillRect(bp.x - 8, bp.y - 3, 16, 6);
                ctx.fillStyle = "#ff5722";
                ctx.beginPath();
                ctx.arc(bp.x - 8, bp.y, 3, 0, Math.PI * 2);
                ctx.fill();
            } else if (bp.type === "dollar") {
                ctx.fillStyle = "#4caf50";
                ctx.fillRect(bp.x - 5, bp.y - 7, 10, 14);
                ctx.fillStyle = "#2e7d32";
                ctx.font = "bold 10px monospace";
                ctx.fillText("$", bp.x - 3, bp.y + 4);
            } else if (bp.type === "tentacle") {
                ctx.strokeStyle = bp.color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(bp.x + 10, bp.y);
                ctx.quadraticCurveTo(bp.x, bp.y + Math.sin(animClock * 0.1) * 5, bp.x - 10, bp.y);
                ctx.stroke();
            }
        });

        // Boss health bar
        const barW = 300, barH = 14;
        const barX = (W - barW) / 2, barY = 15;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
        ctx.fillStyle = "#333";
        ctx.fillRect(barX, barY, barW, barH);
        const hpPct = Math.max(0, b.hp / b.maxHp);
        const hpColor = hpPct > 0.5 ? "#ef5350" : hpPct > 0.25 ? "#ff9800" : "#f44336";
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * hpPct, barH);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(b.name.toUpperCase(), W / 2, barY + 11);
        ctx.textAlign = "left";
    }

    function drawLandfillBoss(b) {
        // Huge mound of trash
        ctx.fillStyle = "#6d4c41";
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + b.h);
        ctx.quadraticCurveTo(b.x + b.w / 2, b.y - 20, b.x + b.w, b.y + b.h);
        ctx.fill();
        // Trash layers
        const trashColors = ["#8d6e63", "#78909c", "#4caf50", "#ff9800", "#e91e63"];
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = trashColors[i % trashColors.length];
            const tx = b.x + 10 + (i % 4) * 22;
            const ty = b.y + 30 + Math.floor(i / 4) * 35 + Math.sin(animClock * 0.03 + i) * 3;
            ctx.fillRect(tx, ty, 12 + i * 2, 8 + i);
        }
        // Shopping bag crown
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2 - 12, b.y + 10);
        ctx.lineTo(b.x + b.w / 2, b.y - 10);
        ctx.lineTo(b.x + b.w / 2 + 12, b.y + 10);
        ctx.lineTo(b.x + b.w / 2 + 8, b.y + 25);
        ctx.lineTo(b.x + b.w / 2 - 8, b.y + 25);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e53935";
        ctx.font = "bold 8px sans-serif";
        ctx.fillText("SHOP", b.x + b.w / 2 - 12, b.y + 18);
        // Face
        drawGooglyEyes(b.x + b.w / 2, b.y + 50, 8, -1);
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + 70, 12, 0, Math.PI);
        ctx.fill();
    }

    function drawCorporateBoss(b) {
        // Robot body in suit
        ctx.fillStyle = "#37474f";
        ctx.fillRect(b.x + 15, b.y + 30, 70, 90);
        // Suit lapels
        ctx.fillStyle = "#263238";
        ctx.beginPath();
        ctx.moveTo(b.x + 50, b.y + 30);
        ctx.lineTo(b.x + 20, b.y + 70);
        ctx.lineTo(b.x + 50, b.y + 60);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(b.x + 50, b.y + 30);
        ctx.lineTo(b.x + 80, b.y + 70);
        ctx.lineTo(b.x + 50, b.y + 60);
        ctx.fill();
        // Tie
        ctx.fillStyle = "#c62828";
        ctx.beginPath();
        ctx.moveTo(b.x + 47, b.y + 35);
        ctx.lineTo(b.x + 53, b.y + 35);
        ctx.lineTo(b.x + 51, b.y + 70);
        ctx.lineTo(b.x + 49, b.y + 70);
        ctx.closePath();
        ctx.fill();
        // Robot head
        ctx.fillStyle = "#78909c";
        ctx.fillRect(b.x + 25, b.y, 50, 35);
        // Antenna
        ctx.strokeStyle = "#90a4ae";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x + 50, b.y);
        ctx.lineTo(b.x + 50, b.y - 15);
        ctx.stroke();
        ctx.fillStyle = "#f44336";
        ctx.beginPath();
        ctx.arc(b.x + 50, b.y - 15, 4, 0, Math.PI * 2);
        ctx.fill();
        // Evil red eyes
        ctx.fillStyle = "#f44336";
        ctx.fillRect(b.x + 33, b.y + 12, 12, 6);
        ctx.fillRect(b.x + 55, b.y + 12, 12, 6);
        // Smoke stacks on shoulders
        ctx.fillStyle = "#455a64";
        ctx.fillRect(b.x + 5, b.y + 25, 12, 30);
        ctx.fillRect(b.x + 83, b.y + 25, 12, 30);
        // Smoke
        for (let i = 0; i < 2; i++) {
            const sx = i === 0 ? b.x + 11 : b.x + 89;
            ctx.fillStyle = `rgba(100,100,100,${0.3 + Math.sin(animClock * 0.05 + i) * 0.15})`;
            ctx.beginPath();
            ctx.arc(sx, b.y + 20 - Math.sin(animClock * 0.04 + i) * 5, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        // Robot legs
        ctx.fillStyle = "#455a64";
        ctx.fillRect(b.x + 25, b.y + 120, 15, 20);
        ctx.fillRect(b.x + 60, b.y + 120, 15, 20);
    }

    function drawGarbagePatchBoss(b) {
        // Massive wave of debris
        ctx.fillStyle = "#006064";
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + b.h);
        // Wave shape
        for (let i = 0; i <= b.w; i += 5) {
            const wy = b.y + 20 + Math.sin((i + animClock * 2) * 0.05) * 15;
            ctx.lineTo(b.x + i, wy);
        }
        ctx.lineTo(b.x + b.w, b.y + b.h);
        ctx.closePath();
        ctx.fill();
        // Plastic debris floating in it
        const debrisColors = ["#e3f2fd", "#fff", "#ffcdd2", "#c8e6c9", "#fff9c4"];
        for (let i = 0; i < 12; i++) {
            ctx.fillStyle = debrisColors[i % debrisColors.length];
            const dx = b.x + 10 + (i % 5) * 18 + Math.sin(animClock * 0.03 + i) * 4;
            const dy = b.y + 25 + Math.floor(i / 5) * 35 + Math.cos(animClock * 0.04 + i) * 6;
            ctx.save();
            ctx.translate(dx, dy);
            ctx.rotate(animClock * 0.02 + i);
            ctx.fillRect(-4, -3, 8, 6);
            ctx.restore();
        }
        // Glowing core
        const coreGlow = 0.5 + Math.sin(animClock * 0.06) * 0.3;
        ctx.fillStyle = `rgba(0, 230, 118, ${coreGlow})`;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 18 + Math.sin(animClock * 0.08) * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(105, 240, 174, ${coreGlow * 0.8})`;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 10, 0, Math.PI * 2);
        ctx.fill();
        // Tentacles
        ctx.strokeStyle = "#00838f";
        ctx.lineWidth = 4;
        for (let i = 0; i < 4; i++) {
            const ta = (i / 4) * Math.PI - Math.PI / 2;
            const tentLen = 40 + Math.sin(animClock * 0.04 + i * 2) * 10;
            const tcx = b.x + b.w / 2;
            const tcy = b.y + b.h / 2;
            ctx.beginPath();
            ctx.moveTo(tcx, tcy);
            ctx.quadraticCurveTo(
                tcx + Math.cos(ta) * tentLen * 0.5 + Math.sin(animClock * 0.06 + i) * 10,
                tcy + Math.sin(ta) * tentLen * 0.5,
                tcx + Math.cos(ta) * tentLen,
                tcy + Math.sin(ta) * tentLen
            );
            ctx.stroke();
        }
        // Face on the core
        drawGooglyEyes(b.x + b.w / 2, b.y + b.h / 2 - 3, 5, -1);
    }

    // ── Draw Projectiles ───────────────────────────────────────────────
    function drawProjectiles() {
        projectiles.forEach(p => {
            ctx.fillStyle = p.color;
            if (p.weapIdx === 0) {
                // Water cannon: stream
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,0.3)";
                ctx.beginPath();
                ctx.arc(p.x - 1, p.y - 1, p.size * 0.3, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.weapIdx === 1) {
                // Solar beam: golden laser
                ctx.fillRect(p.x - p.size * 2, p.y - 1.5, p.size * 4, 3);
                ctx.fillStyle = "rgba(255,255,255,0.5)";
                ctx.fillRect(p.x - p.size, p.y - 0.5, p.size * 2, 1);
            } else if (p.weapIdx === 2) {
                // Recycling ray: green spiral
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, animClock * 0.2, animClock * 0.2 + Math.PI * 1.5);
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.weapIdx === 3) {
                // Nature's wrath: vine whip
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(p.x - 8, p.y);
                ctx.quadraticCurveTo(p.x, p.y + Math.sin(animClock * 0.15) * 8, p.x + 8, p.y);
                ctx.stroke();
                // Leaves
                ctx.fillStyle = "#4caf50";
                ctx.beginPath();
                ctx.ellipse(p.x + 6, p.y - 3, 4, 2, 0.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    // ── Draw Crystals ──────────────────────────────────────────────────
    function drawCrystals() {
        crystals.forEach(c => {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            // Diamond shape
            ctx.fillStyle = "#ce93d8";
            ctx.beginPath();
            ctx.moveTo(0, -c.size);
            ctx.lineTo(c.size * 0.7, 0);
            ctx.lineTo(0, c.size);
            ctx.lineTo(-c.size * 0.7, 0);
            ctx.closePath();
            ctx.fill();
            // Inner shine
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.beginPath();
            ctx.moveTo(0, -c.size * 0.5);
            ctx.lineTo(c.size * 0.3, 0);
            ctx.lineTo(0, c.size * 0.5);
            ctx.lineTo(-c.size * 0.3, 0);
            ctx.closePath();
            ctx.fill();
            // Glow
            ctx.shadowColor = "#ce93d8";
            ctx.shadowBlur = 10;
            ctx.restore();
        });
    }

    // ── Draw Particles ─────────────────────────────────────────────────
    function drawParticles() {
        particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            if (p.confetti) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        });
    }

    // ── Draw Text Popups ───────────────────────────────────────────────
    function drawTextPopups() {
        textPopups.forEach(t => {
            const alpha = t.life / t.maxLife;
            const scale = t.life > t.maxLife * 0.8 ? 1 + (t.life - t.maxLife * 0.8) / (t.maxLife * 0.2) * 0.3 : 1;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${Math.round(t.size * scale)}px 'Inter', sans-serif`;
            ctx.textAlign = "center";
            // Outline
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = 3;
            ctx.strokeText(t.text, t.x, t.y);
            // Fill
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        });
    }

    // ── HUD (on canvas) ────────────────────────────────────────────────
    function drawHUD() {
        // Score (top center)
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(W / 2 - 70, 8, 140, 34);
        ctx.fillStyle = "#ffd8a2";
        ctx.font = "bold 18px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(Math.floor(score), W / 2, 30);
        // Combo
        if (combo >= 2) {
            const comboCol = combo >= 10 ? "#ff9800" : combo >= 5 ? "#ffd54f" : combo >= 3 ? "#42a5f5" : "#4caf50";
            ctx.fillStyle = comboCol;
            ctx.font = "bold 11px 'Inter', sans-serif";
            ctx.fillText("x" + combo + " COMBO", W / 2, 44);
        }

        // Distance (top right)
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(W - 110, 8, 100, 26);
        ctx.fillStyle = "#a8b5a0";
        ctx.font = "12px 'JetBrains Mono', monospace";
        ctx.textAlign = "right";
        ctx.fillText(Math.floor(distance) + "m", W - 18, 26);
        ctx.textAlign = "left";

        // Lives (top left)
        for (let i = 0; i < 3; i++) {
            const hx = 15 + i * 24;
            if (i < lives) {
                // Full heart
                ctx.fillStyle = "#ef4444";
                drawHeart(hx, 18, 8);
            } else {
                // Empty heart
                ctx.fillStyle = "#333";
                drawHeart(hx, 18, 8);
            }
        }

        // Weapon indicator (bottom left on canvas)
        const weap = WEAPONS[currentWeapon];
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(8, H - 32, 120, 24);
        ctx.fillStyle = weap.color;
        ctx.beginPath();
        ctx.arc(22, H - 20, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ccc";
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText(weap.name, 34, H - 16);
    }

    function drawHeart(x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.3);
        ctx.bezierCurveTo(x - size, y + size * 0.7, x, y + size, x, y + size * 1.2);
        ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.7, x + size, y + size * 0.3);
        ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
        ctx.fill();
    }

    // ── Color Utilities ────────────────────────────────────────────────
    function lerpColor(a, b, t) {
        const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
        const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const bv = Math.round(ab + (bb - ab) * t);
        return `rgb(${r},${g},${bv})`;
    }

    // ── Game Loop ──────────────────────────────────────────────────────
    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const rawDt = timestamp - lastTime;
        lastTime = timestamp;
        // Cap dt to avoid spiral of death
        const dt = Math.min(rawDt / 16.667, 3); // normalize to ~60fps

        update(dt);
        draw();
        requestAnimationFrame(gameLoop);
    }

    // ── Start / Restart ────────────────────────────────────────────────
    function startGame() {
        resetGame();
        state = STATE.PLAYING;
        startOverlay.classList.add("hidden");
        gameoverOverlay.classList.add("hidden");
        lastTime = 0;
    }

    btnStart.addEventListener("click", () => {
        startGame();
    });
    btnRestart.addEventListener("click", () => {
        startGame();
    });

    // Weapon sidebar clicks
    document.querySelectorAll(".weapon-slot").forEach(el => {
        el.addEventListener("click", () => {
            const idx = parseInt(el.dataset.weapon);
            if (unlockedWeapons && unlockedWeapons[idx]) switchWeapon(idx);
        });
    });

    // ── Init ───────────────────────────────────────────────────────────
    resetGame();
    // Draw initial frame
    draw();
    requestAnimationFrame(gameLoop);

})();

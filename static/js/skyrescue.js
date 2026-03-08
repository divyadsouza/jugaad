/* ==========================================================================
   Sky Rescue — Purify the Skies
   A side-scrolling action platformer about restoring polluted skies.
   ========================================================================== */

(function () {
    "use strict";

    /* ------------------------------------------------------------------
       CONSTANTS
    ------------------------------------------------------------------ */
    const CW = 960;          // canvas logical width
    const CH = 540;          // canvas logical height
    const GRAVITY = 0.48;
    const MAX_FALL = 12;
    const JUMP_FORCE = -10.5;
    const JUMP_HOLD = -0.35; // extra upward while holding jump
    const DOUBLE_JUMP_FORCE = -9;
    const MOVE_ACCEL = 0.55;
    const MOVE_MAX = 5;
    const FRICTION = 0.82;
    const AIR_FRICTION = 0.92;
    const DASH_SPEED = 14;
    const DASH_DURATION = 8;  // frames
    const DASH_COOLDOWN = 120; // frames (~2 sec)
    const FAST_FALL = 8;

    const ZONE_LEN = 2000;   // pixels per zone
    const TOTAL_LEN = ZONE_LEN * 3;

    const PLAYER_W = 28;
    const PLAYER_H = 36;

    const ECO_FACTS = [
        "Air pollution causes 7 million premature deaths yearly \u2014 WHO",
        "The ozone layer won't fully recover until 2066",
        "Indoor air can be 2-5x more polluted than outdoor air",
        "Trees remove 22 million tons of CO\u2082 per year in the US alone",
        "1 in 8 deaths globally is linked to air pollution",
        "Electric vehicles produce 50% less lifecycle emissions",
        "Planting 1 trillion trees could capture 25% of annual CO\u2082",
        "The atmosphere is only 60 miles thin \u2014 thinner than an apple's skin relative to size"
    ];

    /* ------------------------------------------------------------------
       STATE
    ------------------------------------------------------------------ */
    let canvas, ctx;
    let running = false;
    let paused = false;
    let lastTime = 0;
    let accumulator = 0;
    const STEP = 1000 / 60;

    // Camera
    let camX = 0;

    // Player
    let P = {};
    // Input
    let keys = {};
    let mouseDown = false;
    let fireRequested = false;

    // World objects
    let platforms = [];
    let enemies = [];
    let crystals = [];
    let projectiles = [];
    let particles = [];
    let windCurrents = [];
    let bosses = [];
    let bossActive = null;

    // Game state
    let score = 0;
    let health = 5;
    let maxHealth = 5;
    let purification = [0, 0, 0]; // per-zone meter (0-100)
    let zonePurified = [false, false, false];
    let currentZone = 0;
    let crystalsCollected = 0;
    let enemiesDefeated = 0;
    let invincibleTimer = 0;
    let screenShake = 0;
    let healWave = -1;     // x-position of the healing sweep, -1 = inactive

    // Animation frame counter
    let frameTick = 0;

    /* ------------------------------------------------------------------
       HELPERS
    ------------------------------------------------------------------ */
    function rand(a, b) { return a + Math.random() * (b - a); }
    function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function aabb(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    }
    function dist(a, b) {
        let dx = a.x - b.x, dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    function getZone(x) {
        if (x < ZONE_LEN) return 0;
        if (x < ZONE_LEN * 2) return 1;
        return 2;
    }
    function randomFact() { return ECO_FACTS[randInt(0, ECO_FACTS.length - 1)]; }

    /* ------------------------------------------------------------------
       SPRITE DRAWING  (programmatic pixel-art characters)
    ------------------------------------------------------------------ */
    const SPR = {
        // Draw the Eco Guardian
        player(x, y, frame, state, facingRight, auraColor) {
            ctx.save();
            ctx.translate(x, y);
            if (!facingRight) {
                ctx.scale(-1, 1);
                ctx.translate(-PLAYER_W, 0);
            }

            // Aura glow
            ctx.globalAlpha = 0.2 + 0.1 * Math.sin(frameTick * 0.1);
            ctx.fillStyle = auraColor;
            ctx.beginPath();
            ctx.ellipse(PLAYER_W / 2, PLAYER_H / 2, PLAYER_W * 0.9, PLAYER_H * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Body
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(6, 10, 16, 18);

            // Head
            ctx.fillStyle = '#f5d0a9';
            ctx.fillRect(8, 0, 12, 12);

            // Eyes
            ctx.fillStyle = '#fff';
            ctx.fillRect(10, 3, 4, 4);
            ctx.fillRect(16, 3, 4, 4);
            ctx.fillStyle = '#1e3a5f';
            ctx.fillRect(12, 4, 2, 3);
            ctx.fillRect(18, 4, 2, 3);

            // Hair
            ctx.fillStyle = '#1e3a5f';
            ctx.fillRect(7, 0, 14, 3);

            // Cape / wings
            if (state === 'fly') {
                let wf = Math.sin(frameTick * 0.15) * 3;
                ctx.fillStyle = '#60a5fa';
                ctx.beginPath();
                ctx.moveTo(6, 12);
                ctx.lineTo(-4, 20 + wf);
                ctx.lineTo(-2, 28 + wf);
                ctx.lineTo(6, 22);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = '#60a5fa';
                ctx.beginPath();
                ctx.moveTo(6, 12);
                ctx.lineTo(2, 26);
                ctx.lineTo(6, 24);
                ctx.closePath();
                ctx.fill();
            }

            // Legs
            let legOff = 0;
            if (state === 'run') {
                legOff = Math.sin(frameTick * 0.3) * 3;
            }
            ctx.fillStyle = '#1e40af';
            ctx.fillRect(8, 28, 5, 8 + legOff);
            ctx.fillRect(15, 28, 5, 8 - legOff);

            // Boots
            ctx.fillStyle = '#92400e';
            ctx.fillRect(7, 34 + Math.max(0, legOff), 6, 3);
            ctx.fillRect(14, 34 + Math.max(0, -legOff), 6, 3);

            // Dash blur
            if (state === 'dash') {
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = '#93c5fd';
                ctx.fillRect(-8, 8, 10, 20);
                ctx.fillRect(-16, 12, 8, 14);
                ctx.globalAlpha = 1;
            }

            // Attack — beam arm
            if (state === 'attack') {
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(22, 14, 8, 4);
            }

            ctx.restore();
        },

        // Smog Puff (Zone 1 enemy)
        smogPuff(x, y, hp, maxHp) {
            ctx.save();
            ctx.translate(x, y);
            let bob = Math.sin(frameTick * 0.05 + x) * 3;
            ctx.translate(0, bob);
            let t = hp / maxHp;
            ctx.globalAlpha = 0.5 + 0.5 * t;
            ctx.fillStyle = '#4a5e3a';
            ctx.beginPath();
            ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6b7a50';
            ctx.beginPath();
            ctx.ellipse(-8, -4, 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(8, -6, 12, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            // Eyes
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-6, -3, 4, 4);
            ctx.fillRect(3, -3, 4, 4);
            ctx.globalAlpha = 1;
            ctx.restore();
        },

        // Acid Droplet (Zone 2 enemy)
        acidDroplet(x, y) {
            ctx.save();
            ctx.translate(x, y);
            ctx.fillStyle = '#84cc16';
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.quadraticCurveTo(10, 0, 0, 12);
            ctx.quadraticCurveTo(-10, 0, 0, -12);
            ctx.fill();
            ctx.fillStyle = '#a3e635';
            ctx.beginPath();
            ctx.arc(-2, -2, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        },

        // Corroded Drone (Zone 2 enemy)
        corrodedDrone(x, y, hp, maxHp) {
            ctx.save();
            ctx.translate(x, y);
            let prop = Math.sin(frameTick * 0.4) * 6;
            ctx.fillStyle = '#78716c';
            ctx.fillRect(-14, -6, 28, 12);
            ctx.fillStyle = '#57534e';
            ctx.fillRect(-10, -10, 6, 6);
            ctx.fillRect(4, -10, 6, 6);
            // Propellers
            ctx.fillStyle = '#a8a29e';
            ctx.fillRect(-12 + prop, -14, 10, 2);
            ctx.fillRect(2 - prop, -14, 10, 2);
            // Eye
            ctx.fillStyle = hp > maxHp / 2 ? '#ef4444' : '#fbbf24';
            ctx.fillRect(-3, -2, 6, 4);
            ctx.restore();
        },

        // Smog Wraith (Zone 3 enemy — invisible until close)
        smogWraith(x, y, alpha) {
            ctx.save();
            ctx.translate(x, y);
            ctx.globalAlpha = alpha;
            let wave = Math.sin(frameTick * 0.08) * 4;
            ctx.fillStyle = '#1c1917';
            ctx.beginPath();
            ctx.ellipse(0, 0, 18, 22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#44403c';
            ctx.beginPath();
            ctx.ellipse(0, wave, 14, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            // Glowing eyes
            ctx.fillStyle = '#a855f7';
            ctx.beginPath();
            ctx.arc(-5, -4, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(5, -4, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
        },

        // Crystal
        crystal(x, y, color, glow) {
            ctx.save();
            ctx.translate(x, y);
            let bob = Math.sin(frameTick * 0.08 + x * 0.1) * 3;
            ctx.translate(0, bob);
            // Glow
            ctx.globalAlpha = 0.25 + 0.1 * Math.sin(frameTick * 0.1);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            // Diamond
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.lineTo(7, 0);
            ctx.lineTo(0, 10);
            ctx.lineTo(-7, 0);
            ctx.closePath();
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.lineTo(3, -3);
            ctx.lineTo(0, 0);
            ctx.lineTo(-3, -3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        },

        // Boss health bar
        bossBar(name, hp, maxHp) {
            let bw = 300, bh = 12;
            let bx = (CW - bw) / 2;
            let by = CH - 40;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(bx - 4, by - 18, bw + 8, bh + 24);
            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = '#ffd8a2';
            ctx.textAlign = 'center';
            ctx.fillText(name, CW / 2, by - 5);
            ctx.fillStyle = '#333';
            ctx.fillRect(bx, by, bw, bh);
            let frac = clamp(hp / maxHp, 0, 1);
            let g = ctx.createLinearGradient(bx, 0, bx + bw * frac, 0);
            g.addColorStop(0, '#ef4444');
            g.addColorStop(1, '#f97316');
            ctx.fillStyle = g;
            ctx.fillRect(bx, by, bw * frac, bh);
            ctx.textAlign = 'left';
        }
    };

    /* ------------------------------------------------------------------
       PARTICLE SYSTEM (object pool)
    ------------------------------------------------------------------ */
    const MAX_PARTICLES = 300;

    function spawnParticle(x, y, vx, vy, color, life, size) {
        if (particles.length >= MAX_PARTICLES) {
            // reuse oldest
            let p = particles.shift();
            p.x = x; p.y = y; p.vx = vx; p.vy = vy;
            p.color = color; p.life = life; p.maxLife = life; p.size = size || 3;
            particles.push(p);
        } else {
            particles.push({ x, y, vx, vy, color, life, maxLife: life, size: size || 3 });
        }
    }

    function burstParticles(x, y, color, count, speed) {
        for (let i = 0; i < count; i++) {
            let angle = rand(0, Math.PI * 2);
            let spd = rand(0.5, speed);
            spawnParticle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, color, randInt(20, 50), rand(2, 5));
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.02;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function drawParticles() {
        for (let p of particles) {
            ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - camX, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    /* ------------------------------------------------------------------
       PROJECTILES (object pool)
    ------------------------------------------------------------------ */
    const MAX_PROJ = 30;

    function spawnProjectile(x, y, vx, vy, friendly, color) {
        if (projectiles.length >= MAX_PROJ) return;
        projectiles.push({ x, y, vx, vy, friendly, color, w: 10, h: 4, life: 120 });
    }

    function updateProjectiles() {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            let pr = projectiles[i];
            pr.x += pr.vx;
            pr.y += pr.vy;
            pr.life--;
            if (pr.life <= 0 || pr.x < camX - 50 || pr.x > camX + CW + 50 || pr.y < -50 || pr.y > CH + 50) {
                projectiles.splice(i, 1);
                continue;
            }
            let pb = { x: pr.x, y: pr.y, w: pr.w, h: pr.h };

            if (pr.friendly) {
                // Hit enemies
                for (let j = enemies.length - 1; j >= 0; j--) {
                    let e = enemies[j];
                    if (aabb(pb, { x: e.x - e.r, y: e.y - e.r, w: e.r * 2, h: e.r * 2 })) {
                        e.hp--;
                        burstParticles(e.x, e.y, '#4ade80', 6, 3);
                        projectiles.splice(i, 1);
                        if (e.hp <= 0) {
                            burstParticles(e.x, e.y, '#22c55e', 12, 4);
                            score += e.score || 50;
                            enemiesDefeated++;
                            addPurification(e.zone, 5);
                            enemies.splice(j, 1);
                        }
                        break;
                    }
                }
                // Hit bosses
                if (bossActive && projectiles[i]) {
                    let b = bossActive;
                    if (aabb(pb, { x: b.x - b.hw, y: b.y - b.hh, w: b.hw * 2, h: b.hh * 2 })) {
                        b.hp--;
                        screenShake = 6;
                        burstParticles(b.x, b.y, '#fbbf24', 8, 4);
                        projectiles.splice(i, 1);
                        if (b.hp <= 0) {
                            defeatBoss(b);
                        }
                    }
                }
            } else {
                // Hit player
                let pp = { x: P.x, y: P.y, w: PLAYER_W, h: PLAYER_H };
                if (aabb(pb, pp)) {
                    damagePlayer();
                    projectiles.splice(i, 1);
                }
            }
        }
    }

    function drawProjectiles() {
        for (let pr of projectiles) {
            ctx.fillStyle = pr.color;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(pr.x - camX, pr.y, pr.w, pr.h);
            // trail
            ctx.globalAlpha = 0.3;
            ctx.fillRect(pr.x - camX - pr.vx * 2, pr.y, pr.w, pr.h);
            ctx.globalAlpha = 1;
        }
    }

    /* ------------------------------------------------------------------
       WORLD GENERATION
    ------------------------------------------------------------------ */
    function generateWorld() {
        platforms = [];
        enemies = [];
        crystals = [];
        windCurrents = [];
        bosses = [];

        // Ground segments with gaps
        for (let x = 0; x < TOTAL_LEN; x += 140) {
            // leave gaps for variety
            if (Math.random() < 0.15 && x > 200) continue;
            let zone = getZone(x);
            platforms.push({
                x, y: CH - 40, w: 120 + rand(0, 60), h: 40,
                zone, type: 'ground'
            });
        }

        // Floating platforms
        for (let x = 150; x < TOTAL_LEN; x += rand(120, 250)) {
            let zone = getZone(x);
            let yBase = zone === 0 ? rand(250, 400) : zone === 1 ? rand(200, 380) : rand(180, 360);
            let moving = zone >= 1 && Math.random() < 0.3;
            platforms.push({
                x, y: yBase, w: rand(80, 160), h: 16,
                zone, type: 'float',
                moving, moveRange: moving ? rand(40, 100) : 0,
                moveSpeed: moving ? rand(0.01, 0.025) : 0,
                origY: yBase
            });
        }

        // Crystals on/near platforms
        for (let plat of platforms) {
            if (Math.random() < 0.4) {
                let zone = plat.zone;
                let color = zone === 0 ? '#4ade80' : zone === 1 ? '#38bdf8' : '#fbbf24';
                let glow = zone === 0 ? 'rgba(74,222,128,0.4)' : zone === 1 ? 'rgba(56,189,248,0.4)' : 'rgba(251,191,36,0.4)';
                let value = zone === 2 ? 30 : 10;
                crystals.push({
                    x: plat.x + rand(10, plat.w - 10),
                    y: plat.y - rand(20, 50),
                    color, glow, value, zone,
                    collected: false
                });
            }
        }

        // Extra floating crystals
        for (let x = 100; x < TOTAL_LEN; x += rand(200, 400)) {
            let zone = getZone(x);
            let color = zone === 0 ? '#4ade80' : zone === 1 ? '#38bdf8' : '#fbbf24';
            let glow = zone === 0 ? 'rgba(74,222,128,0.4)' : zone === 1 ? 'rgba(56,189,248,0.4)' : 'rgba(251,191,36,0.4)';
            let value = zone === 2 ? 30 : 10;
            crystals.push({
                x: x + rand(0, 80), y: rand(100, 300),
                color, glow, value, zone,
                collected: false
            });
        }

        // Enemies — Zone 1: Smog Puffs
        for (let x = 300; x < ZONE_LEN - 200; x += rand(180, 350)) {
            enemies.push({
                x: x, y: rand(180, 380), r: 20,
                type: 'smogPuff', zone: 0, hp: 2, maxHp: 2,
                score: 50, shootTimer: randInt(60, 120)
            });
        }

        // Enemies — Zone 2: Acid Droplets + Corroded Drones
        for (let x = ZONE_LEN + 200; x < ZONE_LEN * 2 - 200; x += rand(200, 350)) {
            if (Math.random() < 0.5) {
                enemies.push({
                    x: x, y: rand(50, 150), r: 12,
                    type: 'acidDrop', zone: 1, hp: 1, maxHp: 1,
                    vy: rand(1.5, 3), score: 30
                });
            } else {
                enemies.push({
                    x: x, y: rand(150, 350), r: 16,
                    type: 'drone', zone: 1, hp: 3, maxHp: 3,
                    score: 80, patternT: 0, origY: rand(150, 350),
                    shootTimer: randInt(80, 160)
                });
            }
        }

        // Enemies — Zone 3: Smog Wraiths + Pollution Vortexes
        for (let x = ZONE_LEN * 2 + 200; x < TOTAL_LEN - 300; x += rand(250, 400)) {
            if (Math.random() < 0.5) {
                enemies.push({
                    x: x, y: rand(150, 380), r: 22,
                    type: 'wraith', zone: 2, hp: 3, maxHp: 3,
                    score: 100, alpha: 0
                });
            } else {
                enemies.push({
                    x: x, y: rand(200, 400), r: 30,
                    type: 'vortex', zone: 2, hp: 4, maxHp: 4,
                    score: 120, pullRadius: 120
                });
            }
        }

        // Wind currents (Zone 2 and 3)
        for (let x = ZONE_LEN + 300; x < TOTAL_LEN - 200; x += rand(300, 600)) {
            windCurrents.push({
                x: x, y: rand(100, 350), w: rand(60, 150), h: rand(120, 200),
                vx: rand(-1, 1), vy: rand(-3, -1.5)
            });
        }

        // Bosses setup (spawned when purification reaches threshold)
        bosses = [
            {
                zone: 0, name: 'SMOG TITAN', hp: 5, maxHp: 5,
                x: ZONE_LEN - 200, y: 200, hw: 50, hh: 60,
                active: false, defeated: false,
                attackTimer: 0, phase: 0
            },
            {
                zone: 1, name: 'ACID RAIN SERPENT', hp: 8, maxHp: 8,
                x: ZONE_LEN * 2 - 200, y: 200, hw: 60, hh: 30,
                active: false, defeated: false,
                attackTimer: 0, phase: 0, segmentT: 0
            },
            {
                zone: 2, name: 'THE GREAT POLLUTION', hp: 15, maxHp: 15,
                x: TOTAL_LEN - 300, y: CH / 2 - 50, hw: 100, hh: 120,
                active: false, defeated: false,
                attackTimer: 0, phase: 0
            }
        ];
    }

    /* ------------------------------------------------------------------
       PLAYER
    ------------------------------------------------------------------ */
    function resetPlayer() {
        P = {
            x: 80, y: CH - 120,
            vx: 0, vy: 0,
            w: PLAYER_W, h: PLAYER_H,
            onGround: false,
            jumps: 2, jumpHeld: false,
            facingRight: true,
            dashing: false, dashTimer: 0, dashCooldown: 0, dashDir: 1,
            attackTimer: 0, fireCD: 0,
            state: 'idle' // idle, run, fly, dash, attack
        };
    }

    function updatePlayer() {
        let left = keys['a'] || keys['arrowleft'];
        let right = keys['d'] || keys['arrowright'];
        let jumpKey = keys['w'] || keys['arrowup'] || keys[' '];
        let downKey = keys['s'] || keys['arrowdown'];
        let dashKey = keys['shift'];

        // Dash
        if (dashKey && P.dashCooldown <= 0 && !P.dashing) {
            P.dashing = true;
            P.dashTimer = DASH_DURATION;
            P.dashCooldown = DASH_COOLDOWN;
            P.dashDir = P.facingRight ? 1 : -1;
            burstParticles(P.x + PLAYER_W / 2, P.y + PLAYER_H / 2, '#93c5fd', 8, 3);
        }

        if (P.dashing) {
            P.vx = DASH_SPEED * P.dashDir;
            P.vy = 0;
            P.dashTimer--;
            if (P.dashTimer <= 0) P.dashing = false;
        } else {
            // Horizontal movement
            if (left) {
                P.vx -= MOVE_ACCEL;
                P.facingRight = false;
            }
            if (right) {
                P.vx += MOVE_ACCEL;
                P.facingRight = true;
            }
            P.vx = clamp(P.vx, -MOVE_MAX, MOVE_MAX);
            if (!left && !right) {
                P.vx *= P.onGround ? FRICTION : AIR_FRICTION;
            }

            // Jump
            if (jumpKey && !P.jumpHeld && P.jumps > 0) {
                if (P.onGround) {
                    P.vy = JUMP_FORCE;
                } else {
                    P.vy = DOUBLE_JUMP_FORCE;
                    burstParticles(P.x + PLAYER_W / 2, P.y + PLAYER_H, '#60a5fa', 6, 2);
                }
                P.jumps--;
                P.onGround = false;
                P.jumpHeld = true;
            }
            if (jumpKey && P.vy < 0) {
                P.vy += JUMP_HOLD; // variable height
            }
            if (!jumpKey) P.jumpHeld = false;

            // Fast fall
            if (downKey && !P.onGround) {
                P.vy = Math.max(P.vy, FAST_FALL);
            }

            // Gravity
            P.vy += GRAVITY;
            if (P.vy > MAX_FALL) P.vy = MAX_FALL;
        }

        P.dashCooldown = Math.max(0, P.dashCooldown - 1);

        // Move
        P.x += P.vx;
        P.y += P.vy;

        // Wind currents
        for (let wc of windCurrents) {
            let pb = { x: P.x, y: P.y, w: PLAYER_W, h: PLAYER_H };
            if (aabb(pb, wc)) {
                P.vx += wc.vx * 0.15;
                P.vy += wc.vy * 0.12;
            }
        }

        // Platform collision
        P.onGround = false;
        for (let pl of platforms) {
            if (pl.moving) {
                pl.y = pl.origY + Math.sin(frameTick * pl.moveSpeed) * pl.moveRange;
            }
            let pb = { x: P.x, y: P.y, w: PLAYER_W, h: PLAYER_H };
            if (aabb(pb, pl) && P.vy >= 0) {
                // Only land if falling and feet above platform midpoint
                if (P.y + PLAYER_H - P.vy <= pl.y + 8) {
                    P.y = pl.y - PLAYER_H;
                    P.vy = 0;
                    P.onGround = true;
                    P.jumps = 2;
                }
            }
        }

        // Boundaries
        if (P.x < 0) { P.x = 0; P.vx = 0; }
        if (P.x > TOTAL_LEN - PLAYER_W) { P.x = TOTAL_LEN - PLAYER_W; P.vx = 0; }

        // Fell off screen
        if (P.y > CH + 60) {
            damagePlayer();
            P.y = CH - 200;
            P.vy = -5;
        }

        // Fire purification beam
        P.fireCD = Math.max(0, P.fireCD - 1);
        if ((fireRequested || keys['z']) && P.fireCD <= 0) {
            let dir = P.facingRight ? 1 : -1;
            spawnProjectile(
                P.x + (P.facingRight ? PLAYER_W : -10),
                P.y + PLAYER_H / 2 - 2,
                8 * dir, 0, true, '#4ade80'
            );
            P.fireCD = 15;
            P.attackTimer = 10;
            fireRequested = false;
        }

        // Invincibility
        invincibleTimer = Math.max(0, invincibleTimer - 1);
        P.attackTimer = Math.max(0, P.attackTimer - 1);

        // State
        if (P.dashing) P.state = 'dash';
        else if (P.attackTimer > 0) P.state = 'attack';
        else if (!P.onGround) P.state = 'fly';
        else if (Math.abs(P.vx) > 0.5) P.state = 'run';
        else P.state = 'idle';

        // Collect crystals
        for (let c of crystals) {
            if (c.collected) continue;
            let dx = P.x + PLAYER_W / 2 - c.x;
            let dy = P.y + PLAYER_H / 2 - c.y;
            if (Math.sqrt(dx * dx + dy * dy) < 28) {
                c.collected = true;
                score += c.value * 10;
                crystalsCollected++;
                addPurification(c.zone, c.value);
                burstParticles(c.x, c.y, c.color, 10, 3);
            }
        }

        // Zone tracking
        currentZone = getZone(P.x);
    }

    function damagePlayer() {
        if (invincibleTimer > 0) return;
        health--;
        invincibleTimer = 90;
        screenShake = 10;
        burstParticles(P.x + PLAYER_W / 2, P.y + PLAYER_H / 2, '#ef4444', 10, 4);
        if (health <= 0) {
            gameOver();
        }
    }

    function addPurification(zone, amount) {
        if (zone < 0 || zone > 2) return;
        purification[zone] = Math.min(100, purification[zone] + amount);
        // Check if zone is now purified -> activate boss
        if (purification[zone] >= 80 && !bosses[zone].active && !bosses[zone].defeated) {
            activateBoss(zone);
        }
    }

    /* ------------------------------------------------------------------
       ENEMIES UPDATE
    ------------------------------------------------------------------ */
    function updateEnemies() {
        for (let e of enemies) {
            // Don't update off-screen enemies
            if (Math.abs(e.x - camX - CW / 2) > CW) continue;

            switch (e.type) {
                case 'smogPuff':
                    e.shootTimer--;
                    if (e.shootTimer <= 0) {
                        e.shootTimer = randInt(90, 150);
                        // Shoot toxic drop toward player
                        let dx = P.x - e.x, dy = P.y - e.y;
                        let len = Math.sqrt(dx * dx + dy * dy) || 1;
                        spawnProjectile(e.x, e.y, (dx / len) * 3, (dy / len) * 3, false, '#84cc16');
                    }
                    break;

                case 'acidDrop':
                    e.y += e.vy;
                    if (e.y > CH + 20) {
                        e.y = -20;
                        e.x += rand(-30, 30);
                    }
                    break;

                case 'drone':
                    e.patternT += 0.02;
                    e.y = e.origY + Math.sin(e.patternT) * 50;
                    e.x += Math.cos(e.patternT * 0.7) * 0.8;
                    e.shootTimer--;
                    if (e.shootTimer <= 0) {
                        e.shootTimer = randInt(100, 180);
                        let dx2 = P.x - e.x, dy2 = P.y - e.y;
                        let len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
                        spawnProjectile(e.x, e.y, (dx2 / len2) * 3.5, (dy2 / len2) * 3.5, false, '#fbbf24');
                    }
                    break;

                case 'wraith':
                    // Invisible until player close
                    let distW = dist({ x: P.x, y: P.y }, { x: e.x, y: e.y });
                    e.alpha = distW < 200 ? clamp(1 - distW / 200, 0, 1) : 0;
                    // Move toward player when visible
                    if (e.alpha > 0.3) {
                        let dxw = P.x - e.x, dyw = P.y - e.y;
                        let lenw = Math.sqrt(dxw * dxw + dyw * dyw) || 1;
                        e.x += (dxw / lenw) * 1.2;
                        e.y += (dyw / lenw) * 1.2;
                    }
                    break;

                case 'vortex':
                    // Pull player in
                    let dv = dist({ x: P.x, y: P.y }, { x: e.x, y: e.y });
                    if (dv < e.pullRadius && dv > 5) {
                        let pull = 0.5 * (1 - dv / e.pullRadius);
                        P.vx += ((e.x - P.x) / dv) * pull;
                        P.vy += ((e.y - P.y) / dv) * pull;
                    }
                    // Spin particles
                    if (frameTick % 4 === 0) {
                        let ang = frameTick * 0.1;
                        spawnParticle(e.x + Math.cos(ang) * 25, e.y + Math.sin(ang) * 25,
                            -Math.cos(ang) * 1.5, -Math.sin(ang) * 1.5, '#a855f7', 30, 2);
                    }
                    break;
            }

            // Contact damage
            let eb = { x: e.x - e.r, y: e.y - e.r, w: e.r * 2, h: e.r * 2 };
            let pp = { x: P.x, y: P.y, w: PLAYER_W, h: PLAYER_H };
            if (aabb(eb, pp)) {
                damagePlayer();
            }
        }
    }

    function drawEnemies() {
        for (let e of enemies) {
            let sx = e.x - camX;
            if (sx < -60 || sx > CW + 60) continue;
            switch (e.type) {
                case 'smogPuff': SPR.smogPuff(sx, e.y, e.hp, e.maxHp); break;
                case 'acidDrop': SPR.acidDroplet(sx, e.y); break;
                case 'drone': SPR.corrodedDrone(sx, e.y, e.hp, e.maxHp); break;
                case 'wraith': SPR.smogWraith(sx, e.y, e.alpha); break;
                case 'vortex':
                    ctx.save();
                    ctx.translate(sx, e.y);
                    ctx.globalAlpha = 0.6;
                    ctx.fillStyle = '#581c87';
                    for (let ri = 0; ri < 3; ri++) {
                        let rr = 12 + ri * 10 + Math.sin(frameTick * 0.08 + ri) * 4;
                        ctx.beginPath();
                        ctx.arc(0, 0, rr, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.fillStyle = '#a855f7';
                    ctx.beginPath();
                    ctx.arc(0, 0, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.restore();
                    break;
            }
        }
    }

    /* ------------------------------------------------------------------
       BOSSES
    ------------------------------------------------------------------ */
    function activateBoss(zone) {
        let b = bosses[zone];
        b.active = true;
        bossActive = b;
        screenShake = 15;
    }

    function defeatBoss(b) {
        b.defeated = true;
        b.active = false;
        bossActive = null;
        score += (b.zone + 1) * 500;
        zonePurified[b.zone] = true;
        purification[b.zone] = 100;
        healWave = b.zone * ZONE_LEN;
        burstParticles(b.x, b.y, '#fbbf24', 30, 6);
        screenShake = 20;

        // Check victory
        if (zonePurified[0] && zonePurified[1] && zonePurified[2]) {
            setTimeout(victory, 2000);
        }
    }

    function updateBoss() {
        if (!bossActive) return;
        let b = bossActive;
        b.attackTimer--;

        switch (b.zone) {
            case 0: // Smog Titan
                // Bob up and down
                b.y = 200 + Math.sin(frameTick * 0.02) * 40;
                if (b.attackTimer <= 0) {
                    b.attackTimer = 50;
                    // Toxic rain — several drops
                    for (let i = 0; i < 4; i++) {
                        spawnProjectile(b.x + rand(-40, 40), b.y + 50,
                            rand(-1, 1), rand(2, 4), false, '#84cc16');
                    }
                }
                break;

            case 1: // Acid Rain Serpent
                b.segmentT += 0.03;
                b.x = ZONE_LEN * 2 - 200 + Math.sin(b.segmentT) * 150;
                b.y = 200 + Math.cos(b.segmentT * 1.5) * 100;
                if (b.attackTimer <= 0) {
                    b.attackTimer = 40;
                    let dx = P.x - b.x, dy = P.y - b.y;
                    let len = Math.sqrt(dx * dx + dy * dy) || 1;
                    spawnProjectile(b.x, b.y, (dx / len) * 4, (dy / len) * 4, false, '#84cc16');
                    spawnProjectile(b.x, b.y, (dx / len) * 3, (dy / len) * 3 + 1, false, '#a3e635');
                }
                break;

            case 2: // The Great Pollution
                b.y = CH / 2 - 50 + Math.sin(frameTick * 0.015) * 30;
                if (b.attackTimer <= 0) {
                    b.phase = (b.phase + 1) % 3;
                    switch (b.phase) {
                        case 0: // Slam — line of projectiles
                            b.attackTimer = 70;
                            for (let i = 0; i < 6; i++) {
                                spawnProjectile(b.x, b.y + b.hh,
                                    rand(-3, 3), rand(3, 5), false, '#7c3aed');
                            }
                            screenShake = 8;
                            break;
                        case 1: // Laser sweep
                            b.attackTimer = 50;
                            for (let i = 0; i < 8; i++) {
                                let ang = -Math.PI / 2 + (i / 7) * Math.PI;
                                spawnProjectile(b.x, b.y,
                                    Math.cos(ang) * 4, Math.sin(ang) * 4, false, '#a855f7');
                            }
                            break;
                        case 2: // Spawn minions
                            b.attackTimer = 90;
                            enemies.push({
                                x: b.x + rand(-80, 80), y: b.y + rand(-60, 60), r: 16,
                                type: 'wraith', zone: 2, hp: 1, maxHp: 1,
                                score: 40, alpha: 0.8
                            });
                            break;
                    }
                }

                // Fog particles
                if (frameTick % 3 === 0) {
                    spawnParticle(b.x + rand(-80, 80), b.y + rand(-100, 100),
                        rand(-0.5, 0.5), rand(-0.5, 0.5), 'rgba(30,20,40,0.6)', 60, rand(4, 10));
                }
                break;
        }

        // Contact damage with boss
        let bb = { x: b.x - b.hw, y: b.y - b.hh, w: b.hw * 2, h: b.hh * 2 };
        let pp = { x: P.x, y: P.y, w: PLAYER_W, h: PLAYER_H };
        if (aabb(bb, pp)) {
            damagePlayer();
        }
    }

    function drawBoss() {
        if (!bossActive) return;
        let b = bossActive;
        let sx = b.x - camX;

        ctx.save();
        ctx.translate(sx, b.y);

        switch (b.zone) {
            case 0: // Smog Titan — large cloud entity
                ctx.fillStyle = '#374a28';
                ctx.beginPath();
                ctx.ellipse(0, 0, 50, 55, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#4a5e3a';
                ctx.beginPath();
                ctx.ellipse(-20, -15, 30, 25, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(20, -20, 35, 28, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(0, 20, 40, 25, 0, 0, Math.PI * 2);
                ctx.fill();
                // Eyes
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(-15, -8, 8, 8);
                ctx.fillRect(8, -8, 8, 8);
                // Mouth
                ctx.fillStyle = '#7f1d1d';
                ctx.fillRect(-10, 8, 20, 6);
                break;

            case 1: // Acid Rain Serpent
                // Body segments
                for (let i = 5; i >= 0; i--) {
                    let off = Math.sin(b.segmentT + i * 0.6) * 15;
                    let siz = 20 - i * 2;
                    ctx.fillStyle = i === 0 ? '#65a30d' : '#4d7c0f';
                    ctx.beginPath();
                    ctx.ellipse(-i * 18, off, siz, siz, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Head
                ctx.fillStyle = '#84cc16';
                ctx.beginPath();
                ctx.ellipse(0, 0, 25, 20, 0, 0, Math.PI * 2);
                ctx.fill();
                // Eyes
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(-8, -5, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(8, -5, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(-8, -5, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(8, -5, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 2: // The Great Pollution — massive dark entity
                // Dark body
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#0c0a09';
                ctx.beginPath();
                ctx.ellipse(0, 0, 100, 115, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1c1917';
                ctx.beginPath();
                ctx.ellipse(0, -20, 80, 90, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                // Multiple eyes
                let eyePositions = [[-30, -40], [30, -40], [-15, -15], [15, -15], [0, 10]];
                for (let [ex, ey] of eyePositions) {
                    ctx.fillStyle = '#7c3aed';
                    ctx.beginPath();
                    ctx.arc(ex, ey, 6 + Math.sin(frameTick * 0.05 + ex) * 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#c084fc';
                    ctx.beginPath();
                    ctx.arc(ex, ey, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Tendrils
                ctx.strokeStyle = '#44403c';
                ctx.lineWidth = 4;
                for (let t = 0; t < 6; t++) {
                    let ta = (t / 6) * Math.PI * 2 + frameTick * 0.02;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(ta) * 60, Math.sin(ta) * 70 + 30);
                    ctx.quadraticCurveTo(
                        Math.cos(ta + 0.5) * 100, Math.sin(ta + 0.5) * 100 + 40,
                        Math.cos(ta + 1) * 80, Math.sin(ta + 1) * 90 + 50
                    );
                    ctx.stroke();
                }
                break;
        }

        ctx.restore();

        SPR.bossBar(b.name, b.hp, b.maxHp);
    }

    /* ------------------------------------------------------------------
       BACKGROUND RENDERING (Parallax)
    ------------------------------------------------------------------ */
    function getZoneColors(zone, purified) {
        if (purified) {
            switch (zone) {
                case 0: return { skyTop: '#87CEEB', skyBot: '#b0e0e6', cloud: 'rgba(255,255,255,0.7)', platTop: '#4ade80', platSide: '#166534' };
                case 1: return { skyTop: '#f97316', skyBot: '#fda4af', cloud: 'rgba(255,200,200,0.5)', platTop: '#f472b6', platSide: '#9d174d' };
                case 2: return { skyTop: '#3b82f6', skyBot: '#93c5fd', cloud: 'rgba(255,255,255,0.6)', platTop: '#34d399', platSide: '#065f46' };
            }
        }
        switch (zone) {
            case 0: return { skyTop: '#374151', skyBot: '#4b5563', cloud: 'rgba(100,100,60,0.5)', platTop: '#78716c', platSide: '#44403c' };
            case 1: return { skyTop: '#713f12', skyBot: '#a16207', cloud: 'rgba(200,200,50,0.3)', platTop: '#a8a29e', platSide: '#57534e' };
            case 2: return { skyTop: '#1c1917', skyBot: '#292524', cloud: 'rgba(40,30,50,0.5)', platTop: '#57534e', platSide: '#292524' };
        }
    }

    function drawBackground() {
        // Draw sky for each zone visible on screen
        for (let z = 0; z < 3; z++) {
            let zStart = z * ZONE_LEN;
            let zEnd = zStart + ZONE_LEN;
            let screenStart = Math.max(0, zStart - camX);
            let screenEnd = Math.min(CW, zEnd - camX);
            if (screenEnd <= 0 || screenStart >= CW) continue;

            let colors = getZoneColors(z, zonePurified[z]);

            // If heal wave is active in this zone
            let hwActive = healWave >= zStart && healWave < zEnd;
            let hwScreen = healWave - camX;

            // Sky gradient
            let g = ctx.createLinearGradient(0, 0, 0, CH);
            g.addColorStop(0, colors.skyTop);
            g.addColorStop(1, colors.skyBot);
            ctx.fillStyle = g;
            ctx.fillRect(screenStart, 0, screenEnd - screenStart, CH);

            // Heal wave overlay
            if (hwActive && hwScreen > screenStart && hwScreen < screenEnd) {
                let pureColors = getZoneColors(z, true);
                let pg = ctx.createLinearGradient(0, 0, 0, CH);
                pg.addColorStop(0, pureColors.skyTop);
                pg.addColorStop(1, pureColors.skyBot);
                ctx.fillStyle = pg;
                ctx.fillRect(screenStart, 0, hwScreen - screenStart, CH);

                // Bright edge line
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillRect(hwScreen - 2, 0, 4, CH);
            }

            // Parallax clouds (far layer)
            let cloudOffset = camX * 0.3;
            for (let cx = zStart; cx < zEnd; cx += 200) {
                let scx = cx - cloudOffset - camX * 0.7;
                if (scx < screenStart - 100 || scx > screenEnd + 100) continue;
                ctx.fillStyle = colors.cloud;
                ctx.beginPath();
                ctx.ellipse(scx, 80 + Math.sin(cx * 0.005) * 30, 60 + (cx % 40), 25 + (cx % 20), 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Mid clouds
            let cloudOffset2 = camX * 0.5;
            for (let cx = zStart + 100; cx < zEnd; cx += 300) {
                let scx = cx - cloudOffset2 - camX * 0.5;
                if (scx < screenStart - 80 || scx > screenEnd + 80) continue;
                ctx.fillStyle = colors.cloud;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.ellipse(scx, 180 + Math.sin(cx * 0.008 + 1) * 40, 50 + (cx % 30), 20 + (cx % 15), 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        // Zone 2: Acid rain (if not purified)
        if (!zonePurified[1] && currentZone === 1) {
            ctx.fillStyle = 'rgba(200,200,50,0.3)';
            for (let i = 0; i < 30; i++) {
                let rx = ((frameTick * 2 + i * 97) % CW);
                let ry = ((frameTick * 4 + i * 53) % CH);
                ctx.fillRect(rx, ry, 1, 8);
            }
        }

        // Zone 3: Fog effect (if not purified)
        if (!zonePurified[2] && currentZone === 2) {
            ctx.fillStyle = 'rgba(10,5,15,0.4)';
            ctx.fillRect(0, 0, CW, CH);
            // Visibility circle around player
            let px = P.x - camX + PLAYER_W / 2;
            let py = P.y + PLAYER_H / 2;
            let fogGrad = ctx.createRadialGradient(px, py, 60, px, py, 250);
            fogGrad.addColorStop(0, 'rgba(10,5,15,0)');
            fogGrad.addColorStop(1, 'rgba(10,5,15,0.6)');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, CW, CH);
        }

        // Purified zone extras
        if (zonePurified[0] && currentZone === 0) {
            // Birds
            for (let i = 0; i < 4; i++) {
                let bx = (frameTick * 0.5 + i * 200) % (CW + 200) - 100;
                let by = 60 + Math.sin(frameTick * 0.03 + i * 2) * 20 + i * 30;
                ctx.strokeStyle = '#1e3a5f';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bx - 8, by);
                ctx.quadraticCurveTo(bx - 4, by - 6, bx, by);
                ctx.quadraticCurveTo(bx + 4, by - 6, bx + 8, by);
                ctx.stroke();
            }
        }
        if (zonePurified[2]) {
            // Rainbow
            let rbx = CW / 2;
            for (let i = 0; i < 7; i++) {
                let colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6'];
                ctx.strokeStyle = colors[i];
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(rbx, CH - 40, 200 + i * 8, Math.PI, 0);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
    }

    /* ------------------------------------------------------------------
       PLATFORM DRAWING
    ------------------------------------------------------------------ */
    function drawPlatforms() {
        for (let pl of platforms) {
            let sx = pl.x - camX;
            if (sx + pl.w < -10 || sx > CW + 10) continue;

            let zone = pl.zone;
            let colors = getZoneColors(zone, zonePurified[zone]);

            if (pl.type === 'ground') {
                ctx.fillStyle = colors.platSide;
                ctx.fillRect(sx, pl.y, pl.w, pl.h);
                ctx.fillStyle = colors.platTop;
                ctx.fillRect(sx, pl.y, pl.w, 6);

                // Grass tufts when purified
                if (zonePurified[zone]) {
                    ctx.fillStyle = '#22c55e';
                    for (let gx = sx + 5; gx < sx + pl.w - 5; gx += 12) {
                        ctx.fillRect(gx, pl.y - 4, 2, 4);
                        ctx.fillRect(gx + 4, pl.y - 6, 2, 6);
                        ctx.fillRect(gx + 8, pl.y - 3, 2, 3);
                    }
                    // Flowers on zone 1 purified
                    if (zone === 1) {
                        for (let fx = sx + 10; fx < sx + pl.w - 10; fx += 30) {
                            ctx.fillStyle = '#f472b6';
                            ctx.beginPath();
                            ctx.arc(fx, pl.y - 6, 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }
            } else {
                // Floating platform
                ctx.fillStyle = colors.platSide;
                // Rounded rect
                let r = 4;
                ctx.beginPath();
                ctx.moveTo(sx + r, pl.y);
                ctx.lineTo(sx + pl.w - r, pl.y);
                ctx.quadraticCurveTo(sx + pl.w, pl.y, sx + pl.w, pl.y + r);
                ctx.lineTo(sx + pl.w, pl.y + pl.h - r);
                ctx.quadraticCurveTo(sx + pl.w, pl.y + pl.h, sx + pl.w - r, pl.y + pl.h);
                ctx.lineTo(sx + r, pl.y + pl.h);
                ctx.quadraticCurveTo(sx, pl.y + pl.h, sx, pl.y + pl.h - r);
                ctx.lineTo(sx, pl.y + r);
                ctx.quadraticCurveTo(sx, pl.y, sx + r, pl.y);
                ctx.fill();
                ctx.fillStyle = colors.platTop;
                ctx.fillRect(sx, pl.y, pl.w, 4);
            }
        }
    }

    /* ------------------------------------------------------------------
       WIND CURRENTS
    ------------------------------------------------------------------ */
    function drawWindCurrents() {
        for (let wc of windCurrents) {
            let sx = wc.x - camX;
            if (sx + wc.w < 0 || sx > CW) continue;

            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(sx, wc.y, wc.w, wc.h);
            ctx.globalAlpha = 1;

            // Animated upward particles inside
            for (let i = 0; i < 5; i++) {
                let px = sx + (frameTick * 0.3 + i * (wc.w / 5)) % wc.w;
                let py = wc.y + wc.h - ((frameTick * 1.5 + i * 40) % wc.h);
                ctx.fillStyle = 'rgba(147,197,253,0.5)';
                ctx.fillRect(px, py, 2, 6);
            }
        }
    }

    /* ------------------------------------------------------------------
       CRYSTALS
    ------------------------------------------------------------------ */
    function drawCrystals() {
        for (let c of crystals) {
            if (c.collected) continue;
            let sx = c.x - camX;
            if (sx < -20 || sx > CW + 20) continue;
            SPR.crystal(sx, c.y, c.color, c.glow);
        }
    }

    /* ------------------------------------------------------------------
       HUD
    ------------------------------------------------------------------ */
    function drawHUD() {
        // Health hearts
        for (let i = 0; i < maxHealth; i++) {
            let hx = 16 + i * 26;
            let hy = 16;
            if (i < health) {
                ctx.fillStyle = '#ef4444';
                // Heart shape
                ctx.beginPath();
                ctx.moveTo(hx + 6, hy + 4);
                ctx.bezierCurveTo(hx + 6, hy, hx, hy, hx, hy + 4);
                ctx.bezierCurveTo(hx, hy + 8, hx + 6, hy + 12, hx + 6, hy + 14);
                ctx.bezierCurveTo(hx + 6, hy + 12, hx + 12, hy + 8, hx + 12, hy + 4);
                ctx.bezierCurveTo(hx + 12, hy, hx + 6, hy, hx + 6, hy + 4);
                ctx.fill();
            } else {
                ctx.strokeStyle = '#57534e';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(hx + 6, hy + 4);
                ctx.bezierCurveTo(hx + 6, hy, hx, hy, hx, hy + 4);
                ctx.bezierCurveTo(hx, hy + 8, hx + 6, hy + 12, hx + 6, hy + 14);
                ctx.bezierCurveTo(hx + 6, hy + 12, hx + 12, hy + 8, hx + 12, hy + 4);
                ctx.bezierCurveTo(hx + 12, hy, hx + 6, hy, hx + 6, hy + 4);
                ctx.stroke();
            }
        }

        // Score
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = '#ffd8a2';
        ctx.textAlign = 'center';
        ctx.fillText('SCORE: ' + score, CW / 2, 26);
        ctx.textAlign = 'left';

        // Zone indicator
        let zoneNames = ['TOXIC CLOUDLANDS', 'ACID RAIN VALLEY', 'THE GREAT SMOG'];
        let zoneColors = ['#4ade80', '#38bdf8', '#a855f7'];
        if (zonePurified[currentZone]) {
            zoneNames = ['PURE CLOUDLANDS', 'SUNSET VALLEY', 'CLEAR SKIES'];
            zoneColors = ['#87CEEB', '#f97316', '#3b82f6'];
        }
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = zoneColors[currentZone];
        ctx.textAlign = 'right';
        ctx.fillText('ZONE ' + (currentZone + 1) + ': ' + zoneNames[currentZone], CW - 16, 22);
        ctx.textAlign = 'left';

        // Purification meter
        let pmX = CW / 2 - 60;
        let pmY = 34;
        let pmW = 120;
        let pmH = 6;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(pmX, pmY, pmW, pmH);
        let pFrac = purification[currentZone] / 100;
        let pmGrad = ctx.createLinearGradient(pmX, 0, pmX + pmW * pFrac, 0);
        pmGrad.addColorStop(0, zoneColors[currentZone]);
        pmGrad.addColorStop(1, '#fff');
        ctx.fillStyle = pmGrad;
        ctx.fillRect(pmX, pmY, pmW * pFrac, pmH);
        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = '#a8b5a0';
        ctx.textAlign = 'center';
        ctx.fillText('PURIFICATION', CW / 2, pmY + pmH + 10);
        ctx.textAlign = 'left';

        // Dash cooldown indicator near player
        if (P.dashCooldown > 0) {
            let dx = P.x - camX + PLAYER_W / 2;
            let dy = P.y - 12;
            let dashFrac = 1 - P.dashCooldown / DASH_COOLDOWN;
            ctx.strokeStyle = 'rgba(147,197,253,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dx, dy, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dashFrac);
            ctx.stroke();
        }

        // Crystals collected
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillStyle = '#ffd8a2';
        ctx.fillText('Crystals: ' + crystalsCollected, 16, CH - 16);
    }

    /* ------------------------------------------------------------------
       HEAL WAVE ANIMATION
    ------------------------------------------------------------------ */
    function updateHealWave() {
        if (healWave < 0) return;
        healWave += 8;
        // Spawn heal particles at wave edge
        if (frameTick % 2 === 0) {
            spawnParticle(healWave, rand(0, CH), rand(-1, 1), rand(-2, 2), '#4ade80', 40, rand(3, 8));
            spawnParticle(healWave, rand(0, CH), rand(-1, 1), rand(-2, 2), '#87CEEB', 40, rand(3, 8));
        }
        // Once past zone end, stop
        let zoneEnd = (Math.floor(healWave / ZONE_LEN) + 1) * ZONE_LEN;
        if (healWave >= zoneEnd) {
            healWave = -1;
        }
    }

    /* ------------------------------------------------------------------
       CAMERA
    ------------------------------------------------------------------ */
    function updateCamera() {
        let targetX = P.x - CW * 0.35;
        camX = lerp(camX, targetX, 0.08);
        camX = clamp(camX, 0, TOTAL_LEN - CW);
    }

    /* ------------------------------------------------------------------
       SCREEN SHAKE
    ------------------------------------------------------------------ */
    function applyScreenShake() {
        if (screenShake > 0) {
            let sx = rand(-screenShake, screenShake);
            let sy = rand(-screenShake, screenShake);
            ctx.translate(sx, sy);
            screenShake = Math.max(0, screenShake - 0.5);
        }
    }

    /* ------------------------------------------------------------------
       GAME OVER / VICTORY
    ------------------------------------------------------------------ */
    function gameOver() {
        running = false;
        let overlay = document.getElementById('gameover-overlay');
        let statsDiv = document.getElementById('gameover-stats');
        let factDiv = document.getElementById('gameover-fact');

        statsDiv.innerHTML = `
            <div class="end-stat"><div class="end-stat-value">${score}</div><div class="end-stat-label">Score</div></div>
            <div class="end-stat"><div class="end-stat-value">${crystalsCollected}</div><div class="end-stat-label">Crystals</div></div>
            <div class="end-stat"><div class="end-stat-value">${enemiesDefeated}</div><div class="end-stat-label">Enemies</div></div>
            <div class="end-stat"><div class="end-stat-value">${currentZone + 1}/3</div><div class="end-stat-label">Zones</div></div>
        `;
        factDiv.textContent = randomFact();
        overlay.classList.add('active');
    }

    function victory() {
        running = false;
        let overlay = document.getElementById('victory-overlay');
        let statsDiv = document.getElementById('victory-stats');
        let factDiv = document.getElementById('victory-fact');

        statsDiv.innerHTML = `
            <div class="end-stat"><div class="end-stat-value">${score}</div><div class="end-stat-label">Score</div></div>
            <div class="end-stat"><div class="end-stat-value">${crystalsCollected}</div><div class="end-stat-label">Crystals</div></div>
            <div class="end-stat"><div class="end-stat-value">${enemiesDefeated}</div><div class="end-stat-label">Enemies Purified</div></div>
            <div class="end-stat"><div class="end-stat-value">3/3</div><div class="end-stat-label">Zones Healed</div></div>
        `;
        factDiv.textContent = randomFact();
        overlay.classList.add('active');
    }

    function resetGame() {
        score = 0;
        health = maxHealth;
        purification = [0, 0, 0];
        zonePurified = [false, false, false];
        currentZone = 0;
        crystalsCollected = 0;
        enemiesDefeated = 0;
        invincibleTimer = 0;
        screenShake = 0;
        healWave = -1;
        bossActive = null;
        camX = 0;
        frameTick = 0;
        projectiles = [];
        particles = [];
        resetPlayer();
        generateWorld();
        document.getElementById('gameover-overlay').classList.remove('active');
        document.getElementById('victory-overlay').classList.remove('active');
        running = true;
        lastTime = performance.now();
    }

    /* ------------------------------------------------------------------
       MAIN LOOP
    ------------------------------------------------------------------ */
    function update() {
        if (paused) return;
        frameTick++;
        updatePlayer();
        updateEnemies();
        updateBoss();
        updateProjectiles();
        updateParticles();
        updateHealWave();
        updateCamera();
    }

    function draw() {
        ctx.save();
        applyScreenShake();

        drawBackground();
        drawWindCurrents();
        drawPlatforms();
        drawCrystals();
        drawEnemies();
        drawProjectiles();

        // Draw player
        let px = P.x - camX;
        let py = P.y;
        if (invincibleTimer > 0 && frameTick % 6 < 3) {
            // Blink when invincible
        } else {
            let auraColor = currentZone === 0 ? '#4ade80' : currentZone === 1 ? '#38bdf8' : '#a855f7';
            if (zonePurified[currentZone]) auraColor = '#fbbf24';
            SPR.player(px, py, frameTick, P.state, P.facingRight, auraColor);
        }

        drawBoss();
        drawParticles();
        drawHUD();

        ctx.restore();

        // Pause overlay
        if (paused) {
            ctx.fillStyle = 'rgba(1,26,20,0.7)';
            ctx.fillRect(0, 0, CW, CH);
            ctx.font = '32px Cormorant Garamond, serif';
            ctx.fillStyle = '#ffd8a2';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', CW / 2, CH / 2);
            ctx.font = '14px Inter, sans-serif';
            ctx.fillStyle = '#a8b5a0';
            ctx.fillText('Press P to resume', CW / 2, CH / 2 + 30);
            ctx.textAlign = 'left';
        }
    }

    function gameLoop(timestamp) {
        if (!running) {
            draw(); // still render last frame
            return;
        }

        let dt = timestamp - lastTime;
        lastTime = timestamp;
        if (dt > 100) dt = 100; // cap

        accumulator += dt;
        while (accumulator >= STEP) {
            update();
            accumulator -= STEP;
        }

        draw();
        requestAnimationFrame(gameLoop);
    }

    /* ------------------------------------------------------------------
       CANVAS SCALING
    ------------------------------------------------------------------ */
    function resizeCanvas() {
        let wrapper = document.querySelector('.game-wrapper');
        let ww = wrapper.clientWidth - 16;
        let wh = wrapper.clientHeight - 16;
        let scale = Math.min(ww / CW, wh / CH);
        canvas.style.width = (CW * scale) + 'px';
        canvas.style.height = (CH * scale) + 'px';
    }

    /* ------------------------------------------------------------------
       INPUT
    ------------------------------------------------------------------ */
    function setupInput() {
        document.addEventListener('keydown', (e) => {
            let key = e.key.toLowerCase();
            if (key === ' ' || key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
                e.preventDefault();
            }
            keys[key] = true;

            if (key === 'p' && running) {
                paused = !paused;
                if (!paused) {
                    lastTime = performance.now();
                    requestAnimationFrame(gameLoop);
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
        });

        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            fireRequested = true;
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('resize', resizeCanvas);
    }

    /* ------------------------------------------------------------------
       INIT
    ------------------------------------------------------------------ */
    function init() {
        canvas = document.getElementById('game-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        canvas.width = CW;
        canvas.height = CH;

        resizeCanvas();
        setupInput();

        // Generate world and reset
        resetPlayer();
        generateWorld();

        // Draw initial frame
        draw();

        // Start button
        let startBtn = document.getElementById('btn-start');
        let startOverlay = document.getElementById('start-overlay');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                startOverlay.classList.add('hidden');
                running = true;
                lastTime = performance.now();
                requestAnimationFrame(gameLoop);
            });
        }

        // Retry / replay buttons
        document.getElementById('btn-retry').addEventListener('click', resetGame);
        document.getElementById('btn-replay').addEventListener('click', resetGame);

        // Also start on enter/space from start screen
        document.addEventListener('keydown', function startKey(e) {
            if (e.key === 'Enter' && !running && startOverlay && !startOverlay.classList.contains('hidden')) {
                startOverlay.classList.add('hidden');
                running = true;
                lastTime = performance.now();
                requestAnimationFrame(gameLoop);
                document.removeEventListener('keydown', startKey);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

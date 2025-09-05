class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.chargeStartTime = null;
        this.launched = false;
        this.distance = 0;
        this.maxDistance = 0;
        this.enforcerSkin = 'assets/enforcer.png';
        this.blorkSkin = 'assets/blork.png';
        this.clubSkin = 'assets/club.png';
        this.groundLevel = 0; // Will be set to blork's initial y
        this.landingTime = null; // Track when blork lands
        this.ready = true; // Control retry delay
        this.sliding = false; // Track sliding phase
        this.slideStartTime = null; // Track start of sliding
        this.landingSplashPlayed = false; // Track landing splash
        this.submergedY = null; // Store final submerged y position
    }

    preload() {
        this.load.image('enforcer', this.enforcerSkin);
        this.load.image('blork', this.blorkSkin);
        this.load.image('club', this.clubSkin);
        this.load.image('snow-bg', 'assets/snow-bg.png');
        this.load.audio('hit-sound', 'assets/hit-sound.mp3');
        this.load.audio('scream-sound', 'assets/scream-sound.mp3');
        this.load.audio('splash-sound', 'assets/splash.mp3'); // Add splash sound
        this.load.audio('water-swoosh', 'assets/watery-whoosh.mp3'); // Add watery swoosh sound
        this.load.audio('submerge-sound', 'assets/submerge.mp3'); // Add submerge sound
    }

    create() {
        this.scale.resize(window.innerWidth, window.innerHeight);
        window.addEventListener('resize', () => this.scale.resize(window.innerWidth, window.innerHeight));

        // Background with dynamic width
        this.bg = this.add.tileSprite(0, 0, 5000, this.scale.height, 'snow-bg').setOrigin(0, 0);
        this.bg.setScrollFactor(1);

        // Physics
        this.physics.world.setBounds(0, 0, Infinity, this.scale.height);
        this.physics.world.gravity.y = 150;

        // Enforcer (static)
        this.enforcer = this.add.image(400, this.scale.height - 200, 'enforcer').setScale(0.5);

        // Club (attached to enforcer, for swinging)
        this.club = this.add.image(120, this.scale.height - 150, 'club').setScale(0.5).setOrigin(0, 0.5);
        this.club.setRotation(-Math.PI / 4);

        // Blork (stationary start)
        this.blork = this.physics.add.image(310, this.scale.height - 100, 'blork').setScale(0.3);
        this.groundLevel = this.blork.y; // Set ground level to blork's starting position
        this.blork.setCollideWorldBounds(true);
        this.blork.setBounce(0.4); // Current bounce factor
        this.blork.body.allowGravity = false;

        // Distance signs (every 50m = 500 pixels)
        this.signs = this.add.group();
        for (let distance = 50; distance <= 2000; distance += 50) {
            const xPos = distance * 10; // 1m = 10 pixels
            const sign = this.add.rectangle(xPos, this.groundLevel - 70, 80, 40, 0xD2B48C); // Tan, larger rectangle
            sign.setRotation(-0.0873); // Slight angle (~-5 degrees)
            const signText = this.add.text(xPos, this.groundLevel - 70, `${distance}m`, {
                fontSize: '18px',
                fill: '#fff', // White text
                stroke: '#000', // Black outline
                strokeThickness: 2,
                align: 'center'
            }).setOrigin(0.5, 0.5);
            this.signs.addMultiple([sign, signText]);
        }

        // Sounds
        this.hitSound = this.sound.add('hit-sound');
        this.screamSound = this.sound.add('scream-sound', { volume: 0.5 });
        this.splashSound = this.sound.add('splash-sound', { volume: 0.5 }); // Add splash sound
        this.waterSwoosh = this.sound.add('water-swoosh', { volume: 0.5 }); // Add watery swoosh sound
        this.submergeSound = this.sound.add('submerge-sound', { volume: 0.69 }); // Add submerge sound   

        // Ensure input system is active
        this.input.enabled = true;

        // Setup input listeners
        this.setupInput();

        // Set ready to true after scene setup
        this.ready = true;

        // Camera follow blork
        this.cameras.main.setBounds(0, 0, Infinity, this.scale.height);
        this.cameras.main.startFollow(this.blork, true, 0.08, 0.08);

        // Instructions
        this.add.text(300, 200, 'Click and hold to charge, release to throw!', { fontSize: '20px', fill: '#fff' }).setScrollFactor(0);
    }

    setupInput() {
        // Clear any existing input listeners to avoid duplicates
        this.input.off('pointerdown');
        this.input.off('pointerup');

        // Mouse input for charge and launch
        this.input.on('pointerdown', () => {
            if (this.ready && !this.launched) {
                this.chargeStartTime = this.time.now;
                this.tweens.add({
                    targets: this.club,
                    rotation: Math.PI / 4,
                    duration: 500,
                    yoyo: true,
                    repeat: -1
                });
            } else {
            }
        });

        this.input.on('pointerup', () => {
            if (this.chargeStartTime && this.ready && !this.launched) {
                const chargeTime = this.time.now - this.chargeStartTime;
                const power = Phaser.Math.Clamp(chargeTime / 1000 * 2000, 400, 5000); // Max power 5000
                this.launchBlork(power);
                this.tweens.killTweensOf(this.club);
                this.club.setRotation(Math.PI / 4);
            } else {
            }
        });
    }

    launchBlork(power) {
        this.launched = true;
        this.blork.body.allowGravity = true;
        this.blork.setVelocity(power * 1.2, -power / 2 * 1.2); // Amplified velocity
        this.hitSound.play();
        this.time.delayedCall(800, () => {
            if (this.screamSound.isPlaying) this.screamSound.stop();
            this.screamSound.play({ duration: 1000 });
        }, [], this);
        this.landingSplashPlayed = false; // Reset landing splash flag
    }

    update() {
        if (this.launched) {
            this.distance = Math.floor(this.blork.x / 10);
            this.maxDistance = Math.max(this.maxDistance, this.distance);
            document.getElementById('score').innerText = `Distance: ${this.maxDistance}m`;

            // Apply reduced air resistance
            const velX = this.blork.body.velocity.x;
            const velY = this.blork.body.velocity.y;
            if (velX > 0.5) {
                this.blork.body.setVelocity(velX * 0.9992, velY); // Reduced resistance to 0.9992
            }

            // Check for landing and bounces
            if (this.blork.y >= this.groundLevel - 10 && velY >= 0) { // Loosened threshold
                if (!this.landingTime) {
                    this.landingTime = this.time.now;
                    if (!this.landingSplashPlayed) { // Play splash on first landing
                        this.splashSound.play();
                        this.landingSplashPlayed = true;
                    }
                }
                this.splashSound.play(); // Play splash on each ground contact (landing and bounces)
            }

            // Update background
            if (velX > 0.5) {
                this.bg.tilePositionX += 4;
                this.bg.width = this.cameras.main.scrollX + this.scale.width + 5000;
            }

            // Transition to sliding after 4 seconds post-landing
            const velocityMagnitude = Math.sqrt(this.blork.body.velocity.x * this.blork.body.velocity.x + this.blork.body.velocity.y * this.blork.body.velocity.y);
            if (this.landingTime && this.time.now - this.landingTime >= 4000 && !this.sliding) {
                this.sliding = true;
                this.slideStartTime = this.time.now;
                this.waterSwoosh.play(); // Play watery swoosh sound
            }

            // Apply sliding friction for 4 seconds and handle submerging
            if (this.sliding && this.slideStartTime) {
                if (this.time.now - this.slideStartTime <= 4000) {
                    if (velX > 0) {
                        this.blork.body.setVelocity(velX * 0.99, velY); // Gentler friction during slide
                    }
                } else if (velocityMagnitude > 1 && this.time.now - this.slideStartTime > 4000) {
                    this.blork.body.setVelocity(velX * 0.90, velY); // Final reduction if above 1
                } else if (velocityMagnitude <= 1 && !this.endScreen) {
                    this.submergeSound.play(); // Play submerge sound first
                    // Delay the submerging animation to ensure sound plays before movement
                    this.time.delayedCall(500, () => {
                        // Disable physics body to prevent ghosting
                        this.blork.body.enable = false;
                        // Start submerging animation
                        this.tweens.add({
                            targets: this.blork,
                            y: this.blork.y + 200, // Move downward
                            duration: 2000, // 2 seconds to submerge
                            ease: 'Linear',
                            onUpdate: () => {
                                // Update camera to follow the tweened position
                                this.cameras.main.centerOn(this.blork.x, this.blork.y);
                            },
                            onComplete: () => {
                                this.submergedY = this.blork.y; // Store final position
                                this.showEndScreen(); // Show end screen after submerging
                            }
                        });
                    }, [], this);
                }
            }
        }
    }

    showEndScreen() {
        try {
            if (!this.endScreen) {
                this.endScreen = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width * 0.8, this.scale.height * 0.6, 0x000000, 0.8).setScrollFactor(0);
                // Use the submerged position if available, otherwise default
                if (this.submergedY) {
                    this.blork.setPosition(this.blork.x, this.submergedY);
                }
                this.blork.body.setVelocity(0, 0); // Stop blork movement
                // Display final distance
                this.add.text(this.scale.width / 2, this.scale.height / 2 - 100, `Final Distance: ${this.maxDistance}m`, { fontSize: '32px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0);
                // Load or initialize leaderboard
                let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];
                // Add current score if it's in the top 5
                leaderboard.push(this.maxDistance);
                leaderboard.sort((a, b) => b - a); // Sort descending
                leaderboard = leaderboard.slice(0, 5); // Keep top 5
                localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
                // Display leaderboard
                let yOffset = this.scale.height / 2 - 30;
                this.add.text(this.scale.width / 2, yOffset, 'Leaderboard:', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5).setScrollFactor(0);
                yOffset += 30;
                leaderboard.forEach((score, index) => {
                    this.add.text(this.scale.width / 2, yOffset, `${index + 1}. ${score}m`, { fontSize: '20px', fill: '#fff' }).setOrigin(0.5).setScrollFactor(0);
                    yOffset += 25;
                });
                const tryAgainButton = this.add.text(this.scale.width / 2, yOffset + 20, 'Try Again', { fontSize: '24px', fill: '#fff', backgroundColor: '#00ff00', padding: { x: 20, y: 10 } }).setOrigin(0.5).setInteractive().setScrollFactor(0);

                tryAgainButton.on('pointerdown', () => {
                    this.ready = false;
                    this.tweens.killAll(); // Kill all tweens
                    this.blork.body.setVelocity(0, 0); // Reset blork physics
                    this.blork.setPosition(310, this.scale.height - 100); // Reset to original position
                    this.blork.body.allowGravity = true; // Re-enable physics
                    this.blork.body.enable = true; // Re-enable physics body
                    this.club.setRotation(-Math.PI / 4); // Reset club position
                    this.chargeStartTime = null;
                    this.launched = false;
                    this.distance = 0;
                    this.maxDistance = 0;
                    this.landingTime = null;
                    this.sliding = false;
                    this.slideStartTime = null;
                    this.endScreen = null;
                    this.landingSplashPlayed = false; // Reset landing splash flag
                    this.submergedY = null; // Reset submerged position

                    document.getElementById('score').style.display = 'block';

                    this.scene.restart();
                });

                document.getElementById('score').style.display = 'none';
            }
        } catch (error) {
            console.error('Error creating end screen:', error);
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    physics: { default: 'arcade' },
    scene: GameScene,
    scale: { mode: Phaser.Scale.RESIZE }
};

const game = new Phaser.Game(config);
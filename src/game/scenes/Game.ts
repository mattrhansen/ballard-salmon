import { Scene } from 'phaser';

const JOYSTICK_RADIUS = 50;
const THUMB_RADIUS = 24;

export class Game extends Scene
{
    player: Phaser.Physics.Arcade.Sprite;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };
    groundLayer: Phaser.Tilemaps.TilemapLayer;
    readonly SPEED = 160;

    // Virtual joystick
    joystickBase: Phaser.GameObjects.Arc;
    joystickThumb: Phaser.GameObjects.Arc;
    joystickPointer: Phaser.Input.Pointer | null = null;
    joystickVec: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.buildPlayerTexture();

        const map = this.buildMap();
        this.setupPlayer(map);
        this.setupInput();
        this.setupCamera(map);
        this.setupJoystick();

        const isMobile = !this.sys.game.device.os.desktop;
        const hint = isMobile ? 'Drag the joystick to move' : 'Arrow keys or WASD to move';
        this.add.text(12, 12, hint, {
            fontSize: '13px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
        }).setScrollFactor(0).setDepth(10);
    }

    update ()
    {
        const body = this.player.body as Phaser.Physics.Arcade.Body;

        // Keyboard input
        const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
        const down  = this.cursors.down.isDown  || this.wasd.down.isDown;

        let vx = right ? this.SPEED : left ? -this.SPEED : 0;
        let vy = down  ? this.SPEED : up   ? -this.SPEED : 0;

        // Joystick overrides keyboard if active
        if (this.joystickPointer) {
            vx = this.joystickVec.x * this.SPEED;
            vy = this.joystickVec.y * this.SPEED;
        }

        body.setVelocity(vx, vy);

        if (vx !== 0 && vy !== 0) {
            body.velocity.normalize().scale(this.SPEED);
        }
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private setupJoystick () {
        const baseX = 90, baseY = this.scale.height - 90;

        this.joystickBase = this.add.circle(baseX, baseY, JOYSTICK_RADIUS, 0xffffff, 0.2)
            .setScrollFactor(0).setDepth(20);
        this.add.circle(baseX, baseY, JOYSTICK_RADIUS, 0x000000, 0)
            .setStrokeStyle(2, 0xffffff, 0.5)
            .setScrollFactor(0).setDepth(20);

        this.joystickThumb = this.add.circle(baseX, baseY, THUMB_RADIUS, 0xffffff, 0.5)
            .setScrollFactor(0).setDepth(21);

        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (!this.joystickPointer) this.joystickPointer = p;
        });

        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!this.joystickPointer || p.id !== this.joystickPointer.id) return;

            const dx = p.x - baseX;
            const dy = p.y - baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const clamped = Math.min(dist, JOYSTICK_RADIUS);
            const angle = Math.atan2(dy, dx);

            const tx = baseX + Math.cos(angle) * clamped;
            const ty = baseY + Math.sin(angle) * clamped;
            this.joystickThumb.setPosition(tx, ty);

            // Normalised direction (-1 to 1)
            this.joystickVec.set(
                Math.cos(angle) * (clamped / JOYSTICK_RADIUS),
                Math.sin(angle) * (clamped / JOYSTICK_RADIUS)
            );
        });

        this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (this.joystickPointer && p.id === this.joystickPointer.id) {
                this.joystickPointer = null;
                this.joystickVec.set(0, 0);
                this.joystickThumb.setPosition(baseX, baseY);
            }
        });
    }


    private buildPlayerTexture () {
        const g = this.add.graphics();
        g.fillStyle(0xe74c3c); g.fillRect(4, 8, 18, 16);
        g.fillStyle(0xf5cba7); g.fillRect(7, 0, 12, 12);
        g.fillStyle(0x2c3e50);
        g.fillRect(9, 3, 3, 3);
        g.fillRect(15, 3, 3, 3);
        g.generateTexture('player', 26, 26);
        g.destroy();
    }

    private buildMap (): Phaser.Tilemaps.Tilemap {
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('terrain', 'terrain')!;
        this.groundLayer = map.createLayer('Tile Layer 1', tileset, 0, 0)!;
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        return map;
    }

    private setupPlayer (_map: Phaser.Tilemaps.Tilemap) {
        this.player = this.physics.add.sprite(20 * 16, 15 * 16, 'player');
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.groundLayer);
    }

    private setupInput () {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
    }

    private setupCamera (map: Phaser.Tilemaps.Tilemap) {
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    }
}

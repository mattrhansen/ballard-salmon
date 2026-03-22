import { Scene } from 'phaser';

const TILE = 32;

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

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.buildTilesetTexture();
        this.buildPlayerTexture();

        const map = this.buildMap();
        this.setupPlayer(map);
        this.setupInput();
        this.setupCamera(map);

        this.add.text(12, 12, 'Arrow keys or WASD to move', {
            fontSize: '13px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
        }).setScrollFactor(0).setDepth(10);
    }

    update ()
    {
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
        const down  = this.cursors.down.isDown  || this.wasd.down.isDown;

        const vx = right ? this.SPEED : left ? -this.SPEED : 0;
        const vy = down  ? this.SPEED : up   ? -this.SPEED : 0;

        body.setVelocity(vx, vy);

        // Normalize diagonal so speed stays consistent
        if (vx !== 0 && vy !== 0) {
            body.velocity.normalize().scale(this.SPEED);
        }
    }

    // ─── helpers ────────────────────────────────────────────────────────────

    private buildTilesetTexture () {
        const g = this.add.graphics();

        // 0 – grass
        g.fillStyle(0x4a9e3f); g.fillRect(0, 0, TILE, TILE);
        g.fillStyle(0x3d8434, 0.4);
        [4,14,22,10,28].forEach((x, i) => g.fillRect(x, i * 6, 4, 4));

        // 1 – dirt path
        g.fillStyle(0xc8a458); g.fillRect(TILE, 0, TILE, TILE);
        g.fillStyle(0xa88040, 0.3);
        [TILE+4, TILE+18, TILE+8].forEach((x, i) => g.fillRect(x, i * 10 + 4, 5, 3));

        // 2 – water
        g.fillStyle(0x2979d4); g.fillRect(TILE * 2, 0, TILE, TILE);
        g.fillStyle(0x5599e8, 0.5);
        g.fillRect(TILE * 2 + 4, 8, 20, 4);
        g.fillRect(TILE * 2 + 8, 20, 16, 4);

        // 3 – stone wall
        g.fillStyle(0x6e7a8a); g.fillRect(TILE * 3, 0, TILE, TILE);
        g.lineStyle(1, 0x4a5260);
        g.strokeRect(TILE * 3, 0, TILE, TILE);
        g.strokeRect(TILE * 3, 0, TILE / 2, TILE / 2);
        g.strokeRect(TILE * 3 + TILE / 2, TILE / 2, TILE / 2, TILE / 2);

        g.generateTexture('tiles', TILE * 4, TILE);
        g.destroy();
    }

    private buildPlayerTexture () {
        const g = this.add.graphics();
        // Body
        g.fillStyle(0xe74c3c); g.fillRect(4, 8, 18, 16);
        // Head
        g.fillStyle(0xf5cba7); g.fillRect(7, 0, 12, 12);
        // Eyes
        g.fillStyle(0x2c3e50);
        g.fillRect(9, 3, 3, 3);
        g.fillRect(15, 3, 3, 3);
        g.generateTexture('player', 26, 26);
        g.destroy();
    }

    private buildMap (): Phaser.Tilemaps.Tilemap {
        const COLS = 50, ROWS = 40;

        // Fill with grass
        const data: number[][] = Array.from({ length: ROWS }, () =>
            Array(COLS).fill(0)
        );

        // Stone room (top-left area)
        for (let r = 4; r < 13; r++) {
            for (let c = 4; c < 16; c++) {
                if (r === 4 || r === 12 || c === 4 || c === 15) {
                    data[r][c] = 3;
                } else {
                    data[r][c] = 1; // dirt floor inside
                }
            }
        }
        data[8][15] = 1; // door opening in east wall

        // Dirt path from room to pond
        for (let c = 15; c < 28; c++) data[8][c] = 1;
        for (let r = 8; r < 22; r++)  data[r][27] = 1;

        // Water pond
        for (let r = 18; r < 26; r++) {
            for (let c = 20; c < 34; c++) {
                data[r][c] = 2;
            }
        }
        // Beach around pond
        for (let r = 17; r < 27; r++) {
            for (let c = 19; c < 35; c++) {
                if (data[r][c] !== 2) data[r][c] = 1;
            }
        }

        // Second room (right side)
        for (let r = 10; r < 20; r++) {
            for (let c = 36; c < 48; c++) {
                if (r === 10 || r === 19 || c === 36 || c === 47) {
                    data[r][c] = 3;
                } else {
                    data[r][c] = 1;
                }
            }
        }
        data[15][36] = 1; // west door

        // Path from pond to second room
        for (let c = 34; c < 37; c++) data[15][c] = 1;

        const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
        const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
        this.groundLayer = map.createLayer(0, tileset, 0, 0)!;

        // Walls and water block movement
        this.groundLayer.setCollision([2, 3]);

        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

        return map;
    }

    private setupPlayer (_map: Phaser.Tilemaps.Tilemap) {
        // Start player inside the first room
        this.player = this.physics.add.sprite(8 * TILE, 8 * TILE, 'player');
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

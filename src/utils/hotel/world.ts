import * as THREE from "three";

export type Collider = {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
	enabled: boolean;
};

export type Interactable = {
	id: string;
	mesh: THREE.Object3D;
	prompt: () => string;
	use: () => string;
	update: (dt: number) => void;
	collider?: Collider;
};

export type HotelWorld = {
	colliders: Collider[];
	interactables: Interactable[];
	spawn: THREE.Vector3;
	dispose: () => void;
};

export const PLAYER_RADIUS = 0.32;
export const PLAYER_EYE = 1.64;
export const WALK_SPEED = 4.1;
export const SPRINT_SPEED = 6.6;

type MatBag = {
	marble: THREE.MeshStandardMaterial;
	marbleDark: THREE.MeshStandardMaterial;
	wood: THREE.MeshStandardMaterial;
	woodDark: THREE.MeshStandardMaterial;
	brass: THREE.MeshStandardMaterial;
	velvet: THREE.MeshStandardMaterial;
	wallpaper: THREE.MeshStandardMaterial;
	plaster: THREE.MeshStandardMaterial;
	carpet: THREE.MeshStandardMaterial;
	glass: THREE.MeshStandardMaterial;
	lampShade: THREE.MeshStandardMaterial;
	emissiveWarm: THREE.MeshStandardMaterial;
};

function canvasTexture(
	draw: (ctx: CanvasRenderingContext2D, size: number) => void,
	size = 512,
): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas");
	draw(ctx, size);
	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.anisotropy = 8;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

function makeMaterials(): { bag: MatBag; textures: THREE.Texture[] } {
	const marbleMap = canvasTexture((ctx, s) => {
		const g = ctx.createLinearGradient(0, 0, s, s);
		g.addColorStop(0, "#f4eee6");
		g.addColorStop(0.45, "#e7d8c8");
		g.addColorStop(1, "#d9c7b4");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, s, s);
		ctx.strokeStyle = "rgba(180,150,120,0.28)";
		ctx.lineWidth = 2;
		for (let i = 0; i < 18; i++) {
			ctx.beginPath();
			ctx.moveTo(Math.random() * s, 0);
			ctx.bezierCurveTo(
				Math.random() * s,
				s * 0.4,
				Math.random() * s,
				s * 0.7,
				Math.random() * s,
				s,
			);
			ctx.stroke();
		}
		ctx.fillStyle = "rgba(196,163,90,0.18)";
		for (let x = 0; x < s; x += 64) ctx.fillRect(x, 0, 3, s);
		for (let y = 0; y < s; y += 64) ctx.fillRect(0, y, s, 3);
	});
	marbleMap.repeat.set(8, 6);

	const woodMap = canvasTexture((ctx, s) => {
		ctx.fillStyle = "#4a301c";
		ctx.fillRect(0, 0, s, s);
		for (let y = 0; y < s; y++) {
			const n = 0.85 + Math.sin(y * 0.08) * 0.08 + Math.random() * 0.06;
			ctx.fillStyle = `rgb(${Math.floor(82 * n)},${Math.floor(52 * n)},${Math.floor(28 * n)})`;
			ctx.fillRect(0, y, s, 1);
		}
		ctx.fillStyle = "rgba(0,0,0,0.12)";
		for (let x = 0; x < s; x += 42) ctx.fillRect(x, 0, 2, s);
	});
	woodMap.repeat.set(2, 2);

	const paperMap = canvasTexture((ctx, s) => {
		ctx.fillStyle = "#3a2228";
		ctx.fillRect(0, 0, s, s);
		ctx.fillStyle = "#4a2c34";
		for (let y = 0; y < s; y += 48) {
			ctx.fillRect(0, y, s, 36);
		}
		ctx.strokeStyle = "rgba(196,163,90,0.22)";
		ctx.lineWidth = 2;
		for (let x = 0; x < s; x += 64) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, s);
			ctx.stroke();
		}
	});
	paperMap.repeat.set(6, 3);

	const carpetMap = canvasTexture((ctx, s) => {
		ctx.fillStyle = "#5c2030";
		ctx.fillRect(0, 0, s, s);
		ctx.fillStyle = "#7a2c40";
		for (let i = 0; i < 40; i++) {
			ctx.fillRect((i * 37) % s, (i * 53) % s, 18, 18);
		}
		ctx.strokeStyle = "rgba(196,163,90,0.35)";
		ctx.strokeRect(16, 16, s - 32, s - 32);
		ctx.strokeRect(40, 40, s - 80, s - 80);
	});
	carpetMap.repeat.set(3, 4);

	const bag: MatBag = {
		marble: new THREE.MeshStandardMaterial({
			map: marbleMap,
			roughness: 0.28,
			metalness: 0.08,
		}),
		marbleDark: new THREE.MeshStandardMaterial({
			color: "#cbb9a4",
			roughness: 0.32,
			metalness: 0.1,
		}),
		wood: new THREE.MeshStandardMaterial({
			map: woodMap,
			roughness: 0.62,
			metalness: 0.04,
		}),
		woodDark: new THREE.MeshStandardMaterial({
			color: "#2a1810",
			roughness: 0.7,
			metalness: 0.02,
		}),
		brass: new THREE.MeshStandardMaterial({
			color: "#c4a35a",
			roughness: 0.28,
			metalness: 0.85,
		}),
		velvet: new THREE.MeshStandardMaterial({
			color: "#6b2438",
			roughness: 0.86,
			metalness: 0,
		}),
		wallpaper: new THREE.MeshStandardMaterial({
			map: paperMap,
			roughness: 0.78,
			metalness: 0,
		}),
		plaster: new THREE.MeshStandardMaterial({
			color: "#e6dcd0",
			roughness: 0.84,
			metalness: 0,
		}),
		carpet: new THREE.MeshStandardMaterial({
			map: carpetMap,
			roughness: 0.92,
			metalness: 0,
		}),
		glass: new THREE.MeshStandardMaterial({
			color: "#dce8f0",
			roughness: 0.05,
			metalness: 0.15,
			transparent: true,
			opacity: 0.35,
		}),
		lampShade: new THREE.MeshStandardMaterial({
			color: "#f0e2c8",
			emissive: "#c9a36a",
			emissiveIntensity: 0.35,
			roughness: 0.7,
		}),
		emissiveWarm: new THREE.MeshStandardMaterial({
			color: "#ffd9a0",
			emissive: "#ffcc88",
			emissiveIntensity: 1.2,
			roughness: 0.4,
		}),
	};

	return {
		bag,
		textures: [marbleMap, woodMap, paperMap, carpetMap],
	};
}

function box(
	scene: THREE.Object3D,
	mat: THREE.Material,
	w: number,
	h: number,
	d: number,
	x: number,
	y: number,
	z: number,
): THREE.Mesh {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
	mesh.position.set(x, y, z);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	scene.add(mesh);
	return mesh;
}

function collider(
	x: number,
	z: number,
	w: number,
	d: number,
	enabled = true,
): Collider {
	return {
		minX: x - w / 2,
		maxX: x + w / 2,
		minZ: z - d / 2,
		maxZ: z + d / 2,
		enabled,
	};
}

export function createHotelWorld(scene: THREE.Scene): HotelWorld {
	const { bag, textures } = makeMaterials();
	const colliders: Collider[] = [];
	const interactables: Interactable[] = [];
	const extras: THREE.Object3D[] = [];

	scene.background = new THREE.Color("#120c10");
	scene.fog = new THREE.Fog("#120c10", 12, 28);

	const hemi = new THREE.HemisphereLight("#f3e6d2", "#2a1818", 0.45);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight("#ffdcb0", 0.55);
	sun.position.set(4, 10, 3);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.left = -12;
	sun.shadow.camera.right = 12;
	sun.shadow.camera.top = 12;
	sun.shadow.camera.bottom = -12;
	scene.add(sun);
	const chandelierLight = new THREE.PointLight("#ffd4a8", 38, 18, 1.6);
	chandelierLight.position.set(0, 3.55, 0.4);
	chandelierLight.castShadow = true;
	scene.add(chandelierLight);

	const roomW = 16;
	const roomD = 13;
	const wallH = 4.2;
	const wallT = 0.28;

	box(scene, bag.marble, roomW, 0.08, roomD, 0, 0.04, 0);
	box(scene, bag.plaster, roomW, 0.12, roomD, 0, wallH, 0);
	box(scene, bag.carpet, 4.2, 0.04, 9.2, 0, 0.09, 0.4);

	const walls = [
		{ w: roomW + wallT, h: wallH, d: wallT, x: 0, y: wallH / 2, z: -roomD / 2 },
		{ w: 6.9, h: wallH, d: wallT, x: -4.55, y: wallH / 2, z: roomD / 2 },
		{ w: 6.9, h: wallH, d: wallT, x: 4.55, y: wallH / 2, z: roomD / 2 },
		{ w: 2.4, h: 1.7, d: wallT, x: 0, y: 3.35, z: roomD / 2 },
		{ w: wallT, h: wallH, d: roomD, x: -roomW / 2, y: wallH / 2, z: 0 },
		{ w: wallT, h: wallH, d: roomD, x: roomW / 2, y: wallH / 2, z: 0 },
	];
	for (const wall of walls) {
		const mesh = box(
			scene,
			bag.wallpaper,
			wall.w,
			wall.h,
			wall.d,
			wall.x,
			wall.y,
			wall.z,
		);
		mesh.receiveShadow = true;
		colliders.push(collider(wall.x, wall.z, wall.w, wall.d));
	}

	for (const z of [-3.2, 3.2]) {
		box(scene, bag.wood, 0.42, 3.3, 0.42, -4.6, 1.65, z);
		box(scene, bag.wood, 0.42, 3.3, 0.42, 4.6, 1.65, z);
		box(scene, bag.brass, 0.5, 0.08, 0.5, -4.6, 3.34, z);
		box(scene, bag.brass, 0.5, 0.08, 0.5, 4.6, 3.34, z);
		colliders.push(collider(-4.6, z, 0.55, 0.55));
		colliders.push(collider(4.6, z, 0.55, 0.55));
	}

	box(scene, bag.wood, roomW, 0.18, 0.08, 0, 0.18, -roomD / 2 + 0.18);
	box(scene, bag.wood, roomW, 0.18, 0.08, 0, 0.18, roomD / 2 - 0.18);
	box(scene, bag.brass, roomW * 0.7, 0.04, 0.04, 0, 3.55, -0.02);

	const chandelier = new THREE.Group();
	chandelier.position.set(0, 3.72, 0.4);
	const chain = new THREE.Mesh(
		new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8),
		bag.brass,
	);
	chain.position.y = 0.22;
	chandelier.add(chain);
	chandelier.add(
		new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 10, 24), bag.brass),
	);
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2;
		const bulb = new THREE.Mesh(
			new THREE.SphereGeometry(0.07, 12, 12),
			bag.emissiveWarm,
		);
		bulb.position.set(Math.cos(a) * 0.55, -0.12, Math.sin(a) * 0.55);
		chandelier.add(bulb);
	}
	scene.add(chandelier);
	extras.push(chandelier);

	const desk = new THREE.Group();
	desk.position.set(0, 0, -4.7);
	box(desk, bag.wood, 3.4, 0.12, 1.15, 0, 1.08, 0);
	box(desk, bag.marbleDark, 3.5, 0.05, 1.22, 0, 1.16, 0);
	box(desk, bag.woodDark, 0.12, 1.02, 1.05, -1.55, 0.51, 0);
	box(desk, bag.woodDark, 0.12, 1.02, 1.05, 1.55, 0.51, 0);
	box(desk, bag.wood, 3.2, 0.9, 0.08, 0, 0.5, 0.5);
	scene.add(desk);
	colliders.push(collider(0, -4.7, 3.6, 1.3));

	const drawer = box(desk, bag.wood, 0.7, 0.16, 0.7, 0.55, 0.72, 0.28);
	const drawerHit = box(desk, bag.wood, 0.72, 0.2, 0.08, 0.55, 0.72, 0.66);
	drawerHit.material = bag.brass;
	let drawerOpen = false;
	let drawerZ = 0.28;
	interactables.push({
		id: "drawer",
		mesh: drawerHit,
		prompt: () => (drawerOpen ? "关上抽屉" : "拉开抽屉"),
		use: () => {
			drawerOpen = !drawerOpen;
			return drawerOpen ? "抽屉里是一本烫金登记簿。" : "抽屉关上了。";
		},
		update: (dt) => {
			const target = drawerOpen ? 0.72 : 0.28;
			drawerZ += (target - drawerZ) * Math.min(1, dt * 8);
			drawer.position.z = drawerZ;
			drawerHit.position.z = drawerZ + 0.38;
		},
	});

	const bell = new THREE.Mesh(
		new THREE.SphereGeometry(0.07, 16, 12),
		bag.brass,
	);
	bell.scale.y = 0.7;
	bell.position.set(-0.7, 1.28, 0.1);
	desk.add(bell);
	const bellBase = box(desk, bag.brass, 0.1, 0.04, 0.1, -0.7, 1.2, 0.1);
	interactables.push({
		id: "bell",
		mesh: bell,
		prompt: () => "按响前台铃",
		use: () => {
			bell.position.y = 1.22;
			return "叮。前台暂时没有人，走廊里回了一声。";
		},
		update: (dt) => {
			bell.position.y += (1.28 - bell.position.y) * Math.min(1, dt * 6);
		},
	});
	extras.push(bellBase);

	const lampPole = box(desk, bag.brass, 0.04, 0.42, 0.04, 1.15, 1.4, -0.15);
	const shade = new THREE.Mesh(
		new THREE.ConeGeometry(0.16, 0.18, 16, 1, true),
		bag.lampShade,
	);
	shade.position.set(1.15, 1.66, -0.15);
	desk.add(shade);
	const lampLight = new THREE.PointLight("#ffc58a", 6, 6, 2);
	lampLight.position.set(1.15, 1.55, -0.15);
	desk.add(lampLight);
	let lampOn = true;
	interactables.push({
		id: "lamp",
		mesh: shade,
		prompt: () => (lampOn ? "关掉台灯" : "打开台灯"),
		use: () => {
			lampOn = !lampOn;
			lampLight.intensity = lampOn ? 6 : 0;
			bag.lampShade.emissiveIntensity = lampOn ? 0.35 : 0;
			return lampOn ? "台灯暖了起来。" : "这一角暗下去了。";
		},
		update: () => {},
	});
	extras.push(lampPole);

	const book = box(desk, bag.velvet, 0.28, 0.04, 0.2, 0.05, 1.22, -0.15);
	interactables.push({
		id: "ledger",
		mesh: book,
		prompt: () => "翻开登记簿",
		use: () => "封面写着「永恒酒店 · 今夜」。内页还是空白。",
		update: () => {},
	});

	function makeChair(x: number, z: number, rotY: number) {
		const g = new THREE.Group();
		g.position.set(x, 0, z);
		g.rotation.y = rotY;
		box(g, bag.woodDark, 0.62, 0.08, 0.62, 0, 0.38, 0);
		box(g, bag.velvet, 0.6, 0.12, 0.6, 0, 0.46, 0);
		box(g, bag.velvet, 0.6, 0.55, 0.12, 0, 0.8, -0.24);
		box(g, bag.wood, 0.08, 0.38, 0.08, -0.24, 0.19, -0.24);
		box(g, bag.wood, 0.08, 0.38, 0.08, 0.24, 0.19, -0.24);
		box(g, bag.wood, 0.08, 0.38, 0.08, -0.24, 0.19, 0.24);
		box(g, bag.wood, 0.08, 0.38, 0.08, 0.24, 0.19, 0.24);
		scene.add(g);
		colliders.push(collider(x, z, 0.7, 0.7));
		return g;
	}
	makeChair(4.4, 1.6, -0.6);
	makeChair(5.4, 0.5, 2.4);
	const table = box(scene, bag.wood, 0.9, 0.08, 0.9, 4.9, 0.48, 1.15);
	box(scene, bag.marbleDark, 0.86, 0.03, 0.86, 4.9, 0.54, 1.15);
	box(scene, bag.woodDark, 0.1, 0.44, 0.1, 4.9, 0.22, 1.15);
	colliders.push(collider(4.9, 1.15, 1, 1));
	extras.push(table);

	const vase = new THREE.Mesh(
		new THREE.CylinderGeometry(0.05, 0.07, 0.22, 10),
		bag.brass,
	);
	vase.position.set(4.9, 0.68, 1.15);
	scene.add(vase);
	const bloom = new THREE.Mesh(
		new THREE.SphereGeometry(0.11, 10, 10),
		bag.velvet,
	);
	bloom.position.set(4.9, 0.86, 1.15);
	scene.add(bloom);
	interactables.push({
		id: "flowers",
		mesh: bloom,
		prompt: () => "凑近花瓶",
		use: () => "是干枝玫瑰，香气很淡，像旧丝绒。",
		update: () => {},
	});

	function makeDoorLeaf(): THREE.Mesh {
		const leaf = box(scene, bag.wood, 1.05, 2.4, 0.08, 0, 1.2, 0);
		const handle = box(leaf, bag.brass, 0.04, 0.12, 0.08, 0.42, 0, 0.06);
		extras.push(handle);
		return leaf;
	}

	const doorLeft = makeDoorLeaf();
	const doorRight = makeDoorLeaf();
	const doorPivotL = new THREE.Group();
	const doorPivotR = new THREE.Group();
	doorPivotL.position.set(-0.55, 0, 6.36);
	doorPivotR.position.set(0.55, 0, 6.36);
	scene.add(doorPivotL, doorPivotR);
	doorLeft.position.set(0.52, 1.2, 0);
	doorRight.position.set(-0.52, 1.2, 0);
	doorPivotL.add(doorLeft);
	doorPivotR.add(doorRight);
	box(scene, bag.woodDark, 2.4, 0.12, 0.16, 0, 2.46, 6.36);
	box(scene, bag.brass, 2.2, 0.04, 0.18, 0, 2.52, 6.36);
	const doorCollider = collider(0, 6.36, 2.2, 0.3);
	colliders.push(doorCollider);
	let doorsOpen = false;
	let doorT = 0;
	const doorHit = box(scene, bag.wood, 2.1, 2.4, 0.2, 0, 1.2, 6.36);
	doorHit.visible = false;
	interactables.push({
		id: "doors",
		mesh: doorHit,
		prompt: () => (doorsOpen ? "关上旋转门" : "推开大门"),
		use: () => {
			doorsOpen = !doorsOpen;
			doorCollider.enabled = !doorsOpen;
			return doorsOpen
				? "门轴轻轻响了一声，夜风从街上传进来。"
				: "大门合上，大堂又静了。";
		},
		update: (dt) => {
			doorT += ((doorsOpen ? 1 : 0) - doorT) * Math.min(1, dt * 5);
			doorPivotL.rotation.y = doorT * 1.15;
			doorPivotR.rotation.y = -doorT * 1.15;
		},
		collider: doorCollider,
	});

	const elevDoorL = box(scene, bag.brass, 0.62, 2.2, 0.06, -7.55, 1.2, -2.1);
	const elevDoorR = box(scene, bag.brass, 0.62, 2.2, 0.06, -6.9, 1.2, -2.1);
	box(scene, bag.woodDark, 1.5, 0.12, 0.2, -7.22, 2.38, -2.1);
	const elevCollider = collider(-7.22, -2.1, 1.4, 0.35);
	colliders.push(elevCollider);
	box(scene, bag.wood, 0.18, 2.2, 1.8, -8, 1.1, -2.9);
	colliders.push(collider(-8, -2.9, 0.3, 1.9));
	let elevOpen = false;
	let elevT = 0;
	const elevHit = box(scene, bag.brass, 1.3, 2.2, 0.2, -7.22, 1.2, -2.1);
	elevHit.visible = false;
	interactables.push({
		id: "elevator",
		mesh: elevHit,
		prompt: () => (elevOpen ? "关上电梯门" : "按下电梯"),
		use: () => {
			elevOpen = !elevOpen;
			elevCollider.enabled = !elevOpen;
			return elevOpen
				? "轿厢停在一层。里面铺着同样的地毯，楼上还没开放。"
				: "电梯门合上了。";
		},
		update: (dt) => {
			elevT += ((elevOpen ? 1 : 0) - elevT) * Math.min(1, dt * 4);
			elevDoorL.position.x = -7.55 - elevT * 0.55;
			elevDoorR.position.x = -6.9 + elevT * 0.55;
		},
	});

	const sconceMat = bag.emissiveWarm;
	for (const [x, z] of [
		[-7.6, 2.4],
		[7.6, 2.4],
		[-7.6, -1.2],
		[7.6, -1.2],
	] as [number, number][]) {
		box(scene, bag.brass, 0.08, 0.18, 0.08, x, 2.1, z);
		const bulb = new THREE.Mesh(
			new THREE.SphereGeometry(0.05, 8, 8),
			sconceMat,
		);
		bulb.position.set(x + (x > 0 ? -0.08 : 0.08), 2.02, z);
		scene.add(bulb);
		const light = new THREE.PointLight("#ffd0a0", 4.5, 5.5, 2);
		light.position.set(x, 2.05, z);
		scene.add(light);
	}

	const painting = box(scene, bag.velvet, 1.4, 0.9, 0.06, 0, 2.15, -6.34);
	box(scene, bag.brass, 1.48, 0.98, 0.04, 0, 2.15, -6.37);
	interactables.push({
		id: "painting",
		mesh: painting,
		prompt: () => "看墙上的画",
		use: () => "夜色里的一栋楼，窗户全是暖的。画框比画更亮。",
		update: () => {},
	});

	const keyBowl = box(scene, bag.brass, 0.22, 0.04, 0.22, -1.2, 1.21, -4.55);
	interactables.push({
		id: "keys",
		mesh: keyBowl,
		prompt: () => "拿起钥匙盘",
		use: () => "盘里只有 3 号房的黄铜钥匙。楼上还锁着。",
		update: () => {},
	});

	return {
		colliders,
		interactables,
		spawn: new THREE.Vector3(0, PLAYER_EYE, 3.8),
		dispose: () => {
			for (const texture of textures) texture.dispose();
			for (const material of Object.values(bag)) material.dispose();
		},
	};
}

export function moveWithColliders(
	from: THREE.Vector3,
	delta: THREE.Vector3,
	colliders: Collider[],
	radius: number,
): THREE.Vector3 {
	const next = from.clone();
	next.x += delta.x;
	if (
		hitsAny(next.x, from.z, radius, colliders) ||
		!insideRoom(next.x, from.z, radius)
	) {
		next.x = from.x;
	}
	next.z += delta.z;
	if (
		hitsAny(next.x, next.z, radius, colliders) ||
		!insideRoom(next.x, next.z, radius)
	) {
		next.z = from.z;
	}
	next.y = from.y;
	return next;
}

function insideRoom(x: number, z: number, r: number): boolean {
	return Math.abs(x) < 8 - r && Math.abs(z) < 6.5 - r;
}

function hitsAny(
	x: number,
	z: number,
	r: number,
	colliders: Collider[],
): boolean {
	for (const boxCol of colliders) {
		if (!boxCol.enabled) continue;
		if (
			x + r > boxCol.minX &&
			x - r < boxCol.maxX &&
			z + r > boxCol.minZ &&
			z - r < boxCol.maxZ
		) {
			return true;
		}
	}
	return false;
}

<script lang="ts">
import { onMount } from "svelte";
import * as THREE from "three";
import {
	createHotelWorld,
	type HotelWorld,
	moveWithColliders,
	PLAYER_EYE,
	PLAYER_RADIUS,
	SPRINT_SPEED,
	WALK_SPEED,
} from "@/utils/hotel/world";

let canvas: HTMLCanvasElement | undefined = $state();
let playing = $state(false);
let hint = $state("");
let toast = $state("");
let toastTimer = 0;

function enterHotel() {
	playing = true;
	document.documentElement.classList.add("hotel-playing");
	void canvas?.requestPointerLock();
}

onMount(() => {
	if (!canvas) return;

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		powerPreference: "high-performance",
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(
		72,
		window.innerWidth / window.innerHeight,
		0.08,
		60,
	);
	camera.rotation.order = "YXZ";

	let world: HotelWorld;
	try {
		world = createHotelWorld(scene);
	} catch (error) {
		toast = error instanceof Error ? error.message : "场景没能建起来";
		return;
	}
	camera.position.copy(world.spawn);
	let yaw = 0;
	let pitch = 0;

	const keys = new Set<string>();
	const raycaster = new THREE.Raycaster();
	raycaster.far = 2.6;
	const ndc = new THREE.Vector2(0, 0);
	let hovered: (typeof world.interactables)[number] | null = null;
	let last = performance.now();
	let running = true;

	const showToast = (text: string) => {
		toast = text;
		toastTimer = 2.8;
	};

	const onResize = () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		keys.add(event.code);
		if (event.code === "KeyE" && hovered) {
			event.preventDefault();
			showToast(hovered.use());
		}
		if (event.code === "Escape") {
			document.exitPointerLock();
			playing = false;
			document.documentElement.classList.remove("hotel-playing");
		}
	};
	const onKeyUp = (event: KeyboardEvent) => {
		keys.delete(event.code);
	};
		const onMouseMove = (event: MouseEvent) => {
			const locked = document.pointerLockElement === canvas;
			if (!locked && !(playing && event.buttons === 1)) return;
			yaw -= event.movementX * 0.0022;
			pitch -= event.movementY * 0.0022;
			pitch = Math.max(-1.15, Math.min(1.15, pitch));
		};
	const onPointerLock = () => {
		if (document.pointerLockElement === canvas) playing = true;
	};
	const onClick = () => {
		if (!playing || document.pointerLockElement !== canvas) {
			enterHotel();
			return;
		}
		if (hovered) showToast(hovered.use());
	};

	window.addEventListener("resize", onResize);
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("mousemove", onMouseMove);
	document.addEventListener("pointerlockchange", onPointerLock);
	canvas.addEventListener("click", onClick);

	const tick = (now: number) => {
		if (!running) return;
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;

		for (const item of world.interactables) item.update(dt);

		if (toastTimer > 0) {
			toastTimer -= dt;
			if (toastTimer <= 0) toast = "";
		}

		camera.rotation.y = yaw;
		camera.rotation.x = pitch;

		if (playing) {
			const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
			const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
			const wish = new THREE.Vector3();
			if (keys.has("KeyW") || keys.has("ArrowUp")) wish.add(forward);
			if (keys.has("KeyS") || keys.has("ArrowDown")) wish.sub(forward);
			if (keys.has("KeyD") || keys.has("ArrowRight")) wish.add(right);
			if (keys.has("KeyA") || keys.has("ArrowLeft")) wish.sub(right);
			if (wish.lengthSq() > 0) {
				wish.normalize();
				const speed =
					keys.has("ShiftLeft") || keys.has("ShiftRight")
						? SPRINT_SPEED
						: WALK_SPEED;
				const next = moveWithColliders(
					camera.position,
					wish.multiplyScalar(speed * dt),
					world.colliders,
					PLAYER_RADIUS,
				);
				camera.position.copy(next);
			}
			camera.position.y = PLAYER_EYE;
		}

		raycaster.setFromCamera(ndc, camera);
		const hits = world.interactables
			.map((item) => {
				const found = raycaster.intersectObject(item.mesh, true);
				return found[0] ? { item, dist: found[0].distance } : null;
			})
			.filter(
				(
					entry,
				): entry is {
					item: (typeof world.interactables)[number];
					dist: number;
				} => Boolean(entry),
			)
			.sort((a, b) => a.dist - b.dist);
		hovered = hits[0]?.item ?? null;
		hint = hovered ? hovered.prompt() : "";

		renderer.render(scene, camera);
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);

	return () => {
		running = false;
		document.documentElement.classList.remove("hotel-playing");
		if (document.pointerLockElement === canvas) document.exitPointerLock();
		window.removeEventListener("resize", onResize);
		window.removeEventListener("keydown", onKeyDown);
		window.removeEventListener("keyup", onKeyUp);
		window.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("pointerlockchange", onPointerLock);
		canvas.removeEventListener("click", onClick);
		world.dispose();
		renderer.dispose();
	};
});
</script>

<div class="hotel-root">
	<canvas bind:this={canvas} class="view"></canvas>
	<div class="crosshair" class:is-hot={Boolean(hint)} aria-hidden="true"></div>
	<a class="leave" href="/">离开大堂</a>
	{#if !playing}
		<button class="enter" type="button" onclick={enterHotel}>
			<span class="kicker">永恒酒店 · 一层大堂</span>
			<strong>点击画面进入</strong>
			<small>WASD 走动 · 鼠标转头 · Shift 快走 · E 或点击交互 · Esc 放开鼠标</small>
		</button>
	{/if}
	{#if hint && playing}
		<p class="prompt"><kbd>E</kbd> {hint}</p>
	{/if}
	{#if toast}
		<p class="toast">{toast}</p>
	{/if}
</div>

<style>
	.hotel-root {
		position: fixed;
		inset: 0;
		background: #120c10;
		z-index: 80;
	}

	.view {
		display: block;
		width: 100%;
		height: 100%;
		cursor: none;
	}

	.crosshair {
		position: fixed;
		top: 50%;
		left: 50%;
		width: 10px;
		height: 10px;
		border: 1.5px solid rgba(255, 236, 214, 0.72);
		transform: translate(-50%, -50%);
		pointer-events: none;
		z-index: 82;
	}

	.crosshair.is-hot {
		border-color: #e8c37a;
		background: rgba(232, 195, 122, 0.25);
	}

	.leave {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 83;
		color: rgba(255, 236, 214, 0.82);
		text-decoration: none;
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		padding: 0.35rem 0.7rem;
		border: 1px solid rgba(232, 195, 122, 0.28);
		background: rgba(18, 12, 16, 0.55);
	}

	.enter {
		position: fixed;
		inset: 0;
		z-index: 81;
		display: grid;
		place-content: center;
		gap: 0.45rem;
		border: 0;
		background: rgba(12, 8, 10, 0.42);
		color: #f4ece2;
		cursor: pointer;
		text-align: center;
	}

	.enter .kicker {
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #e8c37a;
	}

	.enter strong {
		font-size: 1.6rem;
	}

	.enter small {
		color: rgba(244, 236, 226, 0.72);
	}

	.prompt,
	.toast {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		z-index: 83;
		margin: 0;
		color: #f4ece2;
		text-align: center;
		text-shadow: 0 1px 8px #120c10;
		pointer-events: none;
	}

	.prompt {
		bottom: 2.4rem;
		font-size: 0.95rem;
	}

	.prompt kbd {
		display: inline-block;
		min-width: 1.2rem;
		margin-right: 0.35rem;
		padding: 0.05rem 0.35rem;
		border: 1px solid #e8c37a;
		color: #e8c37a;
		font: inherit;
	}

	.toast {
		bottom: 4.4rem;
		max-width: 28rem;
		font-size: 0.88rem;
		color: #e8c37a;
	}
</style>

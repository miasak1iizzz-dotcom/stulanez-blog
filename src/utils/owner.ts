// 站长设备识别（协议「站长与游客」）：站长按设备认定，不设登录后台。
// 认领：在目标设备的浏览器打开任意页面，地址末尾加 #saki-owner，一次即可；
// 收回：加 #saki-owner-off。标记存在浏览器 localStorage，认领规程记在仓库 AGENTS.md。
const OWNER_KEY = "stulanez:owner-device";
const CLAIM_HASH = "#saki-owner";
const REVOKE_HASH = "#saki-owner-off";

export function isOwnerDevice(): boolean {
	try {
		return localStorage.getItem(OWNER_KEY) === "1";
	} catch {
		// localStorage 不可用（隐私模式等），按游客处理
		return false;
	}
}

// 每次整页加载调用一次：处理认领/撤销，并把站长状态挂到 <html> 的 class 上，
// 供 [data-owner-only] 的全局 CSS 使用（swup 换页不丢，无需重复执行）。
// 顺带监听 hashchange：页面开着时手动补认领标记也能即时生效。
export function watchOwnerDevice(): boolean {
	const apply = () => {
		try {
			if (location.hash === CLAIM_HASH) {
				localStorage.setItem(OWNER_KEY, "1");
				stripHash();
			} else if (location.hash === REVOKE_HASH) {
				localStorage.removeItem(OWNER_KEY);
				stripHash();
			}
		} catch {
			// localStorage 写不进去时仍按只读逻辑走
		}
		document.documentElement.classList.toggle("is-owner", isOwnerDevice());
	};
	apply();
	window.addEventListener("hashchange", apply);
	return isOwnerDevice();
}

function stripHash() {
	history.replaceState(null, "", location.pathname + location.search);
}

// Editor hints for the Cookie Clicker globals mods use most (checked against Steam 2.053 and the browser version of October 2026).
// Deliberately incomplete: anything not listed here is typed as `any`.
// Source of truth is the game itself: game/src/main.js (search for "MODDING API").

/** Icon as [column, row] on the game's icons.png, or [column, row, imageUrl] for a custom sprite sheet. */
type CCIcon = [number, number] | [number, number, string];

/** Object passed to Game.registerMod. Extra fields and methods are allowed and reachable via Game.mods[id]. */
interface CCMod {
	/** Called once when the game is ready (Steam: before the save is loaded; browser: right away). Register hooks and declare content here. */
	init?(): void;
	/** Return a string to store in the save file under this mod's ID. */
	save?(): string | void;
	/** Receives the string previously returned by save(). Called after init(), only if save data exists. */
	load?(str: string): void;
	/** Set by the Steam version: absolute path of the mod folder (forward slashes), e.g. this.dir+'/icons.png'. */
	dir?: string;
	id?: string;
	name?: string;
	[key: string]: any;
}

interface CCHooks {
	/** Every logic tick (Game.fps times per second). */
	logic: () => void;
	/** Every draw tick. */
	draw: () => void;
	/** On reset: hard is true for a full wipe, false for an ascension. */
	reset: (hard: boolean) => void;
	/** After reincarnating at the end of an ascension. */
	reincarnate: () => void;
	/** When choosing news ticker text: return additional possible messages. */
	ticker: () => string[];
	/** BROWSER ONLY, missing on Steam 2.053 (registering it there does nothing): after the ticker text was chosen; return the new text. */
	tickerFinal: (text: string) => string;
	/** When computing CpS: return the modified value. */
	cps: (cps: number) => number;
	/** BROWSER ONLY, missing on Steam 2.053 (registering it there does nothing): when computing the global CpS multiplier; return the modified value. */
	cpsMult: (mult: number) => number;
	/** When computing cookies per click: return the modified value. */
	cookiesPerClick: (cpc: number) => number;
	/** When the big cookie is clicked. */
	click: () => void;
	/** Steam only in practice: runs at game start, before a browser-loaded mod exists. Declare custom content in init() instead. */
	create: () => void;
	/** Every few seconds, when unlock conditions are checked. */
	check: () => void;
}

interface CCGame {
	/** The id must match "ID" in info.txt. */
	registerMod(id: string, mod: CCMod & ThisType<CCMod>): void;
	registerHook<K extends keyof CCHooks>(hook: K, func: CCHooks[K] | CCHooks[K][]): void;
	removeHook<K extends keyof CCHooks>(hook: K, func: CCHooks[K] | CCHooks[K][]): void;
	mods: Record<string, CCMod>;
	/** Loads a script file or URL. */
	LoadMod(url: string, callback?: () => void, error?: () => void): void;

	/** Notification at the bottom of the screen; quick = seconds until it disappears (max 6). */
	Notify(title: string, desc: string, pic?: CCIcon | 0, quick?: number, noLog?: boolean): void;
	/** Small floating text at screen coordinates. */
	Popup(text: string, x?: number, y?: number): void;
	Prompt(content: string, options?: any[], updateFunc?: () => void, style?: string): void;
	ClosePrompt(): void;

	Earn(howmuch: number): void;
	Spend(howmuch: number): void;
	/** 1 if the upgrade with this name is bought, else 0. */
	Has(what: string): number;
	/** 1 if the achievement with this name is won, else 0. */
	HasAchiev(what: string): number;
	Unlock(what: string | string[]): void;
	Win(what: string | string[]): void;
	gainBuff(type: string, time: number, arg1?: number, arg2?: number, arg3?: number): any;
	/** The active buff with this name, or 0. */
	hasBuff(what: string): any;
	CalculateGains(): void;
	RefreshStore(): void;
	UpdateMenu(): void;

	Upgrade: new (name: string, desc: string, price: number, icon: CCIcon, buyFunction?: () => void) => any;
	Achievement: new (name: string, desc: string, icon: CCIcon) => any;
	Loader: {
		/** Replace a game image at runtime, e.g. Replace('perfectCookie.png', this.dir+'/cookie.png'). */
		Replace(old: string, newer: string): void;
		[key: string]: any;
	};

	cookies: number;
	cookiesEarned: number;
	cookiesPs: number;
	computedMouseCps: number;
	globalCpsMult: number;
	/** Logic frames since the game started. */
	T: number;
	fps: number;
	ready: number;
	version: number;
	Objects: Record<string, any>;
	ObjectsById: any[];
	Upgrades: Record<string, any>;
	UpgradesById: any[];
	Achievements: Record<string, any>;
	AchievementsById: any[];
	buffs: Record<string, any>;

	[key: string]: any;
}

declare var Game: CCGame;
/** Steam/Electron bridge; 0 in the browser version. */
declare var App: any;

declare function l(id: string): HTMLElement;
declare function choose<T>(arr: T[]): T;
declare function Beautify(val: number, floats?: number): string;
declare function PlaySound(url: string, vol?: number, pitchVar?: number): void;
declare function AddEvent(el: EventTarget, ev: string, func: (e: Event) => void): void;
/** Localized game text; returns the id itself if there is no translation. */
declare function loc(id: string, params?: any, baseline?: string): string;
/** HTML for a small inline icon. */
declare function tinyIcon(icon: CCIcon, css?: string): string;
declare function LoadScript(url: string, callback?: () => void, error?: () => void): void;
/** Used in language pack files (info.txt "LanguagePacks"). Language codes: EN, FR, DE, ... or "*". */
declare function ModLanguage(lang: string, strings: Record<string, any>): void;

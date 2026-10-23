/*
	Cookie Clicker Expanded - entry point.
	Runs in the browser version (loaded with Game.LoadMod(url), e.g. from a bookmarklet) and on Steam (mods/local or Workshop).
	Every feature has to work in the browser first, then on Steam.

	The ID below must match "ID" in info.txt (Steam). Never change it after the first release:
	it is the key under which the game stores this mod's save data.

	API reference: search for "MODDING API" in the game's main.js (game-web/main.js, game/src/main.js).
	Steam loads mods before the game starts: init() -> 'create' hook -> load(str).
	The browser loads them into a running game: init() and load(str) run immediately, 'create' has already happened.
	So declare custom content directly in init(), never in a 'create' hook.
*/
Game.registerMod('cookie clicker expanded',{
	//folder of this file when loaded from a URL (browser); can only be read while the file is executing
	scriptDir:document.currentScript?document.currentScript.src.replace(/\/[^\/]*$/,''):'',
	init:function(){
		//called once when the game is ready; register hooks and declare content here

		//inside hooks and event handlers "this" no longer refers to the mod, so we keep a reference
		let MOD=this;
		//base path for assets (MOD.dir+'/image.png'): set by the game on Steam, the script's URL folder in the browser,
		//empty when the code was pasted into the console
		MOD.dir=MOD.dir||MOD.scriptDir;
		MOD.data=MOD.defaultData();

		Game.registerHook('reset',function(hard){
			//hard is true for a full wipe, false for an ascension
			if (hard) MOD.data=MOD.defaultData();
		});

		Game.Notify(`Cookie Clicker Expanded loaded!`,'',[16,5],3);
	},
	save:function(){
		//the returned string is stored in the save file under this mod's ID
		return JSON.stringify(this.data);
	},
	load:function(str){
		//receives the string previously returned by save()
		let data={};
		try {data=JSON.parse(str||'{}');}
		catch (e) {console.error('[cookie clicker expanded] could not read save data:',e);}
		this.data=Object.assign(this.defaultData(),data);
	},
	defaultData:function(){
		//everything the mod needs to persist; bump saveVersion when the structure changes
		return {
			saveVersion:1,
		};
	},
});

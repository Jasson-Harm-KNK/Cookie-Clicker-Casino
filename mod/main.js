/*
	Cookie Clicker Casino - entry point.
	Runs in the browser version (loaded with Game.LoadMod(url), e.g. from a bookmarklet) and on Steam (mods/local or Workshop).
	Every feature has to work in the browser first, then on Steam.

	The ID below must match "ID" in info.txt (Steam). Never change it after the first release:
	it is the key under which the game stores this mod's save data.

	API reference: search for "MODDING API" in the game's main.js (game-web/main.js, game/src/main.js).
	Steam loads mods before the game starts: init() -> 'create' hook -> load(str).
	The browser loads them into a running game: init() and load(str) run immediately, 'create' has already happened.
	So declare custom content directly in init(), never in a 'create' hook.
*/
Game.registerMod('cookie clicker casino',{
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

		MOD.createCasino();

		Game.registerHook('reset',function(hard){
			//hard is true for a full wipe, false for an ascension
			if (hard) MOD.data=MOD.defaultData();
		});
		Game.registerHook('draw',function(){
			//same frames in which the game updates the store
			if (Game.drawT%5==0) MOD.refreshStoreVisibility();
		});
		Game.registerHook('check',function(){
			MOD.checkBuildingAchievements();
		});

		Game.Notify(`Cookie Clicker Casino loaded!`,'',[16,5],3);
	},
	save:function(){
		//the returned string is stored in the save file under this mod's ID
		this.data.casino=this.saveBuilding(this.casino);
		return JSON.stringify(this.data);
	},
	load:function(str){
		//receives the string previously returned by save()
		let data={};
		try {data=JSON.parse(str||'{}');}
		catch (e) {console.error('[cookie clicker casino] could not read save data:',e);}
		this.data=Object.assign(this.defaultData(),data);
		this.loadBuilding(this.casino,this.data.casino);
	},
	defaultData:function(){
		//everything the mod needs to persist; bump saveVersion when the structure changes
		return {
			saveVersion:1,
			casino:null,
		};
	},

	createCasino:function(){
		//graphics are drawn by art/casino.py; each casino unlocks one more game in the minigame (minigameCasino.js)
		let me=this.addBuilding({
			name:'Casino',
			commonName:'casino|casinos|won|[X] lucky table|[X] lucky tables',
			desc:'Make cookies faster than ever!',
			after:'Alchemy lab',
			special:true,
			price:500e9,
			priceIncrease:1000,//each casino costs 1000 times the one before
			cps:0,
			max:6,
			icon:this.dir+'/img/casinoIcon.png',
			miniIcons:this.dir+'/img/casinoMiniIcons.png',
			art:{pic:this.dir+'/img/casino.png',bg:this.dir+'/img/casinoBackground.png',xV:16,yV:16,w:64,rows:2,x:0,y:16,frames:3},
			iconColumn:Game.Objects['Chancemaker'].iconColumn,//only a fallback, miniIcons replace it where it shows
			goldenBuffs:['Jackpot','House edge'],
		});
		//the game loads the minigame script once the building reaches level 1
		me.minigameUrl=this.dir+'/minigameCasino.js';
		me.minigameName='Games';
		me.refresh();
		this.casino=me;
	},

	addBuilding:function(spec){
		/*
			Creates a building that appears right after the building named spec.after (store, building rows, statistics).
			Internally it comes after all vanilla buildings: the game loads buildings from the save by their position
			in Game.ObjectsById, so the vanilla ones must keep their ids. The game doesn't save non-vanilla buildings
			at all, see saveBuilding/loadBuilding.
			spec: name, commonName, desc, after, price and cps (base values), priceIncrease (price factor from one building
			to the next instead of the game's 1.15), max (most that can be owned), icon (sprite sheet URL, layout of a buildings.png row),
			miniIcons (48px icons side by side: building icon, golden cookie boost, burden), art (building row graphics),
			iconColumn (column in icons.png), goldenBuffs ([buff name, debuff name]),
			special (true for buildings outside the regular sequence: name shown in purple)
		*/
		let prev=Game.Objects[spec.after];
		//the constructor adds its row with l('rows').innerHTML+=..., which recreates all existing rows and breaks their
		//canvases and loaded minigames; hand it a detached container instead and move the row into place ourselves
		let realL=window.l,holder=document.createElement('div');
		window.l=function(what){return what=='rows'?holder:realL(what);};
		let me;
		try {
			me=new Game.Object(spec.name,spec.commonName,spec.desc,0,spec.iconColumn,Object.assign({},spec.art),0,function(me){
				return me.baseCps*Game.GetTieredCpsMult(me)*Game.magicCpS(me.name);
			},function(){
				Game.UnlockTiered(this);
			});
		}
		finally {window.l=realL;}
		me.desc=spec.desc;//the constructor looks for a localized description, which doesn't exist for us
		//the constructor derives price and CpS from the id
		me.basePrice=spec.price;
		me.baseCps=spec.cps;
		l('row'+prev.id).after(holder.firstChild);

		//store and mute bar icons come from buildings.png; point this building's icon elements to its own sprite sheet
		//(with the icon index 0, the game's background positions select the right column of it)
		let style=document.createElement('style');
		style.textContent='#productIcon'+me.id+',#productIconOff'+me.id+',#mutedProduct'+me.id+'{background-image:url("'+spec.icon+'");}';
		//special buildings show their name in purple, in the store and in the tooltip (see me.tooltip below)
		if (spec.special) style.textContent+='#productName'+me.id+',#tooltip .specialBuilding .name{color:#c77dff;}';
		document.head.appendChild(style);

		//what the game does for every building row when it starts
		me.canvas=l('rowCanvas'+me.id);
		me.ctx=me.canvas.getContext('2d',{alpha:false});
		me.pics=[];
		AddEvent(me.canvas,'mouseover',function(){me.mouseOn=true;});
		AddEvent(me.canvas,'mouseout',function(){me.mouseOn=false;});
		AddEvent(me.canvas,'mousemove',function(e){let box=this.getBounds();me.mousePos[0]=e.pageX-box.left;me.mousePos[1]=e.pageY-box.top;});
		l('mutedProduct'+prev.id).insertAdjacentHTML('afterend','<div class="tinyProductIcon" id="mutedProduct'+me.id+'" style="display:none;background-position:0px -'+(me.icon*64)+'px;" '+Game.clickStr+'="Game.ObjectsById['+me.id+'].mute(0);PlaySound(Game.ObjectsById['+me.id+'].muted?\'snd/clickOff2.mp3\':\'snd/clickOn2.mp3\');" '+Game.getDynamicTooltip('Game.mutedBuildingTooltip('+me.id+')','this')+'></div>');

		//the tooltip and the golden cookie "building special" buffs show 48px icons from icons.png (column iconColumn)
		//without a way to pass an image; hand them spec.miniIcons instead
		let realTooltip=me.tooltip;
		me.tooltip=function(){
			let realWriteIcon=window.writeIcon,html;
			window.writeIcon=function(icon){return realWriteIcon(!icon[2] && icon[0]==me.iconColumn && icon[1]==0?[0,0,spec.miniIcons]:icon);};
			try {html=realTooltip.call(this);}
			finally {window.writeIcon=realWriteIcon;}
			//a locked building's tooltip says "???", which stays white like in the store
			return spec.special && !me.locked?'<div class="specialBuilding">'+html+'</div>':html;
		};
		for (let [type,column] of [['building buff',1],['building debuff',2]])
		{
			let buffType=Game.buffTypesByName[type],realFunc=buffType.func;
			buffType.func=function(time,pow,building){
				let buff=realFunc.apply(this,arguments);
				if (building==me.id) buff.icon=[column,0,spec.miniIcons];
				return buff;
			};
		}
		if (spec.priceIncrease || spec.max) this.customizePrices(me,spec.priceIncrease||Game.priceIncrease,spec.max||Infinity);

		//the buff names are looked up by building name, without a fallback
		Game.goldenCookieBuildingBuffs[spec.name]=spec.goldenBuffs;
		//texts like "%1 casinos" need a localized string; the game picks plural forms by index without a bounds
		//check (some languages have 3), so offer more than enough of them
		let names=spec.commonName.split('|'),strings={};
		strings['%1 '+names[0]]=['%1 '+names[0],'%1 '+names[1],'%1 '+names[1],'%1 '+names[1]];
		ModLanguage('*',strings);

		//move the buildings after `prev` behind the new one, so that everything iterating Game.Objects shows it in place
		let move=false;
		for (let key of Object.keys(Game.Objects))
		{
			if (move && key!=spec.name) {let building=Game.Objects[key];delete Game.Objects[key];Game.Objects[key]=building;}
			if (key==spec.after) move=true;
		}
		Game.BuildStore();
		Game.RefreshStore();
		return me;
	},
	customizePrices:function(me,increase,max){
		/*
			Gives a building its own price factor from one building to the next (the game uses Game.priceIncrease for all)
			and a maximum amount. At the maximum it leaves the store (except in sell mode), and its price is Infinity, so the
			Grimoire's Spontaneous Edifice doesn't pick it. Discounts apply as usual (Game.modifyBuildingPrice).
		*/
		me.maxAmount=max;
		//price of building number n, counting from 0, before discounts
		let basePriceOf=function(n){return me.basePrice*Math.pow(increase,Math.max(0,n-me.free));};
		me.getPrice=function(){
			if (this.amount>=max) return Infinity;
			return Math.ceil(Game.modifyBuildingPrice(this,basePriceOf(this.amount)));
		};
		me.getSumPrice=function(amount){
			//buying more than the maximum allows only gets you up to it
			let price=0,end=Math.min(this.amount+amount,max);
			for (let i=this.amount;i<end;i++) price+=basePriceOf(i);
			return end>this.amount?Math.ceil(Game.modifyBuildingPrice(this,price)):Infinity;
		};
		me.getReverseSumPrice=function(amount){
			let price=0;
			for (let i=Math.max(0,this.amount-amount);i<this.amount;i++) price+=basePriceOf(i);
			return Math.ceil(Game.modifyBuildingPrice(this,price)*this.getSellMultiplier());
		};
		let buy=me.buy;
		me.buy=function(amount){
			if (Game.buyMode==-1) return buy.call(this,amount);
			if (!amount) amount=Game.buyBulk;
			if (amount==-1) amount=1000;
			amount=Math.min(amount,max-this.amount);
			if (amount>0) buy.call(this,amount);
		};
		//the game refunds a share of the next building's price, which with a steep price factor is far more than the sold
		//building cost; refund a share of what it cost instead, as the store shows in sell mode
		let sell=me.sell,getPrice=me.getPrice;
		me.sell=function(){
			this.getPrice=function(){return Math.ceil(Game.modifyBuildingPrice(this,basePriceOf(this.amount-1)));};
			try {sell.apply(this,arguments);}
			finally {this.getPrice=getPrice;this.refresh();}
		};

		//at the maximum the building leaves the store, except in sell mode; bulk buying shows how many you'd get
		let rebuild=me.rebuild;
		me.rebuild=function(){
			rebuild.call(this);
			let left=max-this.amount;
			l('product'+this.id).style.display=(Game.buyMode==1 && left<=0)?'none':'';
			if (Game.buyMode==1 && left>0 && Game.buyBulk>1) l('productPriceMult'+this.id).textContent='x'+Math.min(Game.buyBulk,left)+' ';
		};
		//right after buying the last one its tooltip can still be open: "Max" instead of a price
		let style=document.createElement('style');
		style.textContent='.price.maxed{padding-left:0px;}.price.maxed:before{display:none;}';
		document.head.appendChild(style);
		let tooltip=me.tooltip;
		me.tooltip=function(){
			if (Game.buyMode!=1 || this.amount<max) return tooltip.call(this);
			//a price of 0 also leaves out the cost details
			let bulkPrice=this.bulkPrice;
			this.bulkPrice=0;
			try {return tooltip.call(this).replace('<span class="price">0</span>','<span class="price disabled maxed">Max</span>');}
			finally {this.bulkPrice=bulkPrice;}
		};
	},
	refreshStoreVisibility:function(){
		//the game hides locked buildings after the second "???" going by building id; redo that in display order
		let lastLocked=0;
		for (let key in Game.Objects)
		{
			let me=Game.Objects[key];
			lastLocked=me.locked?lastLocked+1:0;
			me.l.classList.toggle('toggledOff',lastLocked>2);
		}
	},
	checkBuildingAchievements:function(){
		//Mathematician and Base 10 rank buildings by id, so our buildings (always after the vanilla ones) count as the most
		//expensive and every vanilla building needs one step more; award them as without the mod, from vanilla buildings only.
		//The game's own check stays stricter, so it never awards them first
		if (Game.HasAchiev('Mathematician') && Game.HasAchiev('Base 10')) return;
		let vanilla=Game.ObjectsById.filter(function(me){return me.vanilla;}),mathematician=true,base10=true;
		for (let me of vanilla)
		{
			let rank=vanilla.length-me.id;//1 for the most expensive
			if (me.amount<Math.min(128,Math.pow(2,rank-1))) mathematician=false;
			if (me.amount<rank*10) base10=false;
		}
		if (mathematician) Game.Win('Mathematician');
		if (base10) Game.Win('Base 10');
	},
	saveBuilding:function(me){
		//the same fields Game.WriteSave stores for vanilla buildings
		return {amount:me.amount,bought:me.bought,totalCookies:Math.floor(me.totalCookies),level:me.level,highest:me.highest,muted:me.muted?1:0,
			minigame:Game.isMinigameReady(me)?me.minigame.save():(me.minigameSave||'')};
	},
	loadBuilding:function(me,state){
		//the game has just reset the building (no data for it in the vanilla part of the save)
		if (!state) return;
		me.amount=Math.min(state.amount,me.maxAmount||Infinity);me.bought=state.bought;me.totalCookies=state.totalCookies;me.level=state.level;me.highest=state.highest;
		//like Game.LoadSave: a loaded minigame gets the data now, otherwise once its script has loaded
		if (Game.isMinigameReady(me)) {me.minigame.reset(true);me.minigame.load(state.minigame||'');}
		else me.minigameSave=state.minigame||0;
		me.mute(state.muted);
		Game.BuildingsOwned+=me.amount;
		me.refresh();
		Game.recalculateGains=1;
		//the game loaded the minigames before the mod restored this building's level
		if (me.level>0) Game.LoadMinigames();
	},
});

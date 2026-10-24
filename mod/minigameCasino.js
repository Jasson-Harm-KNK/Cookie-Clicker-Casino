/*
	Casino minigame: one game per casino owned (up to 6, see main.js), picked with the switch at the top.
	The game loads this file like its own minigames once the Casino reaches level 1 (minigameUrl is set in main.js).
	Payouts include the stake and are credited like the Stock Market's profits: they don't count as cookies baked,
	otherwise betting over and over would inflate cookies baked and with it prestige.
	Each game is an object with a name, css and init(div), and save/load/reset/logic/draw like a minigame where it
	needs them, plus lock() for when selling casinos takes the game away.
*/
var M={};
M.parent=Game.Objects['Casino'];
M.parent.minigame=M;
M.launch=function()
{
	var M=this;
	M.name=M.parent.minigameName;
	M.dir=M.parent.minigameUrl.replace(/\/[^\/]*$/,'');//the mod's folder, for images
	M.init=function(div)
	{
		//populate div with html and initialize values
		M.games=[M.roulette,M.blackjack,M.jackpot,M.crash,M.slots,M.plinko];
		M.selected=0;

		var str='<style>'+M.css;
		for (var i=0;i<M.games.length;i++) str+=M.games[i].css||'';
		str+='</style>';
		str+='<div id="casinoSwitch">';
		for (var i=0;i<M.games.length;i++) str+='<a class="option casinoTab" id="casinoTab'+i+'"></a>';
		str+='</div>';
		for (var i=0;i<M.games.length;i++) str+='<div class="casinoGame" id="casinoGame'+i+'"></div>';
		div.innerHTML=str;
		for (var i=0;i<M.games.length;i++)
		{
			AddEvent(l('casinoTab'+i),'click',function(i){return function(){M.select(i);};}(i));
			M.games[i].init(l('casinoGame'+i));
		}
		M.updateSwitch();
	}
	M.css=
		'#casinoSwitch{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:10px 8px 0px 8px;}'+
		'a.option.casinoTab{margin:0px;min-width:64px;padding:5px 6px;text-align:center;font-variant:small-caps;font-weight:bold;font-size:12px;cursor:pointer;}'+
		'a.option.casinoTab.on{color:#ffd25a;box-shadow:0px 0px 1px 2px rgba(0,0,0,0.5),0px 0px 8px rgba(255,210,90,0.7);}'+
		'.casinoGame{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:16px 24px;min-height:206px;padding:12px 12px 18px 12px;background:radial-gradient(ellipse at center,rgba(24,96,52,0.45) 0%,rgba(0,0,0,0) 70%);}'+
		'.casinoControls{width:280px;text-align:center;color:#fff;text-shadow:0px 1px 1px #000;}'+
		'.casinoTitle{font-family:Merriweather,Georgia,serif;font-size:22px;color:#ffd25a;margin-bottom:10px;}'+
		'.casinoBetInput{box-sizing:border-box;width:100%;padding:6px;font-size:16px;text-align:center;color:#fff;background:rgba(0,0,0,0.6);border:1px solid #c8a24a;border-radius:4px;outline:none;}'+
		'.casinoBetInput:focus{box-shadow:0px 0px 6px #ffd25a;}'+
		'.casinoBetInfo{font-size:11px;min-height:15px;margin:3px 0px 8px 0px;opacity:0.85;}'+
		'.casinoBetInfo .warning{color:#ff7a6a;opacity:1;}'+
		'.casinoButtons{display:flex;align-items:center;gap:8px;}'+
		//the game's stylesheet underlines links and colors .red and .green
		'a.casinoButton{flex:1;padding:6px 0px;border:1px solid #000;border-radius:4px;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;cursor:pointer;box-shadow:inset 0px 1px 0px rgba(255,255,255,0.35),0px 2px 4px rgba(0,0,0,0.6);}'+
		'.casinoButton small{display:block;font-size:11px;font-weight:normal;opacity:0.85;}'+
		'.casinoButton:hover{filter:brightness(1.2);}'+
		'.casinoButton:active{transform:translateY(1px);}'+
		'.casinoButton.red{background:linear-gradient(#d84a3e,#a3241d);}'+
		'.casinoButton.green{background:linear-gradient(#45b360,#1d7536);}'+
		'.casinoButton.black{background:linear-gradient(#4b4751,#211e25);}'+
		'.casinoButton.gold{background:linear-gradient(#d9a93e,#94681c);}'+
		'.casinoButton.off,.casinoButtons.busy .casinoButton{opacity:0.4;pointer-events:none;}'+
		'.casinoResult{font-size:14px;min-height:20px;margin-top:10px;}'+
		'.casinoResult .won{color:#ffd25a;}'+
		'.casinoResult .lost{color:#bbb;}'+
		'.casinoNote{font-size:11px;min-height:14px;text-align:center;color:#fff;opacity:0.85;text-shadow:0px 1px 1px #000;}'+
		'.casinoOptions{display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:8px;font-size:12px;}'+
		'a.option.casinoOption{margin:0px;min-width:14px;padding:4px 6px;text-align:center;font-weight:bold;font-size:12px;cursor:pointer;}'+
		'a.option.casinoOption.on{color:#ffd25a;box-shadow:0px 0px 1px 2px rgba(0,0,0,0.5),0px 0px 8px rgba(255,210,90,0.7);}'+
		'.casinoOptions span{margin-right:4px;}'+
		'.casinoCountInput{box-sizing:border-box;width:46px;padding:6px 2px;font-size:14px;text-align:center;color:#fff;background:rgba(0,0,0,0.6);border:1px solid #c8a24a;border-radius:4px;outline:none;}'+
		'.casinoStage{display:flex;flex-direction:column;align-items:center;gap:6px;}';

	/*=====================================================================================
	SWITCH AND SHARED PARTS
	=======================================================================================*/
	M.unlocked=function()
	{
		//one game per casino
		return Math.min(M.games.length,M.parent.amount);
	}
	M.updateSwitch=function()
	{
		//names of the unlocked games, "???" for the others; if selling casinos locked the selected game, go back to the first
		var n=M.unlocked();
		if (M.selected>=n) M.selected=0;
		for (var i=0;i<M.games.length;i++)
		{
			var tab=l('casinoTab'+i);
			tab.textContent=i<n?M.games[i].name:'???';
			tab.classList.toggle('on',i==M.selected);
			tab.classList.toggle('disabled',i>=n);
			l('casinoGame'+i).style.display=(i==M.selected)?'':'none';
		}
		M.shownUnlocked=n;
	}
	M.select=function(i)
	{
		if (i==M.selected || i>=M.unlocked()) return false;
		M.selected=i;
		M.updateSwitch();
		PlaySound('snd/tick.mp3');
	}
	M.betInputHTML=function(id)
	{
		//the bet field and the line below it (id+'Info')
		return '<input class="casinoBetInput" id="'+id+'" type="text" placeholder="Cookies to bet, e.g. 1000000 or 1.5e12" autocomplete="off" spellcheck="false"/>'+
			'<div class="casinoBetInfo" id="'+id+'Info"></div>';
	}
	M.setupBetInput=function(input,info)
	{
		AddEvent(input,'input',function(){M.showBet(input,info);});
		M.isolateInput(input);
	}
	M.isolateInput=function(input)
	{
		//typing into the field shouldn't trigger the game's keyboard shortcuts
		AddEvent(input,'keydown',function(e){e.stopPropagation();});
		AddEvent(input,'keyup',function(e){e.stopPropagation();});
	}
	M.readBet=function(input)
	{
		//accepts plain numbers, scientific notation (1.5e12) and separators like 1,000,000 or 1 000 000
		var bet=Math.floor(parseFloat(input.value.replace(/[\s,_']/g,'')));
		if (!(bet>=1)) return {error:'Enter a bet.'};
		if (bet>Game.cookies) return {error:'Not enough cookies.'};
		return {bet:bet};
	}
	M.showBet=function(input,info)
	{
		//the line below the field: the bet in words, or what's wrong with it
		var read=M.readBet(input);
		if (!input.value) info.innerHTML='';
		else if (read.error) info.innerHTML='<span class="warning">'+read.error+'</span>';
		else info.innerHTML=loc("%1 cookie",LBeautify(read.bet));
	}
	M.refuse=function(info,error)
	{
		info.innerHTML='<span class="warning">'+error+'</span>';
		PlaySound('snd/clickOff2.mp3');
	}
	M.win=function(cookies)
	{
		//like the Stock Market: winnings don't count as cookies baked
		Game.cookies+=cookies;
		Game.cookiesEarned=Math.max(Game.cookies,Game.cookiesEarned);
	}
	M.outcome=function(what,stake,payout)
	{
		//the result line of a game
		if (payout>stake) return '<span class="won"><b>'+what+'</b>: you win '+loc("%1 cookie",LBeautify(payout))+'!</span>';
		if (payout==stake) return '<span class="lost"><b>'+what+'</b>: you get your bet back.</span>';
		if (payout>0) return '<span class="lost"><b>'+what+'</b>: you get '+loc("%1 cookie",LBeautify(payout))+' back.</span>';
		return '<span class="lost"><b>'+what+'</b>: you lose '+loc("%1 cookie",LBeautify(stake))+'.</span>';
	}
	M.random=function(n)
	{
		//0 to n-1; the game reseeds Math.random in places, so results come from the browser's crypto source when possible
		if (window.crypto && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0]%n;
		return Math.floor(Math.random()*n);
	}
	M.randomFloat=function()
	{
		//more than 0, up to 1
		if (window.crypto && crypto.getRandomValues) return (crypto.getRandomValues(new Uint32Array(1))[0]+1)/4294967296;
		return 1-Math.random();
	}
	M.setupCanvas=function(canvas,w,h)
	{
		//w x h pixels on the page, sharp on high-resolution screens
		var dpr=Math.min(window.devicePixelRatio||1,2);
		canvas.width=Math.round(w*dpr);
		canvas.height=Math.round(h*dpr);
		canvas.style.width=w+'px';
		canvas.style.height=h+'px';
		var ctx=canvas.getContext('2d');
		ctx.setTransform(dpr,0,0,dpr,0,0);
		return ctx;
	}
	M.drawCookie=function(ctx,x,y,r)
	{
		//dough lit from the top left, three chocolate chips
		var g=ctx.createRadialGradient(x-r*0.35,y-r*0.4,r*0.1,x,y,r);
		g.addColorStop(0,'#f6d29a');
		g.addColorStop(0.6,'#d39a52');
		g.addColorStop(1,'#9c6a2e');
		ctx.fillStyle=g;
		ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
		ctx.fillStyle='#4a2810';
		var chips=[[-0.35,-0.2],[0.3,-0.05],[-0.05,0.4]];
		for (var i=0;i<chips.length;i++) {ctx.beginPath();ctx.arc(x+chips[i][0]*r,y+chips[i][1]*r,Math.max(0.8,r*0.17),0,Math.PI*2);ctx.fill();}
	}

	/*=====================================================================================
	ROULETTE: a strip of 15 fields (7 red, 7 black, 1 green) rolls under a marker; red and black pay 2x, green 14x
	=======================================================================================*/
	var R=M.roulette={name:'Roulette'};
	R.fields=[1,14,2,13,3,12,4,0,11,5,10,6,9,7,8];//order on the strip: red and black alternate, green in between
	R.bets={
		red:{name:'Red',payout:2},
		green:{name:'Green',payout:14},
		black:{name:'Black',payout:2},
	};
	R.tileH=40;//px per field
	R.cycles=10;//how often the field order repeats on the strip
	R.spinDuration=5000;//ms
	R.spinning=0;
	R.css=
		'#casinoWindow{position:relative;flex:none;width:96px;height:'+(R.tileH*5)+'px;overflow:hidden;border:2px solid #c8a24a;border-radius:6px;box-shadow:0px 0px 0px 2px #000,0px 4px 12px rgba(0,0,0,0.8);background:#111;}'+
		'#casinoWindow:after{content:"";position:absolute;left:0px;right:0px;top:0px;bottom:0px;pointer-events:none;background:linear-gradient(rgba(0,0,0,0.75),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 70%,rgba(0,0,0,0.75));}'+
		'#casinoStrip{position:absolute;left:0px;right:0px;top:0px;will-change:transform;}'+
		'.casinoField{height:'+R.tileH+'px;line-height:'+R.tileH+'px;text-align:center;font-weight:bold;font-size:18px;color:#fff;text-shadow:0px 1px 2px #000;box-shadow:inset 0px 0px 0px 1px rgba(0,0,0,0.45);}'+
		'.casinoField.red{background:linear-gradient(#d84a3e,#a3241d);}'+
		'.casinoField.black{background:linear-gradient(#4b4751,#211e25);}'+
		'.casinoField.green{background:linear-gradient(#45b360,#1d7536);}'+
		'#casinoMarker{position:absolute;left:0px;right:0px;top:50%;height:2px;margin-top:-1px;background:#ffd25a;box-shadow:0px 0px 6px #ffd25a;pointer-events:none;z-index:1;}'+
		'#casinoMarker:before,#casinoMarker:after{content:"";position:absolute;top:-7px;border:8px solid transparent;}'+
		'#casinoMarker:before{left:-1px;border-left-color:#ffd25a;}'+
		'#casinoMarker:after{right:-1px;border-right-color:#ffd25a;}';
	R.init=function(div)
	{
		var str='';
		str+='<div id="casinoWindow"><div id="casinoStrip">';
		for (var i=0;i<R.cycles;i++)
		{
			for (var ii=0;ii<R.fields.length;ii++) str+='<div class="casinoField '+R.colorOf(R.fields[ii])+'">'+R.fields[ii]+'</div>';
		}
		str+='</div><div id="casinoMarker"></div></div>';
		str+='<div class="casinoControls">';
			str+='<div class="casinoTitle">Roulette</div>';
			str+=M.betInputHTML('casinoRouletteBet');
			str+='<div class="casinoButtons" id="casinoRouletteButtons">';
			for (var color in R.bets) str+='<a class="casinoButton '+color+'" id="casinoBet-'+color+'">'+R.bets[color].name+'<small>'+R.bets[color].payout+'x</small></a>';
			str+='</div>';
			str+='<div class="casinoResult" id="casinoRouletteResult"></div>';
		str+='</div>';
		div.innerHTML=str;
		R.stripL=l('casinoStrip');
		R.inputL=l('casinoRouletteBet');
		R.infoL=l('casinoRouletteBetInfo');
		R.buttonsL=l('casinoRouletteButtons');
		R.resultL=l('casinoRouletteResult');
		M.setupBetInput(R.inputL,R.infoL);
		for (var color in R.bets)
		{
			AddEvent(l('casinoBet-'+color),'click',function(color){return function(){R.spin(color);};}(color));
		}
		R.place(R.fields.length+Math.floor(Math.random()*R.fields.length),0);
	}
	R.colorOf=function(n)
	{
		return n==0?'green':(n<=7?'red':'black');
	}
	R.place=function(pos,duration)
	{
		//pos: index of the strip field under the marker (fractions are offsets within a field)
		R.pos=pos;
		R.stripL.style.transition=duration?('transform '+(duration/1000)+'s cubic-bezier(0.12,0.6,0.15,1)'):'none';
		R.stripL.style.transform='translateY('+(R.tileH*2.5-(pos+0.5)*R.tileH)+'px)';
	}
	R.spin=function(color)
	{
		if (R.spinning) return false;
		var read=M.readBet(R.inputL);
		if (read.error) {M.refuse(R.infoL,read.error);return false;}
		Game.Spend(read.bet);
		var result=M.random(R.fields.length);
		R.spinning={bet:read.bet,color:color,result:result,end:Date.now()+R.spinDuration};
		//jump back to an identical-looking spot near the top of the strip, then roll several cycles down to the result
		var start=R.pos%R.fields.length+R.fields.length;
		R.place(start,0);
		R.stripL.offsetHeight;//apply the jump before the animated move starts
		R.place(R.fields.length*(Math.floor(start/R.fields.length)+5)+R.fields.indexOf(result)+(Math.random()-0.5)*0.8,R.spinDuration);
		R.resultL.innerHTML='';
		R.buttonsL.classList.add('busy');
		PlaySound('snd/cashOut.mp3');
	}
	R.finish=function(silent)
	{
		var spin=R.spinning;
		R.spinning=0;
		R.buttonsL.classList.remove('busy');
		var color=R.colorOf(spin.result);
		var payout=(color==spin.color)?spin.bet*R.bets[spin.color].payout:0;
		if (payout>0) M.win(payout);
		R.resultL.innerHTML=M.outcome(spin.result+' '+R.bets[color].name.toLowerCase(),spin.bet,payout);
		if (!silent) PlaySound(payout>0?(color=='green'?'snd/smallCymbalCrash.mp3':'snd/cashIn.mp3'):'snd/clickOff2.mp3');
		M.showBet(R.inputL,R.infoL);
	}
	R.save=function()
	{
		var spin=R.spinning;
		return spin?[spin.bet,spin.color,spin.result].join(' '):'';
	}
	R.load=function(str)
	{
		var spl=str.split(' ');
		var bet=parseFloat(spl[0])||0,color=spl[1],result=parseInt(spl[2])||0;
		//a bet still rolling when the game was saved: its cookies were already taken, so settle it now
		if (bet>0 && R.bets[color] && !R.spinning)
		{
			R.spinning={bet:bet,color:color,result:result,end:0};
			R.place(R.fields.length+R.fields.indexOf(result),0);
			R.finish(true);
		}
	}
	R.reset=function()
	{
		R.spinning=0;
		R.buttonsL.classList.remove('busy');
		R.resultL.innerHTML='';
	}
	R.logic=function()
	{
		if (R.spinning && Date.now()>=R.spinning.end) R.finish();
	}
	R.draw=function()
	{
		//keep the line below the field up to date as the cookie count changes
		if (Game.drawT%10==0 && !R.spinning && R.inputL.value) M.showBet(R.inputL,R.infoL);
	}

	/*=====================================================================================
	BLACKJACK against an automatic dealer: endless deck, the dealer stands on all 17s and checks for blackjack,
	blackjack pays 3:2, doubling down on the first two cards; no splitting or insurance
	=======================================================================================*/
	var B=M.blackjack={name:'Blackjack'};
	B.ranks='A23456789TJQK';
	B.suits='shdc';
	B.cardDelay=600;//ms between the dealer's cards
	B.css=
		'#casinoTable{width:250px;text-align:center;}'+
		'.casinoHandLabel{font-family:Merriweather,Georgia,serif;font-size:13px;color:#ffd25a;text-shadow:0px 1px 1px #000;}'+
		'.casinoHandLabel span{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:8px;background:rgba(0,0,0,0.55);font-family:Tahoma,Arial,sans-serif;font-size:11px;font-weight:bold;color:#fff;}'+
		'.casinoHandLabel span:empty{display:none;}'+
		'.casinoHand{display:flex;justify-content:center;height:66px;margin:6px 0px;}'+
		'.casinoCard{position:relative;flex:none;width:46px;height:66px;margin:0px -5px;border-radius:5px;background:linear-gradient(#fffdf6,#e6dcc3);box-shadow:0px 2px 5px rgba(0,0,0,0.7),inset 0px 0px 0px 1px rgba(0,0,0,0.35);font-family:Merriweather,Georgia,serif;text-shadow:none;animation:casinoDeal 0.25s ease-out both;}'+
		'.casinoCard.red{color:#c22b1d;}'+
		'.casinoCard.black{color:#25222a;}'+
		'.casinoCardCorner{position:absolute;left:4px;top:4px;font-size:12px;font-weight:bold;line-height:12px;text-align:center;}'+
		'.casinoCardSuit{position:absolute;left:0px;right:0px;bottom:8px;text-align:center;font-size:24px;line-height:24px;}'+
		'.casinoCard.back{background:repeating-linear-gradient(45deg,#8a2318 0px,#8a2318 4px,#6a170f 4px,#6a170f 8px);box-shadow:0px 2px 5px rgba(0,0,0,0.7),inset 0px 0px 0px 2px #c8a24a;}'+
		//a cookie on the back of the cards
		'.casinoCard.back:after{content:"";position:absolute;left:12px;top:22px;width:22px;height:22px;border-radius:50%;'+
			'background:radial-gradient(circle at 32% 35%,#5a3416 2px,rgba(0,0,0,0) 2.5px),radial-gradient(circle at 68% 45%,#5a3416 2px,rgba(0,0,0,0) 2.5px),'+
			'radial-gradient(circle at 42% 72%,#5a3416 2px,rgba(0,0,0,0) 2.5px),radial-gradient(circle at 40% 35%,#f0c27a,#c98a3c);'+
			'box-shadow:0px 0px 0px 1px #3a1d0c,0px 1px 2px rgba(0,0,0,0.6);}'+
		'.casinoCard.flip{animation:casinoFlip 0.3s ease-out;}'+
		'@keyframes casinoDeal{from{opacity:0;transform:translate(0px,-24px) rotate(-8deg);}to{opacity:1;transform:none;}}'+
		'@keyframes casinoFlip{from{transform:scaleX(0);}to{transform:scaleX(1);}}';
	B.init=function(div)
	{
		var str='';
		str+='<div id="casinoTable">';
			str+='<div class="casinoHandLabel">Dealer<span id="casinoDealerTotal"></span></div>';
			str+='<div class="casinoHand" id="casinoDealerHand"></div>';
			str+='<div class="casinoHand" id="casinoPlayerHand"></div>';
			str+='<div class="casinoHandLabel">You<span id="casinoPlayerTotal"></span></div>';
		str+='</div>';
		str+='<div class="casinoControls">';
			str+='<div class="casinoTitle">Blackjack</div>';
			str+=M.betInputHTML('casinoBlackjackBet');
			str+='<div class="casinoButtons" id="casinoBlackjackButtons">';
				str+='<a class="casinoButton gold" id="casinoDeal">Deal</a>';
				str+='<a class="casinoButton green" id="casinoHit">Hit</a>';
				str+='<a class="casinoButton red" id="casinoStand">Stand</a>';
				str+='<a class="casinoButton black" id="casinoDouble">Double</a>';
			str+='</div>';
			str+='<div class="casinoResult" id="casinoBlackjackResult"></div>';
		str+='</div>';
		div.innerHTML=str;
		B.dealerL=l('casinoDealerHand');
		B.playerL=l('casinoPlayerHand');
		B.dealerTotalL=l('casinoDealerTotal');
		B.playerTotalL=l('casinoPlayerTotal');
		B.inputL=l('casinoBlackjackBet');
		B.infoL=l('casinoBlackjackBetInfo');
		B.buttonsL=l('casinoBlackjackButtons');
		B.resultL=l('casinoBlackjackResult');
		M.setupBetInput(B.inputL,B.infoL);
		AddEvent(l('casinoDeal'),'click',function(){B.deal();});
		AddEvent(l('casinoHit'),'click',function(){B.hit();});
		AddEvent(l('casinoStand'),'click',function(){B.stand();});
		AddEvent(l('casinoDouble'),'click',function(){B.doubleDown();});
		B.reset();
	}
	//cards are strings of rank and suit, like "As" or "Td"
	B.newCard=function()
	{
		return B.ranks[M.random(13)]+B.suits[M.random(4)];
	}
	B.total=function(cards)
	{
		//aces count 11, or 1 where 11 would go over 21
		var total=0,aces=0;
		for (var i=0;i<cards.length;i++)
		{
			var rank=B.ranks.indexOf(cards[i][0]);
			if (rank==0) aces++;
			total+=rank==0?11:Math.min(10,rank+1);
		}
		while (total>21 && aces>0) {total-=10;aces--;}
		return total;
	}
	B.isBlackjack=function(cards)
	{
		return cards.length==2 && B.total(cards)==21;
	}
	B.deal=function()
	{
		if (B.phase!=0) return false;
		var read=M.readBet(B.inputL);
		if (read.error) {M.refuse(B.infoL,read.error);return false;}
		Game.Spend(read.bet);
		B.bet=read.bet;
		B.doubled=0;
		B.player=[B.newCard(),B.newCard()];
		B.dealer=[B.newCard(),B.newCard()];
		B.phase=1;
		B.clearTable();
		B.resultL.innerHTML='';
		//the cards go out one at a time: player, dealer, player, dealer face down
		B.showHand(B.playerL,B.player,2,-1,[0,300]);
		B.showHand(B.dealerL,B.dealer,2,1,[150,450]);
		//a blackjack on either side ends the hand at once (the dealer checks the face-down card)
		if (B.isBlackjack(B.player) || B.isBlackjack(B.dealer)) B.endTurn(900);
		B.update();
		PlaySound('snd/page.mp3');
	}
	B.hit=function()
	{
		if (B.phase!=1) return false;
		B.player.push(B.newCard());
		//at 21 or more the turn ends by itself, once the new card has landed
		if (B.total(B.player)>=21) B.endTurn(400);
		B.update();
		PlaySound('snd/page.mp3');
	}
	B.stand=function()
	{
		if (B.phase!=1) return false;
		B.endTurn(0);
		B.update();
	}
	B.doubleDown=function()
	{
		//double the bet for exactly one more card
		if (B.phase!=1 || B.player.length!=2) return false;
		if (B.bet>Game.cookies) {M.refuse(B.infoL,'Not enough cookies.');return false;}
		Game.Spend(B.bet);
		B.doubled=1;
		B.player.push(B.newCard());
		B.endTurn(400);
		B.update();
		PlaySound('snd/page.mp3');
	}
	B.endTurn=function(delay)
	{
		//the dealer draws to 17 unless the hand is already decided. All his cards are drawn now and only shown one
		//after another (B.update), so the outcome is fixed and a save during the dealer's turn just settles the hand
		if (B.total(B.player)<=21 && !B.isBlackjack(B.player) && !B.isBlackjack(B.dealer))
		{
			while (B.total(B.dealer)<17) B.dealer.push(B.newCard());
		}
		B.phase=2;
		B.revealAt=Date.now()+delay;
		B.settleAt=B.revealAt+B.cardDelay*(B.dealer.length-1);
	}
	B.settle=function(silent)
	{
		var player=B.total(B.player),dealer=B.total(B.dealer),stake=B.bet*(B.doubled?2:1),payout=0,what;
		if (player>21) what='Bust';
		else if (B.isBlackjack(B.player) && B.isBlackjack(B.dealer)) {what='Push';payout=stake;}
		else if (B.isBlackjack(B.player)) {what='Blackjack';payout=B.bet*2.5;}
		else if (B.isBlackjack(B.dealer)) what='Dealer blackjack';
		else if (dealer>21) {what='Dealer busts';payout=stake*2;}
		else if (player==dealer) {what='Push';payout=stake;}
		else {what=player+' to '+dealer;if (player>dealer) payout=stake*2;}
		B.phase=0;
		if (payout>0) M.win(payout);
		B.resultL.innerHTML=M.outcome(what,stake,payout);
		if (!silent) PlaySound(payout>stake?(what=='Blackjack'?'snd/smallCymbalCrash.mp3':'snd/cashIn.mp3'):(payout>0?'snd/tick.mp3':'snd/clickOff2.mp3'));
		B.update();
		M.showBet(B.inputL,B.infoL);
	}
	B.clearTable=function()
	{
		B.dealerL.innerHTML='';
		B.playerL.innerHTML='';
		B.faceUp=0;
	}
	B.showHand=function(handL,cards,count,hidden,delays)
	{
		//adds the cards that aren't on the table yet (they fly in, after delays in ms) and turns over the face-down card
		//(index hidden) once it's revealed
		for (var i=handL.children.length;i<count;i++)
		{
			var cardL=document.createElement('div');
			cardL.className='casinoCard';
			if (delays) cardL.style.animationDelay=delays[i]+'ms';
			handL.appendChild(cardL);
		}
		for (var i=0;i<count;i++)
		{
			var cardL=handL.children[i],face=(i==hidden)?'back':((cards[i][1]=='h' || cards[i][1]=='d')?'red':'black');
			if (cardL.dataset.face==face) continue;
			if (cardL.dataset.face=='back') cardL.classList.add('flip');
			cardL.classList.remove('back','red','black');
			cardL.classList.add(face);
			cardL.dataset.face=face;
			var suit={s:'&spades;',h:'&hearts;',d:'&diams;',c:'&clubs;'}[cards[i][1]];
			cardL.innerHTML=(face=='back')?'':('<div class="casinoCardCorner">'+(cards[i][0]=='T'?'10':cards[i][0])+'<br>'+suit+'</div><div class="casinoCardSuit">'+suit+'</div>');
		}
	}
	B.update=function()
	{
		//hands, totals and buttons; during the dealer's turn his cards turn up one after another (see B.endTurn)
		var shown=B.dealer.length,hidden=-1;
		if (B.phase==1) hidden=1;
		else if (B.phase==2)
		{
			var t=Date.now()-B.revealAt;
			if (t<0) {hidden=1;shown=2;}
			else shown=Math.min(B.dealer.length,2+Math.floor(t/B.cardDelay));
		}
		B.showHand(B.playerL,B.player,B.player.length,-1);
		B.showHand(B.dealerL,B.dealer,shown,hidden);
		var faceUp=(hidden==1)?1:shown;
		if (B.phase==2 && faceUp>B.faceUp) PlaySound('snd/page.mp3',0.6);
		B.faceUp=faceUp;
		B.playerTotalL.textContent=B.player.length?B.total(B.player):'';
		B.dealerTotalL.textContent=B.dealer.length?B.total(B.dealer.slice(0,faceUp)):'';
		var playing=B.phase>0;
		l('casinoDeal').style.display=playing?'none':'';
		l('casinoHit').style.display=l('casinoStand').style.display=l('casinoDouble').style.display=playing?'':'none';
		B.buttonsL.classList.toggle('busy',B.phase==2);
		l('casinoDouble').classList.toggle('off',B.player.length!=2 || B.bet>Game.cookies);
	}
	B.save=function()
	{
		if (!B.phase) return '';
		return [B.phase,B.bet,B.doubled,B.player.join(''),B.dealer.join('')].join(' ');
	}
	B.load=function(str)
	{
		var spl=str.split(' ');
		var phase=parseInt(spl[0])||0,bet=parseFloat(spl[1])||0,player=(spl[3]||'').match(/../g)||[],dealer=(spl[4]||'').match(/../g)||[];
		if (!phase || !(bet>0) || player.length<2 || dealer.length<2) return false;
		B.bet=bet;
		B.doubled=parseInt(spl[2])?1:0;
		B.player=player;
		B.dealer=dealer;
		B.clearTable();
		//a hand saved during the dealer's turn was already decided: settle it now
		if (phase==2) {B.phase=2;B.settle(true);}
		else {B.phase=1;B.update();}
	}
	B.reset=function()
	{
		B.phase=0;//0: placing a bet, 1: player's turn, 2: dealer's turn (outcome already decided)
		B.bet=0;
		B.doubled=0;
		B.player=[];
		B.dealer=[];
		B.clearTable();
		B.resultL.innerHTML='';
		B.update();
	}
	B.lock=function()
	{
		//selling casinos took the game away during the player's turn: stand
		if (B.phase==1) B.endTurn(0);
	}
	B.logic=function()
	{
		if (B.phase==2 && Date.now()>=B.settleAt) B.settle();
	}
	B.draw=function()
	{
		if (B.phase==2) B.update();
		else if (Game.drawT%10==0)
		{
			//whether doubling is affordable, and the line below the field, change with the cookie count
			if (B.phase==1) B.update();
			if (B.inputL.value) M.showBet(B.inputL,B.infoL);
		}
	}

	/*=====================================================================================
	JACKPOT: your bet and those of 1 to 6 opponents form a pot; a wheel picks who gets all of it, everyone's chance being
	their share of the pot (no house edge). The opponents bet between a quarter and four times as much as you.
	=======================================================================================*/
	var J=M.jackpot={name:'Jackpot'};
	J.colors=['#d9a93e','#b8322a','#2f78b5','#2e9550','#7d3c98','#c8661f','#15897a'];//yours first
	J.spinDuration=5000;//ms
	J.opponents=3;
	J.spinning=0;
	J.rotation=0;
	J.css=
		'#casinoJackpotWheelWrap{position:relative;width:180px;height:180px;margin-top:8px;}'+
		'#casinoJackpotPointer{position:absolute;left:50%;top:-12px;margin-left:-10px;border-left:10px solid transparent;border-right:10px solid transparent;border-top:18px solid #ffd25a;z-index:3;filter:drop-shadow(0px 2px 2px rgba(0,0,0,0.8));}'+
		'#casinoJackpotWheel{position:relative;box-sizing:border-box;width:180px;height:180px;border-radius:50%;border:4px solid #c8a24a;box-shadow:0px 0px 0px 2px #000,0px 4px 12px rgba(0,0,0,0.8);}'+
		//a cookie in the middle
		'#casinoJackpotWheel:before{content:"";position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0px 0px -17px;border-radius:50%;z-index:1;'+
			'background:radial-gradient(circle at 32% 35%,#5a3416 3px,rgba(0,0,0,0) 3.5px),radial-gradient(circle at 68% 45%,#5a3416 3px,rgba(0,0,0,0) 3.5px),'+
			'radial-gradient(circle at 42% 72%,#5a3416 3px,rgba(0,0,0,0) 3.5px),radial-gradient(circle at 40% 35%,#f0c27a,#c98a3c);box-shadow:0px 0px 0px 2px #3a1d0c,0px 2px 4px rgba(0,0,0,0.6);}'+
		//your part of the wheel: a gold ring outside of it
		'#casinoJackpotWheel:after{content:"";position:absolute;left:-10px;right:-10px;top:-10px;bottom:-10px;border-radius:50%;pointer-events:none;'+
			'background:conic-gradient(rgba(0,0,0,0) 0deg var(--mineStart),#ffd25a var(--mineStart) var(--mineEnd),rgba(0,0,0,0) var(--mineEnd));'+
			'-webkit-mask:radial-gradient(circle,rgba(0,0,0,0) 91px,#000 92px);}'+
		'#casinoJackpotYou{position:absolute;left:50%;top:50%;width:32px;height:16px;margin:-8px 0px 0px -16px;line-height:16px;border-radius:8px;z-index:2;background:#ffd25a;color:#2a1600;font-size:10px;font-weight:bold;text-align:center;text-shadow:none;box-shadow:0px 1px 3px rgba(0,0,0,0.8);}';
	J.init=function(div)
	{
		var str='';
		str+='<div class="casinoStage">';
			str+='<div id="casinoJackpotWheelWrap"><div id="casinoJackpotPointer"></div><div id="casinoJackpotWheel"><div id="casinoJackpotYou">You</div></div></div>';
			str+='<div class="casinoNote" id="casinoJackpotPot"></div>';
		str+='</div>';
		str+='<div class="casinoControls">';
			str+='<div class="casinoTitle">Jackpot</div>';
			str+='<div class="casinoOptions"><span>Opponents</span>';
			for (var i=1;i<=6;i++) str+='<a class="option casinoOption" id="casinoJackpotOpp'+i+'">'+i+'</a>';
			str+='</div>';
			str+=M.betInputHTML('casinoJackpotBet');
			str+='<div class="casinoButtons" id="casinoJackpotButtons"><a class="casinoButton gold" id="casinoJackpotSpin">Spin</a></div>';
			str+='<div class="casinoResult" id="casinoJackpotResult"></div>';
		str+='</div>';
		div.innerHTML=str;
		J.wheelL=l('casinoJackpotWheel');
		J.youL=l('casinoJackpotYou');
		J.potL=l('casinoJackpotPot');
		J.inputL=l('casinoJackpotBet');
		J.infoL=l('casinoJackpotBetInfo');
		J.buttonsL=l('casinoJackpotButtons');
		J.resultL=l('casinoJackpotResult');
		M.setupBetInput(J.inputL,J.infoL);
		for (var i=1;i<=6;i++) AddEvent(l('casinoJackpotOpp'+i),'click',function(i){return function(){J.setOpponents(i);};}(i));
		AddEvent(l('casinoJackpotSpin'),'click',function(){J.spin();});
		J.setOpponents(J.opponents,true);
	}
	J.setOpponents=function(n,quiet)
	{
		if (J.spinning) return false;
		J.opponents=n;
		for (var i=1;i<=6;i++) l('casinoJackpotOpp'+i).classList.toggle('on',i==n);
		//until the next spin, everyone gets the same share
		var stakes=[];
		for (var i=0;i<=n;i++) stakes.push(1);
		J.paint(stakes);
		if (!quiet) PlaySound('snd/tick.mp3');
	}
	J.paint=function(stakes)
	{
		//one slice per stake, clockwise from the top; yours comes first. Returns the pot
		var total=0,acc=0,stops=[];
		for (var i=0;i<stakes.length;i++) total+=stakes[i];
		J.slices=[];
		for (var i=0;i<stakes.length;i++)
		{
			var start=acc/total*360;
			acc+=stakes[i];
			J.slices.push([start,acc/total*360]);
			stops.push(J.colors[i%J.colors.length]+' '+start+'deg '+(acc/total*360)+'deg');
		}
		J.wheelL.style.background='conic-gradient('+stops.join(',')+')';
		J.wheelL.style.setProperty('--mineStart',J.slices[0][0]+'deg');
		J.wheelL.style.setProperty('--mineEnd',J.slices[0][1]+'deg');
		J.youL.style.transform='rotate('+((J.slices[0][0]+J.slices[0][1])/2)+'deg) translateY(-60px)';
		return total;
	}
	J.turn=function(deg,duration)
	{
		J.rotation=deg;
		J.wheelL.style.transition=duration?('transform '+(duration/1000)+'s cubic-bezier(0.12,0.6,0.18,1)'):'none';
		J.wheelL.style.transform='rotate('+deg+'deg)';
	}
	J.spin=function()
	{
		if (J.spinning) return false;
		var read=M.readBet(J.inputL);
		if (read.error) {M.refuse(J.infoL,read.error);return false;}
		Game.Spend(read.bet);
		var stakes=[read.bet];
		for (var i=0;i<J.opponents;i++) stakes.push(Math.max(1,Math.round(read.bet*Math.pow(2,4*M.randomFloat()-2))));
		var total=J.paint(stakes),pick=M.randomFloat()*total,winner=0;
		while (winner<stakes.length-1 && pick>stakes[winner]) {pick-=stakes[winner];winner++;}
		J.spinning={stakes:stakes,winner:winner,end:Date.now()+J.spinDuration};
		//a few turns, ending with a random spot of the winner's slice under the pointer
		var slice=J.slices[winner],spot=slice[0]+(slice[1]-slice[0])*(0.1+0.8*M.randomFloat());
		J.turn(J.rotation-J.rotation%360+360*5+(360-spot),J.spinDuration);
		J.potL.textContent='Pot: '+loc("%1 cookie",LBeautify(total))+' · your chance: '+Math.max(1,Math.round(read.bet/total*100))+'%';
		J.resultL.innerHTML='';
		J.buttonsL.classList.add('busy');
		PlaySound('snd/cashOut.mp3');
	}
	J.finish=function(silent)
	{
		var spin=J.spinning,total=0;
		J.spinning=0;
		for (var i=0;i<spin.stakes.length;i++) total+=spin.stakes[i];
		J.buttonsL.classList.remove('busy');
		if (spin.winner==0) M.win(total);
		J.resultL.innerHTML=M.outcome(spin.winner==0?'Jackpot':'Opponent '+spin.winner,spin.stakes[0],spin.winner==0?total:0);
		if (!silent) PlaySound(spin.winner==0?'snd/smallCymbalCrash.mp3':'snd/clickOff2.mp3');
		M.showBet(J.inputL,J.infoL);
	}
	J.save=function()
	{
		var spin=J.spinning;
		return [J.opponents].concat(spin?[spin.winner].concat(spin.stakes):[]).join(' ');
	}
	J.load=function(str)
	{
		var spl=str.split(' '),n=parseInt(spl[0])||3;
		J.setOpponents(Math.max(1,Math.min(6,n)),true);
		//a spin still going when the game was saved: its cookies were already taken, so settle it now
		var winner=parseInt(spl[1]),stakes=spl.slice(2).map(parseFloat);
		if (stakes.length>=2 && winner>=0 && winner<stakes.length && stakes.every(function(x){return x>0;}) && !J.spinning)
		{
			J.paint(stakes);
			var slice=J.slices[winner];
			J.turn(360-(slice[0]+slice[1])/2,0);
			J.spinning={stakes:stakes,winner:winner,end:0};
			J.finish(true);
		}
	}
	J.reset=function()
	{
		J.spinning=0;
		J.buttonsL.classList.remove('busy');
		J.resultL.innerHTML='';
		J.potL.textContent='';
		J.setOpponents(J.opponents,true);
	}
	J.logic=function()
	{
		if (J.spinning && Date.now()>=J.spinning.end) J.finish();
	}
	J.draw=function()
	{
		if (Game.drawT%10==0 && !J.spinning && J.inputL.value) M.showBet(J.inputL,J.infoL);
	}

	/*=====================================================================================
	CRASH: the multiplier doubles every 4 seconds until it crashes; cash out before that. The crash point is drawn at the
	start with P(crash at M or later) = 1/M, so every way of cashing out returns the bet on average (no house edge)
	=======================================================================================*/
	var C=M.crash={name:'Crash'};
	C.doubling=4000;//ms until the multiplier doubles
	C.width=250;
	C.height=160;
	C.running=0;
	C.last=0;//the round that ended, as shown
	C.css=
		'#casinoCrashCanvas{border-radius:6px;border:2px solid #c8a24a;box-shadow:0px 0px 0px 2px #000,0px 4px 12px rgba(0,0,0,0.8);}'+
		'#casinoCrashMult{font-family:Merriweather,Georgia,serif;font-size:28px;color:#ffd25a;text-shadow:0px 2px 4px #000;}'+
		'#casinoCrashMult.won{color:#7be08f;}'+
		'#casinoCrashMult.busted{color:#ff6b5b;}';
	C.init=function(div)
	{
		var str='';
		str+='<div class="casinoStage"><canvas id="casinoCrashCanvas"></canvas><div id="casinoCrashMult"></div></div>';
		str+='<div class="casinoControls">';
			str+='<div class="casinoTitle">Crash</div>';
			str+=M.betInputHTML('casinoCrashBet');
			str+='<div class="casinoButtons"><a class="casinoButton gold" id="casinoCrashStart">Start</a><a class="casinoButton green" id="casinoCrashCashOut">Cash out</a></div>';
			str+='<div class="casinoResult" id="casinoCrashResult"></div>';
		str+='</div>';
		div.innerHTML=str;
		C.ctx=M.setupCanvas(l('casinoCrashCanvas'),C.width,C.height);
		C.multL=l('casinoCrashMult');
		C.inputL=l('casinoCrashBet');
		C.infoL=l('casinoCrashBetInfo');
		C.resultL=l('casinoCrashResult');
		M.setupBetInput(C.inputL,C.infoL);
		AddEvent(l('casinoCrashStart'),'click',function(){C.start();});
		AddEvent(l('casinoCrashCashOut'),'click',function(){C.cashOut();});
		C.update();
	}
	C.multAt=function(ms)
	{
		return Math.pow(2,ms/C.doubling);
	}
	C.start=function()
	{
		if (C.running) return false;
		var read=M.readBet(C.inputL);
		if (read.error) {M.refuse(C.infoL,read.error);return false;}
		Game.Spend(read.bet);
		C.running={bet:read.bet,point:1/M.randomFloat(),start:Date.now()};
		C.last=0;
		C.resultL.innerHTML='';
		C.update();
		PlaySound('snd/cashOut.mp3');
	}
	C.cashOut=function()
	{
		if (!C.running) return false;
		var mult=C.multAt(Date.now()-C.running.start);
		if (mult<C.running.point) C.settle(mult);
	}
	C.settle=function(mult,silent)
	{
		//mult: where the player cashed out, 0 for a crash
		var run=C.running,shown=Math.floor((mult||run.point)*100)/100,payout=mult?run.bet*shown:0;
		C.running=0;
		C.last={ms:Math.log(mult||run.point)/Math.LN2*C.doubling,mult:shown,state:mult?'won':'busted'};
		if (payout>0) M.win(payout);
		C.resultL.innerHTML=M.outcome((mult?'Cashed out at ':'Crash at ')+shown.toFixed(2)+'x',run.bet,payout);
		if (!silent) PlaySound(mult?'snd/cashIn.mp3':'snd/clickOff2.mp3');
		C.update();
		M.showBet(C.inputL,C.infoL);
	}
	C.update=function()
	{
		var ms=0,mult=1,state='';
		if (C.running) {ms=Date.now()-C.running.start;mult=Math.min(C.multAt(ms),C.running.point);}
		else if (C.last) {ms=C.last.ms;mult=C.last.mult;state=C.last.state;}
		l('casinoCrashStart').style.display=C.running?'none':'';
		l('casinoCrashCashOut').style.display=C.running?'':'none';
		C.multL.textContent=(Math.floor(mult*100)/100).toFixed(2)+'x';
		C.multL.className=state;
		C.paint(ms,state);
	}
	C.paint=function(ms,state)
	{
		//the curve so far, scaled to fit, with a cookie at its tip
		var ctx=C.ctx,W=C.width,H=C.height,pad=10;
		ctx.fillStyle='#0b2416';
		ctx.fillRect(0,0,W,H);
		var msMax=Math.max(C.doubling,ms*1.15),multMax=Math.max(2,C.multAt(ms)*1.25);
		var x=function(ms){return pad+ms/msMax*(W-2*pad);},y=function(mult){return H-pad-(mult-1)/(multMax-1)*(H-2*pad);};
		ctx.strokeStyle='rgba(255,255,255,0.1)';
		ctx.lineWidth=1;
		for (var i=1;i<4;i++)
		{
			var gy=Math.round(H-pad-i/4*(H-2*pad))+0.5;
			ctx.beginPath();ctx.moveTo(pad,gy);ctx.lineTo(W-pad,gy);ctx.stroke();
		}
		ctx.strokeStyle=state=='busted'?'#ff6b5b':(state=='won'?'#7be08f':'#ffd25a');
		ctx.lineWidth=3;
		ctx.lineJoin='round';
		ctx.beginPath();
		for (var i=0;i<=60;i++) ctx.lineTo(x(ms*i/60),y(C.multAt(ms*i/60)));
		ctx.stroke();
		M.drawCookie(ctx,x(ms),y(C.multAt(ms)),7);
	}
	C.save=function()
	{
		//a round still running is cashed out where it stands when this save gets loaded
		if (!C.running) return '';
		var mult=C.multAt(Date.now()-C.running.start);
		return [C.running.bet,mult<C.running.point?mult:0,C.running.point].join(' ');
	}
	C.load=function(str)
	{
		var spl=str.split(' '),bet=parseFloat(spl[0])||0,mult=parseFloat(spl[1])||0,point=parseFloat(spl[2])||1;
		if (!(bet>0) || C.running) return false;
		C.running={bet:bet,point:point,start:0};
		C.settle(mult,true);
	}
	C.reset=function()
	{
		C.running=0;
		C.last=0;
		C.resultL.innerHTML='';
		C.update();
	}
	C.logic=function()
	{
		if (C.running && C.multAt(Date.now()-C.running.start)>=C.running.point) C.settle(0);
	}
	C.draw=function()
	{
		if (C.running) C.update();
		else if (Game.drawT%10==0 && C.inputL.value) M.showBet(C.inputL,C.infoL);
	}

	/*=====================================================================================
	SLOTS: three reels with the same 20 stops; the middle row counts. Three of a kind pay as listed, cherries count from
	the left (one, two or three). Over all 20^3 combinations the payouts add up to 8000, so on average the bet comes back.
	=======================================================================================*/
	var S=M.slots={name:'Slots'};
	S.symbols=['seven','bar','bell','grape','orange','lemon','cherry'];//order in img/casinoSlots.png
	S.reel=['cherry','lemon','orange','bar','cherry','grape','bell','lemon','cherry','seven','orange','grape','cherry','bell','lemon','bar','orange','cherry','grape','bell'];
	S.pays=[
		{combo:['seven','seven','seven'],mult:125,name:'Three sevens'},
		{combo:['bar','bar','bar'],mult:50,name:'Three bars'},
		{combo:['bell','bell','bell'],mult:20,name:'Three bells'},
		{combo:['grape','grape','grape'],mult:15,name:'Three grapes'},
		{combo:['orange','orange','orange'],mult:10,name:'Three oranges'},
		{combo:['lemon','lemon','lemon'],mult:5,name:'Three lemons'},
		{combo:['cherry','cherry','cherry'],mult:10,name:'Three cherries'},
		{combo:['cherry','cherry'],mult:5,name:'Two cherries'},
		{combo:['cherry'],mult:2,name:'Cherry'},
	];
	S.stopTimes=[600,1000,1400];//ms after the start
	S.cellH=44;//px per symbol on a reel
	S.stops=[9,9,9];//shown on the line
	S.spinning=0;
	S.css=
		'#casinoSlotsStage{display:flex;align-items:center;gap:14px;}'+
		'#casinoSlotsWindow{position:relative;display:flex;gap:6px;padding:8px;border:2px solid #c8a24a;border-radius:8px;background:linear-gradient(#1a0d08,#3a1a10 50%,#1a0d08);box-shadow:0px 0px 0px 2px #000,0px 4px 12px rgba(0,0,0,0.8);}'+
		'#casinoSlotsWindow:after{content:"";position:absolute;left:4px;right:4px;top:50%;height:2px;margin-top:-1px;background:#ffd25a;box-shadow:0px 0px 6px #ffd25a;pointer-events:none;z-index:1;}'+
		'.casinoReel{position:relative;width:48px;height:'+(S.cellH*3)+'px;overflow:hidden;border-radius:4px;background:linear-gradient(#cfc8b6,#f7f3e8 30%,#f7f3e8 70%,#cfc8b6);}'+
		'.casinoReelStrip{position:absolute;left:0px;right:0px;top:0px;}'+
		'.casinoReelCell{height:'+S.cellH+'px;display:flex;align-items:center;justify-content:center;}'+
		'.casinoReelCell.off{opacity:0.4;}'+
		'.casinoReel.spinning .casinoReelStrip{animation:casinoReelRoll 0.12s linear infinite;filter:blur(1.5px);}'+
		'.casinoReel.stopped .casinoReelStrip{animation:casinoReelStop 0.18s ease-out;}'+
		'@keyframes casinoReelRoll{from{transform:translateY(-'+(S.cellH*4)+'px);}to{transform:translateY(0px);}}'+
		'@keyframes casinoReelStop{from{transform:translateY(-8px);}to{transform:none;}}'+
		'.casinoSymbol{display:inline-block;width:32px;height:32px;background:url("'+M.dir+'/img/casinoSlots.png") no-repeat;image-rendering:pixelated;}'+
		'#casinoSlotsPays{border-collapse:collapse;}'+
		'#casinoSlotsPays td{padding:1px 2px;font-size:11px;font-weight:bold;color:#ffd25a;text-align:right;text-shadow:0px 1px 1px #000;white-space:nowrap;}'+
		'#casinoSlotsPays td:first-child{text-align:left;color:#fff;opacity:0.6;}'+
		'#casinoSlotsPays .casinoSymbol{width:16px;height:16px;margin-right:2px;vertical-align:middle;background-size:112px 16px;image-rendering:auto;}';
	S.init=function(div)
	{
		var str='';
		str+='<div id="casinoSlotsStage"><div id="casinoSlotsWindow">';
		for (var r=0;r<3;r++) str+='<div class="casinoReel" id="casinoReel'+r+'"><div class="casinoReelStrip"></div></div>';
		str+='</div><table id="casinoSlotsPays">';
		for (var i=0;i<S.pays.length;i++)
		{
			str+='<tr><td>';
			for (var k=0;k<3;k++) str+=k<S.pays[i].combo.length?S.symbolHTML(S.pays[i].combo[k]):'<span class="casinoSymbol" style="background:none;text-align:center;line-height:16px;">-</span>';
			str+='</td><td>'+S.pays[i].mult+'x</td></tr>';
		}
		str+='</table></div>';
		str+='<div class="casinoControls">';
			str+='<div class="casinoTitle">Slots</div>';
			str+=M.betInputHTML('casinoSlotsBet');
			str+='<div class="casinoButtons" id="casinoSlotsButtons"><a class="casinoButton gold" id="casinoSlotsSpin">Spin</a></div>';
			str+='<div class="casinoResult" id="casinoSlotsResult"></div>';
		str+='</div>';
		div.innerHTML=str;
		S.reelsL=[l('casinoReel0'),l('casinoReel1'),l('casinoReel2')];
		S.inputL=l('casinoSlotsBet');
		S.infoL=l('casinoSlotsBetInfo');
		S.buttonsL=l('casinoSlotsButtons');
		S.resultL=l('casinoSlotsResult');
		M.setupBetInput(S.inputL,S.infoL);
		AddEvent(l('casinoSlotsSpin'),'click',function(){S.spin();});
		for (var r=0;r<3;r++) S.showReel(r,S.stops[r],false);
	}
	S.symbolHTML=function(key)
	{
		return '<span class="casinoSymbol" style="background-position:'+(S.symbols.indexOf(key)/(S.symbols.length-1)*100)+'% 0%;"></span>';
	}
	S.showReel=function(r,stop,spinning)
	{
		//stopped: the stop on the line between its neighbours; spinning: a blurred loop of four symbols
		var n=S.reel.length,str='';
		for (var i=0;i<(spinning?7:3);i++)
		{
			var key=spinning?S.reel[(stop+(i%4)*3)%n]:S.reel[(stop+i-1+n)%n];
			str+='<div class="casinoReelCell'+(!spinning && i!=1?' off':'')+'">'+S.symbolHTML(key)+'</div>';
		}
		S.reelsL[r].className='casinoReel '+(spinning?'spinning':'stopped');
		S.reelsL[r].firstChild.innerHTML=str;
	}
	S.lineWin=function(line)
	{
		//the first row of the pay table that matches
		for (var i=0;i<S.pays.length;i++)
		{
			var combo=S.pays[i].combo,hit=true;
			for (var k=0;k<combo.length;k++) {if (line[k]!=combo[k]) hit=false;}
			if (hit) return S.pays[i];
		}
		return 0;
	}
	S.spin=function()
	{
		if (S.spinning) return false;
		var read=M.readBet(S.inputL);
		if (read.error) {M.refuse(S.infoL,read.error);return false;}
		Game.Spend(read.bet);
		S.spinning={bet:read.bet,stops:[M.random(S.reel.length),M.random(S.reel.length),M.random(S.reel.length)],start:Date.now(),shown:0};
		for (var r=0;r<3;r++) S.showReel(r,M.random(S.reel.length),true);
		S.resultL.innerHTML='';
		S.buttonsL.classList.add('busy');
		PlaySound('snd/cashOut.mp3');
	}
	S.finish=function(silent)
	{
		var spin=S.spinning;
		S.spinning=0;
		for (var r=spin.shown;r<3;r++) S.showReel(r,spin.stops[r],false);
		S.stops=spin.stops;
		var win=S.lineWin(spin.stops.map(function(i){return S.reel[i];})),payout=win?spin.bet*win.mult:0;
		if (payout>0) M.win(payout);
		S.resultL.innerHTML=M.outcome(win?win.name:'No win',spin.bet,payout);
		S.buttonsL.classList.remove('busy');
		if (!silent) PlaySound(win?(win.mult>=20?'snd/smallCymbalCrash.mp3':'snd/cashIn.mp3'):'snd/clickOff2.mp3');
		M.showBet(S.inputL,S.infoL);
	}
	S.save=function()
	{
		return S.spinning?[S.spinning.bet].concat(S.spinning.stops).join(' '):'';
	}
	S.load=function(str)
	{
		var spl=str.split(' '),bet=parseFloat(spl[0])||0,stops=spl.slice(1,4).map(function(x){return parseInt(x);});
		//a spin still going when the game was saved: settle it now
		if (bet>0 && stops.length==3 && stops.every(function(x){return x>=0 && x<S.reel.length;}) && !S.spinning)
		{
			S.spinning={bet:bet,stops:stops,start:0,shown:0};
			S.finish(true);
		}
	}
	S.reset=function()
	{
		S.spinning=0;
		S.buttonsL.classList.remove('busy');
		S.resultL.innerHTML='';
		for (var r=0;r<3;r++) S.showReel(r,S.stops[r],false);
	}
	S.logic=function()
	{
		if (S.spinning && Date.now()>=S.spinning.start+S.stopTimes[2]) S.finish();
	}
	S.draw=function()
	{
		if (S.spinning)
		{
			//the reels stop one after another
			var ms=Date.now()-S.spinning.start;
			while (S.spinning.shown<2 && ms>=S.stopTimes[S.spinning.shown])
			{
				S.showReel(S.spinning.shown,S.spinning.stops[S.spinning.shown],false);
				S.spinning.shown++;
				PlaySound('snd/tick.mp3');
			}
		}
		else if (Game.drawT%10==0 && S.inputL.value) M.showBet(S.inputL,S.infoL);
	}

	/*=====================================================================================
	PLINKO: each ball's way down is decided in advance by one fair coin flip per row of pegs, so it lands in slot k with
	the probability C(n,k)/2^n. Both payout tables return exactly the bet on average (sum of C(n,k)*mult(k) = 2^n), and
	the ball only moves along that way. Several balls can be dropped at once and while others are still falling.
	=======================================================================================*/
	var P=M.plinko={name:'Plinko'};
	P.modes={
		7:{rows:8,rowMs:320,mult:[7,4.1,2.1,0.4,0.2,0.4,2.1,4.1,7]},
		100:{rows:14,rowMs:270,mult:[100,45,18,5,2,0.7,0.2,0,0.2,0.7,2,5,18,45,100]},
	};
	P.mode=7;
	P.width=280;
	P.dropMs=380;//falling onto the first peg
	P.settleMs=420;//bouncing in the slot
	P.hop=1.5;//height of the hops from peg to peg
	P.staggerMs=150;//between balls dropped together
	P.maxBalls=20;//balls dropped at once, and landed balls left on the board
	P.scale=[[47,111,208],[30,158,168],[61,170,92],[232,196,44],[236,134,38],[217,52,43]];//slot colors, low to high multipliers
	P.balls=[];//{path,slot,start,bet,paid}
	P.round=0;//the balls since the board was last empty: {n,stake,payout,last}
	P.css=
		'#casinoPlinkoCanvas{display:block;border-radius:6px;border:2px solid #c8a24a;box-shadow:0px 0px 0px 2px #000,0px 4px 12px rgba(0,0,0,0.8);}'+
		'.casinoCountLabel{font-size:12px;}';
	P.init=function(div)
	{
		var str='';
		str+='<div class="casinoStage"><canvas id="casinoPlinkoCanvas"></canvas></div>';
		str+='<div class="casinoControls">';
			str+='<div class="casinoTitle">Plinko</div>';
			str+='<div class="casinoOptions">';
			for (var mode in P.modes) str+='<a class="option casinoOption" id="casinoPlinkoMode'+mode+'">Max '+mode+'x</a>';
			str+='</div>';
			str+=M.betInputHTML('casinoPlinkoBet');
			str+='<div class="casinoButtons"><span class="casinoCountLabel">Balls</span><input class="casinoCountInput" id="casinoPlinkoCount" type="number" min="1" max="'+P.maxBalls+'" value="1"/><a class="casinoButton gold" id="casinoPlinkoDrop">Drop</a></div>';
			str+='<div class="casinoResult" id="casinoPlinkoResult"></div>';
		str+='</div>';
		div.innerHTML=str;
		P.canvasL=l('casinoPlinkoCanvas');
		P.inputL=l('casinoPlinkoBet');
		P.infoL=l('casinoPlinkoBetInfo');
		P.countL=l('casinoPlinkoCount');
		P.resultL=l('casinoPlinkoResult');
		M.setupBetInput(P.inputL,P.infoL);
		M.isolateInput(P.countL);
		for (var mode in P.modes) AddEvent(l('casinoPlinkoMode'+mode),'click',function(mode){return function(){P.setMode(mode);};}(mode));
		AddEvent(l('casinoPlinkoDrop'),'click',function(){P.drop();});
		P.setMode(P.mode,true);
	}
	P.setMode=function(mode,quiet)
	{
		if (P.round || !P.modes[mode]) return false;
		P.mode=parseInt(mode);
		P.balls=[];
		for (var key in P.modes) l('casinoPlinkoMode'+key).classList.toggle('on',key==P.mode);
		P.layout();
		P.paint();
		if (!quiet) PlaySound('snd/tick.mp3');
	}
	P.layout=function()
	{
		//slots are one peg spacing wide; the last row of pegs sits on the slot borders
		var w=P.width,rows=P.modes[P.mode].rows,u=w/(rows+1),dy=u*0.86;
		var br=Math.max(4,Math.min(u*0.2,11)),pr=Math.max(1.6,Math.min(u*0.085,4.5)),startY=br+4,y0=startY+br+pr+dy*1.1;
		var slotH=Math.max(22,Math.min(u*0.8,40)),slotTop=y0+rows*dy;
		P.lay={w:w,h:Math.ceil(slotTop+slotH+6),u:u,dy:dy,br:br,pr:pr,startY:startY,y0:y0,slotTop:slotTop,slotH:slotH};
		P.ctx=M.setupCanvas(P.canvasL,w,P.lay.h);
		//one font size for all slot labels, with the "x" only where it still fits
		var ctx=P.ctx,room=u-Math.max(2,u*0.06)-6,mult=P.modes[P.mode].mult;
		var fit=function(sign)
		{
			for (var fs=Math.min(13,u*0.42);fs>6;fs-=0.5)
			{
				ctx.font='bold '+fs+'px Tahoma,Arial,sans-serif';
				var widest=0;
				for (var k=0;k<mult.length;k++) widest=Math.max(widest,ctx.measureText(mult[k]+sign).width);
				if (widest<=room) break;
			}
			return fs;
		};
		var withSign=fit('x');
		P.lay.sign=withSign>=10?'x':'';
		P.lay.fs=P.lay.sign?withSign:fit('');
	}
	P.pegX=function(i,j){return P.lay.w/2+(j-i/2)*P.lay.u;}
	P.pegY=function(i){return P.lay.y0+i*P.lay.dy;}
	P.slotX=function(k){return (k+0.5)*P.lay.u;}
	P.totalMs=function()
	{
		var mode=P.modes[P.mode];
		return P.dropMs+mode.rows*mode.rowMs+P.settleMs;
	}
	P.bounce=function(u)
	{
		if (u<0.55) {var a=u/0.55;return 0.9*4*a*(1-a);}
		var b=(u-0.55)/0.45;
		return 0.3*4*b*(1-b);
	}
	P.ballAt=function(ms,ball)
	{
		//falling onto the first peg, one hop per row from peg to peg (left or right as the path says), bouncing in the slot
		var lay=P.lay,mode=P.modes[P.mode],rows=ball.path.length,off=lay.pr+lay.br;
		var restX=P.slotX(ball.slot),restY=lay.slotTop-lay.br-1;
		if (ms<P.dropMs)
		{
			var a=ms/P.dropMs;
			return {x:lay.w/2,y:lay.startY+(P.pegY(0)-off-lay.startY)*a*a,hit:-1,hitJ:0,tau:0,settle:0};
		}
		var s=(ms-P.dropMs)/mode.rowMs;
		if (s>=rows)
		{
			var u=Math.min(1,(s-rows)*mode.rowMs/P.settleMs);
			return {x:restX,y:restY-P.bounce(u)*lay.br,hit:-1,hitJ:0,tau:0,settle:u};
		}
		var i=Math.floor(s),tau=s-i,j=0;
		for (var r=0;r<i;r++) j+=ball.path[r];
		var x0=P.pegX(i,j),y0=P.pegY(i)-off,x1=restX,y1=restY;
		if (i<rows-1) {x1=P.pegX(i+1,j+ball.path[i]);y1=P.pegY(i+1)-off;}
		var f=(1+P.hop)*tau*tau-P.hop*tau;
		return {x:x0+(x1-x0)*tau,y:y0+(y1-y0)*f,hit:i,hitJ:j,tau:tau,settle:0};
	}
	P.color=function(mult,lo,hi)
	{
		//on a logarithmic scale from the lowest to the highest multiplier, with dark or light text to match
		var t=mult>0?Math.max(0,Math.min(1,Math.log(mult/lo)/Math.log(hi/lo))):0;
		var p=t*(P.scale.length-1),i=Math.min(P.scale.length-2,Math.floor(p)),f=p-i,a=P.scale[i],b=P.scale[i+1],c=[],lum=0,wt=[0.2126,0.7152,0.0722];
		for (var k=0;k<3;k++)
		{
			c[k]=Math.round(a[k]+(b[k]-a[k])*f);
			var v=c[k]/255;
			lum+=wt[k]*(v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));
		}
		return {fill:'rgb('+c.join(',')+')',text:lum>0.23?'#0b1f15':'#fff'};
	}
	P.roundRect=function(ctx,x,y,w,h,r)
	{
		ctx.beginPath();
		ctx.moveTo(x+r,y);
		ctx.arcTo(x+w,y,x+w,y+h,r);
		ctx.arcTo(x+w,y+h,x,y+h,r);
		ctx.arcTo(x,y+h,x,y,r);
		ctx.arcTo(x,y,x+w,y,r);
		ctx.closePath();
	}
	P.paint=function()
	{
		var lay=P.lay,ctx=P.ctx,mode=P.modes[P.mode],rows=mode.rows,now=Date.now(),total=P.totalMs(),balls=[],lit={},glow=0;
		for (var b=0;b<P.balls.length;b++)
		{
			var ms=now-P.balls[b].start;
			if (ms<0) continue;
			var pos=P.ballAt(Math.min(ms,total),P.balls[b]),h=Math.min(1,pos.settle*2.5);
			balls.push(pos);
			if (h>0) {lit[P.balls[b].slot]=Math.max(lit[P.balls[b].slot]||0,h);glow=Math.max(glow,h);}
		}
		ctx.globalAlpha=1;
		ctx.fillStyle='#0b2416';
		ctx.fillRect(0,0,lay.w,lay.h);
		//pegs light up when a ball hits them
		for (var i=0;i<rows;i++)
		{
			for (var j=0;j<=i;j++)
			{
				var flash=0;
				for (var k=0;k<balls.length;k++) {if (balls[k].hit==i && balls[k].hitJ==j) flash=Math.max(flash,1-balls[k].tau*2.5);}
				ctx.fillStyle=flash>0?'#fff8dc':'rgba(233,228,212,0.8)';
				ctx.beginPath();ctx.arc(P.pegX(i,j),P.pegY(i),lay.pr*(1+0.7*flash),0,Math.PI*2);ctx.fill();
			}
		}
		var positive=mode.mult.filter(function(m){return m>0;}),lo=Math.min.apply(0,positive),hi=Math.max.apply(0,positive);
		var gap=Math.max(2,lay.u*0.06),sw=lay.u-gap,rad=Math.min(5,sw/4),dpr=P.canvasL.width/lay.w;
		ctx.font='bold '+lay.fs+'px Tahoma,Arial,sans-serif';
		ctx.textAlign='center';
		ctx.textBaseline='middle';
		for (var k=0;k<=rows;k++)
		{
			var on=(lit[k]||0)>0,col=P.color(mode.mult[k],lo,hi),x=k*lay.u+gap/2;
			ctx.globalAlpha=(on || glow==0)?1:1-0.35*glow;
			ctx.fillStyle=col.fill;
			P.roundRect(ctx,x,lay.slotTop,sw,lay.slotH,rad);
			ctx.fill();
			ctx.fillStyle=col.text;
			ctx.fillText(mode.mult[k]+lay.sign,x+sw/2,lay.slotTop+lay.slotH/2+0.5);
			if (on)
			{
				ctx.save();
				ctx.shadowColor=col.fill;
				ctx.shadowBlur=14*lit[k]*dpr;
				ctx.strokeStyle='rgba(255,255,255,'+lit[k]+')';
				ctx.lineWidth=2;
				P.roundRect(ctx,x,lay.slotTop,sw,lay.slotH,rad);
				ctx.stroke();
				ctx.restore();
			}
		}
		ctx.globalAlpha=1;
		for (var b=0;b<balls.length;b++) M.drawCookie(ctx,balls[b].x,balls[b].y,lay.br);
	}
	P.count=function()
	{
		var n=parseInt(P.countL.value);
		return n>=1?Math.min(P.maxBalls,n):1;
	}
	P.drop=function()
	{
		var read=M.readBet(P.inputL),n=P.count();
		P.countL.value=n;
		if (read.error) {M.refuse(P.infoL,read.error);return false;}
		if (read.bet*n>Game.cookies) {M.refuse(P.infoL,'Not enough cookies.');return false;}
		Game.Spend(read.bet*n);
		//a new round clears the board
		if (!P.round) {P.balls=[];P.round={n:0,stake:0,payout:0,last:0};}
		var now=Date.now(),rows=P.modes[P.mode].rows;
		for (var b=0;b<n;b++)
		{
			var path=[],slot=0;
			for (var i=0;i<rows;i++) {path.push(M.random(2));slot+=path[i];}
			P.balls.push({path:path,slot:slot,start:now+b*P.staggerMs,bet:read.bet,paid:0});
		}
		P.resultL.innerHTML='';
		P.update();
		PlaySound('snd/cashOut.mp3');
	}
	P.pay=function(ball)
	{
		var mult=P.modes[P.mode].mult[ball.slot],win=ball.bet*mult;
		ball.paid=1;
		if (win>0) M.win(win);
		P.round.n++;
		P.round.stake+=ball.bet;
		P.round.payout+=win;
		P.round.last=mult;
	}
	P.finish=function(silent)
	{
		var round=P.round;
		P.round=0;
		P.resultL.innerHTML=M.outcome(round.n==1?round.last+'x':round.n+' balls',round.stake,round.payout);
		if (!silent) PlaySound(round.payout>round.stake?(round.payout>=round.stake*10?'snd/smallCymbalCrash.mp3':'snd/cashIn.mp3'):'snd/clickOff2.mp3');
		P.update();
		M.showBet(P.inputL,P.infoL);
	}
	P.update=function()
	{
		for (var key in P.modes) l('casinoPlinkoMode'+key).classList.toggle('off',!!P.round && key!=P.mode);
		P.paint();
	}
	P.save=function()
	{
		//balls still falling: their slots are decided, so they pay when this save gets loaded
		var str=String(P.mode);
		for (var b=0;b<P.balls.length;b++) {if (!P.balls[b].paid) str+=' '+P.balls[b].bet+':'+P.balls[b].slot;}
		return str;
	}
	P.load=function(str)
	{
		var spl=str.split(' ');
		P.setMode(P.modes[spl[0]]?spl[0]:P.mode,true);
		var balls=[];
		for (var i=1;i<spl.length;i++)
		{
			var part=spl[i].split(':'),bet=parseFloat(part[0]),slot=parseInt(part[1]);
			if (bet>0 && slot>=0 && slot<=P.modes[P.mode].rows) balls.push({path:[],slot:slot,start:0,bet:bet,paid:0});
		}
		if (!balls.length || P.round) return false;
		P.round={n:0,stake:0,payout:0,last:0};
		for (var i=0;i<balls.length;i++) P.pay(balls[i]);
		P.finish(true);
	}
	P.reset=function()
	{
		P.balls=[];
		P.round=0;
		P.resultL.innerHTML='';
		P.update();
	}
	P.logic=function()
	{
		//each ball pays as it lands; the result line comes when none is falling anymore
		if (!P.round) return;
		var now=Date.now(),total=P.totalMs(),falling=0;
		for (var b=0;b<P.balls.length;b++)
		{
			if (P.balls[b].paid) continue;
			if (now<P.balls[b].start+total) falling++;
			else P.pay(P.balls[b]);
		}
		//keep at most maxBalls landed balls on the board
		var extra=P.balls.filter(function(ball){return ball.paid;}).length-P.maxBalls;
		if (extra>0) P.balls=P.balls.filter(function(ball){return !(ball.paid && extra-->0);});
		if (!falling) P.finish();
	}
	P.draw=function()
	{
		if (P.round) P.paint();
		else if (Game.drawT%10==0 && P.inputL.value) M.showBet(P.inputL,P.infoL);
	}

	/*=====================================================================================
	MINIGAME
	=======================================================================================*/
	M.save=function()
	{
		//output cannot use ",", ";" or "|"; the switch's state, then one part per game, separated by "/"
		var str=M.selected+' '+(M.parent.onMinigame?1:0);
		for (var i=0;i<M.games.length;i++) str+='/'+(M.games[i].save?M.games[i].save():'');
		return str;
	}
	M.load=function(str)
	{
		//interpret str; called after .init
		if (!str) return false;
		var parts=str.split('/'),spl=parts[0].split(' ');
		for (var i=0;i<M.games.length;i++)
		{
			if (parts[i+1] && M.games[i].load) M.games[i].load(parts[i+1]);
		}
		M.selected=parseInt(spl[0])||0;
		M.updateSwitch();
		if (parseInt(spl[1]||0) && Game.ascensionMode!=1) M.parent.switchMinigame(1);
	}
	M.reset=function()
	{
		for (var i=0;i<M.games.length;i++)
		{
			if (M.games[i].reset) M.games[i].reset();
		}
		M.selected=0;
		M.updateSwitch();
	}
	M.logic=function()
	{
		//run each frame, also while the minigame is closed, so running bets always get settled
		var n=M.unlocked();
		for (var i=0;i<M.games.length;i++)
		{
			if (i>=n && M.games[i].lock) M.games[i].lock();
			if (M.games[i].logic) M.games[i].logic();
		}
	}
	M.draw=function()
	{
		//run each draw frame
		if (M.shownUnlocked!=M.unlocked()) M.updateSwitch();
		var game=M.games[M.selected];
		if (game.draw) game.draw();
	}
	M.init(l('rowSpecial'+M.parent.id));
}
var M=0;

"""Draws all graphics of the Casino building as pixel art in the style of the game. Output in mod/img/:

casinoIcon.png        256x64  store icon; layout of a buildings.png row: icon, locked icon (black silhouette),
                              April Fools icon, April Fools locked icon (the casino uses the same pictures there)
casinoMiniIcons.png   144x48  48px icons like in icons.png: building icon (tooltips), golden "building special"
                              boost and burden versions
casinoBackground.png  128x128 building row background, tiles horizontally
casino.png            192x64  building row sprites, 3 variants (art.frames): slot machine, roulette table, chip stacks
casinoSlots.png       224x32  symbols of the Slots game: seven, BAR, bell, grapes, orange, lemon, cherries
../thumbnail.png      512x512 preview picture of the mod (mod list, Steam Workshop; the game wants it in the mod folder)

Style rules measured on the game's graphics: no semi-transparency, small palettes, 1px dark outline, light from
the top left, dark lines between parts. Store icons fill the height and are cut off by the left edge; 48px icons
are centered (about 32x32) with fewer colors.

Run: .dev/venv/bin/python art/casino.py  (needs Pillow: python3 -m venv .dev/venv && .dev/venv/bin/pip install pillow)
"""
import math, os
from PIL import Image, ImageDraw

IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mod', 'img')

OUTLINE = (32, 14, 10)
RED = [(70, 14, 18), (128, 28, 30), (182, 44, 40), (220, 78, 62), (248, 140, 108)]
GOLD = [(96, 52, 18), (158, 98, 30), (214, 152, 48), (244, 206, 100), (255, 244, 196)]
CREAM = [(160, 136, 108), (214, 198, 168), (246, 238, 218)]
COOKIE = [(86, 44, 20), (156, 94, 42), (206, 146, 78), (240, 196, 126)]
DARK = (48, 22, 16)
FELT = [(18, 64, 38), (30, 98, 54), (48, 132, 70), (88, 168, 96)]
WOOD = [(62, 30, 14), (102, 56, 26), (146, 88, 42), (186, 124, 64)]
BLACK = [(22, 20, 24), (44, 40, 48), (72, 66, 78)]


class Canvas:
	def __init__(self, w=64, h=64, wrap=False):
		self.w, self.h, self.wrap = w, h, wrap
		self.px = {}

	def put(self, x, y, color):
		x, y = math.floor(x), math.floor(y)
		if self.wrap:
			x %= self.w
		if 0 <= x < self.w and 0 <= y < self.h:
			self.px[(x, y)] = color

	def paint(self, mask, ramp, level):
		"""Fill mask with ramp colors. level(x, y) is a position on the ramp (0 = darkest); values near the middle
		between two colors are dithered in a checker pattern, everything else gets a flat color (pixel art banding)."""
		for (x, y) in mask:
			v = max(0.0, min(len(ramp) - 1.0, level(x, y)))
			i, f = int(v), v - int(v)
			if f > 0.62 or (f > 0.38 and (x + y) % 2):
				i += 1
			self.put(x, y, ramp[min(i, len(ramp) - 1)])

	def line(self, pts, color):
		for p in pts:
			self.put(p[0], p[1], color)

	def outline(self, color=OUTLINE):
		"""Outer 1px outline around everything drawn so far."""
		add = [(x, y) for y in range(self.h) for x in range(self.w) if (x, y) not in self.px
			and any((x + dx, y + dy) in self.px for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
		for p in add:
			self.px[p] = color

	def image(self):
		img = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
		for (x, y), c in self.px.items():
			img.putpixel((x, y), c + (255,))
		return img


def shape(draw_fn, w=64, h=64):
	"""Pixels covered by a shape drawn with Pillow (aliased, so edges stay crisp)."""
	m = Image.new('1', (w, h), 0)
	draw_fn(ImageDraw.Draw(m))
	return [(x, y) for y in range(h) for x in range(w) if m.getpixel((x, y))]


def rect(x0, y0, x1, y1):
	return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def disc(cx, cy, r):
	return [(x, y) for y in range(math.floor(cy - r) - 1, math.ceil(cy + r) + 1)
		for x in range(math.floor(cx - r) - 1, math.ceil(cx + r) + 1) if (x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= r * r]


def edge(mask):
	"""Pixels of mask that touch a pixel outside of it."""
	s = set(mask)
	return [(x, y) for (x, y) in mask if any((x + dx, y + dy) not in s for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]


def sprite(c, x0, y0, rows, colors):
	for dy, row in enumerate(rows):
		for dx, ch in enumerate(row):
			if ch in colors:
				c.put(x0 + dx, y0 + dy, colors[ch])


# Small cookies are placed pixel by pixel: at 4 to 9 pixels, drawn circles turn into squares or faces.
# H highlight, B base, M shaded base, R rim, S rim on the shadow side, C chocolate chip
COOKIE_COLORS = {'H': COOKIE[3], 'B': COOKIE[2], 'M': (184, 122, 60), 'R': COOKIE[1], 'S': (118, 66, 28), 'C': COOKIE[0]}
COOKIE_9 = ['..RRRRR..', '.RHHHBBR.', 'RHHCBBBBR', 'RHBBBBCBS', 'RBBBBBBMS', 'RBCBBBBMS', 'RBBBBCMMS', '.SMBBMMS.', '..SSSSS..']
COOKIE_7 = ['.RRRRR.', 'RHHBCBR', 'RHCBBBS', 'RBBBBCS', 'RBBCBMS', '.SBMMS.', '..SSS..']
COOKIE_5 = ['.RRR.', 'RHCBS', 'RBBCS', '.SMS.', '..S..']


# ---------------------------------------------------------------------------------------------------------------
# store icon (64x64)

def store_icon():
	c = Canvas()
	L, R = -6, 38  # cabinet spans past the left edge, like the game's icons

	# cabinet: highlight strip on the left, main tone, rounded shadow side on the right
	def body_level(x, y):
		if x <= 1: return 3.0
		if x <= 2: return 2.5
		if x >= R - 1: return 0.6
		if x >= R - 4: return 1.4
		return 2.0 - 0.25 * (y - 18) / 36
	c.paint(rect(L, 18, R, 54), RED, body_level)

	# topper: gold arch with a red panel, bulbs and a cookie emblem
	arch = [p for p in shape(lambda d: d.pieslice((L + 1, 3, R - 1, 33), 180, 360, fill=1)) if p[1] <= 18]
	c.paint(arch, GOLD, lambda x, y: 3.3 - 2.2 * (x - L) / (R - L) - 0.6 * (y - 3) / 15)
	panel = [p for p in shape(lambda d: d.pieslice((L + 4, 6, R - 4, 30), 180, 360, fill=1)) if p[1] <= 17]
	c.paint(panel, RED, lambda x, y: 3.0 - 1.6 * (x - L) / (R - L) - 0.5 * (y - 6) / 11)
	for (x, y) in edge(panel):
		if y < 17:
			c.put(x, y, GOLD[1])
	for a in range(205, 340, 22):
		bx = 16 + round(19.5 * math.cos(math.radians(a)))
		by = 18 + round(13.5 * math.sin(math.radians(a)))
		c.line([(bx, by), (bx + 1, by), (bx, by + 1)], GOLD[4])
		c.put(bx + 1, by + 1, GOLD[3])
	sprite(c, 12, 8, COOKIE_9, COOKIE_COLORS)

	# gold bands with a dark line below each
	for y0 in (18, 38):
		c.paint(rect(L, y0, R, y0 + 1), GOLD, lambda x, y: 3.4 - 2.2 * (x - L) / (R - L) - 0.7 * (y - y0))
		c.line([(x, y0 + 2) for x in range(L, R + 1)], RED[0])

	# reel window: gold frame, dark recess, three reels showing a cookie each (jackpot)
	c.paint(rect(-1, 21, 33, 36), GOLD, lambda x, y: 3.6 - 2.0 * (x + 1) / 34 - 1.0 * (y - 21) / 15)
	c.line(rect(0, 22, 32, 35), DARK)
	for rx in (1, 12, 23):
		reel = rect(rx, 23, rx + 8, 34)
		c.paint(reel, CREAM, lambda x, y: 2.3 - abs(y - 28.5) / 3.2 - (0.6 if x == rx + 8 else 0))
		sprite(c, rx + 1, 25, COOKIE_7, COOKIE_COLORS)
		# the next symbols peeking in at the top and bottom of the reel
		c.line([(x, 23) for x in range(rx + 3, rx + 6)], COOKIE[1])
		c.line([(x, 34) for x in range(rx + 3, rx + 6)], COOKIE[1])
	# payline arrow
	c.line([(34, 26), (34, 27), (34, 28), (34, 29), (34, 30), (35, 27), (35, 28), (35, 29), (36, 28)], GOLD[3])
	c.line([(34, 30), (35, 29)], GOLD[2])

	# buttons: highlight on top, shadow below
	for bx, ramp in ((2, RED), (9, GOLD), (16, RED)):
		c.line([(x, 42) for x in range(bx, bx + 5)], ramp[4])
		c.line([(x, 43) for x in range(bx, bx + 5)], ramp[3])
		c.line([(x, 44) for x in range(bx, bx + 5)], ramp[1])
		c.line([(x, 45) for x in range(bx, bx + 5)], RED[0])

	# payout tray: dark recess with a gold lip, the winnings are cookies
	c.line(rect(1, 47, 31, 51), DARK)
	c.paint(rect(1, 52, 31, 53), GOLD, lambda x, y: 3.2 - 2.0 * x / 31 - 0.8 * (y - 52))
	for tx in (4, 10, 19):
		sprite(c, tx, 47, COOKIE_5, COOKIE_COLORS)

	# base, a little wider on the right
	c.paint(rect(L, 55, R + 2, 60), RED, lambda x, y: 1.6 - 1.0 * (x - L) / (R + 2 - L) - 0.4 * (y - 55) / 5)
	c.line([(x, 55) for x in range(L, R + 3)], RED[0])

	# lever: bracket on the side, slanted rod, red ball
	c.paint(rect(R + 1, 31, R + 3, 39), GOLD, lambda x, y: 2.6 - 0.6 * (x - R - 1) - 0.1 * (y - 31))
	for t in range(0, 22):
		x = R + 3 + round(t * 5 / 21)
		y = 35 - t
		c.put(x, y, GOLD[3])
		c.put(x + 1, y, GOLD[1])
	ball = disc(R + 8.5, 10.5, 5.2)
	c.paint(ball, RED, lambda x, y: 3.4 - 0.75 * ((x - R - 8.5) + (y - 10.5)))
	c.line([(R + 6, 8), (R + 7, 7), (R + 6, 7)], RED[4])
	c.put(R + 7, 8, (255, 232, 214))

	c.outline()
	return c.image()


# ---------------------------------------------------------------------------------------------------------------
# 48px icons: a simpler slot machine plus the golden cookie boost/burden versions

MINI_OUTLINE = (52, 21, 23)
MRED = [(118, 26, 30), (190, 50, 44), (234, 106, 82)]
MGOLD = [(149, 94, 57), (221, 180, 102), (250, 237, 185)]
MINI_COOKIE = {'B': (196, 136, 70), 'C': (110, 60, 28)}
COOKIE_4 = ['.BB.', 'BBCB', 'BCBB', '.BB.']


def mini_icon():
	c = Canvas(48, 48)
	arch = [p for p in shape(lambda d: d.pieslice((12, 7, 31, 23), 180, 360, fill=1), 48, 48) if p[1] <= 15]
	c.paint(arch, MGOLD, lambda x, y: 2.3 - 1.8 * (x - 12) / 19 - 0.5 * (y - 7) / 8)
	panel = [p for p in shape(lambda d: d.pieslice((15, 10, 28, 20), 180, 360, fill=1), 48, 48) if p[1] <= 14]
	c.line(panel, MRED[1])
	c.line([(20, 12), (21, 12), (22, 12), (23, 12)], MGOLD[2])  # lamp in the topper
	c.paint(rect(12, 15, 31, 36), MRED, lambda x, y: 2 if x <= 13 else (0 if x >= 30 else 1))
	c.line(rect(14, 18, 29, 27), MGOLD[1])
	c.line(rect(15, 19, 28, 26), MGOLD[2])
	c.line([(x, y) for x in (19, 24) for y in range(19, 27)], MGOLD[0])
	for rx in (15, 20, 25):
		sprite(c, rx, 21, COOKIE_4, MINI_COOKIE)
	c.line([(x, 29) for x in range(12, 32)], MGOLD[1])
	c.line([(x, 30) for x in range(12, 32)], MRED[0])
	c.line(rect(15, 32, 28, 34), MINI_OUTLINE)
	c.line([(x, 35) for x in range(15, 29)], MGOLD[1])
	c.paint(rect(11, 37, 32, 40), MRED, lambda x, y: 1 if y == 37 else 0)
	c.line(rect(32, 26, 33, 30), MGOLD[1])
	for t in range(0, 14):
		c.put(33 + round(t * 3 / 13), 28 - t, MGOLD[2])
	c.paint(disc(36.5, 12.5, 2.8), MRED, lambda x, y: 2.4 - 0.6 * ((x - 36.5) + (y - 12.5)))
	c.put(35, 11, MGOLD[2])
	c.outline(MINI_OUTLINE)
	return c.image()


def recolor(icon, outline_new, ramp, cuts):
	"""Map an icon onto another palette by brightness, the way the game's boost/burden icons look."""
	out = Image.new('RGBA', icon.size, (0, 0, 0, 0))
	for y in range(icon.height):
		for x in range(icon.width):
			r, g, b, a = icon.getpixel((x, y))
			if not a:
				continue
			if (r, g, b) == MINI_OUTLINE:
				col = outline_new
			else:
				lum = 0.3 * r + 0.59 * g + 0.11 * b
				col = ramp[sum(1 for cut in cuts if lum >= cut)]
			out.putpixel((x, y), col + (255,))
	return out


def boost_icon(icon):
	img = recolor(icon, (106, 34, 15), [(169, 118, 33), (233, 214, 115), (255, 255, 255)], [95, 175])
	for (x, y, size) in ((7, 10, 2), (41, 6, 2), (42, 35, 1), (5, 31, 1), (24, 3, 1)):
		img.putpixel((x, y), (255, 255, 255, 255))
		for d in range(1, size + 1):
			for (dx, dy) in ((d, 0), (-d, 0), (0, d), (0, -d)):
				img.putpixel((x + dx, y + dy), (233, 214, 115, 255) if d == size else (255, 255, 255, 255))
	return img


def burden_icon(icon):
	img = recolor(icon, (77, 42, 35), [(149, 94, 57), (168, 191, 145), (255, 255, 255)], [90, 200])
	slime = (168, 191, 145, 255)
	for (x, length) in ((13, 3), (18, 2), (24, 4), (30, 2)):
		for d in range(length):
			img.putpixel((x, 41 + d), slime)
		img.putpixel((x, 41 + length), (77, 42, 35, 255))
	for (x, y) in ((6, 19), (8, 30), (42, 22), (40, 41), (10, 43), (26, 4)):
		img.putpixel((x, y), slime)
	return img


# ---------------------------------------------------------------------------------------------------------------
# building row background (128x128, tiles horizontally): casino wall with panels and lamps, patterned carpet

WALL = [(40, 12, 16), (58, 18, 22), (76, 26, 28), (98, 36, 34)]
TRIM = [(84, 56, 26), (126, 88, 40), (168, 126, 58)]
CARPET = [(52, 14, 20), (72, 20, 26), (92, 28, 32)]
LAMP = [(150, 108, 58), (212, 170, 100), (252, 226, 168)]


def noise(x, y):
	"""Deterministic texture noise that repeats every 128 pixels horizontally."""
	n = ((x % 128) * 374761393 + y * 668265263) & 0xffffffff
	n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
	return (n >> 8) % 100


def row_background():
	c = Canvas(128, 128, wrap=True)
	# wall, slightly lighter towards the top where the lamps are
	for (x, y) in rect(0, 0, 127, 63):
		level = 1.6 - y / 70 + (0.35 if noise(x, y) < 12 else 0) - (0.35 if noise(x, y) > 90 else 0)
		c.paint([(x, y)], WALL, lambda x, y, level=level: level)
	# two recessed panels per tile with a gold frame and an art deco diamond
	for px0 in (7, 71):
		px1 = px0 + 49
		c.line(rect(px0 + 1, 7, px1 - 1, 56), WALL[0])
		c.line([(x, 6) for x in range(px0, px1 + 1)] + [(px0, y) for y in range(6, 58)], TRIM[2])
		c.line([(x, 57) for x in range(px0, px1 + 1)] + [(px1, y) for y in range(6, 58)], TRIM[0])
		cx, cy = (px0 + px1) // 2, 31
		for d in range(0, 12):
			c.line([(cx - d, cy - 11 + d), (cx + d, cy - 11 + d), (cx - d, cy + 11 - d), (cx + d, cy + 11 - d)], TRIM[0])
		c.line(rect(cx - 1, cy - 1, cx + 1, cy + 1), TRIM[1])
	# wall lamps between the panels, with a dithered glow on the wall
	for lx in (63, 127):
		for (x, y) in disc(lx + 0.5, 22.5, 9):
			if (x + y) % 2 == 0 and (x, y) not in set(rect(lx - 6, 6, lx + 6, 57)) or abs(x - lx - 0.5) > 5:
				if (x + y) % 2 == 0:
					c.put(x, y, WALL[3])
		c.line(rect(lx - 1, 26, lx + 2, 29), TRIM[1])
		c.line(rect(lx - 2, 18, lx + 3, 25), LAMP[1])
		c.line(rect(lx - 1, 19, lx + 1, 23), LAMP[2])
		c.line([(lx - 2, 17), (lx + 3, 17), (lx - 3, 18), (lx + 4, 18)], TRIM[0])
		c.line([(x, 17) for x in range(lx - 1, lx + 3)], LAMP[0])
	# chair rail
	for x in range(128):
		c.put(x, 60, TRIM[2])
		c.put(x, 61, TRIM[1])
		c.put(x, 62, TRIM[0])
		c.put(x, 63, OUTLINE)
	# carpet: dark near the wall, gold diamonds and teal dots in a staggered grid
	for (x, y) in rect(0, 64, 127, 127):
		level = 0.4 + min(1.5, (y - 64) / 18) + (0.3 if noise(x, y) < 10 else 0) - (0.3 if noise(x, y) > 92 else 0)
		c.paint([(x, y)], CARPET, lambda x, y, level=level: level)
	for j, gy in enumerate(range(72, 128, 14)):
		for gx in range(0, 128, 16):
			cx = gx + (8 if j % 2 else 0)
			for d in range(3):
				c.line([(cx - d, gy - 2 + d), (cx + d, gy - 2 + d), (cx - d, gy + 2 - d), (cx + d, gy + 2 - d)], TRIM[0])
			c.put(cx, gy, (36, 74, 72))
			c.put(cx + 8, gy + 7, (36, 74, 72))
	return c.image()


# ---------------------------------------------------------------------------------------------------------------
# building row sprites: 3 variants of 64x64 side by side

def slot_sprite():
	c = Canvas()
	L, R = 19, 41
	c.paint(rect(L, 22, R, 54), RED, lambda x, y: 3.0 if x <= L + 1 else (0.6 if x >= R - 1 else 2.0 - 0.3 * (y - 22) / 32))
	arch = [p for p in shape(lambda d: d.pieslice((L, 11, R, 33), 180, 360, fill=1)) if p[1] <= 22]
	c.paint(arch, GOLD, lambda x, y: 3.4 - 2.2 * (x - L) / (R - L) - 0.5 * (y - 11) / 11)
	panel = [p for p in shape(lambda d: d.pieslice((L + 3, 14, R - 3, 30), 180, 360, fill=1)) if p[1] <= 21]
	c.paint(panel, RED, lambda x, y: 3.0 - 1.4 * (x - L) / (R - L))
	sprite(c, 28, 15, COOKIE_5, COOKIE_COLORS)
	c.paint(rect(L, 22, R, 23), GOLD, lambda x, y: 3.2 - 2.0 * (x - L) / (R - L))
	c.paint(rect(L + 1, 26, R - 1, 35), GOLD, lambda x, y: 3.4 - 2.0 * (x - L) / (R - L) - 0.6 * (y - 26) / 9)
	c.line(rect(L + 2, 27, R - 2, 34), DARK)
	for rx in (L + 3, L + 9, L + 15):
		c.paint(rect(rx, 28, rx + 4, 33), CREAM, lambda x, y: 2.2 - abs(y - 30.5) / 2.2)
		sprite(c, rx, 28, COOKIE_5, COOKIE_COLORS)
	c.paint(rect(L, 37, R, 38), GOLD, lambda x, y: 3.0 - 2.0 * (x - L) / (R - L))
	for bx in (L + 3, L + 8, L + 13):
		c.line([(bx, 41), (bx + 2, 41)], RED[4])
		c.line([(bx, 42), (bx + 2, 42)], RED[1])
	c.line(rect(L + 3, 45, R - 3, 49), DARK)
	c.paint(rect(L + 3, 50, R - 3, 50), GOLD, lambda x, y: 3.0 - 2.0 * (x - L) / (R - L))
	sprite(c, L + 8, 45, COOKIE_5, COOKIE_COLORS)
	c.paint(rect(L - 2, 55, R + 2, 60), RED, lambda x, y: 1.4 - 0.9 * (x - L) / (R - L) - 0.3 * (y - 55) / 5)
	c.line([(x, 55) for x in range(L - 2, R + 3)], RED[0])
	c.paint(rect(R + 1, 33, R + 2, 40), GOLD, lambda x, y: 2.4)
	for t in range(0, 17):
		c.put(R + 2 + round(t * 3 / 16), 36 - t, GOLD[3])
	c.paint(disc(R + 5.5, 17.5, 3.4), RED, lambda x, y: 3.3 - 0.8 * ((x - R - 5.5) + (y - 17.5)))
	c.put(R + 4, 16, (255, 232, 214))
	c.outline()
	return c.image()


def roulette_sprite():
	c = Canvas()
	# pedestal and foot
	c.paint(rect(28, 48, 35, 58), WOOD, lambda x, y: 2.2 - 1.8 * (x - 28) / 7)
	c.paint(rect(20, 58, 43, 61), WOOD, lambda x, y: 2.0 - 1.4 * (x - 20) / 23 - 0.4 * (y - 58) / 3)
	# table: wooden rim around green felt, seen slightly from above
	top = shape(lambda d: d.polygon([(7, 30), (56, 30), (61, 45), (2, 45)], fill=1))
	c.paint(top, WOOD, lambda x, y: 3.0 - 1.6 * x / 63)
	felt = shape(lambda d: d.polygon([(9, 32), (54, 32), (58, 43), (5, 43)], fill=1))
	c.paint(felt, FELT, lambda x, y: 2.6 - 1.4 * x / 63 - 0.3 * (y - 32) / 11)
	c.paint(rect(2, 46, 61, 49), WOOD, lambda x, y: 1.6 - 1.2 * x / 63 - 0.3 * (y - 46))
	c.line([(x, 46) for x in range(2, 62)], WOOD[0])
	# betting fields on the felt: red, green, black
	for fx, col in ((33, RED[2]), (40, FELT[3]), (47, BLACK[1])):
		c.line(rect(fx, 35, fx + 5, 39), col)
		c.line([(fx, 40), (fx + 5, 40)], FELT[0])
	c.line([(x, 34) for x in range(33, 53)], CREAM[2])
	# wheel: wooden bowl, ring of red/black pockets with one green, gold turret
	cx, cy = 18.5, 37.5
	for (x, y) in shape(lambda d: d.ellipse((6, 31, 31, 44), fill=1)):
		dx, dy = (x + 0.5 - cx) / 12.5, (y + 0.5 - cy) / 6.5
		r = math.hypot(dx, dy)
		if r > 0.8:
			c.put(x, y, WOOD[3] if dy < 0 else WOOD[1])
		elif r > 0.45:
			a = (math.degrees(math.atan2(dy, dx)) + 360) % 360
			k = int(a // 24)
			c.put(x, y, FELT[2] if k == 0 else (RED[2] if k % 2 else BLACK[1]))
		else:
			c.put(x, y, GOLD[3] if dx + dy < 0 else GOLD[2])
	c.line([(18, 34), (19, 34), (18, 35), (19, 35)], GOLD[4])
	c.put(25, 35, CREAM[2])  # the ball
	c.outline()
	return c.image()


def chips_sprite():
	c = Canvas()

	def stack(x0, count, ramp, stripe):
		w = 11
		for k in range(count):
			y = 57 - k * 3
			c.paint(rect(x0, y - 2, x0 + w - 1, y), ramp, lambda x, y, x0=x0: 2.2 - 1.6 * (x - x0) / w - (0.8 if (y % 3) == 0 else 0))
			for sx in range(x0 + 1, x0 + w - 1, 3):
				c.put(sx, y - 1, stripe)
		ty = 57 - count * 3
		c.line([(x, ty) for x in range(x0 + 1, x0 + w - 1)], ramp[-1])
		c.line([(x, ty + 1) for x in range(x0, x0 + w)], ramp[-2])
		return ty

	stack(8, 5, RED[1:4], CREAM[2])
	top = stack(19, 9, BLACK, CREAM[1])
	stack(30, 3, FELT[1:4], CREAM[2])
	sprite(c, 20, top - 8, COOKIE_9, COOKIE_COLORS)
	# a die leaning against the stacks: front face with pips, top and side faces
	c.paint(rect(42, 47, 52, 57), CREAM, lambda x, y: 2.2 - 0.6 * (y - 47) / 10)
	c.line([(43 + d, 46 - d) for d in range(0, 3)] + [(x, 44) for x in range(45, 56)], CREAM[2])
	c.line(rect(44, 45, 54, 46), CREAM[2])
	c.paint(rect(53, 45, 55, 55), CREAM, lambda x, y: 0.6)
	for (x, y) in ((44, 49), (47, 52), (50, 55), (50, 49), (44, 55)):
		c.line([(x, y), (x + 1, y), (x, y - 1), (x + 1, y - 1)], RED[1])
	c.outline()
	return c.image()


# ---------------------------------------------------------------------------------------------------------------
# Slots game symbols (32x32 each, in the style of the 48px icons): seven, BAR, bell, grapes, orange, lemon, cherries

PURPLE = [(58, 24, 76), (98, 44, 124), (146, 80, 172), (200, 146, 218)]
ORANGE = [(132, 56, 14), (206, 104, 26), (244, 154, 54), (255, 210, 136)]
LEMON = [(140, 110, 18), (214, 182, 36), (248, 226, 86), (255, 248, 186)]
LEAF = [(30, 76, 30), (56, 130, 46), (112, 186, 74)]
CHERRY = [(96, 14, 24), (170, 30, 40), (226, 66, 70), (255, 166, 158)]
STEM = (92, 58, 26)
LETTERS = {
	'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
	'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
	'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
	'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
	'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
	'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
	'N': ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
	'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
}


def lit(cx, cy, r, ramp):
	"""Ramp level for a round shape lit from the top left."""
	return lambda x, y: (len(ramp) - 1) * (0.62 - 0.5 * ((x + 0.5 - cx) + (y + 0.5 - cy)) / (2 * r))


def bevel(c, mask, ramp):
	"""Flat shape with a light top left edge and a dark bottom right edge."""
	s = set(mask)
	for (x, y) in mask:
		if (x, y - 1) not in s or (x - 1, y) not in s:
			c.put(x, y, ramp[-1])
		elif (x, y + 1) not in s or (x + 1, y) not in s:
			c.put(x, y, ramp[0])
		else:
			c.put(x, y, ramp[-2])


def berry(c, cx, cy, r, ramp):
	"""Round fruit with a dark rim (separates overlapping ones) and a highlight pixel."""
	mask = disc(cx, cy, r)
	c.paint(mask, ramp, lit(cx, cy, r, ramp))
	c.line(edge(mask), ramp[0])
	c.put(cx - r * 0.45, cy - r * 0.45, ramp[-1])


def slots_symbols():
	symbols = []

	c = Canvas(32, 32)
	seven = rect(7, 5, 25, 10) + shape(lambda d: d.polygon([(19, 10), (25, 10), (15, 27), (9, 27)], fill=1), 32, 32)
	bevel(c, sorted(set(seven)), CHERRY[:3] + [CHERRY[3]])
	c.outline(MINI_OUTLINE)
	symbols.append(c)

	c = Canvas(32, 32)
	plate = [p for p in rect(3, 9, 28, 22) if p not in ((3, 9), (28, 9), (3, 22), (28, 22))]
	bevel(c, plate, BLACK)
	for i, ch in enumerate('BAR'):
		sprite(c, 7 + i * 6, 12, LETTERS[ch], {'#': CREAM[2]})
	c.outline(MINI_OUTLINE)
	symbols.append(c)

	c = Canvas(32, 32)
	def bell_shape(d):
		d.pieslice((9, 5, 23, 21), 180, 360, fill=1)
		d.polygon([(9, 13), (23, 13), (25, 20), (27, 23), (5, 23), (7, 20)], fill=1)
	body = shape(bell_shape, 32, 32)
	c.paint(body, GOLD, lit(15, 13, 11, GOLD))
	c.line([(x, 23) for x in range(5, 28)], GOLD[1])
	c.line([(x, 21) for x in range(8, 25)], GOLD[3])
	c.paint(disc(16, 26, 2.4), GOLD, lit(16, 26, 2.4, GOLD))
	c.line(rect(15, 2, 16, 4), GOLD[1])
	c.outline(MINI_OUTLINE)
	symbols.append(c)

	c = Canvas(32, 32)
	c.line([(16, 9), (16, 8), (17, 7), (17, 6), (18, 5)], STEM)
	c.paint(shape(lambda d: d.ellipse((18, 3, 26, 8), fill=1), 32, 32), LEAF, lambda x, y: 2.2 - 0.25 * (y - 3))
	for (x, y) in ((10, 13), (16, 13), (22, 13), (13, 19), (19, 19), (16, 25)):
		berry(c, x, y, 3.6, PURPLE)
	c.outline(MINI_OUTLINE)
	symbols.append(c)

	c = Canvas(32, 32)
	fruit = disc(16, 18, 11)
	c.paint(fruit, ORANGE, lit(16, 18, 11, ORANGE))
	for (x, y) in ((12, 21), (19, 24), (22, 16), (15, 26), (9, 16)):
		c.put(x, y, ORANGE[1])
	c.put(11, 12, ORANGE[3])
	c.put(12, 11, ORANGE[3])
	c.line([(16, 7), (16, 6)], STEM)
	c.paint(shape(lambda d: d.ellipse((17, 3, 24, 8), fill=1), 32, 32), LEAF, lambda x, y: 2.2 - 0.3 * (y - 3))
	c.outline(MINI_OUTLINE)
	symbols.append(c)

	c = Canvas(32, 32)
	lemon = shape(lambda d: d.ellipse((5, 9, 27, 25), fill=1), 32, 32) + [(3, 17), (4, 16), (4, 17), (4, 18), (28, 16), (27, 15), (27, 16), (27, 17)]
	c.paint(sorted(set(lemon)), LEMON, lit(16, 17, 11, LEMON))
	c.line([(11, 12), (12, 12), (13, 11)], LEMON[3])
	c.outline(MINI_OUTLINE)
	symbols.append(c)

	c = Canvas(32, 32)
	for t in range(0, 15):
		c.put(11 + t * 7 / 14, 17 - t * 11 / 14, LEAF[0])
		c.put(21 - t * 3 / 14, 18 - t * 12 / 14, LEAF[0])
	c.paint(shape(lambda d: d.ellipse((19, 3, 27, 8), fill=1), 32, 32), LEAF, lambda x, y: 2.2 - 0.3 * (y - 3))
	berry(c, 10.5, 22.5, 5.8, CHERRY)
	berry(c, 21.5, 23.5, 5.8, CHERRY)
	c.outline(MINI_OUTLINE)
	symbols.append(c)

	sheet = Image.new('RGBA', (32 * len(symbols), 32), (0, 0, 0, 0))
	for i, s in enumerate(symbols):
		sheet.paste(s.image(), (i * 32, 0))
	return sheet


# ---------------------------------------------------------------------------------------------------------------
# preview picture for the mod list and the Steam Workshop (512x512): the slot machine in front of the casino wall

def thumbnail(background, mini):
	img = background.resize((512, 512), Image.NEAREST)
	c = Canvas(37, 9)
	for i, ch in enumerate('CASINO'):
		sprite(c, 1 + i * 6, 1, LETTERS[ch], {'#': GOLD[3]})
	c.outline(OUTLINE)
	text = c.image().resize((37 * 7, 9 * 7), Image.NEAREST)
	img.alpha_composite(text, ((512 - text.width) // 2, 20))
	img.alpha_composite(mini.resize((48 * 9, 48 * 9), Image.NEAREST), (40, 96))
	return img


# ---------------------------------------------------------------------------------------------------------------

def save(img, name):
	img.save(os.path.join(IMG, name))
	print(f'{name:22} {img.width}x{img.height}')


def main():
	os.makedirs(IMG, exist_ok=True)
	icon = store_icon()
	silhouette = Image.new('RGBA', icon.size, (0, 0, 0, 0))
	silhouette.paste((0, 0, 0, 255), (0, 0, 64, 64), icon.split()[3])
	sheet = Image.new('RGBA', (256, 64), (0, 0, 0, 0))
	for i, tile in enumerate((icon, silhouette, icon, silhouette)):
		sheet.paste(tile, (i * 64, 0))
	save(sheet, 'casinoIcon.png')

	mini = mini_icon()
	sheet = Image.new('RGBA', (144, 48), (0, 0, 0, 0))
	for i, tile in enumerate((mini, boost_icon(mini), burden_icon(mini))):
		sheet.paste(tile, (i * 48, 0))
	save(sheet, 'casinoMiniIcons.png')

	background = row_background()
	save(background, 'casinoBackground.png')

	sheet = Image.new('RGBA', (192, 64), (0, 0, 0, 0))
	for i, tile in enumerate((slot_sprite(), roulette_sprite(), chips_sprite())):
		sheet.paste(tile, (i * 64, 0))
	save(sheet, 'casino.png')

	save(slots_symbols(), 'casinoSlots.png')
	save(thumbnail(background, mini), os.path.join('..', 'thumbnail.png'))


if __name__ == '__main__':
	main()

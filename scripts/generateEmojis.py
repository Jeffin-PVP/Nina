#!/usr/bin/env python3
"""Gera os emojis de interface da Nina (PNG 128x128) em assets/emojis/.

Uso:  python3 scripts/generateEmojis.py
Requer: pip install pillow
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

S = 512            # resolução interna (supersampling)
OUT = 128          # tamanho final
K = S / 100.0      # unidades 0-100 -> pixels

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "emojis")
FONT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"

WHITE = (255, 255, 255, 255)
CUT = (0, 0, 0, 0)

PALETTES = {
    "brand":   ("#ff8bf5", "#c43bd6"),
    "red":     ("#ff6b81", "#e0314f"),
    "green":   ("#4be08a", "#1faa59"),
    "amber":   ("#ffcc4d", "#f59e0b"),
    "blue":    ("#6aa8ff", "#3b6fe0"),
    "gold":    ("#ffd75e", "#f2a20c"),
    "purple":  ("#a77bff", "#6b3fd8"),
    "teal":    ("#4fd8d0", "#14a6a0"),
    "slate":   ("#9aa6c4", "#5f6c8c"),
}


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class G:
    """Canvas de glifo em coordenadas 0-100."""

    def __init__(self):
        self.im = Image.new("RGBA", (S, S), CUT)
        self.d = ImageDraw.Draw(self.im)

    @staticmethod
    def p(v):
        return v * K

    def box(self, b):
        return [self.p(v) for v in b]

    def rect(self, b, r=0, fill=WHITE):
        self.d.rounded_rectangle(self.box(b), radius=self.p(r), fill=fill)

    def rect_o(self, b, r=0, w=6, fill=WHITE):
        self.d.rounded_rectangle(self.box(b), radius=self.p(r), outline=fill, width=int(self.p(w)))

    def ell(self, cx, cy, r, fill=WHITE):
        self.d.ellipse(self.box((cx - r, cy - r, cx + r, cy + r)), fill=fill)

    def ring(self, cx, cy, r, w, fill=WHITE):
        self.d.ellipse(self.box((cx - r, cy - r, cx + r, cy + r)), outline=fill, width=int(self.p(w)))

    def ell_b(self, b, fill=WHITE):
        self.d.ellipse(self.box(b), fill=fill)

    def poly(self, pts, fill=WHITE):
        self.d.polygon([(self.p(x), self.p(y)) for x, y in pts], fill=fill)

    def line(self, pts, w, fill=WHITE):
        px = [(self.p(x), self.p(y)) for x, y in pts]
        self.d.line(px, fill=fill, width=int(self.p(w)), joint="curve")
        for x, y in (px[0], px[-1]):
            r = self.p(w) / 2
            self.d.ellipse((x - r, y - r, x + r, y + r), fill=fill)

    def arc(self, cx, cy, r, a0, a1, w, fill=WHITE):
        self.d.arc(self.box((cx - r, cy - r, cx + r, cy + r)), a0, a1, fill=fill, width=int(self.p(w)))

    def text(self, cx, cy, s, size, fill=WHITE):
        f = ImageFont.truetype(FONT, int(self.p(size)))
        self.d.text((self.p(cx), self.p(cy)), s, font=f, fill=fill, anchor="mm")

    def star(self, cx, cy, ro, ri, n=5, fill=WHITE, rot=-90):
        pts = []
        for i in range(n * 2):
            r = ro if i % 2 == 0 else ri
            a = math.radians(rot + i * 180 / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        self.poly(pts, fill)


# ---------------------------------------------------------------- glifos

def g_ok(g):
    g.line([(28, 52), (44, 67), (74, 34)], 11)

def g_error(g):
    g.line([(32, 32), (68, 68)], 11)
    g.line([(68, 32), (32, 68)], 11)

def g_warn(g):
    tri = [(50, 24), (79, 74), (21, 74)]
    g.poly(tri)
    g.line(tri + [tri[0], tri[1]], 9)
    g.line([(50, 40), (50, 56)], 7, CUT)
    g.ell(50, 66, 4.2, CUT)

def g_info(g):
    g.ell(50, 30, 6.5)
    g.rect((43.5, 42, 56.5, 74), r=5)

def g_lock(g):
    g.arc(50, 44, 16, 180, 360, 9)
    g.line([(34, 44), (34, 50)], 9); g.line([(66, 44), (66, 50)], 9)
    g.rect((26, 46, 74, 80), r=9)
    g.ell(50, 60, 5, CUT)
    g.rect((47.5, 60, 52.5, 70), r=2, fill=CUT)

def g_unlock(g):
    g.arc(50, 34, 16, 180, 360, 9)
    g.line([(34, 34), (34, 50)], 9)
    g.line([(66, 34), (66, 40)], 9)
    g.rect((26, 46, 74, 80), r=9)
    g.ell(50, 60, 5, CUT)
    g.rect((47.5, 60, 52.5, 70), r=2, fill=CUT)

def g_ban(g):
    g.ring(50, 50, 27, 9)
    g.line([(31, 69), (69, 31)], 9)

def g_unban(g):
    g.ring(50, 50, 27, 9)
    g.line([(38, 51), (47, 60), (63, 41)], 8)

def g_kick(g):
    g.line([(56, 26), (28, 26), (28, 74), (56, 74)], 8)
    g.line([(44, 50), (74, 50)], 8)
    g.poly([(66, 36), (84, 50), (66, 64)])

def g_timeout(g):
    g.poly([(32, 24), (68, 24), (50, 50)])
    g.poly([(50, 50), (68, 76), (32, 76)])
    g.rect((27, 18, 73, 26), r=4)
    g.rect((27, 74, 73, 82), r=4)

def g_purge(g):
    g.rect((42, 20, 58, 30), r=4)
    g.rect((26, 28, 74, 37), r=4)
    g.poly([(31, 40), (69, 40), (65, 80), (35, 80)])
    for x in (42, 50, 58):
        g.line([(x, 49), (x, 70)], 4, CUT)

def g_clock(g):
    g.ring(50, 50, 28, 8)
    g.line([(50, 50), (50, 33)], 7)
    g.line([(50, 50), (62, 58)], 7)

def g_role(g):
    g.poly([(26, 28), (52, 28), (78, 54), (54, 78), (26, 52)])
    g.ell(40, 40, 5.5, CUT)

def g_nick(g):
    g.poly([(62, 24), (76, 38), (44, 70), (28, 74), (30, 58)])
    g.poly([(30, 58), (44, 70), (24, 78)])
    g.line([(56, 30), (70, 44)], 3.5, CUT)

def g_shield(g):
    g.poly([(50, 20), (76, 29), (76, 50), (66, 64), (50, 80), (34, 64), (24, 50), (24, 29)])
    g.line([(38, 50), (47, 59), (63, 40)], 7, CUT)

def g_coin(g):
    g.ell(50, 50, 29)
    g.text(50, 52, "$", 42, CUT)

def g_wallet(g):
    g.rect((22, 32, 78, 74), r=9)
    g.rect((56, 46, 82, 62), r=7, fill=CUT)
    g.rect((58, 48, 80, 60), r=6)
    g.ell(67, 54, 3.5, CUT)

def g_bank(g):
    g.poly([(50, 20), (80, 38), (20, 38)])
    for x in (28, 45, 62):
        g.rect((x, 44, x + 10, 67), r=3)
    g.rect((20, 71, 80, 80), r=4)

def g_gift(g):
    g.rect((28, 46, 72, 80), r=5)
    g.rect((23, 36, 77, 49), r=5)
    g.rect((46, 36, 54, 80), fill=CUT)
    g.rect((46.5, 36, 53.5, 80))
    g.line([(46, 36), (46, 80)], 1.2, CUT); g.line([(54, 36), (54, 80)], 1.2, CUT)
    g.ring(41, 29, 8, 5); g.ring(59, 29, 8, 5)

def g_work(g):
    g.rect_o((38, 22, 62, 42), r=6, w=6)
    g.rect((22, 36, 78, 76), r=8)
    g.line([(22, 55), (78, 55)], 3, CUT)
    g.rect((44, 50, 56, 61), r=3)

def g_trophy(g):
    g.ring(30, 38, 9, 5); g.ring(70, 38, 9, 5)
    g.poly([(32, 22), (68, 22), (64, 50), (50, 60), (36, 50)])
    g.rect((46, 58, 54, 70))
    g.rect((34, 68, 66, 78), r=4)

def g_pay(g):
    g.line([(26, 36), (68, 36)], 7)
    g.poly([(62, 25), (82, 36), (62, 47)])
    g.line([(32, 64), (74, 64)], 7)
    g.poly([(38, 53), (18, 64), (38, 75)])

def g_deposit(g):
    g.line([(50, 22), (50, 52)], 9)
    g.poly([(32, 46), (68, 46), (50, 66)])
    g.line([(28, 76), (72, 76)], 8)

def g_withdraw(g):
    g.line([(50, 78), (50, 48)], 9)
    g.poly([(32, 54), (68, 54), (50, 34)])
    g.line([(28, 24), (72, 24)], 8)

def g_dice(g):
    g.rect((24, 24, 76, 76), r=12)
    for x, y in ((37, 37), (63, 37), (50, 50), (37, 63), (63, 63)):
        g.ell(x, y, 5, CUT)

def g_slots(g):
    g.text(50, 54, "7", 62)

def g_ping(g):
    for i, top in enumerate((58, 46, 34, 22)):
        x = 21 + i * 15
        g.rect((x, top, x + 10, 78), r=3.5)

def g_help(g):
    g.text(50, 54, "?", 64)

def g_user(g):
    g.ell(50, 36, 13)
    g.ell_b((26, 56, 74, 104))
    g.rect((0, 80, 100, 100), fill=CUT)

def g_server(g):
    for i, y in enumerate((22, 41, 60)):
        g.rect((22, y, 78, y + 16), r=5)
        g.ell(32, y + 8, 3, CUT)
        g.line([(44, y + 8), (68, y + 8)], 3, CUT)

def g_sparkle(g):
    g.poly([(48, 18), (57, 42), (80, 50), (57, 58), (48, 82), (39, 58), (16, 50), (39, 42)])
    g.poly([(74, 16), (78, 26), (88, 30), (78, 34), (74, 44), (70, 34), (60, 30), (70, 26)])

def g_star(g):
    g.star(50, 52, 31, 14)

def g_ticket(g):
    g.rect((20, 32, 80, 68), r=7)
    g.ell(20, 50, 8, CUT); g.ell(80, 50, 8, CUT)
    for y in range(37, 64, 7):
        g.rect((58, y, 62, y + 4), fill=CUT)

def g_calendar(g):
    g.rect((22, 28, 78, 78), r=9)
    g.rect((34, 20, 41, 34), r=3.5)
    g.rect((59, 20, 66, 34), r=3.5)
    g.line([(22, 43), (78, 43)], 3, CUT)
    for x, y in ((36, 55), (50, 55), (64, 55), (36, 67), (50, 67)):
        g.ell(x, y, 3.2, CUT)

def g_heart(g):
    g.ell_b((22, 28, 52, 58)); g.ell_b((48, 28, 78, 58))
    g.poly([(24, 49), (76, 49), (50, 80)])

def g_crown(g):
    g.poly([(22, 34), (38, 52), (50, 28), (62, 52), (78, 34), (72, 68), (28, 68)])
    g.rect((27, 70, 73, 80), r=4)

def g_id(g):
    g.text(50, 52, "ID", 38)

def g_ai(g):
    g.line([(50, 32), (50, 22)], 4)
    g.ell(50, 20, 4.5)
    g.rect((20, 46, 27, 62), r=3); g.rect((73, 46, 80, 62), r=3)
    g.rect((26, 32, 74, 74), r=13)
    g.ell(39, 50, 6, CUT); g.ell(61, 50, 6, CUT)
    g.line([(40, 63), (60, 63)], 3.5, CUT)

def g_config(g):
    g.ell(50, 50, 22)
    for i in range(8):
        a = math.radians(i * 45)
        c, s = math.cos(a), math.sin(a)
        def pt(r, off):
            return (50 + r * c - off * s, 50 + r * s + off * c)
        g.poly([pt(18, -7), pt(32, -5), pt(32, 5), pt(18, 7)])
    g.ell(50, 50, 9, CUT)

def g_log(g):
    g.rect((28, 20, 72, 80), r=7)
    for y, x1 in ((36, 62), (48, 62), (60, 54)):
        g.line([(38, y), (x1, y)], 4.5, CUT)

def g_channel(g):
    g.text(50, 53, "#", 62)

def g_image(g):
    g.rect_o((22, 26, 78, 74), r=7, w=6)
    g.ell(40, 42, 5.5)
    g.poly([(28, 68), (45, 50), (56, 61), (64, 53), (73, 68)])

def g_mail(g):
    g.rect((20, 30, 80, 72), r=8)
    g.line([(22, 36), (50, 57), (78, 36)], 4, CUT)

def g_boost(g):
    g.line([(28, 50), (50, 28), (72, 50)], 10)
    g.line([(28, 74), (50, 52), (72, 74)], 10)

def g_dm(g):
    g_mail(g)


# nome -> (paleta, glifo)
ICONS = {
    "ok": ("green", g_ok), "error": ("red", g_error), "warn": ("amber", g_warn),
    "info": ("blue", g_info), "lock": ("slate", g_lock), "unlock": ("teal", g_unlock),
    "ban": ("red", g_ban), "unban": ("green", g_unban), "kick": ("red", g_kick),
    "timeout": ("amber", g_timeout), "purge": ("red", g_purge), "clock": ("blue", g_clock),
    "role": ("purple", g_role), "nick": ("blue", g_nick), "shield": ("brand", g_shield),
    "coin": ("gold", g_coin), "wallet": ("gold", g_wallet), "bank": ("gold", g_bank),
    "gift": ("brand", g_gift), "work": ("amber", g_work), "trophy": ("gold", g_trophy),
    "pay": ("green", g_pay), "deposit": ("green", g_deposit), "withdraw": ("blue", g_withdraw),
    "dice": ("purple", g_dice), "slots": ("red", g_slots), "ping": ("teal", g_ping),
    "help": ("brand", g_help), "user": ("blue", g_user), "server": ("purple", g_server),
    "sparkle": ("brand", g_sparkle), "star": ("gold", g_star), "ticket": ("purple", g_ticket),
    "calendar": ("blue", g_calendar), "heart": ("brand", g_heart), "crown": ("gold", g_crown),
    "id": ("slate", g_id), "ai": ("brand", g_ai), "config": ("slate", g_config),
    "log": ("slate", g_log), "channel": ("teal", g_channel), "image": ("teal", g_image),
    "mail": ("blue", g_mail), "boost": ("brand", g_boost),
}


def badge_mask():
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle((8, 8, S - 8, S - 8), radius=int(S * 0.26), fill=255)
    return m


def gradient(top, bottom):
    t, b = hex_rgb(top), hex_rgb(bottom)
    col = Image.new("RGBA", (S, S))
    px = col.load()
    for y in range(S):
        f = y / (S - 1)
        c = tuple(int(t[i] + (b[i] - t[i]) * f) for i in range(3)) + (255,)
        for x in range(S):
            px[x, y] = c
    return col


def build(name, palette, glyph_fn):
    top, bottom = PALETTES[palette]
    mask = badge_mask()
    base = gradient(top, bottom)

    # brilho suave no topo
    gloss = Image.new("RGBA", (S, S), CUT)
    ImageDraw.Draw(gloss).ellipse((-S * 0.2, -S * 0.55, S * 1.2, S * 0.5), fill=(255, 255, 255, 46))
    base = Image.alpha_composite(base, gloss)

    g = G()
    glyph_fn(g)
    glyph = g.im

    # sombra do glifo
    shadow = Image.new("RGBA", (S, S), CUT)
    a = glyph.split()[3].point(lambda v: int(v * 0.30))
    shadow.paste((0, 0, 0, 255), mask=a)
    shadow = ImageChops.offset(shadow, 0, int(S * 0.018)).filter(ImageFilter.GaussianBlur(S * 0.012))

    comp = Image.alpha_composite(base, shadow)
    comp = Image.alpha_composite(comp, glyph)

    out = Image.new("RGBA", (S, S), CUT)
    out.paste(comp, mask=mask)
    return out.resize((OUT, OUT), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    imgs = []
    for name, (pal, fn) in ICONS.items():
        im = build(name, pal, fn)
        im.save(os.path.join(OUT_DIR, f"ui_{name}.png"), optimize=True)
        imgs.append((name, im))

    # folha de contato para conferência visual
    cols = 8
    rows = math.ceil(len(imgs) / cols)
    pad = 12
    sheet = Image.new("RGBA", (cols * (OUT + pad) + pad, rows * (OUT + pad) + pad), (32, 34, 37, 255))
    for i, (_, im) in enumerate(imgs):
        sheet.alpha_composite(im, (pad + (i % cols) * (OUT + pad), pad + (i // cols) * (OUT + pad)))
    sheet.save(os.path.join(OUT_DIR, "_preview.png"))
    print(f"{len(imgs)} emojis gerados em {os.path.abspath(OUT_DIR)}")


if __name__ == "__main__":
    main()

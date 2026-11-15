from ursina import *
from panda3d.core import TransparencyAttrib
from pathlib import Path
import math
import random

# ======================================================================
#  CẤU HÌNH
# ======================================================================
SIZE_X, SIZE_Y, SIZE_Z = 8, 8, 3
TOTAL = SIZE_X * SIZE_Y * SIZE_Z
SPACING = 2.2
STEP_TIME = 0.25          # 0.25s / ô  ->  4 ô = 1s
LABEL_SCALE = 18          # kích thước chữ số trong 3D (chỉnh nếu thấy to/nhỏ)
YELLOW_DECOYS = 6         # ô vàng thêm ngẫu nhiên ở BẤT KỲ đâu (kể cả bên trong)
NUMBER_COUNT = 10         # số ô chứa số
MAX_NUMBER = 4            # giá trị lớn nhất của một ô số (1..4)
RETRACE_CHANCE = 0.3      # xác suất mỗi hàng của lời giải mẫu có đi lùi rồi quay lại
                          # (tạo ra các ô bị đi qua nhiều lần -> ô số lớn hơn 1)

# Góc nhìn chuẩn: nhìn từ phía góc trái-dưới-gần, nơi có ô (0,0,0)
DEFAULT_YAW, DEFAULT_PITCH = 35, 22
DEFAULT_DIST = 14 * SPACING
ROTATE_SPEED, ZOOM_STEP = 150, 1.5

# Font .ttf (bold) nằm cùng thư mục với file code này.
# None = tự tìm file .ttf (ưu tiên tên có chữ "bold"); hoặc ghi rõ, ví dụ 'Roboto-Bold.ttf'
FONT_FILE = None


def find_font():
    folder = Path(application.asset_folder)
    fonts = [f for f in folder.iterdir() if f.suffix.lower() == '.ttf']
    fonts.sort(key=lambda f: ('bold' not in f.name.lower(), f.name.lower()))
    return fonts[0].name if fonts else None


# ======================================================================
#  LOGIC TRÒ CHƠI (không phụ thuộc đồ hoạ)
# ======================================================================
def inside(p):
    return 0 <= p[0] < SIZE_X and 0 <= p[1] < SIZE_Y and 0 <= p[2] < SIZE_Z


def add(p, d):
    return (p[0] + d[0], p[1] + d[1], p[2] + d[2])


class Engine:
    def __init__(self, start, yellow, numbers):
        self.start = start
        self.yellow = set(yellow)
        self.init_numbers = dict(numbers)
        self.reset()

    def reset(self):
        self.pos = self.start
        self.visited = {self.start}
        self.numbers = dict(self.init_numbers)
        self.red = set()
        self.history = []

    def plan(self, d):
        path, p = [], self.pos
        while True:
            n = add(p, d)
            if not inside(n) or n in self.red:
                break
            path.append(n)
            p = n
            if n in self.yellow:
                break
        return path

    def apply(self, d):
        path = self.plan(d)
        if not path:
            return None
        rec = {'prev': self.pos, 'path': path, 'new': [], 'nums': []}
        for p in path:
            if p not in self.visited:
                self.visited.add(p)
                rec['new'].append(p)
            if p in self.numbers:
                old = self.numbers[p]
                rec['nums'].append((p, old))
                self.numbers[p] = old - 1
                if old - 1 <= 0:
                    self.red.add(p)
        self.pos = path[-1]
        self.history.append(rec)
        return rec

    def undo(self):
        if not self.history:
            return None
        rec = self.history.pop()
        for p in rec['new']:
            self.visited.discard(p)
        for p, old in rec['nums']:
            self.numbers[p] = old
            self.red.discard(p)
        self.pos = rec['prev']
        return rec

    def progress(self):
        # ô thường: tính khi đã đi qua; ô số: chỉ tính khi đã chuyển đỏ
        normal = sum(1 for p in self.visited if p not in self.init_numbers)
        return normal + len(self.red)

    def complete(self):
        return self.progress() == TOTAL


def walk_to_wall(p, d):
    while inside(add(p, d)):
        p = add(p, d)
    return p


def layer_snake(corner, a):
    """Đi rắn từng hàng trong một tầng. Mỗi hàng có thể đi lùi L ô rồi quay lại:
    ô dừng khi đi lùi là một ô vàng nằm BÊN TRONG hàng, và các ô trên đoạn đó
    bị đi qua nhiều lần (nguồn gốc của các ô số lớn)."""
    b = 1 - a
    size = [SIZE_X, SIZE_Y]
    z = corner[2]
    sa = 1 if corner[a] == 0 else -1
    sb = 1 if corner[b] == 0 else -1
    pos = list(corner)
    moves, yel = [], []
    for r in range(size[b]):
        d = [0, 0, 0]; d[a] = sa
        pos[a] += sa * (size[a] - 1)
        moves.append((tuple(d), (pos[0], pos[1], z)))
        if random.random() < RETRACE_CHANCE:
            L = random.randint(1, size[a] - 1)
            back = [0, 0, 0]; back[a] = -sa
            ypos = list(pos); ypos[a] -= sa * L
            moves.append((tuple(back), (ypos[0], ypos[1], z)))
            if L < size[a] - 1:
                yel.append((ypos[0], ypos[1], z))   # chặn lại giữa hàng
            moves.append((tuple(d), (pos[0], pos[1], z)))
        sa = -sa
        if r < size[b] - 1:
            d = [0, 0, 0]; d[b] = sb
            pos[b] += sb
            moves.append((tuple(d), (pos[0], pos[1], z)))
            yel.append((pos[0], pos[1], z))
    return moves, yel, (pos[0], pos[1], z)


def build_reference():
    # chỉ chọn ô nằm trên 2 mặt nhìn thấy được ở góc nhìn mặc định
    # (mặt trái x=0 và mặt gần y=0, tầng đáy z=0), gồm cả góc (0,0,0)
    boundary = [(x, y, 0) for x in range(SIZE_X) for y in range(SIZE_Y)
                if x == 0 or y == 0]
    start = random.choice(boundary)
    route, yellow = [], set()
    pos = start
    corner_x = start[0] in (0, SIZE_X - 1)
    corner_y = start[1] in (0, SIZE_Y - 1)
    if not (corner_x and corner_y):
        if corner_x:
            d = (0, random.choice([1, -1]), 0)
        else:
            d = (random.choice([1, -1]), 0, 0)
        pos = walk_to_wall(pos, d)
        route.append((d, pos))
    for z in range(SIZE_Z):
        moves, yel, end = layer_snake(pos, random.choice([0, 1]))
        route += moves
        yellow.update(yel)
        pos = end
        if z < SIZE_Z - 1:
            nxt = (end[0], end[1], z + 1)
            route.append(((0, 0, 1), nxt))
            if z + 1 < SIZE_Z - 1:
                yellow.add(nxt)
            pos = nxt
    return start, route, yellow


def replay(start, yellow, numbers, route):
    """Chạy lại lời giải mẫu. Mỗi mục của route là (hướng, ô đích mong muốn).
    Nếu giữa đường có ô vàng chen vào thì bước đó tự tách thành nhiều bước cùng hướng."""
    eng = Engine(start, yellow, numbers)
    for d, expected in route:
        while eng.pos != expected:
            if eng.apply(d) is None:
                return None
    return eng


def generate_puzzle(max_tries=500):
    cells = [(x, y, z) for x in range(SIZE_X) for y in range(SIZE_Y) for z in range(SIZE_Z)]
    for _ in range(max_tries):
        start, route, yellow = build_reference()
        if start in yellow:
            continue
        # ô vàng gây nhiễu: bất kỳ ô nào (kể cả nằm giữa đường đi, khuất bên trong)
        pool = [p for p in cells if p != start and p not in yellow]
        random.shuffle(pool)
        yellow2 = set(yellow) | set(pool[:YELLOW_DECOYS])
        eng = replay(start, yellow2, {}, route)
        if eng is None or not eng.complete():
            continue
        # đếm số lần lời giải mẫu đi vào từng ô
        enter = {}
        for rec in eng.history:
            for p in rec['path']:
                enter[p] = enter.get(p, 0) + 1
        # ô số: bất kỳ ô nào không phải xuất phát/vàng, bị đi qua 1..MAX_NUMBER lần
        rest = [p for p in cells if p != start and p not in yellow2
                and 1 <= enter.get(p, 0) <= MAX_NUMBER]
        random.shuffle(rest)
        chosen = [p for p in rest if enter[p] >= 2][:NUMBER_COUNT // 2]   # ưu tiên số >= 2
        chosen += [p for p in rest if p not in chosen][:NUMBER_COUNT - len(chosen)]
        numbers = {p: enter[p] for p in chosen}     # số = đúng số lần lời giải mẫu đi qua
        eng2 = replay(start, yellow2, numbers, route)
        if eng2 is None or not eng2.complete():
            continue
        return {'start': start, 'yellow': yellow2, 'numbers': numbers,
                'ref_steps': len(eng2.history)}
    raise RuntimeError('không sinh được màn')


# ======================================================================
#  CỬA SỔ + BỐ CỤC GIAO DIỆN
# ======================================================================
app = Ursina()
window.borderless = False
window.size = Vec2(1200, 675)
window.title = '3D Grid'
window.fps_counter.enabled = False
window.exit_button.visible = False
PANEL_BG = color.hex('#06122b')
window.color = PANEL_BG

FONT = FONT_FILE or find_font()
print('font số:', FONT if FONT else 'không tìm thấy .ttf -> dùng font mặc định')

ASPECT = window.size[0] / window.size[1]
HALF_W = ASPECT / 2

# Bảng điều khiển bên phải
PANEL_W = 0.44
PANEL_R = HALF_W - 0.03
PANEL_L = PANEL_R - PANEL_W
PANEL_CX = (PANEL_L + PANEL_R) / 2

# Màn hình đen (viewport 3D) bên trái
VP_L = -HALF_W + 0.03
VP_R = PANEL_L - 0.04
VP_T, VP_B = 0.45, -0.28

# ---------- Màu (mọi ô có opacity 85%) ----------
ALPHA = 217


def cell_color(r, g, b):
    return color.rgba32(r, g, b, ALPHA)


UNVISITED_COLOR = cell_color(160, 175, 200)   # xám: chưa đi (kể cả ô số chưa đỏ)
VISITED_COLOR = cell_color(50, 130, 255)      # xanh dương: đã đi
START_COLOR = cell_color(40, 230, 90)         # xanh lá: xuất phát
YELLOW_COLOR = cell_color(255, 225, 30)       # vàng: ô dừng
RED_COLOR = cell_color(235, 30, 30)           # đỏ: ô bị chặn
EDGE_COLOR = color.rgba32(215, 235, 255, 170)
TRACK_COLOR = color.cyan
CYAN = color.rgba32(0, 220, 255, 255)
BTN_COLOR = color.rgba32(14, 44, 100, 255)
BTN_HL = color.rgba32(30, 90, 190, 255)

# Hướng đi: (tên, vector). Nhìn từ góc nhìn chuẩn:
# i tăng sang phải, j tăng đi vào trong (Tiến), k tăng đi lên.
DIRECTIONS = {
    'Trên': (0, 0, 1), 'Dưới': (0, 0, -1),
    'Trái': (-1, 0, 0), 'Phải': (1, 0, 0),
    'Tiến': (0, 1, 0), 'Lùi': (0, -1, 0),
}
KEYMAP = {
    'left arrow': 'Trái', 'right arrow': 'Phải',
    'up arrow': 'Tiến', 'down arrow': 'Lùi',
    'w': 'Trên', 's': 'Dưới',
}


def to_world(i, j, k):
    return Vec3(i * SPACING, k * SPACING, j * SPACING)


# ======================================================================
#  VIEWPORT 3D (chỉ vẽ 3D trong màn hình đen)
# ======================================================================
def viewport_region():
    return application.base.camNode.get_display_region(0)


def setup_viewport():
    dr = viewport_region()
    dr.set_dimensions(VP_L / ASPECT + 0.5, VP_R / ASPECT + 0.5, VP_B + 0.5, VP_T + 0.5)
    dr.set_clear_color_active(True)
    dr.set_clear_color(Vec4(0, 0, 0, 1))
    dr.set_clear_depth_active(True)


def fit_lens():
    """Giữ đúng tỉ lệ khung hình của màn hình đen (chống méo hình)."""
    a = (VP_R - VP_L) / (VP_T - VP_B)
    lens = application.base.camLens
    lens.set_aspect_ratio(a)
    lens.set_fov(math.degrees(2 * math.atan(a * math.tan(math.radians(40 / 2)))))


def in_viewport():
    return VP_L <= mouse.x <= VP_R and VP_B <= mouse.y <= VP_T


setup_viewport()
fit_lens()


def ui_rect(l, r, b, t, col, z=0):
    return Entity(parent=camera.ui, model='quad', color=col,
                  position=((l + r) / 2, (b + t) / 2, z), scale=(r - l, t - b))


# viền cyan quanh màn hình đen
BORDER = 0.004
ui_rect(VP_L - BORDER, VP_R + BORDER, VP_T, VP_T + BORDER, CYAN)
ui_rect(VP_L - BORDER, VP_R + BORDER, VP_B - BORDER, VP_B, CYAN)
ui_rect(VP_L - BORDER, VP_L, VP_B, VP_T, CYAN)
ui_rect(VP_R, VP_R + BORDER, VP_B, VP_T, CYAN)

# ======================================================================
#  LƯỚI 3D
# ======================================================================
cubes = {}
for i in range(SIZE_X):
    for j in range(SIZE_Y):
        for k in range(SIZE_Z):
            c = Entity(model='cube', color=UNVISITED_COLOR, position=to_world(i, j, k))
            c.setTransparency(TransparencyAttrib.MAlpha)
            c.setDepthWrite(False)
            edge = Entity(parent=c, model='wireframe_cube', color=EDGE_COLOR)
            edge.setTransparency(TransparencyAttrib.MAlpha)
            cubes[(i, j, k)] = c

center = to_world((SIZE_X - 1) / 2, (SIZE_Y - 1) / 2, (SIZE_Z - 1) / 2)
yaw = Entity(position=center)
pitch = Entity(parent=yaw)
camera.parent = pitch
camera.rotation = (0, 0, 0)


def reset_view():
    """Nút Default: về góc nhìn chuẩn (nhìn từ góc trái-dưới-gần, chỗ có ô (0,0,0))."""
    yaw.rotation_y = DEFAULT_YAW
    pitch.rotation_x = DEFAULT_PITCH
    camera.position = (0, 0, -DEFAULT_DIST)


reset_view()

marker = Entity(model='sphere', color=color.orange, scale=0.35)
marker.always_on_top = True

# ======================================================================
#  TRẠNG THÁI TRÒ CHƠI
# ======================================================================
puzzle = None
eng = None
labels = {}            # ô số -> Text (số đỏ)
track_stack = []       # song song với eng.history: các đường track của từng bước
best = None            # số bước ít nhất bạn đã nộp thành công ở màn này
moving = False
finished = False
active_seg = None
orbiting = False
flash_token = 0


def make_label(pos, value):
    kwargs = dict(text=str(value), parent=scene, position=to_world(*pos),
                  billboard=True, origin=(0, 0), scale=LABEL_SCALE, color=color.red)
    if FONT:
        kwargs['font'] = FONT
    t = Text(**kwargs)
    t.setBin('fixed', 0)
    t.setDepthTest(False)
    return t


def cell_visual(p):
    if p in eng.red:
        return RED_COLOR
    if p == eng.start:
        return START_COLOR
    if p in eng.yellow:
        return YELLOW_COLOR
    if p in eng.visited and p not in eng.numbers:
        return VISITED_COLOR
    return UNVISITED_COLOR


def refresh_cell(p):
    cubes[p].color = cell_visual(p)
    if p in labels:
        labels[p].enabled = p not in eng.red
        labels[p].text = str(max(eng.numbers[p], 0))


def clear_tracks():
    for segs in track_stack:
        for e in segs:
            destroy(e)
    track_stack.clear()


def load_puzzle(puz):
    """Nạp (hoặc nạp lại) một màn: đưa mọi thứ về trạng thái ban đầu."""
    global puzzle, eng, moving, finished, active_seg
    puzzle = puz
    eng = Engine(puz['start'], puz['yellow'], puz['numbers'])
    moving, finished, active_seg = False, False, None
    clear_tracks()
    for t in labels.values():
        destroy(t)
    labels.clear()
    for p, v in eng.numbers.items():
        labels[p] = make_label(p, v)
    for p in cubes:
        refresh_cell(p)
    marker.position = to_world(*eng.pos)
    update_stats()


def new_puzzle():
    global best
    best = None
    load_puzzle(generate_puzzle())
    print('màn mới, xuất phát tại', eng.start, '| số bước lời giải mẫu:', puzzle['ref_steps'])


def restart_puzzle():
    load_puzzle(puzzle)      # chơi lại từ đầu, cùng một màn; giữ "Tối ưu"


# ======================================================================
#  THÔNG TIN TRÊN MÀN HÌNH ĐEN
# ======================================================================
stats = Text(text='', position=(VP_L + 0.025, VP_T - 0.025), scale=1.15,
             color=color.rgba32(140, 235, 255, 255))
status = Text(text='', position=(VP_L + 0.025, VP_B + 0.05), scale=1.1,
              color=color.rgba32(255, 210, 90, 255))


def update_stats():
    best_txt = '—' if best is None else str(best)
    stats.text = (f'Tối ưu: {best_txt}\n'
                  f'Số bước: {len(eng.history)}\n'
                  f'Đã hoàn thành: {eng.progress()}/{TOTAL}\n'
                  f'Vị trí: {eng.pos}')


def flash(msg, seconds=1.8):
    global flash_token
    flash_token += 1
    token = flash_token
    status.text = msg

    def clear():
        if token == flash_token:
            status.text = ''
    invoke(clear, delay=seconds)


# ======================================================================
#  HỘP THOẠI XÁC NHẬN
# ======================================================================
class Dialog(Entity):
    def __init__(self):
        super().__init__(parent=camera.ui, enabled=False)
        Entity(parent=self, model='quad', color=color.rgba32(0, 0, 0, 150),
               scale=(ASPECT * 1.3, 1.3), z=-1)
        Entity(parent=self, model='quad', color=CYAN, scale=(0.78, 0.42), z=-2)
        Entity(parent=self, model='quad', color=PANEL_BG, scale=(0.76, 0.40), z=-2.1)
        self.msg = Text(parent=self, text='', origin=(0, 0), position=(0, 0.07), scale=1.3, z=-3)
        self.buttons = [Button(parent=self, text='', scale=(0.26, 0.085), color=BTN_COLOR,
                               highlight_color=BTN_HL) for _ in range(2)]

    def show(self, message, options):
        self.msg.text = message
        xs = [0] if len(options) == 1 else [-0.15, 0.15]
        for n, b in enumerate(self.buttons):
            if n < len(options):
                label, cb = options[n]
                b.enabled = True
                b.text = label
                b.x, b.y, b.z = xs[n], -0.11, -3
                b.on_click = lambda cb=cb: self.pick(cb)
            else:
                b.enabled = False
        self.enabled = True

    def pick(self, cb):
        self.enabled = False
        if cb:
            cb()


dialog = Dialog()


def busy():
    return moving or dialog.enabled or finished


# ======================================================================
#  DI CHUYỂN (animation 0.25s / ô + đường track)
# ======================================================================
def begin_step(p, segs):
    global active_seg
    a = Vec3(marker.position)
    e = Entity(model=Mesh(vertices=[a, a], mode='line', thickness=5), color=TRACK_COLOR)
    e.always_on_top = True
    segs.append(e)
    active_seg = (e, a)
    marker.animate_position(to_world(*p), duration=STEP_TIME, curve=curve.linear)


def end_step(p):
    global active_seg
    b = to_world(*p)
    if active_seg:
        e, a = active_seg
        e.model.vertices = [a, b]
        e.model.generate()
        active_seg = None
    marker.position = b
    refresh_cell(p)


def finish_move():
    global moving
    moving = False
    update_stats()
    if eng.complete():
        flash(f'Đã hoàn thành {TOTAL}/{TOTAL} ô — bấm "Xác nhận hoàn thành"', 4)


def try_move(name):
    """Bấm nút hướng là đi luôn: tới biên, ô vàng, hoặc ngay trước ô đỏ."""
    global moving
    if busy():
        return
    d = DIRECTIONS[name]
    path = eng.plan(d)
    if not path:
        flash('Không thể đi theo hướng này')
        return
    eng.apply(d)                     # cập nhật logic ngay, hiển thị chạy theo animation
    segs = []
    track_stack.append(segs)
    moving = True
    steps = []
    for p in path:
        steps += [Func(begin_step, p, segs), Wait(STEP_TIME), Func(end_step, p)]
    steps.append(Func(finish_move))
    Sequence(*steps).start()


def do_undo():
    if busy():
        return
    rec = eng.undo()
    if rec is None:
        flash('Không còn bước nào để hoàn tác')
        return
    for e in track_stack.pop():
        destroy(e)
    marker.position = to_world(*eng.pos)
    for p in rec['path']:
        refresh_cell(p)
    update_stats()


# ======================================================================
#  CÁC NÚT CHỨC NĂNG
# ======================================================================
def ask_reset():
    if not moving and not dialog.enabled:
        dialog.show('Xác nhận chơi lại từ đầu?', [('Đồng ý', restart_puzzle), ('Huỷ', None)])


def ask_new():
    if not moving and not dialog.enabled:
        dialog.show('Tạo màn mới?', [('Đồng ý', new_puzzle), ('Huỷ', None)])


def ask_submit():
    if not moving and not dialog.enabled and not finished:
        dialog.show('Xác nhận nộp bài?', [('Đồng ý', submit), ('Huỷ', None)])


def keep_optimizing():
    """Chọn "Có": giữ nguyên bàn cờ đã nộp, mở khoá để Undo / thử lại."""
    global finished
    finished = False
    flash('Dùng Undo (hoặc Reset) để thử đường đi ngắn hơn', 4)


def submit():
    global best, finished
    if eng.complete():
        steps = len(eng.history)
        finished = True
        if best is None or steps < best:
            best = steps
        update_stats()
        if steps <= puzzle['ref_steps']:
            dialog.show('Chúc mừng!\nBạn đã đạt được số bước tối ưu.',
                        [('Màn mới', new_puzzle)])
        else:
            dialog.show(f'Hoàn thành trong {steps} bước.\nBạn có muốn tối ưu không?',
                        [('Có', keep_optimizing), ('Không', new_puzzle)])
    else:
        left = sum(1 for p in eng.numbers if p not in eng.red)
        extra = f'\nCòn {left} ô số chưa chuyển đỏ.' if left else ''
        dialog.show(f'Chưa hoàn thành!\nMới hoàn thành {eng.progress()}/{TOTAL} ô.{extra}',
                    [('Tiếp tục', None)])


def ui_button(text, x, y, w, h, cb, col=BTN_COLOR, hl=BTN_HL):
    b = Button(text=text, parent=camera.ui, position=(x, y), scale=(w, h),
               color=col, highlight_color=hl)
    b.on_click = cb
    return b


buttons = []

# 6 nút hướng (giữa bên phải): bấm là đi luôn
BH = 0.115
BW = (PANEL_W - 0.02) / 2
GAP = BW + 0.02
layout = [['Trên', 'Dưới'],
          ['Tiến', 'Lùi'],
          ['Trái', 'Phải']]
for r, row in enumerate(layout):
    for c, name in enumerate(row):
        v = DIRECTIONS[name]
        buttons.append(ui_button(f'{name}\n{v}', PANEL_CX + (c - 0.5) * GAP, 0.28 - r * 0.14,
                                 BW, BH, lambda n=name: try_move(n)))

# 3 nút góc trái dưới
ROW_Y, ROW_H = -0.395, 0.09
cw = (VP_R - VP_L - 0.08) / 3
for n, (label, cb) in enumerate([('Undo', do_undo), ('Reset', ask_reset), ('Default', reset_view)]):
    buttons.append(ui_button(label, VP_L + cw / 2 + n * (cw + 0.04), ROW_Y, cw, ROW_H, cb))

# nút góc phải dưới
buttons.append(ui_button('Xác nhận hoàn thành', PANEL_CX, ROW_Y, PANEL_R - PANEL_L, ROW_H,
                         ask_submit, col=color.rgba32(20, 120, 70, 255),
                         hl=color.rgba32(40, 180, 100, 255)))

Text(text='Xám: chưa đi   Xanh: đã đi\nVàng: dừng   Đỏ: bị chặn\nSố đỏ: đếm ngược về 0',
     position=(PANEL_L, -0.12), scale=0.9, color=color.rgba32(170, 190, 220, 255))

# ======================================================================
#  VÒNG LẶP + PHÍM
# ======================================================================
def update():
    fit_lens()
    if active_seg:
        e, a = active_seg
        e.model.vertices = [a, Vec3(marker.position)]
        e.model.generate()
    if orbiting:
        yaw.rotation_y += mouse.velocity[0] * ROTATE_SPEED
        pitch.rotation_x = clamp(pitch.rotation_x - mouse.velocity[1] * ROTATE_SPEED, -89, 89)


def input(key):
    global orbiting
    if key == 'left mouse down':
        orbiting = (not dialog.enabled) and in_viewport() and mouse.hovered_entity not in buttons
    if key == 'left mouse up':
        orbiting = False
    if dialog.enabled:
        return

    if key in KEYMAP:
        try_move(KEYMAP[key])
    if key in ('backspace', 'z'):
        do_undo()
    if key == 'n':
        ask_new()

    if in_viewport():
        if key == 'scroll up':
            camera.z = min(camera.z + ZOOM_STEP, -6)
        if key == 'scroll down':
            camera.z = max(camera.z - ZOOM_STEP, -70)


new_puzzle()

if __name__ == '__main__':
    app.run()
# Word Racer — asset pack (bóc từ code canvas, không screenshot)

assets/
  assets.json            manifest: rig · part · anchor · z · animation · palette · tuning · sound
  images/parts/*.png      part rời (nền trong suốt, export {scale}×) — ĐÂY là thứ dùng để dựng animation
  images/sprites/*.png    screen/sheet ghép sẵn (tham chiếu, 1 frame tĩnh)
  sounds/*.wav            12 SFX + 2 loop nhạc nền, 44.1kHz mono

## Vòng lặp render chuẩn

    for (const p of rig.parts.sort((a,b)=>a.z-b.z)) {
      const tr = anim(p, t, state);          // {dx, dy, sx, sy, rot, alpha, hidden}
      if (tr.hidden) continue;
      ctx.save();
      ctx.globalAlpha = rigAlpha * (tr.alpha ?? 1);
      ctx.translate(p.anchor.x + (tr.dx || 0), p.anchor.y + (tr.dy || 0));
      ctx.scale(tr.sx ?? 1, tr.sy ?? 1);     // origin "center" → dịch thêm w/2, h/2 trước khi scale
      ctx.drawImage(img[p.id], 0, 0);
      ctx.restore();
    }

Anchor là toạ độ trong KHUNG RIG (không phải trong màn hình). Đặt rig vào world:
  - xe:        (LANE_X[lane] − 24, 246 − 4), lane ease carX += (LANE_X[lane] − carX)·min(1, dt/120)
  - vật cản:   (LANE_X[lane] − 20, y − 4)      y += speed·dt/1000
  - xu:        (LANE_X[lane] − 16, y − 1)
  - khiên:     (LANE_X[lane] − 12, y + 3)      nam châm: (LANE_X[lane] − 12, y − 6)
  - rào boss:  (96, barrier.y − 6)             boss UI: (0, 282)
  - biển làn:  (LANE_X[i] − 45, 30)            HUD: (0, 0)   đường: (0, 0)

## Part có repeat / tint
- barrier_block: 1 tile 24×16 TRẮNG, lặp 12 lần bước 24px, tint xen kẽ #ff3355 / #ffe600.
- hud_life_pip: 1 tile 16×8 trắng, 3 lần, x = 480 − 24·(i+1), tint #ff5b7a (còn) / #3a1420 (mất).
- road_dash: 1 tile 4×26, 2 cột x = 190 & 286, lặp theo y bước 56px, offset = roadScroll mod 56.
- boss_bar_fill: 1 tile 344×8 trắng, scaleX = frac thời gian còn lại, tint theo ngưỡng .5 / .25.
Tất cả part đều tô MÀU PHẲNG → tint bằng shader, không xuất nhiều bản màu.

## Scale & độ nét
Toàn bộ art gốc là pixel/vector vẽ bằng canvas, export ở bất kỳ scale nào đều nét
miễn là bật `ctx.imageSmoothingEnabled = false` (và CSS `image-rendering: pixelated`).

## Ghi chú trung thực về giới hạn tách part
- `star_shape` là MỘT path 10 đỉnh, không có sub-transform trong code → không tách nhỏ hơn được.
- `car_*`: bitmap thân xe là một mảng 8×11 tô cùng 1 màu, trong v2 KHÔNG có transform riêng theo cụm.
  Đã tách theo cụm hình học (mũi / cánh trước / buồng lái / cánh sau / bánh) để đội code có thể thêm
  spin bánh hay nghiêng cánh; các kênh đó ghi rõ "đề xuất", không phải hành vi hiện tại.
- Vật cản 3 biến thể là 3 bitmap khác nhau + 3 màu, không phải 1 rig biến hình → để 3 part loại trừ nhau
  theo cờ `vk`, không gộp.
- Game KHÔNG có particle, screen shake, fog, vignette. Đừng thêm nếu chưa được duyệt.

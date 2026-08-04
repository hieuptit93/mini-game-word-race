# Game Title: Word Racer — Coin Rush (v2)

> Pika · Word Racer v2 "Coin Rush" · Lộ trình Pre-A1 (tune cho A1)
> Cập nhật từ `word_racer_GDD.md` (prototype v0.1) — nguồn: `word_racer.html` hiện hành.
> Đợt v2: giữ nguyên vỏ Pika + curriculum + canvas pixel-art cũ, thay logic bằng bộ mechanics user tự
> làm (coin/shield/magnet/mini-boss/tốc-độ-có-trần/Best), thêm tracking + tune nhịp cho A1.

---

## 1. Game Overview

### 1.1 Game Concept
**Word Racer — Coin Rush** cho bé lái một chiếc xe trên đường 3 làn bằng giọng nói. Mỗi làn mang một
**từ vựng** (cố định trong cả chặng): **nói to từ của làn nào** thì xe lướt sang làn đó. Mục tiêu là
**gom xu (coin)** rải trên đường — nhưng xu thường rơi ở **làn khác** làn xe đang chạy, nên muốn ăn xu
là phải đổi làn = phải nói thêm một từ. Trên đường còn có **khiên** (đỡ 1 va chạm) và **nam châm** (tự
hút xu). Thỉnh thoảng một **rào khổng lồ (mini-boss)** chặn cả 3 làn, không né được — phải **nói cả một
câu** trước khi hết giờ để phá (+15 xu). Game **khởi đầu chậm** (phù hợp bé mới bắt đầu) và **nhanh dần
rất nhẹ theo thời gian**, có trần — không bao giờ tới mức không chơi được.

### 1.2 Genre
Endless runner / lane-switcher giáo dục, điều khiển hoàn toàn bằng giọng nói. Reward loop kiểu
Subway Surfers/Temple Run (coin trail), nhưng coin được đặt để **phục vụ learning loop** (mỗi xu = một
lần phát âm) chứ không tách rời.

### 1.3 Đối tượng người chơi
Trẻ em học tiếng Anh trình độ Pre-A1 → A1, đã đọc được từ đơn. Nhịp v2 được tune riêng cho A1 (bé mới
bắt đầu): chậm, ít dồn dập, mini-boss muộn và nới thời gian.

### 1.4 Nền tảng
Web (HTML5 Canvas, một file `.html` tự chứa, không asset ngoài). Bắt buộc Web Speech API
(Chrome/Edge desktop) + Internet.

### 1.5 Mục tiêu giáo dục
- **Nói từ đơn** (LM06): mỗi lần đổi làn gắn với một từ. **Đặc trưng riêng của Racer**: 3 từ của chặng
  **lặp lại nhiều lần** trong suốt chặng → spaced repetition tự nhiên ngay trong nhịp chơi (khác các
  game "mỗi từ nói một lần").
- **Ghép câu:** phá mini-boss bằng câu hoàn chỉnh (pattern chủ đề + một cụm từ).
- **Nguyên tắc thiết kế xuyên suốt:** mọi mechanic vui thêm vào (xu, khiên, nam châm, mini-boss) phải
  khiến bé **nói nhiều hơn**, không thay thế việc nói — được đo bằng **speech-per-minute** ngay trên trang.

---

## 2. Gameplay

### 2.1 Core loop
1. Vào chặng mới → 3 từ đầu của chủ đề gán cố định lên biển 3 làn.
2. Vật cản, **xu**, và vật phẩm (khiên/nam châm) trôi từ trên xuống theo làn.
3. Bé **nói từ của làn** để lái xe: né vật cản ở làn đang chạy, và sang làn có xu để gom (xu thường ở
   làn khác → chủ động đổi làn = nói thêm).
4. Đi qua xu/khiên/nam châm ở đúng làn → tự nhặt. Đâm vật cản → mất 1 mạng (khiên đỡ được 1 lần).
5. Sau **9–11 đợt** → **mini-boss**: rào chặn cả 3 làn + đồng hồ đếm ngược ~6.5s + câu cần nói. Nói
   đúng câu → phá (+15 xu), sang chặng mới (chủ đề mới). Hết giờ → mất 1 mạng nhưng **vẫn sang chặng
   mới** (thất bại mềm, tránh kẹt nhịp).
6. Hết 3 mạng → Game Over + bảng xếp hạng.

### 2.2 Điều khiển
Chỉ bằng giọng nói (nút ⭐ để bắt đầu/chơi lại). Nói tên từ trên biển làn để đổi làn; nói cả câu để phá
mini-boss.

### 2.3 Cơ chế chính

**3 làn = 3 từ (cố định trong chặng)**
- Mỗi làn gắn một từ trong 3 từ đầu của chủ đề, **giữ nguyên cả chặng** → cùng bộ từ lặp lại nhiều lần
  (identity học tập riêng của Racer). Khớp bằng `laneMatch` (dò `core` của từ làn khác trong transcript).
- `MATCH_LOCK_MS=420`: khoá 420ms sau mỗi lần khớp để interim + final của cùng một câu nói không bắn 2 lần.

**Xu rải lệch làn (thước đo điểm chính)**
- Mỗi đợt spawn, xu rơi thành cột ở một làn **trống và ưu tiên KHÁC làn xe đang chạy** → muốn ăn phải
  đổi làn = nói thêm một từ. Mỗi đồng xu gián tiếp là một lần phát âm.
- **Kỷ lục xu** lưu `localStorage` (`pika_wordracer_bestcoins`), giữ qua các lượt/tải lại trang.

**Khiên & nam châm (vật phẩm hiếm)**
- Xuất hiện ở đầu cột xu: **khiên** ~5%/đợt (đỡ miễn phí 1 va chạm), **nam châm** ~7%/đợt (tự hút xu ở
  cả 3 làn trong 5s — `MAGNET_MS`). Nam châm là "nghỉ giải lao có chủ đích", để hiếm nên không làm giảm
  số lần nói.

**Mini-boss (nói cả câu)**
- Rào khổng lồ chặn cả 3 làn, không né được. Panel đáy màn hiện câu + thanh đếm ngược màu (`BARRIER_TIME_MS`
  = 6.5s). Nói đúng câu (`barrierMatch`: token pattern cột D **và** `core` cụm cột E theo thứ tự) → phá,
  +15 xu, sang chặng mới. Hết giờ → mất 1 mạng nhưng vẫn sang chặng mới.

**3 mạng + bất tử ngắn**
- Va chạm mất 1 mạng + `INVINCIBLE_MS=1200` bất tử (xe nhấp nháy) để không mất dồn nhiều mạng liền.

**Tốc độ: chậm → nhanh dần rất nhẹ theo THỜI GIAN (tune A1)**
- `speed() = (BASE_SPEED + SPEED_PER_ROUND×(round−1)) × (1 + min(0.5, runSec/450×0.5))`.
- Khởi đầu chậm (58 px/s), bước tăng mỗi chặng nhỏ (+4), và **nhân tốc độ tăng dần theo thời gian chơi**
  (`+0 → +50%` trải đều trong ~7.5 phút), có trần → không giật cục, không bao giờ tới mức không chơi được.
- Nhịp spawn thưa (1100–2100ms) và **hầu như chỉ 1 vật cản lúc đầu**; xác suất 2 vật cản cùng lúc dày
  lên rất chậm theo thời gian (`min(0.4, runSec/300×0.4)`).

**Feedback khi nói không khớp**
- Near-miss (edit-distance ≤2 với một từ làn khác / câu mini-boss) → hiện "ALMOST! <từ>" + SFX + log
  `near_miss`. Có toggle bật/tắt (mặc định bật); việc *phát hiện & log* vẫn chạy ngầm khi tắt.
- Transcript máy nghe được luôn hiện (`🎤 …`).

### 2.4 Hằng số tune (bảng)

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| `BASE_SPEED` | 58 px/s | Tốc độ vật cản lúc bắt đầu (v1 cũ: 95) |
| `SPEED_PER_ROUND` | +4 px/s | Bước tăng mỗi chặng (v1 cũ: +12) |
| `SPEED_RAMP_MAX` / `SPEED_RAMP_SEC` | +0.5 / 450s | Tăng tốc theo thời gian: +0→+50% trải đều ~7.5 phút |
| `WAVE_MIN` / `WAVE_MAX` | 1100 / 2100 ms | Khoảng cách 2 đợt spawn (thưa hơn v1: 900/1500) |
| `MINIBOSS_EVERY_MIN` / `_RAND` | 9 / 3 | 9–11 đợt → mini-boss (muộn hơn v1: 6–7) |
| `BARRIER_TIME_MS` | 6500 ms | Hạn nói cả câu (nới rộng v1: 4000) |
| `MAX_LIVES` / `INVINCIBLE_MS` | 3 / 1200 ms | Mạng + bất tử sau va chạm |
| `MAGNET_MS` | 5000 ms | Thời lượng hút xu của nam châm |
| `MATCH_LOCK_MS` | 420 ms | Khoá chống interim/final bắn 2 lần |

Chủ đề xoay vòng theo `CURRICULUM` (24 chủ đề Pre-A1, mỗi chủ đề 6 từ + pattern câu).

---

## 3. Hệ thống & luật chơi
- **Điểm & combo:** điểm chạy cộng dần theo tốc độ (dùng cho leaderboard); combo = `min(3, 1+⌊streak/4⌋)`,
  reset khi mất mạng. Vượt vật cản +`6×round×combo`; phá mini-boss +`100×round×combo` điểm **và +15 xu**.
- **Xu** là thước đo điểm chính (nhặt xu +1; phá boss +15).
- **Mạng:** đâm vật cản (không khiên) hoặc hết giờ mini-boss → mất 1 mạng. Khiên đỡ 1 va chạm.
- **Best score & kỷ lục xu:** lưu độc lập `localStorage` (`pika_wordracer_best`, `pika_wordracer_bestcoins`).
- **Leaderboard:** dữ liệu mẫu trong phiên (`MINH AN 4210` … `KHANH VY 1875`) + "BAN (YOU)" theo điểm.

---

## 4. Assessment signal & Tracking (bám `Framework đo lường hiệu quả`)

### 4.1 Thẻ hiển thị trực tiếp trong trang
- **Assessment signal:** Xu (+ kỷ lục) · Điểm/High score · Chặng đạt được · Lần đổi làn (nói từ) · Rào
  phá (nói câu) · Quãng đường · Va chạm/hết giờ rào · Phản xạ phá rào TB.
- **STT & tracking:** Nói trượt (utterance có tiếng nhưng không khớp) · Near-miss · Tự sửa (self-correct)
  · **Nói/phút (speech-per-minute)** — metric bảo vệ learning loop khi thêm mechanics giải trí.
- **Tốc độ & độ vừa sức (mới, cốt lõi cho tinh chỉnh nhịp):**
  - **Tốc độ hiện tại** (px/s, live).
  - **Nhặt được xu %** = xu nhặt ÷ xu đã rơi — bé có bắt kịp không (thấp = quá nhanh).
  - **Biên né trung bình** (giây): khi bé đổi làn khỏi một làn có vật cản đang lao tới, đo còn bao nhiêu
    giây nữa vật cản mới chạm; va chạm = biên 0. Gần 0s = toàn né sát nút / trượt = quá gấp.
  - **Va chạm / phút** = va chạm ÷ phút đã lái. Cao = đang quá khó.
  - *Cách đọc:* coin% thấp + biên né nhỏ + va chạm/phút cao → tốc độ **quá nhanh** so với bé; ngược lại
    biên né lớn + gần như không va chạm → có thể cho nhanh hơn.

### 4.2 Event stream (`Engine.report_result` mô phỏng)
Ghi vào `sessionEvents[]`, xuất ra file qua nút **"⬇︎ Xuất dữ liệu phiên (JSON)"**:

```
session_start   {game_id, session_id, ts}
target_shown    {word_id, type: word|sentence, round, ts}
utterance       {transcript, matched: word_id|null, near_miss: word_id|null, rt_ms, ts}  ← log CẢ khi không match
target_result   {word_id, result: hit, attempts, rt_ms}
reward_event    {kind: coin|shield|magnet, amount}
speed_sample    {speed_px_s, run_sec, round, coins}        ← mỗi 2s: chuỗi tốc độ theo thời gian
life_lost       {round, trigger: obstacle|barrier_timeout, speed_px_s, run_sec}  ← kèm tốc độ lúc chết
game_over       {round, score, currency}
session_end     {duration, words_practiced[], speech_per_min,
                 coin_collect_pct, avg_dodge_margin_s, crashes, play_sec, final_speed_px_s, crashes_per_min}
```

`speed_sample` + `life_lost.speed_px_s` là hai nguồn chính để review **tốc độ ở đúng thời điểm bé gặp
khó**, làm nền cho adaptive-theo-RT sau này (framework §3.2).

### 4.3 Learner model per-word
Tích luỹ cross-session, lưu `localStorage` `pika_learner_word_racer`:

```
{word_id, exposures, first_try_hits, avg_rt, last_rt, last_seen_ts, escape_count, near_miss_count}
```

`word_id` = `core` của từ đơn, hoặc `"S:"+core` cho mục tiêu dạng câu (mini-boss) — tách riêng thống kê
nói-từ và nói-câu.

### 4.4 Toggle & xuất dữ liệu
- Toggle **"Bật feedback near-miss"** (tắt được; việc phát hiện/log vẫn chạy ngầm).
- Nút xuất JSON gộp: `summary` (gồm cả coin_collect_pct / avg_dodge_margin_s / crashes_per_min /
  cur_speed_px_s) + `events` + `learner`; đồng thời gán `window.pikaSession` để inspect qua devtools.

---

## 5. Nghệ thuật & Âm thanh

### 5.1 Trực quan (giữ asset cũ, canvas pixel-art, không sprite ngoài)
- **Giữ nguyên** từ v1: khung device shell (LED, mic meter, nút ⭐), đường đua + vạch làn cuộn, xe
  (`CAR_BMP` bitmap 8×11), 3 loại vật cản (`OBS_BMPS` + `OBS_COLS`), rào sọc đỏ/vàng, `drawStar`, font
  `Press Start 2P` / `Nunito`.
- **Vẽ thêm bằng canvas primitives** (khớp style pixel-art, không nhúng PNG): xu (đồng tròn vàng pulse),
  khiên (hình khiên xanh có chữ thập), nam châm (móng ngựa đỏ). Xe có viền khiên khi đang có shield.
- **Juice:** float text "+1"/"+15 XU", flash trắng khi va chạm/phá rào, thanh đếm ngược màu cho mini-boss,
  nhấp nháy bất tử.

### 5.2 Âm thanh
Procedural Web Audio, không file ngoài. SFX: `swoosh` (đổi làn), `coin`, `powerup` (khiên/nam châm),
`shieldpop`, `pass`, `crash`, `smash` (phá rào), `warn` (mini-boss), `miss` (near-miss), `over`,
`record`, `start`. Nhạc chiptune 16 bước đổi mood **lái xe → mini-boss** (`BASS_DRIVE`/`LEAD_DRIVE` ↔
`BASS_BARR`/`LEAD_BARR`).

---

## 6. Kỹ thuật

### 6.1 Stack
HTML5 + Canvas 2D (480×320) + Web Audio + Web Speech API. Không thư viện ngoài. Voice pipeline
(`getUserMedia` → analyser meter + `SpeechRecognition` continuous/interim/3-alternatives → `onTranscript`)
giữ kiến trúc chung toàn series.

### 6.2 Kiểm thử
Harness headless (Node `vm`): tách `<script>`, stub DOM/canvas/Web Audio/Web Speech, chạy thật vòng
`tick()`/`render()` qua nhiều chặng + luồng voice mô phỏng (đổi làn theo từ, gom xu, phá mini-boss, hết
giờ rào, nhặt khiên, nam châm auto-collect, game over, lưu localStorage). Kết quả sau đợt tune: **0
runtime error**; xác nhận tốc độ đã giảm (~67 px/s so với 95+ cũ), số lượt nói tăng mạnh (dễ thở hơn),
và các số liệu speed-fit (`speed_sample`, `life_lost` kèm tốc độ, coin%, biên né, va chạm/phút) ghi đúng.

---

## 7. Mechanics & dụng ý thiết kế (đồng bộ với section trên trang)

| Mechanic | Dụng ý |
|---|---|
| 3 làn = 3 từ (cố định/chặng) | Lặp cùng bộ từ nhiều lần → nhớ sâu; identity học tập riêng của Racer. |
| Xu rải lệch làn | Muốn ăn xu phải đổi làn = nói thêm một từ; mỗi xu gián tiếp là một lần phát âm (coin-trail phục vụ learning loop). |
| Khiên · nam châm | Spike phần thưởng tạo cao trào; để hiếm nên không làm giảm số lần nói; nam châm là "nghỉ giải lao có chủ đích". |
| Mini-boss (nói cả câu) | Ép luyện câu chứ không chỉ từ đơn; khoảnh khắc anh hùng cuối mỗi chặng. |
| Chậm → nhanh dần nhẹ | Tune cho A1: nhiều thời gian phản ứng lúc đầu, tăng tốc từng chút theo thời gian, không giật cục. |
| Tracking + speed-fit | Đo học được thật + STT có nghe đúng không + **tốc độ có vừa sức không** (coin%, biên né, va chạm/phút, tốc độ lúc chết). |

---

## 8. Thay đổi so với v0.1 (changelog rút gọn)
- Thêm **xu (coin)** thành thước đo điểm chính + **kỷ lục xu** lưu localStorage; xu **rải lệch làn** để
  mỗi xu = một lần nói.
- Thêm **khiên**, **nam châm**, và **Best score** lưu localStorage (v1 không lưu gì qua reload).
- Đổi rào chắn thành **mini-boss có đồng hồ đếm ngược** (nói cả câu trong thời gian giới hạn) + **combo
  streak**.
- **Tune nhịp cho A1:** chậm hẳn lúc đầu, nhanh dần rất nhẹ theo thời gian (không theo chặng), mini-boss
  muộn hơn (6–7 → 9–11 đợt) và nới hạn nói câu (4s → 6.5s), vật cản thưa hơn.
- Thêm **near-miss feedback** (có toggle) + transcript nổi bật hơn.
- Thêm **event stream + learner model + xuất JSON** theo Framework đo lường, gồm nhóm **speed-fit
  tracking** (coin%, biên né, va chạm/phút, `speed_sample`, `life_lost` kèm tốc độ).
- Thêm section **"Mechanics & dụng ý thiết kế"** trên trang.
- Giữ nguyên toàn bộ asset & vỏ Pika cũ (device shell, curriculum, canvas pixel-art).

---

## 9. Danh sách file liên quan
```
word_racer.html                          bản game v2 đầy đủ (self-contained, chạy qua CHOI GAME)
game docs/v2_upgrade_plan.md             plan nâng cấp v2 (mục Word Racer)
game docs/word_racer/word_racer_GDD.md   GDD gốc v0.1 (tham chiếu lịch sử)
game docs/word_racer/assets/             asset gốc v0.1 (curriculum/palette/audio_spec/sprites)
v2 docs/word_racer_v2_GDD.md             tài liệu này
v2 docs/word_maze_v2_GDD.md              GDD v2 game Maze (cùng bộ)
```

# PIKA VOICE GAMES — Event chung (FrontEnd → Firebase)

> File này định nghĩa các event **cả 3 game đều bắn giống hệt nhau**.
> Giá trị cụ thể của từng game nằm ở 3 file riêng:
> `tracking_events_garden.md` · `tracking_events_maze.md` · `tracking_events_racer.md`

**Lưu ý chung**

- Các records cần có `user_id` là ID của user trên backend.
- Chỉ dùng 3 Event Name chuẩn: `screen_view` (màn load), `gesture` (tác động), `screen_time` (thời gian rời màn).
- Mọi `screen_name` dùng prefix `/voice_games/` (VD: `/voice_games/garden`).
- Param `screen_name` lấy trong Firebase, không cần code.
- Số param mỗi event không vượt quá 25.

---

## 1. Master Data cần bổ sung

Theo quy ước ở `Master Data`: gesture mới và widget_type mới phải được định nghĩa trước, thông báo Platform, rồi mới gắn tracking.

### 1.1. Gesture mới

| Gesture | Trigger | Vì sao cần |
|---|---|---|
| `speak` | User nói vào mic và hệ thống nhận được transcript (kể cả không khớp target) | Toàn bộ game điều khiển bằng giọng nói — không gesture nào trong Master Data hiện tại mô tả được hành vi này |

### 1.2. Widget type mới

| Widget Type | Example Trigger |
|---|---|
| `voice_target` | Đối tượng cần nói ra để tương tác (luống hoa, quái, rào chắn) |

### 1.3. Param mới

Master Data **đã có sẵn**: `word_id`, `word`, `sentence`, `action`, `num_word`, `index_item`, `num_item`, `parent` — tái sử dụng được ngay, không cần khai mới.

Cần khai thêm:

| Param | Value | Data type | Description |
|---|---|---|---|
| `game_name` | `word_garden` / `word_maze` / `word_racer` | string | Phân biệt 3 game |
| `tier` | `T1` / `T3` | string | Độ khó ngôn ngữ: `T1` = từ đơn (`banana`), `T3` = câu (`I like a banana.`) |
| `is_matched` | TRUE / FALSE | boolean | Hệ thống có nhận đúng câu nói không |
| `is_review` | TRUE / FALSE | boolean | Từ này đang được ôn lại (không phải từ mới của chủ đề hiện tại) |
| `attempt_index` | {số lần đã thử với target này} | int | Nói lại lần thứ mấy |
| `rt_ms` | {số mili giây} | int | Từ lúc target hiện tới lúc nói khớp |
| `result` | `hit` / `escaped` | string | Kết quả target: nói đúng / để lọt |
| `topic_name` | {tên chủ đề} | string | VD: `fruits`, `animals` |
| `round_index` | {số thứ tự màn} | int | Màn/vườn thứ mấy trong phiên |
| `game_status` | `win` / `fail` / `lose` / `quit` | string | Kết quả **của một màn** (không phải của cả phiên) — xem bảng ngay dưới |

### 1.4. Bốn giá trị của `game_status`

| Giá trị | Khi nào | Sau đó |
|---|---|---|
| `win` | Hoàn thành màn theo luật game | Vào màn mới |
| `fail` | Màn thất bại (hết giờ / mất mạng) nhưng **vẫn còn mạng** | Chơi tiếp — Garden/Maze chơi lại chính màn đó, Racer sang chặng mới |
| `lose` | Mất **mạng cuối cùng** | Kết thúc phiên, sang màn game over |
| `quit` | Tap back/X giữa chừng | Về màn chọn game |

Điều kiện `win` và `fail` cụ thể của từng game — xem file riêng.

**Vì sao tách `fail` khỏi `lose`:** gộp chung thì không phân biệt được "trẻ thua một màn rồi chơi tiếp" với "trẻ hết mạng, phiên kết thúc". Chính tần suất `fail` (và `fail` liên tiếp ở cùng `round_index`) là tín hiệu pace đang gắt quá — mục tiêu phân tích số 1.

---

## 2. S0 — Màn chọn game (entry point)

| Event Name | Trigger | Parameter | Value | Data type | Note |
|---|---|---|---|---|---|
| `screen_view` | Load màn chọn game | `screen_name` | `/voice_games/home` | string | Đo tổng session vào Voice Games |
| `gesture` | User tap chọn 1 game | `screen_name` | `/voice_games/home` | string | Đo game nào được chọn nhiều nhất |
| | | `gesture` | `tap` | string | |
| | | `widget_type` | `item_list` | string | |
| | | `widget_name` | `select_game` | string | |
| | | `game_name` | `word_garden` / `word_maze` / `word_racer` | string | |
| `screen_time` | Rời màn chọn game | `screen_name` | `/voice_games/home` | string | |
| | | `duration_sec` | {số giây} | int | |
| | | `is_proceeded` | TRUE/FALSE | boolean | Có vào game hay thoát ra |

---

## 3. S1 — Trong game (màn chơi chính)

Giá trị `screen_name`, `num_item`, `index_item` — xem file riêng của từng game.

| Event Name | Trigger | Parameter | Value | Data type | Note |
|---|---|---|---|---|---|
| `screen_view` | Màn game load xong, bắt đầu màn/vườn mới | `screen_name` | {xem file game} | string | Đo số màn thực sự chơi |
| | | `game_name` | {tên game} | string | |
| | | `topic_name` | {tên chủ đề} | string | Đo phân bố chủ đề để tránh chơi nhiều nhưng loanh quanh vài topic |
| | | `round_index` | {số thứ tự màn} | int | |
| | | `num_item` | {số target trong màn} | int | {xem file game} |
| `gesture` | **Target hiện ra** cho user | `screen_name` | {tên màn} | string | Mẫu số để tính tỉ lệ nói đúng |
| | | `gesture` | `view` | string | |
| | | `widget_type` | `voice_target` | string | |
| | | `widget_name` | `target_shown` | string | |
| | | `word_id` | {id từ vựng, VD `fruit.banana`} | string | Id ổn định — ghép được dữ liệu 3 game về cùng 1 từ |
| | | `index_item` | {thứ tự target trong màn, 1..`num_item`} | int | Phân biệt 2 target trùng `word_id` trong cùng màn (nếu có) |
| | | `word` | {từ hiển thị} | string | |
| | | `tier` | `T1` / `T3` | string | Đo tỉ lệ đúng ở từ đơn vs câu |
| | | `is_review` | TRUE/FALSE | boolean | Từ mới hay từ đang ôn lại |
| | | `topic_name` | {tên chủ đề} | string | |
| `gesture` | **User nói** (mọi lần nói, kể cả không khớp) | `screen_name` | {tên màn} | string | Nếu chỉ log lúc nói đúng thì không biết được máy có bị miss không |
| | | `gesture` | `speak` | string | |
| | | `widget_type` | `voice_target` | string | |
| | | `word_id` | {id target đang chờ} | string | |
| | | `index_item` | {thứ tự target trong màn, 1..`num_item`} | int | |
| | | `sentence` | {transcript máy nghe được} | string | Input cải thiện ASR |
| | | `is_matched` | TRUE/FALSE | boolean | Theo dõi trẻ nói sai hay máy nghe sai |
| | | `attempt_index` | {lần thử thứ mấy} | int | Phải nói lại mấy lần mới được |
| | | `rt_ms` | {số mili giây} | int | Nói ra nhanh hay chậm |
| | | `tier` | `T1` / `T3` | string | |
| `gesture` | **Kết thúc 1 target** (nói đúng hoặc để lọt) | `screen_name` | {tên màn} | string | Đo tỉ lệ đúng ngay lần đầu |
| | | `gesture` | `view` | string | |
| | | `widget_type` | `voice_target` | string | |
| | | `widget_name` | `target_result` | string | |
| | | `word_id` | {id từ vựng} | string | |
| | | `index_item` | {thứ tự target trong màn, 1..`num_item`} | int | |
| | | `result` | `hit` / `escaped` | string | |
| | | `attempt_index` | {tổng số lần đã thử} | int | |
| | | `rt_ms` | {số mili giây} | int | |
| | | `tier` | `T1` / `T3` | string | |
| `gesture` | User tap nút back/X thoát game giữa chừng | `screen_name` | {tên màn} | string | Đo bỏ ngang ở đâu — guardrail chống frustration |
| | | `gesture` | `tap` | string | |
| | | `widget_type` | `button` | string | |
| | | `widget_name` | `exit_game` | string | |
| | | `round_index` | {màn thứ mấy} | int | |
| `screen_time` | **Kết thúc một màn** — bằng mọi cách: hoàn thành, thất bại, hết mạng, hoặc thoát | `screen_name` | {tên màn} | string | Đo độ dài **một màn** |
| | | `duration_sec` | {số giây} | int | Thời gian của riêng màn vừa kết thúc |
| | | `game_name` | {tên game} | string | |
| | | `round_index` | {màn vừa kết thúc} | int | Cùng giá trị với `screen_view` mở màn đó |
| | | `is_proceeded` | TRUE/FALSE | boolean | Có vào màn tiếp theo không (TRUE khi `win`/`fail`, FALSE khi `lose`/`quit`) |
| | | `game_status` | `win` / `fail` / `lose` / `quit` | string | Điều kiện từng game — xem file riêng |

### 3.1. `screen_view` và `screen_time` đi theo cặp, **mỗi màn một cặp**

Cả 3 game đều chơi liên tục nhiều màn trong cùng một `screen_name` (không có điều hướng màn hình giữa các màn). Quy ước:

- Mỗi màn mới → bắn `screen_view` (mở cặp).
- Màn đó kết thúc → bắn `screen_time` (đóng cặp), kèm `game_status`.
- Cùng một `round_index` cho cả hai event của một cặp.

Một phiên chơi 5 màn thì có 5 `screen_view` + 5 `screen_time` cho `screen_name` đó, với `game_status` lần lượt kiểu `win`, `win`, `fail`, `win`, `lose`.

**Hệ quả khi phân tích:**

| | Cách tính |
|---|---|
| Độ dài **một màn** | `duration_sec` của một event `screen_time` |
| Độ dài **một phiên** | **Tổng** `duration_sec` của các `screen_time` trong phiên — không phải trung bình, không lấy một event lẻ |
| Số màn đã chơi | Đếm event `screen_time` (hoặc `screen_view`) |
| Màn cuối đạt được | `round_index` của event `screen_time` có `game_status` = `lose` hoặc `quit` |

`is_proceeded` suy được thẳng từ `game_status` (TRUE khi `win`/`fail`) nên là param thừa về mặt thông tin — giữ lại chỉ để đúng quy ước Master Data.

---

## 4. S2 — Màn kết thúc (game over)

| Event Name | Trigger | Parameter | Value | Data type | Note |
|---|---|---|---|---|---|
| `screen_view` | Load màn game over | `screen_name` | `/voice_games/game_over` | string | |
| | | `game_name` | {tên game} | string | |
| | | `round_index` | {số màn đạt được} | int | |
| `gesture` | User tap "Chơi lại" | `screen_name` | `/voice_games/game_over` | string | Tỉ lệ tự nguyện chơi lại |
| | | `gesture` | `tap` | string | |
| | | `widget_type` | `button` | string | |
| | | `widget_name` | `replay` | string | |
| | | `game_name` | {tên game} | string | |
| `gesture` | User tap thoát về màn chọn game | `screen_name` | `/voice_games/game_over` | string | |
| | | `gesture` | `tap` | string | |
| | | `widget_type` | `button` | string | |
| | | `widget_name` | `back_to_home` | string | |
| `screen_time` | Rời màn game over | `screen_name` | `/voice_games/game_over` | string | |
| | | `duration_sec` | {số giây} | int | |
| | | `is_proceeded` | TRUE/FALSE | boolean | TRUE nếu chơi lại |

---

## 5. Bảng đối chiếu nhanh 3 game

| | Word Garden | Word Maze | Word Racer |
|---|---|---|---|
| `screen_name` | `/voice_games/garden` | `/voice_games/maze` | `/voice_games/racer` |
| `game_name` | `word_garden` | `word_maze` | `word_racer` |
| `voice_target` lớp **từ** (`T1`) | Luống hoa | Lối rẽ | Làn xe |
| `voice_target` lớp **câu** (`T3`) | Quạ | Quái | Rào chắn |
| `num_item` | **6** (cố định) | Số lối rẽ mở (**1–4**, đổi theo ô) | **3** (cố định) |
| `round_index` là gì | Vườn thứ mấy | Mê cung thứ mấy | Chặng thứ mấy |
| `game_status=win` khi | Nở đủ 6 luống | Tới lồng phô mai, nói câu mở | Phá được rào khổng lồ (mini-boss) |
| `game_status=fail` khi | Quạ mổ xong hoa, hoặc hoàng hôn mà chưa nở đủ | Đụng quái / bị chaser bắt / hết giờ | Hết giờ rào khổng lồ |
| Khi `fail`, `round_index` | **Giữ nguyên** (chơi lại cùng vườn) | **Giữ nguyên** (chơi lại cùng map) | **+1** (sang chặng mới) |

Ba game **giống nhau hoàn toàn** ở: tập event, tên param, `tier` (`T1`/`T3`), `result` (`hit`/`escaped`), `word_id`, bộ 144 từ và 24 chủ đề.

**Khác nhau ở `round_index` khi `fail`** — Racer vẫn +1, Garden/Maze thì không. Đây là điểm dễ đọc nhầm nhất khi so 3 game; xem [`tracking_events_racer.md`](tracking_events_racer.md) mục 3.1.

---

## 6. Note

**Param `sentence`** — mic chạy chế độ `continuous` nên transcript có thể lọt tiếng nền (người lớn nói chuyện gần đó, TV...). Nên chỉ log transcript trong lúc **có target đang chờ**, không log ở màn chờ/menu. Nếu không feasible về kỹ thuật thì có thể skip param này.

# Word Racer — Event riêng

> Đọc `tracking_events_common.md` trước. File này chỉ ghi phần khác biệt của Word Racer.

**Sân chơi:** xe chạy trên 3 làn, mỗi làn gắn một từ cố định suốt chặng — nói từ nào thì chuyển sang làn đó để tránh chướng ngại và ăn xu. Rào chắn xuất hiện theo chu kỳ, chặn ngang đường, phải nói cả câu mới phá.

---

## 1. Giá trị điền vào event chung

| Param | Giá trị |
|---|---|
| `screen_name` | `/voice_games/racer` |
| `game_name` | `word_racer` |
| `num_item` | **3** — luôn 3 làn mỗi chặng |
| `index_item` | 1–3 theo làn (trái→phải) |
| `round_index` | Chặng thứ mấy trong phiên |

## 2. Hai loại `voice_target`

| Loại | `tier` | `index_item` | Ghi chú |
|---|---|---|---|
| Làn xe | `T1` | 1–3 | 3 từ **cố định suốt chặng**, không đổi giữa chừng |
| Rào chắn | `T3` | — | Câu lấy từ **một từ chưa dùng cho làn nào** trong cùng chủ đề |

## 3. `game_status`

| Giá trị | Khi nào | Màn tiếp theo |
|---|---|---|
| `win` | **Nói được cả câu để phá rào khổng lồ (mini-boss)** — đây chính là điểm kết thúc một chặng | Chặng mới, `round_index` +1 |
| `fail` | **Hết giờ rào chắn** mà chưa nói được câu (mất 1 mạng) nhưng vẫn còn mạng | **Sang chặng mới** — `round_index` **vẫn +1** |
| `lose` | Mất **mạng cuối** — đâm chướng ngại hoặc hết giờ rào chắn (bắt đầu phiên có 3 mạng) | Không có — sang màn game over |
| `quit` | Tap back/X giữa chừng | Không có — về màn chọn game |

**Đâm chướng ngại giữa chặng không kết thúc chặng.** Mất 1 mạng nhưng xe chạy tiếp trong cùng chặng, không bắn `screen_time`. Chỉ rào khổng lồ mới đóng chặng — phá được là `win`, hết giờ là `fail`.

## 3.1. Racer khác 2 game kia ở `round_index` khi `fail`

| | Khi `fail` |
|---|---|
| Garden, Maze | Chơi lại **chính màn đó** — `round_index` giữ nguyên |
| **Racer** | **Sang chặng mới** — `round_index` vẫn +1 |

Nên `round_index=5` ở Racer nghĩa là "đã qua 4 chặng" (thắng hay thua đều tính), còn ở Maze có thể là "đang thử map 5 lần thứ 3". **Không cộng thẳng `round_index` giữa 3 game** khi đo "trẻ đi được bao xa"; với Racer phải lọc `game_status=win` nếu muốn đếm số chặng thực sự vượt qua.

## 4. Lưu ý khi phân tích

**`rt_ms` ở Racer chịu áp lực tốc độ.** Rào chắn có deadline cứng và xe chạy nhanh dần theo chặng, nên `rt_ms` không chỉ phản ánh trẻ nhớ từ nhanh hay chậm. Khi phân tích "trẻ phản xạ chậm dần hay nhanh dần", **tách Racer ra** hoặc kiểm soát theo `round_index`.

**`target_shown` của Racer cao hơn hẳn 2 game kia.** Vì 3 từ làn cố định cả chặng, cùng một `word_id` được hiện lại rất nhiều lần trong một chặng. Khi so "số lần gặp 1 từ" giữa các game phải chuẩn hoá theo game, không cộng thẳng.
